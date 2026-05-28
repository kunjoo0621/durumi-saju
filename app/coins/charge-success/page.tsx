"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Egg, CheckCircle } from "@phosphor-icons/react";
import { FullScreenLoading } from "@/components/loading";

// 결제 완료 페이지 (PR-1, 운영자 한정).
//
// 책임 (하이브리드 — 분석은 entry가, 여기선 충전·광고·완료화면만):
//   1. 결제 파라미터 확인 (취소/실패면 charge·firing 안 함)
//   2. /api/coins/charge 1회 호출 (멱등)
//   3. 충전 성공 + alreadyCharged=false 일 때만 Google conversion firing (페이지 로드 방식, 표준)
//   4. "결제 완료" 화면 + 충전된 알 표시
//   5. 버튼 클릭 → returnTo(whitelist)로 복귀. 분석은 entry 페이지가 afterChargeAction 보고 실행.
//
// firing은 여기 한 곳만 책임 (useCharge의 기존 firing은 운영자 경로에서 호출 안 함 — 중복 방지).

const AD_SEND_TO = "AW-18186268670/_rXuCOX2yrMcEP7f8d9D";

// open redirect 방지 — 허용된 entry 복귀 경로만.
const RETURN_WHITELIST = ["/coins", "/teaser", "/yearly", "/today", "/today/input"];

const RETURN_LABEL: Record<string, string> = {
  "/coins": "확인",
  "/teaser": "결과 보기",
  "/yearly": "올해 운세 보기",
  "/today": "오늘 운세 보기",
  "/today/input": "오늘 운세 보기",
};

function fireConversion(orderId: string, value: number) {
  if (typeof window === "undefined") return;
  const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== "function") return;
  try {
    gtag("event", "conversion", {
      send_to: AD_SEND_TO,
      value,
      currency: "KRW",
      transaction_id: orderId,
    });
  } catch (err) {
    console.warn("[charge-success] gtag fire failed", err);
  }
}

function ChargeSuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const ranRef = useRef(false);
  const [state, setState] = useState<"processing" | "done" | "error">("processing");
  const [charged, setCharged] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  // 버튼 텍스트: 사주/배틀(pendingSpend 있음)이면 "결과 보기" 계열, 단순충전이면 "확인".
  const [buttonLabel, setButtonLabel] = useState("확인");

  const orderId = params.get("chargeOrderId") || params.get("orderId");
  const packageId = params.get("packageId");
  const amount = params.get("amount");
  const paymentId = params.get("paymentId");
  const isMock = params.get("mock") === "1";
  const code = params.get("code"); // PortOne 취소/실패 코드

  const rawReturnTo = params.get("returnTo") || "/coins";
  const returnTo = RETURN_WHITELIST.includes(rawReturnTo) ? rawReturnTo : "/coins";

  useEffect(() => {
    // 중복 실행 방지 (StrictMode 이중 마운트·새로고침 대비)
    if (ranRef.current) return;
    ranRef.current = true;

    // 결제 취소/실패 → charge 안 함, firing 안 함
    if (code) {
      setState("error");
      setErrorMsg(params.get("message") || "결제가 취소되었어.");
      return;
    }

    // 직접 접근 등 필수 파라미터 없음 → /coins
    if (!orderId || !packageId || !amount) {
      router.replace("/coins");
      return;
    }

    // 버튼 텍스트 맥락 결정 (pendingSpend의 type 기반)
    try {
      const pending = sessionStorage.getItem("pendingSpend");
      if (pending) {
        const type = (JSON.parse(pending) as { type?: string })?.type;
        setButtonLabel(type === "battle" ? "대결 결과 보기" : "사주 결과 보기");
      } else {
        setButtonLabel(RETURN_LABEL[returnTo] ?? "확인");
      }
    } catch {
      setButtonLabel(RETURN_LABEL[returnTo] ?? "확인");
    }

    const run = async () => {
      try {
        const res = await fetch("/api/coins/charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId,
            orderId,
            paymentId: paymentId || orderId,
            amount: Number(amount),
            ...(isMock ? { paymentStatus: "success" } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "충전에 실패했어.");

        // firing — alreadyCharged(멱등 재호출)면 발동 안 함 (중복 전환 방지)
        if (!data.alreadyCharged) {
          fireConversion(orderId, Number(amount));
        }
        setCharged(data.charged ?? 0);
        setBonus(data.bonus ?? 0);
        setState("done");
      } catch (err: any) {
        setState("error");
        setErrorMsg(err?.message || "충전 처리 중 오류가 발생했어.");
      }
    };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinue = () => {
    // 사주/배틀: pendingSpend가 있으면 /coins로 chargeOrderId 전달 → /coins가 기존 로직으로
    //   charge(멱등 no-op, 이미 충전됨) + spend + 결과 페이지 이동. 분석 로직 복제 안 함.
    // 단순충전: pendingSpend 없으면 그냥 /coins (잔액만, 이미 충전 완료).
    const hasPending = typeof window !== "undefined" && !!sessionStorage.getItem("pendingSpend");
    if (returnTo === "/coins" && hasPending && orderId && packageId && amount) {
      // charged=1: 이미 여기서 충전 완료 → /coins는 charge 재호출 말고 spend만.
      router.replace(
        `/coins?chargeOrderId=${encodeURIComponent(orderId)}&packageId=${encodeURIComponent(packageId)}&amount=${encodeURIComponent(amount)}&charged=1`
      );
    } else {
      router.replace(returnTo);
    }
  };

  if (state === "processing") {
    return <FullScreenLoading message="결제 확인 중..." />;
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center px-5">
        <div className="max-w-[420px] w-full text-center">
          <p className="text-body-2 text-text-secondary mb-6">{errorMsg}</p>
          <button
            onClick={() => router.replace(returnTo)}
            className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center px-5">
      <div className="max-w-[420px] w-full text-center">
        <div className="flex justify-center mb-5">
          <CheckCircle size={64} weight="fill" className="text-[rgb(var(--c-brand))]" />
        </div>
        <h1 className="text-[22px] font-bold text-text-primary mb-3">결제 완료</h1>
        <p className="flex items-center justify-center gap-1.5 text-[16px] text-text-secondary mb-10">
          <Egg size={18} weight="fill" />
          <span>
            {charged}알{bonus > 0 ? ` + 보너스 ${bonus}알` : ""} 충전됐어
          </span>
        </p>
        <button
          onClick={handleContinue}
          className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

export default function ChargeSuccessPage() {
  return (
    <Suspense fallback={<FullScreenLoading message="화면 로딩 중..." />}>
      <ChargeSuccessInner />
    </Suspense>
  );
}
