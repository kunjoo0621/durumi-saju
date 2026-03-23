"use client";

import { useState } from "react";
import * as PortOne from "@portone/browser-sdk/v2";
import { getPaymentConfig, type CoinPackage } from "@/lib/constants/coins";

interface UseChargeOptions {
  customerName?: string;
  onSuccess: (data: { balance: number; charged: number; bonus: number }) => void;
  onError?: (message: string) => void;
}

export function useCharge({ customerName, onSuccess, onError }: UseChargeOptions) {
  const [charging, setCharging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { storeId, channelKey, isMockPayment } = getPaymentConfig();

  const charge = async (pkg: CoinPackage) => {
    if (charging) return;
    setCharging(true);
    setError(null);

    const orderId = window.crypto?.randomUUID?.() || `charge_${Date.now()}`;

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
        redirectUrl: `${window.location.origin}/coins?chargeOrderId=${encodeURIComponent(orderId)}&packageId=${pkg.id}&amount=${pkg.price}`,
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
