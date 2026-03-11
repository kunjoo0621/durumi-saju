"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import * as PortOne from "@portone/browser-sdk/v2";
import MenuDrawer from "../MenuDrawer";
import { useAllInputs } from "@/store/useInputStore";
import { useBattleStore } from "@/store/useBattleStore";
import { getQuickSajuTags, type SajuTag } from "./actions";
import { FullScreenLoading, ButtonSpinner } from "@/components/loading";
import BusinessFooter from "@/components/BusinessFooter";

type CheckoutType = "analysis" | "battle";

const ELEMENT_TAG_COLORS: Record<string, { color: string; bg: string }> = {
  목: { color: "rgb(34 197 94)", bg: "rgb(34 197 94 / 0.12)" },
  화: { color: "rgb(239 68 68)", bg: "rgb(239 68 68 / 0.12)" },
  토: { color: "rgb(234 179 8)", bg: "rgb(234 179 8 / 0.12)" },
  금: { color: "rgb(228 228 231)", bg: "rgb(228 228 231 / 0.12)" },
  수: { color: "rgb(59 130 246)", bg: "rgb(59 130 246 / 0.12)" },
};
const NEUTRAL_TAG_COLOR = { color: "rgb(156 163 175)", bg: "rgb(156 163 175 / 0.12)" };

function getTagColors(element: string | null) {
  if (!element) return NEUTRAL_TAG_COLOR;
  return ELEMENT_TAG_COLORS[element] ?? NEUTRAL_TAG_COLOR;
}

const BATTLE_RELATIONSHIP_EMOJI: Record<string, string> = {
  lover: "\u2764\uFE0F",
  friend: "\uD83C\uDF7A",
  colleague: "\uD83C\uDFE2",
  family: "\uD83C\uDFE0",
  other: "\uD83E\uDD1D",
};

const BATTLE_RELATIONSHIP_LABELS: Record<string, string> = {
  lover: "연인",
  friend: "친구",
  colleague: "직장동료",
  family: "가족",
  other: "기타",
};

const BATTLE_CHECKOUT_TITLES: Record<string, string> = {
  lover: "연인 사주 대결",
  friend: "친구 사주 대결",
  colleague: "동료 사주 대결",
  family: "가족 사주 대결",
  other: "사주 대결",
};

function CheckoutLoading() {
  return <FullScreenLoading message="화면 로딩 중..." />;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const inputs = useAllInputs();
  const battleStore = useBattleStore();

  const isAuthenticated = status === "authenticated";

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
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);

  const paymentId = searchParams?.get("paymentId");
  const orderIdParam = searchParams?.get("orderId");
  const amountParam = searchParams?.get("amount");
  const sessionIdParam = searchParams?.get("sessionId");
  const typeParam = searchParams?.get("type") || "analysis";
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || "";
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || "";
  const mockPayment = process.env.NEXT_PUBLIC_USE_MOCK_PAYMENT === "true" || (!storeId && !channelKey);

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
    if (!paymentId && !hasRequiredInput) {
      router.replace(redirectBack);
    }
  }, [hasRequiredInput, paymentId, router, redirectBack]);

  // 에러 쿼리 파라미터 처리
  useEffect(() => {
    if (searchParams?.get("error") === "payment") {
      setError("결제가 안 됐어. 다시 시도해봐.");
    }
    const portoneCode = searchParams?.get("code");
    if (portoneCode) {
      setError(searchParams?.get("message") || "결제가 취소되었습니다.");
    }
  }, [searchParams]);

  // 결제 완료 후 복귀 (paymentId 있음) → confirm 처리
  useEffect(() => {
    if (mockPayment) return;
    if (!paymentId || !orderIdParam || !amountParam || !sessionIdParam) return;
    // 포트원 에러 코드가 있으면 에러 useEffect에서 처리
    if (searchParams?.get("code")) return;
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
            paymentId,
            orderId: orderIdParam,
            amount: Number(amountParam),
            type: typeParam,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "결제 확인이 안 되고 있어.");
        }
        const completeData = await res.json().catch(() => ({}));

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
            throw new Error(errData?.error || "배틀 분석이 안 됐어. 다시 해볼까?");
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
          router.replace(completeData.resultId ? `/result?resultId=${completeData.resultId}` : "/result");
        }
      } catch (err: any) {
        setError(err?.message || "결제 확인 중 오류가 발생했습니다.");
        confirmingRef.current = false;
      } finally {
        setConfirming(false);
      }
    };
    run();
  }, [mockPayment, paymentId, orderIdParam, amountParam, sessionIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // 결제 완료 복귀 모드면 early return
  if (paymentId) {
    if (confirming) {
      return <FullScreenLoading message="결제 확인 중..." />;
    }
    return (
      <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center px-5">
        {error && (
          <div className="max-w-[640px] w-full text-center">
            <p className="text-body-2 text-text-secondary mb-6">{error}</p>
            <button
              onClick={() => router.replace(redirectBack)}
              className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors"
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

  // 세션 로딩 중
  if (status === "loading") {
    return <CheckoutLoading />;
  }

  return <CheckoutForm
    inputs={isBattle ? null : inputs}
    battleStore={isBattle ? battleStore : null}
    isBattle={isBattle}
    productName={productName}
    session={session}
    isAuthenticated={isAuthenticated}
    error={error}
    setError={setError}
    paying={paying}
    setPaying={setPaying}
    confirming={confirming}
    setConfirming={setConfirming}
    orderId={orderId}
    setOrderId={setOrderId}
    sessionId={sessionId}
    setSessionId={setSessionId}
    storeId={storeId}
    channelKey={channelKey}
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
  session, isAuthenticated, error, setError,
  paying, setPaying, confirming, setConfirming,
  orderId, setOrderId,
  sessionId, setSessionId,
  storeId, channelKey, mockPayment, amount, hasRequiredInput, router,
  redirectResult, redirectBack, checkoutType,
}: any) {
  // 사주 태그 (배틀 전용)
  const [tagsA, setTagsA] = useState<SajuTag[]>([]);
  const [tagsB, setTagsB] = useState<SajuTag[]>([]);

  useEffect(() => {
    if (!isBattle) return;
    const pA = battleStore.playerA;
    const pB = battleStore.playerB;
    if (!pA.birthYear || !pB.birthYear) return;

    Promise.all([
      getQuickSajuTags({
        birthYear: pA.birthYear, birthMonth: pA.birthMonth, birthDay: pA.birthDay,
        birthHour: pA.birthHour, birthMinute: pA.birthMinute,
        birthLocation: pA.birthLocation, unknownBirthTime: pA.unknownBirthTime,
      }),
      getQuickSajuTags({
        birthYear: pB.birthYear, birthMonth: pB.birthMonth, birthDay: pB.birthDay,
        birthHour: pB.birthHour, birthMinute: pB.birthMinute,
        birthLocation: pB.birthLocation, unknownBirthTime: pB.unknownBirthTime,
      }),
    ]).then(([a, b]) => { setTagsA(a); setTagsB(b); });
  }, [isBattle]); // eslint-disable-line react-hooks/exhaustive-deps

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
          throw new Error(data?.error || "결제 준비가 안 됐어.");
        }
        const data = await res.json();
        if (data.existingResultId && !isBattle) {
          router.replace(`/result?resultId=${data.existingResultId}`);
          return;
        }
        const sid = typeof data?.sessionId === "string" ? data.sessionId : "";
        if (!sid) throw new Error("결제 연결이 안 됐어.");
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

  const handlePay = async () => {
    if (!sessionId) {
      setError("아직 결제 준비 중이야. 잠깐만.");
      return;
    }
    if (!mockPayment && (!storeId || !channelKey)) {
      setError("결제 설정이 누락되었어. 관리자에게 문의해봐.");
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
            throw new Error(data?.error || "배틀 분석이 안 됐어. 다시 해볼까?");
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
        const mockData = await res.json().catch(() => ({}));
        sessionStorage.setItem("sajuJustPaid", "1");
        sessionStorage.removeItem("sajuOrderId");
        router.push(mockData.resultId ? `/result?resultId=${mockData.resultId}` : "/result");
        return;
      }

      const origin = window.location.origin;
      const typeQuery = isBattle ? "&type=battle" : "";
      const redirectUrl = `${origin}/checkout?sessionId=${encodeURIComponent(sessionId)}&orderId=${encodeURIComponent(safeOrderId)}&amount=${amount}${typeQuery}`;
      const displayInputs = isBattle ? battleStore?.playerA : inputs;

      const response = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId: safeOrderId,
        orderName: productName,
        totalAmount: amount,
        currency: "CURRENCY_KRW",
        payMethod: "EASY_PAY",
        customer: {
          fullName: session?.user?.name || displayInputs?.name || "두루미",
        },
        redirectUrl,
      });

      // redirect 발생 시 (모바일 등) — 페이지가 이동하므로 여기 도달하지 않음
      if (!response) return;

      // 결제 실패/취소
      if (response.code != null) {
        throw new Error(response.message || "결제가 취소되었습니다.");
      }

      // 인라인 결제 성공 — 서버에서 검증
      setPaying(false);
      setConfirming(true);

      const completeRes = await fetch("/api/payment/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          paymentId: response.paymentId,
          orderId: safeOrderId,
          amount,
          type: isBattle ? "battle" : "analysis",
        }),
      });

      if (!completeRes.ok) {
        const data = await completeRes.json().catch(() => ({}));
        throw new Error(data?.error || "결제 확인이 안 되고 있어.");
      }

      const completeData = await completeRes.json().catch(() => ({}));

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
          const errData = await analyzeRes.json().catch(() => ({}));
          throw new Error(errData?.error || "배틀 분석이 안 됐어. 다시 해볼까?");
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
        router.replace(completeData.resultId ? `/result?resultId=${completeData.resultId}` : "/result");
      }
    } catch (err: any) {
      setError(err?.message || "결제 처리에 실패했습니다.");
    } finally {
      setPaying(false);
      setConfirming(false);
    }
  };

  const displayInputs = isBattle ? battleStore.playerA : inputs;

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
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
            <div className="text-center">
              <h2 className="text-[24px] font-bold font-aggro text-text-primary">{BATTLE_CHECKOUT_TITLES[battleStore.relationshipType] || "사주 대결"}</h2>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold font-aggro text-white text-center">결제하면 바로 네 사주 까발려줌</h2>
            </>
          )}

          {isBattle ? (
            <>
              {/* Player cards with VS overlap */}
              <div className="relative flex gap-3">
                {/* Card A */}
                <div className="flex-1 rounded-2xl bg-[#1A1A1A] border border-white/5 overflow-hidden">
                  <div className="h-[3px]" style={{ backgroundColor: "#FF6B6B" }} />
                  <div className="p-6">
                    <div className="text-[12px] font-bold tracking-[0.05em] mb-2" style={{ color: "#FF6B6B" }}>나</div>
                    <div className="text-[22px] font-bold font-aggro text-white">{battleStore.playerA.name}</div>
                    <div className="text-[14px] text-text-secondary mt-1">
                      {battleStore.playerA.calendarType === "lunar" ? "음력 " : ""}
                      {battleStore.playerA.birthYear}.{battleStore.playerA.birthMonth}.{battleStore.playerA.birthDay} · {battleStore.playerA.gender}
                    </div>
                    {tagsA.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-[40px]">
                        {tagsA.map((tag) => {
                          const c = getTagColors(tag.element);
                          return (
                            <span key={tag.label} className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ color: c.color, backgroundColor: c.bg }}>
                              {tag.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* VS badge */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10
                  w-10 h-10 rounded-full bg-white/[0.08] border border-white/15 backdrop-blur-[8px] flex items-center justify-center">
                  <span className="text-[12px] font-black text-white/70 tracking-tight">VS</span>
                </div>

                {/* Card B */}
                <div className="flex-1 rounded-2xl bg-[#1A1A1A] border border-white/5 overflow-hidden">
                  <div className="h-[3px]" style={{ backgroundColor: "#A855F7" }} />
                  <div className="p-6">
                    <div className="text-[12px] font-bold tracking-[0.05em] mb-2" style={{ color: "#A855F7" }}>상대</div>
                    <div className="text-[22px] font-bold font-aggro text-white">{battleStore.playerB.name}</div>
                    <div className="text-[14px] text-text-secondary mt-1">
                      {battleStore.playerB.calendarType === "lunar" ? "음력 " : ""}
                      {battleStore.playerB.birthYear}.{battleStore.playerB.birthMonth}.{battleStore.playerB.birthDay} · {battleStore.playerB.gender}
                    </div>
                    {tagsB.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-[40px]">
                        {tagsB.map((tag) => {
                          const c = getTagColors(tag.element);
                          return (
                            <span key={tag.label} className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ color: c.color, backgroundColor: c.bg }}>
                              {tag.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
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
            <div className="rounded-2xl bg-background-secondary p-5">
              <div className="flex items-center gap-2 text-[14px] text-text-secondary">
                <span>카카오페이로 결제됩니다</span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-background-secondary px-4 py-3 text-[14px] text-text-secondary">
              {error}
            </div>
          )}
        </div>

        <BusinessFooter
          footerClassName="border-t border-white/[0.06] mt-8"
          innerClassName="max-w-[640px] mx-auto px-5 pt-8 pb-[calc(120px+env(safe-area-inset-bottom))] text-[13px] leading-[180%] text-[rgb(var(--c-text-muted))]"
        />
      </main>

      <div className="fixed left-0 right-0 bottom-0 z-[120] bg-background-primary px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] max-w-[640px] mx-auto">
        <div className="max-w-[640px] mx-auto">
          <p className="text-[12px] text-gray-500 text-center mb-2">
            환불 불가 · {isAuthenticated ? "결과는 저장되니까 안심해" : "로그인하면 결과가 저장돼"} · 결제 후 바로 사주 결과를 받아볼 수 있어
          </p>
          <button
            type="button"
            onClick={handlePay}
            disabled={paying || confirming || !hasRequiredInput || !sessionId}
            className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-all duration-200 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
          >
            {paying ? (
              <ButtonSpinner message="결제창 여는 중..." />
            ) : confirming ? (
              <ButtonSpinner message="결제 확인 중..." />
            ) : !sessionId ? (
              <span className="text-gray-400"><ButtonSpinner message="결제 준비 중..." /></span>
            ) : isBattle ? `${amount.toLocaleString()}원 결제하고 대결하기` : `${amount.toLocaleString()}원 결제하기`}
          </button>

          {/* 비로그인 시 선택적 카카오 로그인 */}
          {!isAuthenticated && (
            <button
              type="button"
              onClick={() => signIn("kakao", { callbackUrl: window.location.href })}
              disabled={paying || confirming}
              className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold mt-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              카카오로 로그인하고 결제하기
            </button>
          )}
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
