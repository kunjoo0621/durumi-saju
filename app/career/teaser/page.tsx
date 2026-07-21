"use client";

// 커리어운 자체입력(self) 미리보기 화면 — app/wealth/teaser/page.tsx 미러(원국 무료 공개 +
// 등급 잠금 + 결제 CTA). 대표사주 경로(/career/input)와 달리 여기서는 방금 입력한 생년월일
// (useInputStore)로 원국을 클라이언트에서 계산해 무료로 보여주고, source:"self"로 커리어운
// start/analyze를 호출한다.
//
// ★★ 생명선(life-line): start와 analyze에 넘기는 selfInput은 반드시 "같은 스토어에서 읽은 같은 값"
//    이어야 한다. 서버가 각각 normalizeSelfInput+buildInputHash로 결제 row를 매칭하므로 필드 하나라도
//    다르면 analyze가 "미리보기 먼저"(404)로 튕긴다. 그래서 selfInput을 useMemo로 단 한 번 만들고
//    (useInputStore 값에서만 파생) start·analyze 양쪽에 그 동일 객체를 넘긴다. 아래 selfInput 참조.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Header from "@/components/layout/Header";
import SajuChart, { StrengthPanel } from "@/components/saju/SajuChart";
import { useAllInputs, useInputStore, hasInputHydrated } from "@/store/useInputStore";
import { useCareerStore, hasCareerHydrated } from "@/store/useCareerStore";
import { useCoinStore } from "@/store/useCoinStore";
import { FullScreenLoading, SkeletonBar } from "@/components/loading";
import ChargeBottomSheet from "@/components/ChargeBottomSheet";
import OverallGradeBadgeSlot, { GRADE_GLOWS, type OverallGradeLabel } from "@/components/result/OverallGradeBadgeSlot";
import { getGradeColor } from "@/lib/utils/grade-colors";
import { CAREER_COST } from "@/lib/constants/coins";
import type { CareerGrade } from "@/lib/career-grade";
import type { CareerSituation } from "@/lib/career-facts";
import type { SelfSajuInput } from "@/lib/self-input";
import { calculateSaju, enrichSajuData, type SajuData } from "@/lib/utils/saju";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

// display 등급(SS/S/A/B/C) → 배지/글로우가 기대하는 내부 등급(S/A/B/C/D) 역매핑.
// (CareerResultClient.CAREER_TO_INTERNAL_GRADE와 동일 — 컴포넌트 내부 상수라 여기 재현.)
const CAREER_TO_INTERNAL_GRADE: Record<CareerGrade, OverallGradeLabel> = {
  SS: "S",
  S: "A",
  A: "B",
  B: "C",
  C: "D",
};

type GwanseongType = "정관우세" | "편관우세" | "관살혼잡" | "무관";

type TeaserFacts = {
  grade?: CareerGrade;
  gwanseongType?: GwanseongType;
  situation?: CareerSituation;
};

const CAREER_LOADING_STEPS: Array<{ message: string; delay: number }> = [
  { message: "사주 데이터를 다시 불러오고 있어", delay: 0 },
  { message: "자리 기운과 그 그릇을 짚어보는 중", delay: 15_000 },
  { message: "일의 기운이 강해지는 시기를 찾는 중", delay: 45_000 },
  { message: "결과를 정리하고 있어", delay: 80_000 },
];

export default function CareerTeaserPage() {
  const router = useRouter();
  const { status } = useSession();
  const inputs = useAllInputs();
  const situation = useCareerStore((s) => s.situation);
  const { balance, setBalance, fetchBalance } = useCoinStore();

  const isAuthenticated = status === "authenticated";

  // store hydration 대기 (useInputStore + useCareerStore) — persist 값 로드 전 판단 금지.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const check = () => {
      if (hasInputHydrated() && hasCareerHydrated()) {
        setHydrated(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const unsub1 = useInputStore.persist.onFinishHydration(() => check());
    const unsub2 = useCareerStore.persist.onFinishHydration(() => check());
    return () => { unsub1(); unsub2(); };
  }, []);

  // 입력 검증 — 서버 필수(birth·gender) + 상황. 부족하면 자체입력으로 되돌린다.
  const hasRequiredInput = useMemo(() => {
    if (!hydrated) return true; // hydration 전 redirect 방지
    return !!(
      inputs.birthYear &&
      inputs.birthMonth &&
      inputs.birthDay &&
      inputs.birthLocation &&
      inputs.gender &&
      situation
    );
  }, [hydrated, inputs, situation]);

  // ★ 생명선 소스: selfInput은 useInputStore 값에서만 파생한 단일 객체. start·analyze 모두 이 값을 넘긴다.
  const selfInput = useMemo<SelfSajuInput>(() => ({
    name: inputs.name,
    birthYear: inputs.birthYear,
    birthMonth: inputs.birthMonth,
    birthDay: inputs.birthDay,
    calendarType: inputs.calendarType,
    birthHour: inputs.birthHour,
    birthMinute: inputs.birthMinute,
    birthLocation: inputs.birthLocation,
    gender: inputs.gender,
    unknownBirthTime: inputs.unknownBirthTime,
  }), [inputs]);

  // 화면 상태
  const [sajuData, setSajuData] = useState<SajuData | null>(null);
  const [calculating, setCalculating] = useState(true);
  const [wonguExpanded, setWonguExpanded] = useState(true);
  const wonguRef = useRef<HTMLDivElement>(null);

  const [teaserState, setTeaserState] = useState<"loading" | "ready" | "error">("loading");
  const [teaserFacts, setTeaserFacts] = useState<TeaserFacts | null>(null);
  const [grade, setGrade] = useState<CareerGrade | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChargeSheet, setShowChargeSheet] = useState(false);

  // 비인증/입력부족 → 되돌리기
  useEffect(() => {
    if (!hydrated || status === "loading") return;
    if (status === "unauthenticated") {
      signIn("kakao", { callbackUrl: "/career/teaser" });
      return;
    }
    if (!hasRequiredInput) {
      router.replace("/career/self");
    }
  }, [hydrated, status, hasRequiredInput, router]);

  // 잔액 선조회
  useEffect(() => {
    if (isAuthenticated) fetchBalance();
  }, [isAuthenticated, fetchBalance]);

  // 원국 계산 (무료 공개용, 클라이언트)
  useEffect(() => {
    if (!hydrated || !hasRequiredInput || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      setCalculating(true);
      try {
        let calcYear = Number(inputs.birthYear);
        let calcMonth = Number(inputs.birthMonth);
        let calcDay = Number(inputs.birthDay);
        if (inputs.calendarType === "lunar") {
          const solar = convertLunarToSolar(calcYear, calcMonth, calcDay);
          if (solar) { calcYear = solar.year; calcMonth = solar.month; calcDay = solar.day; }
        }
        const hour = inputs.unknownBirthTime ? undefined : Number(inputs.birthHour);
        const minute = inputs.unknownBirthTime ? undefined : Number(inputs.birthMinute);
        const saju = await calculateSaju(calcYear, calcMonth, calcDay, hour, minute, {
          birthLocation: inputs.birthLocation,
        });
        if (!cancelled) setSajuData(saju);
      } catch {
        if (!cancelled) setSajuData(null);
      } finally {
        if (!cancelled) setCalculating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hydrated, hasRequiredInput, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const enriched = useMemo(() => {
    if (!sajuData) return null;
    return enrichSajuData(sajuData, { isTimeUnknown: inputs.unknownBirthTime });
  }, [sajuData, inputs.unknownBirthTime]);

  // teaser(무료) 생성 — 등급/관성 유형 구조값 로드. 생명선 selfInput 사용.
  useEffect(() => {
    if (!hydrated || !hasRequiredInput || !isAuthenticated || !situation) return;
    let cancelled = false;
    (async () => {
      setTeaserState("loading");
      try {
        const res = await fetch("/api/career/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "self", selfInput, situation }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || "커리어운 미리보기를 준비하지 못했어.");
          setTeaserState("error");
          return;
        }
        setGrade((data?.grade ?? data?.teaser?.grade ?? null) as CareerGrade | null);
        setTeaserFacts((data?.teaser ?? null) as TeaserFacts | null);
        setTeaserState("ready");
      } catch {
        if (!cancelled) {
          setError("커리어운 미리보기를 준비하지 못했어.");
          setTeaserState("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [hydrated, hasRequiredInput, isAuthenticated, situation, selfInput]);

  // 결제 + 분석 — start(row 보장) → analyze(차감·분석). 생명선 selfInput을 양쪽에 동일하게 넘긴다.
  const runUnlock = useCallback(async (overrideBalance?: number) => {
    if (!situation) return;
    const effectiveBalance = overrideBalance ?? balance;
    if (effectiveBalance !== null && effectiveBalance < CAREER_COST) {
      setConfirming(false);
      setPaying(false);
      setShowChargeSheet(true);
      return;
    }

    setError(null);
    setPaying(true);
    setConfirming(true);
    try {
      // 1) start — teaser row 보장(멱등 upsert). selfInput = 위 생명선 객체.
      const startRes = await fetch("/api/career/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "self", selfInput, situation }),
      });
      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok) throw new Error(startData?.error || "커리어운 준비에 실패했어.");

      // 2) analyze — 실제 차감 + 분석. selfInput = 위 생명선 객체(start와 완전히 동일).
      const analyzeRes = await fetch("/api/career/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "self", selfInput, situation }),
      });
      const analyzeData = await analyzeRes.json().catch(() => ({}));

      if (analyzeRes.status === 402 || analyzeData?.insufficient) {
        if (typeof analyzeData?.balance === "number") setBalance(analyzeData.balance);
        setConfirming(false);
        setPaying(false);
        setShowChargeSheet(true);
        return;
      }
      if (!analyzeRes.ok) {
        throw new Error(
          analyzeData?.error ||
            (analyzeData?.refunded ? "분석에 실패했어. 알은 환불됐어." : "분석에 실패했어."),
        );
      }

      const resultId: string | undefined = analyzeData?.resultId;
      if (!resultId) throw new Error("결과 ID를 받지 못했어.");

      sessionStorage.setItem("careerJustPaid", "1");
      router.replace(`/career/result?id=${resultId}`);
    } catch (err: any) {
      setError(err?.message || "처리 중 오류가 발생했어.");
      setConfirming(false);
      setPaying(false);
    }
  }, [situation, balance, selfInput, router, setBalance]);

  const handleChargeComplete = useCallback(async (newBalance: number) => {
    setBalance(newBalance);
    setShowChargeSheet(false);
    await runUnlock(newBalance);
  }, [setBalance, runUnlock]);

  // charge-success 복귀 처리 — 충전 완료 후 자동 재시도 (today/career entry 패턴 미러).
  const afterChargeRanRef = useRef(false);
  useEffect(() => {
    if (afterChargeRanRef.current) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("afterCharge") !== "1") return;
    if (!hydrated || !isAuthenticated) return; // 준비 전 — 로드되면 재실행
    if (!hasRequiredInput || !situation) {
      afterChargeRanRef.current = true;
      window.history.replaceState({}, "", "/career/teaser");
      return;
    }
    afterChargeRanRef.current = true;
    setConfirming(true);
    window.history.replaceState({}, "", "/career/teaser");
    (async () => {
      const r = await fetch("/api/coins/balance").then((res) => res.json()).catch(() => null);
      const bal = typeof r?.balance === "number" ? r.balance : undefined;
      if (typeof bal === "number") setBalance(bal);
      await runUnlock(bal);
    })();
  }, [hydrated, isAuthenticated, hasRequiredInput, situation, runUnlock, setBalance]);

  // ───── 렌더 ─────
  if (confirming) {
    return (
      <FullScreenLoading
        steps={CAREER_LOADING_STEPS}
        estimatedDuration={90000}
        subMessage="보통 1~2분 걸려"
      />
    );
  }

  if (!isAuthenticated) {
    return <FullScreenLoading message="로그인으로 이동 중" />;
  }

  if (!hydrated || calculating) {
    return <FullScreenLoading message="사주를 계산하고 있어" subMessage="잠깐이면 돼" />;
  }

  if (!hasRequiredInput) {
    return null; // redirect 진행 중
  }

  const internalGrade: OverallGradeLabel = grade ? CAREER_TO_INTERNAL_GRADE[grade] : "D";
  const gc = getGradeColor(internalGrade);
  const gwanseongChip = teaserFacts?.gwanseongType ?? null;

  const displayBirthDate = `${inputs.birthYear}.${inputs.birthMonth}.${inputs.birthDay}`;

  return (
    <div className="min-h-screen bg-background-primary text-text-primary animate-fadeIn">
      <Header showBack sticky onBack={() => router.push("/career/self")} />

      <main className="px-6 py-8 pb-40">
        <div className="max-w-[640px] mx-auto space-y-6">
          {/* 사주 원국 — 무료 공개 */}
          {sajuData && (
            <div ref={wonguRef} className="bg-background-secondary rounded-3xl p-5 md:p-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">
                  {inputs.name ? `${inputs.name}님의 사주 원국` : "내 사주 원국"}
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

          {/* 등급 공개 + 잠금 안내 */}
          <div className="relative overflow-hidden rounded-3xl p-6 md:p-8" style={{ backgroundColor: "#141414" }}>
            <div
              className="pointer-events-none absolute left-1/2 top-[38%] h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px]"
              style={{ background: GRADE_GLOWS[internalGrade] }}
              aria-hidden="true"
            />
            <div className="relative flex flex-col items-center text-center">
              {situation && (
                <span className="mb-5 text-[13px] text-text-secondary">{situation} · 커리어운 심층 검사</span>
              )}
              {teaserState === "loading" ? (
                <>
                  <SkeletonBar className="w-[108px] h-[108px] rounded-full" />
                  <SkeletonBar className="h-5 w-28 mt-4" />
                </>
              ) : teaserState === "error" ? (
                <p className="text-body-2 text-text-secondary py-8">{error || "미리보기를 준비하지 못했어."}</p>
              ) : (
                <>
                  <OverallGradeBadgeSlot grade={internalGrade} size={108} />
                  {grade && (
                    <div className="mt-4 text-[14px] font-bold tracking-wide" style={{ color: gc.text }}>
                      커리어운 {grade}등급
                    </div>
                  )}
                  <h2 className="mt-4 font-aggro text-[24px] leading-[1.3] tracking-tight text-text-primary break-keep max-w-[380px]">
                    등급은 나왔어. 전체 리포트를 열어봐.
                  </h2>
                  <p className="mt-4 max-w-[380px] text-[15px] leading-[1.7] text-text-secondary break-keep">
                    관성 진단, 자리를 담는 그릇, 일의 흐름이 강해지는 시기까지 — 지금은 등급만 공개돼 있어.
                  </p>
                  {(situation || gwanseongChip) && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {situation && (
                        <span className="rounded-full border border-white/10 bg-background-secondary px-3 py-1.5 text-[13px] text-text-secondary">
                          {situation}
                        </span>
                      )}
                      {gwanseongChip && (
                        <span className="rounded-full border border-white/10 bg-background-secondary px-3 py-1.5 text-[13px] text-text-secondary">
                          {gwanseongChip}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 결제 영역 */}
          <div className="px-1 space-y-6 pt-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-body-2 text-text-secondary">소비 알</span>
                <span className="text-[17px] font-bold text-text-primary">{CAREER_COST}알</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body-2 text-text-secondary">현재 보유</span>
                <span className="text-[15px] text-text-primary">{balance ?? "-"}알</span>
              </div>
            </div>

            {error && teaserState !== "error" && (
              <p className="text-[13px] text-amber-400 text-center">{error}</p>
            )}

            <button
              type="button"
              onClick={() => runUnlock()}
              disabled={paying || teaserState !== "ready"}
              className="btn-primary w-full h-[56px] rounded-xl text-[17px] font-bold disabled:opacity-60 active:scale-[0.98] transition-transform"
            >
              {paying ? "준비 중…" : `${CAREER_COST}알로 커리어운 전체 보기`}
            </button>
          </div>
        </div>
      </main>

      <ChargeBottomSheet
        isOpen={showChargeSheet}
        onClose={() => setShowChargeSheet(false)}
        requiredCoins={CAREER_COST}
        currentBalance={balance ?? 0}
        onChargeComplete={handleChargeComplete}
        redirectPath="/career/teaser"
      />
    </div>
  );
}
