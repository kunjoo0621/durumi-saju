"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import * as PortOne from "@portone/browser-sdk/v2";
import { getPaymentConfig, type CoinPackage } from "@/lib/constants/coins";
import { isOperator } from "@/lib/constants/operator";

interface UseChargeOptions {
  customerName?: string;
  redirectPath?: string;
  onSuccess: (data: { balance: number; charged: number; bonus: number; alreadyCharged?: boolean }) => void;
  onError?: (message: string) => void;
}

// charge_orders 신구조 1차 검증 단계: 운영자만 server-issued orderId 사용.
// 일반 사용자는 기존 client-side randomUUID 흐름 유지 (우슬기 사고 재발 가능 영역).
// 검증 후 전체 전환은 후속 PR.
async function fetchServerIssuedOrderId(packageId: string): Promise<string> {
  const res = await fetch("/api/coins/charge/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // intent 실패 → 결제 시작 금지. fallback 절대 X.
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
  const { data: session } = useSession();

  const { storeId, channelKey, isMockPayment } = getPaymentConfig();

  const charge = async (pkg: CoinPackage) => {
    if (charging) return;
    setCharging(true);
    setError(null);

    const supabaseId = (session?.user as { supabaseId?: string } | undefined)?.supabaseId;
    const useServerIssuedOrderId = isOperator(supabaseId);

    let orderId: string;
    try {
      orderId = useServerIssuedOrderId
        ? await fetchServerIssuedOrderId(pkg.id)
        : window.crypto?.randomUUID?.() || `charge_${Date.now()}`;
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
        onSuccess(data);
        return;
      }

      // 실결제: PortOne
      const response = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId: orderId,
        orderName: `사주 이용권 - ${pkg.label}`,
        totalAmount: pkg.price,
        currency: "CURRENCY_KRW",
        payMethod: "EASY_PAY",
        customer: { fullName: customerName || "두루미" },
        redirectUrl: `${window.location.origin}${redirectPath || "/coins"}?chargeOrderId=${encodeURIComponent(orderId)}&packageId=${pkg.id}&amount=${pkg.price}`,
      });

      if (!response) return;
      if (response.code != null) {
        throw new Error(response.message || "결제가 취소되었습니다.");
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
