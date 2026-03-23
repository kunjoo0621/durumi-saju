"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { useAllInputs, useInputStore, hasInputHydrated } from "@/store/useInputStore";
import { useBattleStore, hasBattleHydrated } from "@/store/useBattleStore";
import { useCoinStore } from "@/store/useCoinStore";
import { getQuickSajuTags, type SajuTag } from "./actions";
import { FullScreenLoading, ButtonSpinner } from "@/components/loading";
import BusinessFooter from "@/components/BusinessFooter";
import ChargeBottomSheet from "@/components/ChargeBottomSheet";
import Modal from "@/components/Modal";
import { SAJU_COST, BATTLE_COST } from "@/lib/constants/coins";
import { useKakaoLogin } from "@/hooks/useKakaoLogin";

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

function navigateToResult(
  resultId: string | undefined,
  router: ReturnType<typeof import("next/navigation").useRouter>,
  method: "push" | "replace" = "replace",
  pending = false,
) {
  sessionStorage.setItem("sajuJustPaid", "1");
  sessionStorage.removeItem("sajuOrderId");
  const params = new URLSearchParams();
  if (resultId) params.set("resultId", resultId);
  if (pending) params.set("pending", "true");
  router[method](`/result?${params.toString()}`);
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const inputs = useAllInputs();
  const battleStore = useBattleStore();
  const { login } = useKakaoLogin();

  const isAuthenticated = status === "authenticated";

  const checkoutType: CheckoutType = (searchParams?.get("type") as CheckoutType) || "analysis";
  const isBattle = checkoutType === "battle";
  const eggCost = isBattle ? BATTLE_COST : SAJU_COST;

  // 기존 checkout state
  const [error, setError] = useState<string | null>(null);

  // payment에서 가져온 state
  const [paying, setPaying] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const [existingResultId, setExistingResultId] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // 알 시스템 state
  const { balance: coinBalance, setBalance } = useCoinStore();
  const [showChargeSheet, setShowChargeSheet] = useState(false);

  const paymentId = searchParams?.get("paymentId");
  const orderIdParam = searchParams?.get("orderId");
  const amountParam = searchParams?.get("amount");
  const sessionIdParam = searchParams?.get("sessionId");
  const mockPayment = process.env.NEXT_PUBLIC_USE_MOCK_PAYMENT === "true" ||
    (!process.env.NEXT_PUBLIC_PORTONE_STORE_ID && !process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY);

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

  // store hydration 대기 후 입력 검증 실패 시 redirect
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const checkBoth = () => {
      if (hasInputHydrated() && hasBattleHydrated()) {
        setHydrated(true);
        return true;
      }
      return false;
    };
    if (checkBoth()) return;
    const unsub1 = useInputStore.persist.onFinishHydration(() => checkBoth());
    const unsub2 = useBattleStore.persist.onFinishHydration(() => checkBoth());
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!paymentId && !hasRequiredInput) {
      router.replace(redirectBack);
    }
  }, [hydrated, hasRequiredInput, paymentId, router, redirectBack]);

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

  // 기존 PortOne 결제 완료 후 복귀 (paymentId 있음) → confirm 처리 (레거시 지원)
  useEffect(() => {
    if (mockPayment) return;
    if (!paymentId || !orderIdParam || !amountParam || !sessionIdParam) return;
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
            type: checkoutType,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "결제 확인이 안 되고 있어.");
        }
        const completeData = await res.json().catch(() => ({}));

        if (checkoutType === "battle") {
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
          navigateToResult(completeData.resultId, router);
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
    session={session}
    isAuthenticated={isAuthenticated}
    error={error}
    setError={setError}
    paying={paying}
    setPaying={setPaying}
    confirming={confirming}
    setConfirming={setConfirming}
    sessionId={sessionId}
    setSessionId={setSessionId}
    hasRequiredInput={hasRequiredInput}
    router={router}
    redirectBack={redirectBack}
    checkoutType={checkoutType}
    existingResultId={existingResultId}
    setExistingResultId={setExistingResultId}
    showDuplicateModal={showDuplicateModal}
    setShowDuplicateModal={setShowDuplicateModal}
    eggCost={isBattle ? BATTLE_COST : SAJU_COST}
    coinBalance={coinBalance}
    showChargeSheet={showChargeSheet}
    setShowChargeSheet={setShowChargeSheet}
    setBalance={setBalance}
    login={login}
  />;
}

function CheckoutForm({
  inputs, battleStore, isBattle,
  session, isAuthenticated, error, setError,
  paying, setPaying, confirming, setConfirming,
  sessionId, setSessionId,
  hasRequiredInput, router,
  redirectBack, checkoutType,
  existingResultId, setExistingResultId,
  showDuplicateModal, setShowDuplicateModal,
  eggCost, coinBalance, showChargeSheet, setShowChargeSheet, setBalance,
  login,
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

  // 페이지 로드 시 세션 생성
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
          throw new Error(data?.error || "준비가 안 됐어.");
        }
        const data = await res.json();
        if (data.existingResultId && !isBattle) {
          setExistingResultId(data.existingResultId);
        }
        const sid = typeof data?.sessionId === "string" ? data.sessionId : "";
        if (!sid) throw new Error("연결이 안 됐어.");
        setSessionId(sid);
      } catch (err: any) {
        setError(err?.message || "준비 중 오류가 발생했습니다.");
      }
    };
    createSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 알 차감 후 spend 실행
  const executeSpend = async () => {
    if (!sessionId) {
      setError("아직 준비 중이야. 잠깐만.");
      return;
    }

    setPaying(true);
    setError(null);

    try {
      const res = await fetch("/api/coins/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          type: isBattle ? "battle" : "analysis",
        }),
      });

      const data = await res.json().catch(() => ({}));

      // 잔액 부족
      if (data.insufficient) {
        setBalance(data.balance);
        setShowChargeSheet(true);
        setPaying(false);
        return;
      }

      if (!res.ok) {
        if (data.refunded) {
          throw new Error("분석이 실패했어. 알은 환불됐으니 다시 시도해봐.");
        }
        throw new Error(data?.error || "처리에 실패했습니다.");
      }

      // 잔액 갱신
      if (typeof data.balance === "number") {
        setBalance(data.balance);
      }

      if (isBattle) {
        // 배틀: 알 차감 완료 → battle/analyze 호출
        setConfirming(true);
        setPaying(false);

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
        // 사주 분석: spend 완료 → 결과 페이지로 즉시 이동
        setConfirming(true);
        setPaying(false);
        navigateToResult(data.resultId, router, "push", Boolean(data.pending));
      }
    } catch (err: any) {
      setError(err?.message || "처리에 실패했습니다.");
    } finally {
      setPaying(false);
      setConfirming(false);
    }
  };

  const handlePayWithEggs = async () => {
    if (!isAuthenticated) {
      // 비로그인 → 카카오 로그인
      login(window.location.href);
      return;
    }

    // 중복 결과가 있고 아직 모달을 보여주지 않았으면 모달 표시
    if (existingResultId && !showDuplicateModal) {
      setShowDuplicateModal(true);
      return;
    }

    await executeSpend();
  };

  // 충전 완료 콜백 → 자동 spend 재시도
  const handleChargeComplete = async (newBalance: number) => {
    setBalance(newBalance);
    setShowChargeSheet(false);
    // 충전 후 자동으로 spend 재시도
    await executeSpend();
  };

  const displayInputs = isBattle ? battleStore.playerA : inputs;

  const CONFIRM_STEPS = isBattle
    ? [
        { message: "알을 사용하고 있어", delay: 0 },
        { message: "두 사람의 사주를 분석하고 있어", delay: 3000 },
        { message: "대결 결과를 만들고 있어", delay: 10000 },
        { message: "마무리하고 있어", delay: 25000 },
      ]
    : [
        { message: "알을 사용하고 있어", delay: 0 },
      ];

  if (confirming) {
    return (
      <FullScreenLoading
        steps={CONFIRM_STEPS}
        subMessage="최대 3분까지 걸릴 수 있어"
      />
    );
  }

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <Header showBack sticky onBack={() => router.push(redirectBack)} />

      <main className="flex-1 px-5 pb-48">
        <div className="max-w-[640px] mx-auto pt-10 space-y-4">
          {isBattle ? (
            <div className="text-center">
              <h2 className="text-[24px] font-bold font-aggro text-text-primary">{BATTLE_CHECKOUT_TITLES[battleStore.relationshipType] || "사주 대결"}</h2>
            </div>
          ) : (
            <h2 className="text-2xl font-bold font-aggro text-text-primary text-center">결제하면 바로 네 사주 까발려줌</h2>
          )}

          {isBattle ? (
              <div className="relative flex gap-3">
                {/* Card A */}
                <div className="flex-1 rounded-2xl bg-background-secondary border border-white/5 overflow-hidden">
                  <div className="h-[3px]" style={{ backgroundColor: "#FF6B6B" }} />
                  <div className="p-6">
                    <div className="text-[12px] font-bold tracking-[0.05em] mb-2" style={{ color: "#FF6B6B" }}>나</div>
                    <div className="text-[22px] font-bold font-aggro text-text-primary">{battleStore.playerA.name}</div>
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
                  <span className="text-[12px] font-black text-text-secondary tracking-tight">VS</span>
                </div>

                {/* Card B */}
                <div className="flex-1 rounded-2xl bg-background-secondary border border-white/5 overflow-hidden">
                  <div className="h-[3px]" style={{ backgroundColor: "#A855F7" }} />
                  <div className="p-6">
                    <div className="text-[12px] font-bold tracking-[0.05em] mb-2" style={{ color: "#A855F7" }}>상대</div>
                    <div className="text-[22px] font-bold font-aggro text-text-primary">{battleStore.playerB.name}</div>
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
          ) : (
            <div className="rounded-2xl p-5 bg-background-secondary">
              <div className="text-sm text-text-tertiary mb-3">입력 정보 확인</div>
              <dl>
                {displayInputs.name && (
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <dt className="text-sm text-text-secondary">이름</dt>
                    <dd className="text-sm text-text-primary font-medium">{displayInputs.name}</dd>
                  </div>
                )}
                {displayInputs.birthYear && displayInputs.birthMonth && displayInputs.birthDay && (
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <dt className="text-sm text-text-secondary">생년월일</dt>
                    <dd className="text-sm text-text-primary font-medium">
                      {displayInputs.calendarType === "lunar" ? "음력 " : ""}{displayInputs.birthYear}.{displayInputs.birthMonth}.{displayInputs.birthDay}
                    </dd>
                  </div>
                )}
                {!displayInputs.unknownBirthTime && displayInputs.birthHour && displayInputs.birthMinute && (
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <dt className="text-sm text-text-secondary">태어난 시간</dt>
                    <dd className="text-sm text-text-primary font-medium">{displayInputs.birthHour}:{displayInputs.birthMinute}</dd>
                  </div>
                )}
                {displayInputs.unknownBirthTime && (
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <dt className="text-sm text-text-secondary">태어난 시간</dt>
                    <dd className="text-sm text-text-primary font-medium">모름</dd>
                  </div>
                )}
                {displayInputs.birthLocation && (
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <dt className="text-sm text-text-secondary">출생지</dt>
                    <dd className="text-sm text-text-primary font-medium">{displayInputs.birthLocation}</dd>
                  </div>
                )}
                {displayInputs.gender && (
                  <div className="flex justify-between py-3">
                    <dt className="text-sm text-text-secondary">성별</dt>
                    <dd className="text-sm text-text-primary font-medium">{displayInputs.gender}</dd>
                  </div>
                )}
              </dl>
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

      <div className="fixed left-0 right-0 bottom-0 z-[120] bg-background-primary px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="max-w-[640px] mx-auto">
          <p className="text-[12px] text-text-tertiary text-center mb-2">
            {isAuthenticated ? "결과는 저장되니까 안심해" : "로그인하면 결과가 저장돼"} · 바로 사주 결과를 받아볼 수 있어
          </p>

          {isAuthenticated ? (
            <button
              type="button"
              onClick={handlePayWithEggs}
              disabled={paying || confirming || !hasRequiredInput || !sessionId}
              className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors duration-200 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
            >
              {paying ? (
                <ButtonSpinner message="처리 중..." />
              ) : confirming ? (
                <ButtonSpinner message="분석 중..." />
              ) : !sessionId ? (
                <span className="text-text-secondary"><ButtonSpinner message="준비 중..." /></span>
              ) : isBattle ? `${eggCost}알로 대결하기` : `${eggCost}알로 사주보기`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => login(window.location.href)}
              disabled={paying}
              className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors duration-200"
            >
              {isBattle ? "카카오 로그인하고 대결하기" : "카카오 로그인하고 사주보기"}
            </button>
          )}
        </div>
      </div>

      {/* 충전 바텀시트 */}
      <ChargeBottomSheet
        isOpen={showChargeSheet}
        onClose={() => setShowChargeSheet(false)}
        requiredCoins={eggCost}
        currentBalance={coinBalance ?? 0}
        onChargeComplete={handleChargeComplete}
      />

      {/* 중복 결과 모달 */}
      <Modal
        isOpen={showDuplicateModal && !!existingResultId}
        onClose={() => { setShowDuplicateModal(false); setExistingResultId(null); }}
        maxWidth="340px"
        ariaLabel="중복 결과 안내"
      >
        <div className="p-6">
          <h3 className="text-[17px] font-bold text-text-primary text-center mb-2">
            이미 같은 사주로 본 결과가 있어
          </h3>
          <p className="text-[13px] text-text-secondary text-center mb-6">
            기존 결과를 볼 수도 있고, 새로 결제할 수도 있어
          </p>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => router.push(`/result?resultId=${existingResultId}`)}
              className="btn-primary w-full h-[48px] rounded-xl text-[15px] font-semibold"
            >
              결과 보러가기
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDuplicateModal(false);
                setExistingResultId(null);
                handlePayWithEggs();
              }}
              className="w-full h-[48px] rounded-xl text-[15px] font-semibold text-text-secondary bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
            >
              새로 결제하기
            </button>
          </div>
        </div>
      </Modal>
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
