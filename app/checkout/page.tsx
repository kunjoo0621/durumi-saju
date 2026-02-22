"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Script from "next/script";
import MenuDrawer from "../MenuDrawer";
import { useAllInputs } from "@/store/useInputStore";
import { useBattleStore } from "@/store/useBattleStore";

type CheckoutType = "analysis" | "battle";

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
  const battleStore = useBattleStore();

  const checkoutType: CheckoutType = (searchParams?.get("type") as CheckoutType) || "analysis";
  const isBattle = checkoutType === "battle";
  const amount = isBattle ? 2000 : 1000;
  const productName = isBattle ? "사주 배틀" : "사주 전체 결과";

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
  const typeParam = searchParams?.get("type") || "analysis";
  const clientKey = process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;
  const mockPayment = process.env.NEXT_PUBLIC_USE_MOCK_PAYMENT === "true";

  const hasRequiredInput = useMemo(() => {
    if (isBattle) {
      const { playerA, playerB, relationshipType } = battleStore;
      if (!playerA.name?.trim() || !playerA.birthYear || !playerA.birthMonth || !playerA.birthDay || !playerA.birthLocation || !playerA.gender) return false;
      if (!playerA.unknownBirthTime && (!playerA.birthHour || !playerA.birthMinute)) return false;
      if (!playerB.name?.trim() || !playerB.birthYear || !playerB.birthMonth || !playerB.birthDay || !playerB.birthLocation || !playerB.gender) return false;
      if (!playerB.unknownBirthTime && (!playerB.birthHour || !playerB.birthMinute)) return false;
      if (!relationshipType) return false;
      return true;
    }
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
  }, [inputs, battleStore, isBattle]);

  const redirectBack = isBattle ? "/battle/input" : "/start";
  const redirectResult = isBattle ? "/battle/result" : "/result";

  // 입력 검증 실패 시 redirect
  useEffect(() => {
    if (!paymentKey && !hasRequiredInput) {
      router.replace(redirectBack);
    }
  }, [hasRequiredInput, paymentKey, router, redirectBack]);

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
            type: typeParam,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "결제 확인에 실패했습니다.");
        }

        if (typeParam === "battle") {
          // 결제 확인 완료 → 배틀 분석 실행
          const analyzeRes = await fetch("/api/battle/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playerA: battleStore.playerA,
              playerB: battleStore.playerB,
              relationshipType: battleStore.relationshipType,
              sessionId: sessionIdParam,
            }),
          });
          if (!analyzeRes.ok) {
            const errData = await analyzeRes.json().catch(() => ({}));
            throw new Error(errData?.error || "배틀 분석에 실패했습니다.");
          }
          const analyzeData = await analyzeRes.json();
          if (analyzeData?.result) {
            battleStore.setBattleResult(analyzeData.result);
          }
          sessionStorage.setItem("sajuBattleJustPaid", "1");
          sessionStorage.removeItem("sajuOrderId");
          router.replace(`/battle/result${analyzeData.battleId ? `?id=${analyzeData.battleId}` : ""}`);
        } else {
          sessionStorage.setItem("sajuJustPaid", "1");
          sessionStorage.removeItem("sajuOrderId");
          router.replace("/result");
        }
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
              onClick={() => router.replace(redirectBack)}
              className="btn-primary w-full px-8 py-4 rounded-2xl text-button-md transition-colors"
            >
              돌아가기
            </button>
          </div>
        )}
      </div>
    );
  }

  // 입력 검증 실패 → redirect
  if (!hasRequiredInput) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center px-5">
        <div className="text-text-secondary text-[14px]">이동 중...</div>
      </div>
    );
  }

  return <CheckoutForm
    inputs={isBattle ? null : inputs}
    battleStore={isBattle ? battleStore : null}
    isBattle={isBattle}
    productName={productName}
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
    redirectResult={isBattle ? "/battle/result" : "/result"}
    redirectBack={redirectBack}
    checkoutType={checkoutType}
  />;
}

function CheckoutForm({
  inputs, battleStore, isBattle, productName,
  session, error, setError,
  paying, setPaying, orderId, setOrderId,
  sessionId, setSessionId, widgets, setWidgets,
  widgetReady, setWidgetReady, sdkReady, setSdkReady,
  clientKey, mockPayment, amount, hasRequiredInput, router,
  redirectResult, redirectBack, checkoutType,
}: any) {
  // 페이지 로드 시 세션 생성 + orderId 생성
  useEffect(() => {
    if (sessionId) return;
    const createSession = async () => {
      try {
        const sessionBody = isBattle
          ? {
              name: battleStore.playerA.name,
              birthYear: battleStore.playerA.birthYear,
              birthMonth: battleStore.playerA.birthMonth,
              birthDay: battleStore.playerA.birthDay,
              calendarType: battleStore.playerA.calendarType,
              birthHour: battleStore.playerA.birthHour,
              birthMinute: battleStore.playerA.birthMinute,
              birthLocation: battleStore.playerA.birthLocation,
              gender: battleStore.playerA.gender,
              relationshipStatus: battleStore.playerA.relationshipStatus || "솔로",
              employmentStatus: battleStore.playerA.employmentStatus || "직장인",
              coreFearAxis: battleStore.playerA.coreFearAxis || "DISMISS",
              unknownBirthTime: battleStore.playerA.unknownBirthTime,
            }
          : inputs;
        const res = await fetch("/api/intake/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionBody),
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
        // For battle mock payment, call battle analyze API directly
        if (isBattle) {
          const analyzeRes = await fetch("/api/battle/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playerA: battleStore.playerA,
              playerB: battleStore.playerB,
              relationshipType: battleStore.relationshipType,
              sessionId,
            }),
          });
          if (!analyzeRes.ok) {
            const data = await analyzeRes.json().catch(() => ({}));
            throw new Error(data?.error || "배틀 분석에 실패했습니다.");
          }
          const data = await analyzeRes.json();
          if (data?.result) {
            battleStore.setBattleResult(data.result);
          }
          sessionStorage.setItem("sajuBattleJustPaid", "1");
          sessionStorage.removeItem("sajuOrderId");
          router.push(`/battle/result${data.battleId ? `?id=${data.battleId}` : ""}`);
          return;
        }

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
      const typeQuery = isBattle ? `&type=battle` : "";
      const successUrl = `${origin}/checkout?sessionId=${encodeURIComponent(sessionId)}${typeQuery}`;
      const failUrl = `${origin}/checkout?error=payment${typeQuery}`;

      await widgets.requestPayment({
        orderId: safeOrderId,
        orderName: productName,
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

  const displayInputs = isBattle ? battleStore.playerA : inputs;

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

      <header className="px-6 py-5 sticky top-0 z-[100] bg-[#0D0D0D]">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push(redirectBack)}
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
          {isBattle ? (
            <>
              <p className="text-[18px] font-semibold">1:1 사주 배틀 결과가 열려요</p>
              <p className="text-[15px] text-text-secondary">5개 카테고리 비교 + 심판 판정</p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold font-aggro text-white text-center">결제하면 바로 네 사주 까발려줌</h2>
            </>
          )}

          {isBattle ? (
            <div className="rounded-2xl bg-background-secondary p-5 space-y-3">
              <div className="text-[14px] text-text-secondary">대결 정보 확인</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl bg-background-primary p-3 text-center">
                  <div className="text-[13px] text-text-tertiary">甲</div>
                  <div className="text-[15px] font-semibold text-text-primary mt-1">{battleStore.playerA.name}</div>
                </div>
                <div className="text-[16px] font-bold text-primary">VS</div>
                <div className="flex-1 rounded-xl bg-background-primary p-3 text-center">
                  <div className="text-[13px] text-text-tertiary">乙</div>
                  <div className="text-[15px] font-semibold text-text-primary mt-1">{battleStore.playerB.name}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5" style={{ backgroundColor: '#141414' }}>
              <div className="text-sm text-gray-500 mb-3">입력 정보 확인</div>
              <dl>
                {displayInputs.name && (
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <dt className="text-sm text-gray-400">이름</dt>
                    <dd className="text-sm text-white font-medium">{displayInputs.name}</dd>
                  </div>
                )}
                {displayInputs.birthYear && displayInputs.birthMonth && displayInputs.birthDay && (
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <dt className="text-sm text-gray-400">생년월일</dt>
                    <dd className="text-sm text-white font-medium">
                      {displayInputs.calendarType === "lunar" ? "음력 " : ""}{displayInputs.birthYear}.{displayInputs.birthMonth}.{displayInputs.birthDay}
                    </dd>
                  </div>
                )}
                {!displayInputs.unknownBirthTime && displayInputs.birthHour && displayInputs.birthMinute && (
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <dt className="text-sm text-gray-400">태어난 시간</dt>
                    <dd className="text-sm text-white font-medium">{displayInputs.birthHour}:{displayInputs.birthMinute}</dd>
                  </div>
                )}
                {displayInputs.unknownBirthTime && (
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <dt className="text-sm text-gray-400">태어난 시간</dt>
                    <dd className="text-sm text-white font-medium">모름</dd>
                  </div>
                )}
                {displayInputs.birthLocation && (
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <dt className="text-sm text-gray-400">출생지</dt>
                    <dd className="text-sm text-white font-medium">{displayInputs.birthLocation}</dd>
                  </div>
                )}
                {displayInputs.gender && (
                  <div className="flex justify-between py-3">
                    <dt className="text-sm text-gray-400">성별</dt>
                    <dd className="text-sm text-white font-medium">{displayInputs.gender}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

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
                테스트 결제로 바로 진행돼
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
          <p className="text-sm text-gray-400 text-center mb-2">결과는 저장되니까 안심해</p>
          <button
            type="button"
            onClick={handlePay}
            disabled={paying || !hasRequiredInput || !sessionId || (!mockPayment && !widgetReady)}
            className="w-full rounded-xl px-4 py-4 text-lg font-bold text-white leading-none transition-all duration-200 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
            style={{ backgroundColor: paying ? undefined : '#FF6B6B' }}
          >
            {paying ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                결제창 여는 중...
              </span>
            ) : (!sessionId || (!mockPayment && !widgetReady)) ? (
              <span className="flex items-center justify-center gap-2 text-gray-400">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                결제 준비 중...
              </span>
            ) : `${amount.toLocaleString()}원 결제하기`}
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
