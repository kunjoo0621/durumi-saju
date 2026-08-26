"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as PortOne from "@portone/browser-sdk/v2";
import { getPaymentConfig, type CoinPackage } from "@/lib/constants/coins";

// Google Ads 전환 추적 firing.
// gtag.js 자체는 app/layout.tsx 에서 모든 페이지 head 에 로드. 여기선 결제 완료 시점에만 conversion event.
// alreadyCharged(=멱등 재호출)는 firing X — 같은 결제가 두 번 전환 카운트되면 안 됨 (transaction_id 중복 가드와 별개로 클라이언트에서도 차단).
// gtag 미로드(광고 차단 브라우저) / firing 실패는 결제 흐름에 영향 0.
function fireGoogleAdsConversion(orderId: string, value: number, alreadyCharged?: boolean) {
  if (alreadyCharged) return;
  if (typeof window === "undefined") return;
  const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== "function") return;
  try {
    gtag("event", "conversion", {
      send_to: "AW-18186268670/_rXuCOX2yrMcEP7f8d9D",
      value,
      currency: "KRW",
      transaction_id: orderId,
    });
  } catch (err) {
    console.warn("[gtag] conversion fire failed", err);
  }
}

interface UseChargeOptions {
  customerName?: string;
  redirectPath?: string;
  onSuccess: (data: { balance: number; charged: number; bonus: number; alreadyCharged?: boolean }) => void;
  onError?: (message: string) => void;
}

// charge_orders 신구조 server-issued orderId.
// 5/N PR 부터 전체 사용자 사용 (운영자 production 실결제 검증 완료 후 gate 제거).
// intent 실패 시 결제 시작 금지 — fallback 절대 X (우슬기 사고 재발 영역).
async function fetchServerIssuedOrderId(packageId: string): Promise<string> {
  const res = await fetch("/api/coins/charge/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "결제 준비에 실패했습니다.");
  }
  const data = await res.json();
  if (typeof data?.orderId !== "string" || !data.orderId) {
    throw new Error("결제 주문번호를 받지 못했습니다.");
  }
  return data.orderId;
}

export function useCharge({ customerName, redirectPath, onSuccess, onError }: UseChargeOptions) {
  const [charging, setCharging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  // 아래 '반환값 없음' 안내 타이머. 사용자가 그 사이 다시 눌러 새 결제를 시작하면
  // 묵은 타이머가 뒤늦게 터져 진행 중인 시도 위에 에러를 덮어쓴다 — 새 시도 시작 시 취소한다.
  const noResponseTimerRef = useRef<number | null>(null);

  const { storeId, channelKey, isMockPayment } = getPaymentConfig();

  const charge = async (pkg: CoinPackage) => {
    if (charging) return;
    if (noResponseTimerRef.current != null) {
      window.clearTimeout(noResponseTimerRef.current);
      noResponseTimerRef.current = null;
    }
    setCharging(true);
    setError(null);

    // 전체 사용자: 결제 완료 화면(charge-success)을 경유.
    // charge-success가 charge + Google conversion firing 담당 → 여기선 firing 안 함 (중복 방지).
    // whitelist 경로(/coins 계열·yearly·today)만 경유. 그 외 returnTo는 기존 인라인 흐름.
    // 복귀 후 분석 시작은 각 entry 가 담당 (charge-success는 charge+firing+returnTo 까지만).
    const SUCCESS_PAGE_RETURNS = ["/coins", "/teaser", "/yearly", "/yearly/input", "/today", "/today/input", "/marriage", "/marriage/input", "/marriage/teaser", "/wealth", "/wealth/input", "/wealth/teaser", "/career", "/career/input", "/career/teaser"];
    const returnTo = redirectPath || "/coins";
    const viaSuccessPage = SUCCESS_PAGE_RETURNS.includes(returnTo);

    let orderId: string;
    try {
      // 모든 사용자가 서버 발급 orderId 사용 — operator gate 제거 (5/N).
      orderId = await fetchServerIssuedOrderId(pkg.id);
    } catch (err: any) {
      // intent 실패 시 결제 진입 자체를 막음.
      const msg = err?.message || "결제 준비에 실패했습니다.";
      setError(msg);
      onError?.(msg);
      setCharging(false);
      return;
    }

    try {
      if (isMockPayment) {
        if (viaSuccessPage) {
          // mock: charge-success가 charge + firing 담당.
          router.push(
            `/coins/charge-success?mock=1&chargeOrderId=${encodeURIComponent(orderId)}&packageId=${pkg.id}&amount=${pkg.price}&returnTo=${encodeURIComponent(returnTo)}`
          );
          return;
        }
        const res = await fetch("/api/coins/charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId: pkg.id,
            orderId,
            amount: pkg.price,
            paymentStatus: "success",
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "충전에 실패했습니다.");
        }
        const data = await res.json();
        fireGoogleAdsConversion(orderId, pkg.price, data?.alreadyCharged);
        onSuccess(data);
        return;
      }

      // 실결제: PortOne. viaSuccessPage면 redirect 복귀지를 charge-success로.
      const redirectUrl = viaSuccessPage
        ? `${window.location.origin}/coins/charge-success?returnTo=${encodeURIComponent(returnTo)}&chargeOrderId=${encodeURIComponent(orderId)}&packageId=${pkg.id}&amount=${pkg.price}`
        : `${window.location.origin}${returnTo}?chargeOrderId=${encodeURIComponent(orderId)}&packageId=${pkg.id}&amount=${pkg.price}`;

      const response = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId: orderId,
        orderName: `사주 이용권 - ${pkg.label}`,
        totalAmount: pkg.price,
        currency: "CURRENCY_KRW",
        payMethod: "EASY_PAY",
        customer: { fullName: customerName || "두루미" },
        redirectUrl,
      });

      // ★반환값 없음 — 방어적 카나리아. "자주 일어나는 일"이 아니다.
      //
      // 2026-08-26 에 cdn.portone.io/v2/browser-sdk.js 원본을 읽어 확인한 사실:
      //   requestPayment → prepare 내부의 paymentResult 프라미스는 모든 해소 경로에서
      //   **객체로 resolve** 한다(onTransactionOver·onTransactionFail·onForceClose 전부).
      //   undefined 로 resolve 하는 경로는 없다. 대신 `forceRedirect === true` 일 때만
      //   결과를 URL 로 실어 window.location.href 로 보내고 프라미스를 영영 안 끝낸다.
      //   우리는 forceRedirect 를 쓰지 않는다. 모바일은 loadPageDriver 가
      //   onAfterPrepare 에서 곧장 window.location.href 로 떠나므로 이 아래가 실행되지 않는다.
      //   → 타입의 `| undefined` 는 "이동해서 resolve 되지 않음"을 TS 로 표현 못 해 붙은 것.
      //
      // 그래도 남겨두는 이유: 여기 도달하면 SDK 동작이 우리가 아는 것과 달라졌다는 뜻이다.
      // 기존 코드는 그 상황에서 아무 메시지도 로그도 없이 조용히 끝났고(코인 시스템 최초
      // 커밋부터), 사용자는 버튼만 다시 눌리는 화면을 봤다. pending row 는 이미 생성된 뒤다.
      // 그래서 계측을 남기고, 2초 뒤에도 페이지가 살아 있을 때만 안내한다.
      // 페이지가 떠나면 타이머는 실행되지 않으므로 정상 흐름 영향은 0이다.
      //
      // ⚠️이 경로가 READY 반복(3분에 7번)의 원인이라는 근거는 없다. 그건 별건이다.
      if (!response) {
        try {
          const payload = JSON.stringify({ orderId, event: "requestPayment_no_response" });
          // sendBeacon 은 페이지가 떠나는 중에도 전송을 보장한다. 없으면 fetch 로 폴백.
          if (typeof navigator !== "undefined" && navigator.sendBeacon) {
            navigator.sendBeacon("/api/coins/charge/client-event", new Blob([payload], { type: "application/json" }));
          } else {
            void fetch("/api/coins/charge/client-event", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: payload,
              keepalive: true,
            }).catch(() => {});
          }
        } catch {
          // 계측 실패가 결제 흐름을 막으면 안 된다.
        }
        noResponseTimerRef.current = window.setTimeout(() => {
          noResponseTimerRef.current = null;
          const msg = "결제창이 열리지 않았어요. 다시 시도해보고, 계속 안 되면 다른 브라우저에서 열어주세요.";
          setError(msg);
          onError?.(msg);
        }, 2000);
        return;
      }
      if (response.code != null) {
        throw new Error(response.message || "결제가 취소되었습니다.");
      }

      if (viaSuccessPage) {
        // popup 흐름: charge-success가 charge + firing 담당.
        router.push(
          `/coins/charge-success?chargeOrderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(response.paymentId ?? orderId)}&packageId=${pkg.id}&amount=${pkg.price}&returnTo=${encodeURIComponent(returnTo)}`
        );
        return;
      }

      const res = await fetch("/api/coins/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: pkg.id,
          orderId,
          paymentId: response.paymentId,
          amount: pkg.price,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "충전 검증에 실패했습니다.");
      }
      const data = await res.json();
      fireGoogleAdsConversion(orderId, pkg.price, data?.alreadyCharged);
      onSuccess(data);
    } catch (err: any) {
      const raw = err?.message || "";
      const msg =
        /load failed|failed to fetch|networkerror|script error/i.test(raw)
          ? "결제 모듈을 불러오지 못했어요. 네트워크 연결을 확인하고 다시 시도해주세요."
          : raw || "충전에 실패했습니다.";
      setError(msg);
      onError?.(msg);
    } finally {
      setCharging(false);
    }
  };

  return { charge, charging, error, setError };
}
