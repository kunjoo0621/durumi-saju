"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import SajuChart, { StrengthPanel } from "@/components/saju/SajuChart";
import { useAllInputs, useInputStore, hasInputHydrated } from "@/store/useInputStore";
import { useBattleStore, hasBattleHydrated } from "@/store/useBattleStore";
import { useCoinStore } from "@/store/useCoinStore";
import { useKakaoLogin } from "@/hooks/useKakaoLogin";
import { trackPaymentAttempt, trackPaymentSuccess, trackPaymentFail, trackInsufficientBalance } from "@/lib/analytics";
import { calculateSaju, enrichSajuData, type SajuData } from "@/lib/utils/saju";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import { SAJU_COST, BATTLE_COST } from "@/lib/constants/coins";
import { getQuickSajuTags, type SajuTag } from "@/app/checkout/actions";
import { Egg, CaretDown, CaretUp } from "@phosphor-icons/react";
import { FullScreenLoading, ButtonSpinner } from "@/components/loading";
import ChargeBottomSheet from "@/components/ChargeBottomSheet";
import Modal from "@/components/Modal";

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

const BATTLE_CHECKOUT_TITLES: Record<string, string> = {
  lover: "연인 사주 대결",
  friend: "친구 사주 대결",
  colleague: "동료 사주 대결",
  family: "가족 사주 대결",
  other: "사주 대결",
};

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

function TeaserContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputs = useAllInputs();
  const playerA = useBattleStore((s) => s.playerA);
  const playerB = useBattleStore((s) => s.playerB);
  const relationshipType = useBattleStore((s) => s.relationshipType);
  const setBattleResult = useBattleStore((s) => s.setBattleResult);
  const { status } = useSession();
  const { balance, setBalance } = useCoinStore();
  const { login } = useKakaoLogin();

  const isBattle = searchParams?.get("type") === "battle";
  const eggCost = isBattle ? BATTLE_COST : SAJU_COST;

  const isAuthenticated = status === "authenticated";

  const [wonguExpanded, setWonguExpanded] = useState(true);
  const wonguRef = useRef<HTMLDivElement>(null);

  // payment/spend state
  const [paying, setPaying] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingResultId, setExistingResultId] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showChargeSheet, setShowChargeSheet] = useState(false);

  // 배틀 사주 태그
  const [tagsA, setTagsA] = useState<SajuTag[]>([]);
  const [tagsB, setTagsB] = useState<SajuTag[]>([]);

  // store hydration 대기
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

  // 입력 검증
  const hasRequiredInput = useMemo(() => {
    if (!hydrated) return true; // hydration 전에는 redirect 방지
    if (isBattle) {
      if (!playerA.name?.trim() || !playerA.birthYear || !playerA.birthMonth || !playerA.birthDay || !playerA.birthLocation || !playerA.gender) return false;
      if (!playerA.unknownBirthTime && (!playerA.birthHour || !playerA.birthMinute)) return false;
      if (!playerB.name?.trim() || !playerB.birthYear || !playerB.birthMonth || !playerB.birthDay || !playerB.birthLocation || !playerB.gender) return false;
      if (!playerB.unknownBirthTime && (!playerB.birthHour || !playerB.birthMinute)) return false;
      if (!relationshipType) return false;
      return true;
    }
    return !!(
      inputs.name.trim() &&
      inputs.birthYear &&
      inputs.birthMonth &&
      inputs.birthDay &&
      inputs.birthLocation &&
      inputs.gender
    );
  }, [hydrated, inputs, playerA, playerB, relationshipType, isBattle]);

  const redirectBack = isBattle ? "/battle/input" : "/start";

  useEffect(() => {
    if (hydrated && !hasRequiredInput) {
      router.replace(redirectBack);
    }
  }, [hydrated, hasRequiredInput, router, redirectBack]);

  // 비인증 시 로그인으로 리다이렉트 (fallback)
  useEffect(() => {
    if (status === "unauthenticated") {
      const callbackUrl = isBattle
        ? `${window.location.origin}/teaser?type=battle`
        : `${window.location.origin}/teaser`;
      login(callbackUrl);
    }
  }, [status, isBattle, login]);

  // 사주 계산 (사주 분석 모드만)
  const [sajuData, setSajuData] = useState<SajuData | null>(null);
  const [calculating, setCalculating] = useState(!isBattle);

  useEffect(() => {
    if (isBattle || !hydrated || !hasRequiredInput) return;

    const calc = async () => {
      setCalculating(true);
      try {
        let calcYear = Number(inputs.birthYear);
        let calcMonth = Number(inputs.birthMonth);
        let calcDay = Number(inputs.birthDay);

        if (inputs.calendarType === "lunar") {
          const solar = convertLunarToSolar(calcYear, calcMonth, calcDay);
          if (solar) {
            calcYear = solar.year;
            calcMonth = solar.month;
            calcDay = solar.day;
          }
        }

        const hour = inputs.unknownBirthTime ? undefined : Number(inputs.birthHour);
        const minute = inputs.unknownBirthTime ? undefined : Number(inputs.birthMinute);

        const saju = await calculateSaju(calcYear, calcMonth, calcDay, hour, minute, {
          birthLocation: inputs.birthLocation,
        });
        setSajuData(saju);
      } catch {
        setSajuData(null);
      } finally {
        setCalculating(false);
      }
    };
    calc();
  }, [hydrated, hasRequiredInput, isBattle]); // eslint-disable-line react-hooks/exhaustive-deps

  const enriched = useMemo(() => {
    if (!sajuData) return null;
    return enrichSajuData(sajuData, { isTimeUnknown: inputs.unknownBirthTime });
  }, [sajuData, inputs.unknownBirthTime]);

  // 배틀 사주 태그 로드
  useEffect(() => {
    if (!isBattle || !hydrated || !hasRequiredInput) return;
    if (!playerA.birthYear || !playerB.birthYear) return;

    Promise.all([
      getQuickSajuTags({
        birthYear: playerA.birthYear, birthMonth: playerA.birthMonth, birthDay: playerA.birthDay,
        birthHour: playerA.birthHour, birthMinute: playerA.birthMinute,
        birthLocation: playerA.birthLocation, unknownBirthTime: playerA.unknownBirthTime,
      }),
      getQuickSajuTags({
        birthYear: playerB.birthYear, birthMonth: playerB.birthMonth, birthDay: playerB.birthDay,
        birthHour: playerB.birthHour, birthMinute: playerB.birthMinute,
        birthLocation: playerB.birthLocation, unknownBirthTime: playerB.unknownBirthTime,
      }),
    ]).then(([a, b]) => { setTagsA(a); setTagsB(b); });
  }, [isBattle, hydrated, hasRequiredInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // 로그인 상태일 때 세션 생성
  useEffect(() => {
    if (!isAuthenticated || !hydrated || !hasRequiredInput || sessionId) return;

    const createSession = async () => {
      try {
        const sessionBody = isBattle
          ? {
              name: playerA.name,
              birthYear: playerA.birthYear,
              birthMonth: playerA.birthMonth,
              birthDay: playerA.birthDay,
              calendarType: playerA.calendarType,
              birthHour: playerA.birthHour,
              birthMinute: playerA.birthMinute,
              birthLocation: playerA.birthLocation,
              gender: playerA.gender,
              relationshipStatus: playerA.relationshipStatus || "솔로",
              employmentStatus: playerA.employmentStatus || "직장인",
              coreFearAxis: playerA.coreFearAxis || "DISMISS",
              unknownBirthTime: playerA.unknownBirthTime,
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
  }, [isAuthenticated, hydrated, hasRequiredInput, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 알 차감 실행
  const executeSpend = async () => {
    if (!sessionId) {
      setError("아직 준비 중이야. 잠깐만.");
      return;
    }

    const spendType = isBattle ? "battle" as const : "analysis" as const;
    trackPaymentAttempt(spendType, eggCost);
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
        trackInsufficientBalance(spendType, data.balance, eggCost);
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
        setConfirming(true);
        setPaying(false);

        const analyzeRes = await fetch("/api/battle/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerA,
            playerB,
            relationshipType,
            sessionId,
          }),
        });
        if (!analyzeRes.ok) {
          const errData = await analyzeRes.json().catch(() => ({}));
          throw new Error(errData?.error || "배틀 분석이 안 됐어. 다시 해볼까?");
        }
        const analyzeData = await analyzeRes.json();
        if (analyzeData?.result) {
          setBattleResult(analyzeData.result);
        }
        trackPaymentSuccess(spendType, eggCost);
        sessionStorage.setItem("sajuBattleJustPaid", "1");
        sessionStorage.removeItem("sajuOrderId");
        router.replace(`/battle/result${analyzeData.battleId ? `?id=${analyzeData.battleId}` : ""}`);
      } else {
        trackPaymentSuccess(spendType, eggCost);
        setConfirming(true);
        setPaying(false);
        navigateToResult(data.resultId, router, "push", Boolean(data.pending));
      }
    } catch (err: any) {
      trackPaymentFail(spendType, err?.message || "unknown");
      setError(err?.message || "처리에 실패했습니다.");
      setPaying(false);
      setConfirming(false);
    }
  };

  const handleUnlock = async () => {
    if (!isAuthenticated) {
      const callbackUrl = isBattle
        ? `${window.location.origin}/teaser?type=battle`
        : `${window.location.origin}/teaser`;
      login(callbackUrl);
      return;
    }

    // 중복 결과가 있고 아직 모달을 보여주지 않았으면 모달 표시
    if (!isBattle && existingResultId && !showDuplicateModal) {
      setShowDuplicateModal(true);
      return;
    }

    await executeSpend();
  };

  // 충전 완료 콜백 → 자동 spend 재시도
  const handleChargeComplete = async (newBalance: number) => {
    setBalance(newBalance);
    setShowChargeSheet(false);
    await executeSpend();
  };

  const displayBirthDate = `${inputs.birthYear}.${inputs.birthMonth}.${inputs.birthDay}`;

  const confirmSteps = useMemo(() => isBattle
    ? [
        { message: "알을 사용하고 있어", delay: 0 },
        { message: "두 사람의 사주를 분석하고 있어", delay: 3000 },
        { message: "대결 결과를 만들고 있어", delay: 10000 },
        { message: "마무리하고 있어", delay: 25000 },
      ]
    : [
        { message: "알을 사용하고 있어", delay: 0 },
      ], [isBattle]);

  // 비인증 시 로그인 리다이렉트 중 — 불필요한 렌더링 방지
  if (!isAuthenticated) {
    return <FullScreenLoading message="로그인으로 이동 중" />;
  }

  // 로딩 상태
  if (!hydrated || (!isBattle && calculating)) {
    return <FullScreenLoading message="사주를 계산하고 있어" subMessage="잠깐이면 돼" />;
  }

  if (confirming) {
    return (
      <FullScreenLoading
        steps={confirmSteps}
        subMessage={isBattle ? "최대 3분까지 걸릴 수 있어" : undefined}
      />
    );
  }

  if (!hasRequiredInput) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background-primary animate-fadeIn">
      <Header showBack showBalance sticky onBack={() => router.push(redirectBack)} />

      <main className="px-6 py-8 pb-48">
        <div className="max-w-[640px] mx-auto space-y-6">

          {/* 배틀 모드: VS 카드 */}
          {isBattle ? (
            <>
              <div className="text-center">
                <h2 className="text-[24px] font-bold font-aggro text-text-primary">
                  {BATTLE_CHECKOUT_TITLES[relationshipType] || "사주 대결"}
                </h2>
              </div>

              <div className="relative flex gap-3">
                {/* Card A */}
                <div className="flex-1 rounded-2xl bg-background-secondary border border-white/5 overflow-hidden">
                  <div className="h-[3px]" style={{ backgroundColor: "#FF6B6B" }} />
                  <div className="p-6">
                    <div className="text-[12px] font-bold tracking-[0.05em] mb-2" style={{ color: "#FF6B6B" }}>나</div>
                    <div className="text-[22px] font-bold font-aggro text-text-primary">{playerA.name}</div>
                    <div className="text-[14px] text-text-secondary mt-1">
                      {playerA.calendarType === "lunar" ? "음력 " : ""}
                      {playerA.birthYear}.{playerA.birthMonth}.{playerA.birthDay} · {playerA.gender}
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
                    <div className="text-[22px] font-bold font-aggro text-text-primary">{playerB.name}</div>
                    <div className="text-[14px] text-text-secondary mt-1">
                      {playerB.calendarType === "lunar" ? "음력 " : ""}
                      {playerB.birthYear}.{playerB.birthMonth}.{playerB.birthDay} · {playerB.gender}
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
            <>
              {/* 사주 원국 */}
              {sajuData && (
                <div ref={wonguRef} className="bg-background-secondary rounded-3xl p-5 md:p-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">
                      {inputs.name}님의 사주 원국
                    </h3>
                    <span className="text-xs text-gray-500">
                      ({inputs.calendarType === "lunar" ? "음력" : "양력"} {displayBirthDate} 기준)
                    </span>
                  </div>

                  <SajuChart sajuData={sajuData} enriched={enriched} hideStrengthPanel />

                  {!wonguExpanded && (
                    <button
                      onClick={() => setWonguExpanded(true)}
                      className="w-full bg-[#252525] text-sm font-medium text-gray-200 py-3 rounded-lg mt-10 transition-colors hover:bg-[#2A2A2A] active:bg-[#2A2A2A] flex items-center justify-center gap-1.5"
                    >
                      상세 분석 보기
                      <CaretDown weight="bold" size={16} />
                    </button>
                  )}

                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                    style={{ gridTemplateRows: wonguExpanded ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      {enriched && <StrengthPanel enriched={enriched} />}

                      <button
                        onClick={() => {
                          setWonguExpanded(false);
                          wonguRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className="w-full bg-[#252525] text-sm font-medium text-gray-200 py-3 rounded-lg mt-8 transition-colors hover:bg-[#2A2A2A] active:bg-[#2A2A2A] flex items-center justify-center gap-1.5"
                      >
                        상세 분석 접기
                        <CaretUp weight="bold" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 등급 가림 + 그라데이션 */}
              <div className="relative overflow-hidden rounded-3xl">
                <div
                  className="rounded-3xl p-6 md:p-8"
                  style={{ backgroundColor: "#141414" }}
                >
                  <div className="mt-6 flex flex-col items-center text-center">
                    <div className="mb-5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/badges/rank-unknown.svg"
                        alt="등급 미공개"
                        className="object-contain"
                        style={{ width: 120, height: 120 }}
                        draggable={false}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg font-bold text-white/20">?등급</span>
                      <span className="text-lg font-bold text-gray-400">· 상위 ??%</span>
                    </div>
                    <div className="mt-10 text-2xl font-bold font-aggro text-white/15 line-clamp-2">
                      네 사주 결과가 준비됐어
                    </div>
                    <p className="mt-3 max-w-lg text-[16px] text-gray-600 text-center leading-7">
                      등급과 상세 해설을 확인해봐
                    </p>
                  </div>
                </div>

                {/* 그라데이션 */}
                <div
                  className="absolute inset-x-0 bottom-0 pointer-events-none"
                  style={{
                    height: "80%",
                    background: "linear-gradient(to bottom, rgba(9,9,11,0) 0%, rgba(9,9,11,0.08) 15%, rgba(9,9,11,0.25) 30%, rgba(9,9,11,0.55) 50%, rgba(9,9,11,0.8) 65%, rgba(9,9,11,0.95) 80%, rgb(9,9,11) 100%)",
                  }}
                />
              </div>
            </>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div role="alert" aria-live="assertive" className="rounded-xl bg-background-secondary px-4 py-3 text-[14px] text-text-secondary">
              {error}
            </div>
          )}

          {/* CTA */}
          <div className={`${isBattle ? "" : "-mt-4"} relative z-10 flex flex-col items-center text-center pb-12`}>
            <p className="text-[15px] font-semibold text-text-primary mb-2">
              {isBattle ? "대결 결과를 확인해봐" : "전체 사주 결과를 확인해봐"}
            </p>
            <p className="text-[13px] text-text-tertiary mb-6">
              결과는 저장되니까 안심해
            </p>

            <button
              type="button"
              onClick={handleUnlock}
              disabled={paying || confirming || !hasRequiredInput || !sessionId}
              className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
            >
              {paying ? (
                <ButtonSpinner message="처리 중..." />
              ) : !sessionId ? (
                <ButtonSpinner message="준비 중..." />
              ) : (
                <>
                  <Egg size={18} weight="fill" />
                  {isBattle ? `${eggCost}알로 대결하기` : `${eggCost}알로 전체 결과 보기`}
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* 충전 바텀시트 */}
      <ChargeBottomSheet
        isOpen={showChargeSheet}
        onClose={() => setShowChargeSheet(false)}
        requiredCoins={eggCost}
        currentBalance={balance ?? 0}
        onChargeComplete={handleChargeComplete}
        redirectPath="/coins"
        onBeforeCharge={() => {
          if (sessionId) {
            const pending: Record<string, unknown> = {
              sessionId,
              type: isBattle ? "battle" : "analysis",
            };
            if (isBattle) {
              pending.playerA = playerA;
              pending.playerB = playerB;
              pending.relationshipType = relationshipType;
            }
            sessionStorage.setItem("pendingSpend", JSON.stringify(pending));
          }
        }}
      />

      {/* 중복 결과 모달 (사주 분석 전용) */}
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
                handleUnlock();
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

export default function TeaserPage() {
  return (
    <Suspense fallback={<FullScreenLoading message="사주를 계산하고 있어" subMessage="잠깐이면 돼" />}>
      <TeaserContent />
    </Suspense>
  );
}
