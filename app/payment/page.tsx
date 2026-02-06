"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Script from "next/script";
import MenuDrawer from "../MenuDrawer";

// 로딩 컴포넌트
function PaymentLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-text-secondary">결제 페이지 로딩 중...</p>
    </div>
  );
}

// 메인 결제 컴포넌트
function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [returnTo, setReturnTo] = useState<string | null>(null);

  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string>("");
  const [widgets, setWidgets] = useState<any>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  const paymentKey = searchParams?.get("paymentKey");
  const orderIdParam = searchParams?.get("orderId");
  const amountParam = searchParams?.get("amount");
  const returnToParam = searchParams?.get("returnTo");
  const sessionIdParam = searchParams?.get("sessionId");
  const clientKey = process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;
  const mockPayment = process.env.NEXT_PUBLIC_USE_MOCK_PAYMENT === "true";
  const amount = 1000;

  const handlePay = async () => {
    if (!sessionIdParam) {
      router.push("/checkout");
      return;
    }

    if (!mockPayment && !widgets) {
      setError("결제 위젯을 준비 중입니다. 잠시만 기다려주세요.");
      return;
    }

    let safeOrderId = orderId;
    if (!safeOrderId) {
      const generated = window.crypto?.randomUUID?.() || `order_${Date.now()}`;
      sessionStorage.setItem("sajuOrderId", generated);
      setOrderId(generated);
      safeOrderId = generated;
    }

    setPaying(true);
    setError(null);

    try {
      if (mockPayment) {
        const res = await fetch("/api/payment/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdParam,
            paymentMethod: "mock",
            orderId: safeOrderId,
            amount,
            paymentStatus: "success",
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "결제 처리에 실패했습니다.");
        }

        sessionStorage.setItem("sajuJustPaid", "1");
        sessionStorage.removeItem("sajuOrderId");
        const target = returnTo && returnTo.startsWith("/") ? returnTo : "/result";
        router.push(target);
        return;
      }

      const origin = window.location.origin;
      const successUrl = `${origin}/payment?returnTo=${encodeURIComponent(
        returnTo && returnTo.startsWith("/") ? returnTo : "/result"
      )}&sessionId=${encodeURIComponent(sessionIdParam)}`;
      const failUrl = `${origin}/checkout?error=payment`;

      await widgets.requestPayment({
        orderId: safeOrderId,
        orderName: "사주 전체 결과",
        successUrl,
        failUrl,
        customerName: session?.user?.name || "두루미",
      });
    } catch (err: any) {
      setError(err?.message || "결제창 호출에 실패했습니다.");
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      const callback = `/payment?returnTo=${encodeURIComponent(
        returnToParam && returnToParam.startsWith("/") ? returnToParam : "/result"
      )}${sessionIdParam ? `&sessionId=${encodeURIComponent(sessionIdParam)}` : ""}`;
      signIn("kakao", { callbackUrl: callback });
    }
  }, [status, returnToParam, sessionIdParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReturnTo(returnToParam);
    if (!sessionIdParam) {
      router.replace("/checkout");
      return;
    }
    const stored = sessionStorage.getItem("sajuOrderId");
    if (stored) {
      setOrderId(stored);
      return;
    }
    const generated = window.crypto?.randomUUID?.() || `order_${Date.now()}`;
    sessionStorage.setItem("sajuOrderId", generated);
    setOrderId(generated);
  }, [returnToParam, sessionIdParam, router]);

  useEffect(() => {
    if (mockPayment) return;
    if (!sdkReady || !clientKey || paymentKey) return;
    if (!window || !(window as any).TossPayments) return;

    const init = async () => {
      try {
        const tossPayments = (window as any).TossPayments(clientKey);
        const userId = (session?.user as { id?: string })?.id;
        const customerKey = userId ? `user_${userId}` : `guest_${orderId}`;
        const nextWidgets = tossPayments.widgets({ customerKey });
        await nextWidgets.setAmount({ currency: "KRW", value: amount });
        await nextWidgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" });
        await nextWidgets.renderAgreement({ selector: "#payment-agreement" });
        setWidgets(nextWidgets);
        setWidgetReady(true);
      } catch (err: any) {
        setError(err?.message || "결제 위젯 초기화에 실패했습니다.");
      }
    };

    init();
  }, [sdkReady, clientKey, paymentKey, session?.user, orderId, mockPayment]);

  useEffect(() => {
    if (mockPayment) return;
    if (!paymentKey || !orderIdParam || !amountParam || !sessionIdParam) return;
    if (confirming) return;
    const run = async () => {
      setConfirming(true);
      setError(null);
      try {
        const res = await fetch("/api/payment/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdParam,
            paymentKey,
            orderId: orderIdParam,
            amount: Number(amountParam),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "결제 확인에 실패했습니다.");
        }

        sessionStorage.setItem("sajuJustPaid", "1");
        sessionStorage.removeItem("sajuOrderId");
        const target = returnToParam && returnToParam.startsWith("/") ? returnToParam : "/result";
        router.replace(target);
      } catch (err: any) {
        setError(err?.message || "결제 확인 중 오류가 발생했습니다.");
      } finally {
        setConfirming(false);
      }
    };

    run();
  }, [
    mockPayment,
    paymentKey,
    orderIdParam,
    amountParam,
    confirming,
    sessionIdParam,
    returnToParam,
    router,
  ]);

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      {!mockPayment && (
        <Script
          src="https://js.tosspayments.com/v2/standard"
          strategy="afterInteractive"
          onLoad={() => setSdkReady(true)}
        />
      )}
      <header className="px-6 py-5 sticky top-0 z-[100] bg-background-primary">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-primary hover:bg-background-secondary transition-colors"
            aria-label="이전 화면"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-title-3 text-text-primary font-aggro">사주보는 두루미</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="flex-1 px-5 pb-48">
        <div className="max-w-[640px] w-full mx-auto pt-10 space-y-6 text-center">
          <h2 className="text-[24px] font-semibold text-text-primary font-aggro">
            전체 결과를 소장하려면 결제가 필요합니다
          </h2>
          <p className="text-body-2 text-text-secondary">
            결제 후 바로 전체 해석과 만세력 표를 확인할 수 있어요.
          </p>

          <div className="rounded-2xl bg-background-secondary p-5 text-left space-y-3">
            <div className="text-[14px] text-text-secondary">결제 수단</div>
            {mockPayment && (
              <div className="text-[13px] text-text-tertiary">
                테스트 결제로 바로 진행됩니다.
              </div>
            )}
            {!mockPayment && !clientKey && (
              <div className="text-[13px] text-text-tertiary">
                결제 키가 설정되지 않았습니다. 환경변수를 확인해주세요.
              </div>
            )}
            {!mockPayment && (
              <>
                <div id="payment-method" className="rounded-xl overflow-hidden" />
                <div id="payment-agreement" className="rounded-xl overflow-hidden" />
              </>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-background-secondary px-4 py-3 text-text-secondary">
              {error}
            </div>
          )}
          {!sessionIdParam && !error && (
            <div className="rounded-xl bg-background-secondary px-4 py-3 text-text-secondary">
              결제 정보가 만료되었습니다. 이전 화면으로 이동합니다.
            </div>
          )}
        </div>
      </main>

      <div className="fixed left-0 right-0 bottom-0 z-[120] bg-background-primary px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="max-w-[640px] mx-auto">
          <button
            onClick={handlePay}
            disabled={paying || confirming || !sessionIdParam || (!mockPayment && !widgetReady)}
            className="btn-primary w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none transition-all duration-200"
          >
            {confirming ? "결제 확인 중..." : paying ? "결제창 여는 중..." : "결제하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Suspense 래퍼로 내보내기 - Next.js 15 useSearchParams 요구사항
export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentLoading />}>
      <PaymentContent />
    </Suspense>
  );
}
