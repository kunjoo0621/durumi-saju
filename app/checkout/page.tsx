"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Script from "next/script";
import MenuDrawer from "../MenuDrawer";
import { useAllInputs } from "@/store/useInputStore";

function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center px-5">
      <div className="text-text-secondary text-[14px]">화면 로딩 중...</div>
    </div>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const inputs = useAllInputs();

  // 기존 checkout state
  const [error, setError] = useState<string | null>(null);

  // payment에서 가져온 state
  const [paying, setPaying] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<any>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const [sdkReady, setSdkReady] = useState(false);

  const paymentKey = searchParams?.get("paymentKey");
  const orderIdParam = searchParams?.get("orderId");
  const amountParam = searchParams?.get("amount");
  const sessionIdParam = searchParams?.get("sessionId");
  const clientKey = process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;
  const mockPayment = process.env.NEXT_PUBLIC_USE_MOCK_PAYMENT === "true";
  const amount = 1000;

  const hasRequiredInput = useMemo(() => {
    if (
      !inputs.name.trim() ||
      !inputs.birthYear ||
      !inputs.birthMonth ||
      !inputs.birthDay ||
      !inputs.birthLocation ||
      !inputs.gender ||
      !inputs.relationshipStatus ||
      !inputs.employmentStatus ||
      !inputs.coreFearAxis
    ) {
      return false;
    }
    if (!inputs.unknownBirthTime && (!inputs.birthHour || !inputs.birthMinute)) {
      return false;
    }
    return true;
  }, [inputs]);

  // 입력 검증 실패 시 /start로 redirect
  useEffect(() => {
    if (!paymentKey && !hasRequiredInput) {
      router.replace("/start");
    }
  }, [hasRequiredInput, paymentKey, router]);

  // 에러 쿼리 파라미터 처리
  useEffect(() => {
    if (searchParams?.get("error") === "payment") {
      setError("결제가 완료되지 않았습니다. 다시 시도해 주세요.");
    }
  }, [searchParams]);

  // 결제 완료 후 복귀 (paymentKey 있음) → confirm 처리
  useEffect(() => {
    if (mockPayment) return;
    if (!paymentKey || !orderIdParam || !amountParam || !sessionIdParam) return;
    if (confirmingRef.current) return;
    confirmingRef.current = true;

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
        router.replace("/result");
      } catch (err: any) {
        setError(err?.message || "결제 확인 중 오류가 발생했습니다.");
        confirmingRef.current = false;
      } finally {
        setConfirming(false);
      }
    };
    run();
  }, [mockPayment, paymentKey, orderIdParam, amountParam, sessionIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // 결제 완료 복귀 모드면 early return
  if (paymentKey) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center px-5">
        {confirming && (
          <>
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-text-secondary text-[14px]">결제 확인 중...</p>
          </>
        )}
        {error && (
          <div className="max-w-[640px] w-full text-center">
            <p className="text-body-2 text-text-secondary mb-6">{error}</p>
            <button
              onClick={() => router.replace("/start")}
              className="btn-primary w-full px-8 py-4 rounded-2xl text-button-md transition-colors"
            >
              돌아가기
            </button>
          </div>
        )}
      </div>
    );
  }

  // 입력 검증 실패 → /start redirect
  // (useEffect 대신 여기서도 체크하여 잘못된 UI 깜빡임 방지)
  if (!hasRequiredInput) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center px-5">
        <div className="text-text-secondary text-[14px]">이동 중...</div>
      </div>
    );
  }

  return <CheckoutForm
    inputs={inputs}
    session={session}
    error={error}
    setError={setError}
    paying={paying}
    setPaying={setPaying}
    orderId={orderId}
    setOrderId={setOrderId}
    sessionId={sessionId}
    setSessionId={setSessionId}
    widgets={widgets}
    setWidgets={setWidgets}
    widgetReady={widgetReady}
    setWidgetReady={setWidgetReady}
    sdkReady={sdkReady}
    setSdkReady={setSdkReady}
    clientKey={clientKey}
    mockPayment={mockPayment}
    amount={amount}
    hasRequiredInput={hasRequiredInput}
    router={router}
  />;
}

function CheckoutForm({
  inputs, session, error, setError,
  paying, setPaying, orderId, setOrderId,
  sessionId, setSessionId, widgets, setWidgets,
  widgetReady, setWidgetReady, sdkReady, setSdkReady,
  clientKey, mockPayment, amount, hasRequiredInput, router,
}: any) {
  // 페이지 로드 시 세션 생성 + orderId 생성
  useEffect(() => {
    if (sessionId) return;
    const createSession = async () => {
      try {
        const res = await fetch("/api/intake/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inputs),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "결제 준비에 실패했습니다.");
        }
        const data = await res.json();
        const sid = typeof data?.sessionId === "string" ? data.sessionId : "";
        if (!sid) throw new Error("결제 세션을 만들지 못했습니다.");
        setSessionId(sid);

        const stored = sessionStorage.getItem("sajuOrderId");
        if (stored) {
          setOrderId(stored);
        } else {
          const generated = window.crypto?.randomUUID?.() || `order_${Date.now()}`;
          sessionStorage.setItem("sajuOrderId", generated);
          setOrderId(generated);
        }
      } catch (err: any) {
        setError(err?.message || "결제 준비 중 오류가 발생했습니다.");
      }
    };
    createSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Toss 위젯 초기화
  useEffect(() => {
    if (mockPayment) return;
    if (!sdkReady || !clientKey || !orderId || !sessionId) return;
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
  }, [sdkReady, clientKey, session?.user, orderId, sessionId, mockPayment]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePay = async () => {
    if (!sessionId) {
      setError("결제 세션이 준비되지 않았습니다. 잠시만 기다려주세요.");
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
            sessionId,
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
        router.push("/result");
        return;
      }

      const origin = window.location.origin;
      const successUrl = `${origin}/checkout?sessionId=${encodeURIComponent(sessionId)}`;
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

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      {!mockPayment && (
        <Script
          src="https://js.tosspayments.com/v2/standard"
          strategy="afterInteractive"
          onLoad={() => setSdkReady(true)}
          onError={() => setError("결제 모듈을 불러오지 못했어요. 페이지를 새로고침해 주세요.")}
        />
      )}

      <header className="px-6 py-5 sticky top-0 z-[100] bg-background-primary">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/start")}
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
        <div className="max-w-[640px] mx-auto pt-10 space-y-4">
          <p className="text-[18px] font-semibold">전체 결과표 + 8개 섹션 리포트가 열려요</p>
          <p className="text-[15px] text-text-secondary">결과는 계정에 저장돼서 다시 볼 수 있어요</p>

          <div className="rounded-2xl bg-background-secondary p-5 space-y-2">
            <div className="text-[14px] text-text-secondary">입력 정보 확인</div>
            <dl className="space-y-1.5 text-[14px]">
              {inputs.name && (
                <div className="flex justify-between">
                  <dt className="text-text-secondary">이름</dt>
                  <dd className="text-text-primary font-medium">{inputs.name}</dd>
                </div>
              )}
              {inputs.birthYear && inputs.birthMonth && inputs.birthDay && (
                <div className="flex justify-between">
                  <dt className="text-text-secondary">생년월일</dt>
                  <dd className="text-text-primary font-medium">
                    {inputs.calendarType === "lunar" ? "음력 " : ""}{inputs.birthYear}.{inputs.birthMonth}.{inputs.birthDay}
                  </dd>
                </div>
              )}
              {!inputs.unknownBirthTime && inputs.birthHour && inputs.birthMinute && (
                <div className="flex justify-between">
                  <dt className="text-text-secondary">태어난 시간</dt>
                  <dd className="text-text-primary font-medium">{inputs.birthHour}:{inputs.birthMinute}</dd>
                </div>
              )}
              {inputs.unknownBirthTime && (
                <div className="flex justify-between">
                  <dt className="text-text-secondary">태어난 시간</dt>
                  <dd className="text-text-primary font-medium">모름</dd>
                </div>
              )}
              {inputs.birthLocation && (
                <div className="flex justify-between">
                  <dt className="text-text-secondary">출생지</dt>
                  <dd className="text-text-primary font-medium">{inputs.birthLocation}</dd>
                </div>
              )}
              {inputs.gender && (
                <div className="flex justify-between">
                  <dt className="text-text-secondary">성별</dt>
                  <dd className="text-text-primary font-medium">{inputs.gender}</dd>
                </div>
              )}
            </dl>
          </div>

          {!mockPayment && (
            <div className="rounded-2xl bg-background-secondary p-5 space-y-3">
              <div className="text-[14px] text-text-secondary">결제 수단</div>
              {!clientKey && (
                <div className="text-[13px] text-text-tertiary">
                  결제 키가 설정되지 않았습니다. 환경변수를 확인해주세요.
                </div>
              )}
              <div id="payment-method" className="rounded-xl overflow-hidden min-h-[200px]">
                {!widgetReady && (
                  <div className="flex items-center justify-center h-[200px] text-[13px] text-text-tertiary">
                    결제 수단을 불러오는 중…
                  </div>
                )}
              </div>
              <div id="payment-agreement" className="rounded-xl overflow-hidden min-h-[80px]" />
            </div>
          )}

          {mockPayment && (
            <div className="rounded-2xl bg-background-secondary p-5">
              <div className="text-[13px] text-text-tertiary">
                테스트 결제로 바로 진행됩니다.
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-background-secondary px-4 py-3 text-[14px] text-text-secondary">
              {error}
            </div>
          )}
        </div>
      </main>

      <div className="fixed left-0 right-0 bottom-0 z-[120] bg-background-primary px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="max-w-[640px] mx-auto">
          <button
            type="button"
            onClick={handlePay}
            disabled={paying || !hasRequiredInput || !sessionId || (!mockPayment && !widgetReady)}
            className="btn-primary w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none transition-all duration-200"
          >
            {paying ? "결제창 여는 중..." : "1,000원 결제하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutContent />
    </Suspense>
  );
}
