"use client";

import { useState } from "react";
import * as PortOne from "@portone/browser-sdk/v2";
import { getPaymentConfig, type CoinPackage } from "@/lib/constants/coins";

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

  const { storeId, channelKey, isMockPayment } = getPaymentConfig();

  const charge = async (pkg: CoinPackage) => {
    if (charging) return;
    setCharging(true);
    setError(null);

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
