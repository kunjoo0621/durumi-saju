"use client";

// 재물운 자체입력(self) 미리보기 화면 — app/marriage/teaser/page.tsx 미러(원국 무료 공개 +
// 등급 잠금 + 결제 CTA). 대표사주 경로(/wealth/input)와 달리 여기서는 방금 입력한 생년월일
// (useInputStore)로 원국을 클라이언트에서 계산해 무료로 보여주고, source:"self"로 재물운
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
import { useWealthStore, hasWealthHydrated } from "@/store/useWealthStore";
import { useCoinStore } from "@/store/useCoinStore";
import { FullScreenLoading, SkeletonBar } from "@/components/loading";
import ChargeBottomSheet from "@/components/ChargeBottomSheet";
import { WEALTH_COST } from "@/lib/constants/coins";
import type { WealthInterest } from "@/lib/wealth-facts";
import type { SelfSajuInput } from "@/lib/self-input";
import type { SajuData } from "@/lib/utils/saju";
import type { EnrichedSajuData } from "@/lib/utils/saju-enrichment";
import { computeChartFromInput } from "@/lib/actions/chart";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

type JaeseongType = "정재우세" | "편재우세" | "재성혼재" | "무재";

// 등급은 결제 전에 화면·상태 어디에도 두지 않는다(서버도 티저 응답에서 grade를 빼고 내려준다).
type TeaserFacts = {
  jaeseongType?: JaeseongType;
  interest?: WealthInterest;
};

const WEALTH_LOADING_STEPS: Array<{ message: string; delay: number }> = [
  { message: "사주 데이터를 다시 불러오고 있어", delay: 0 },
  { message: "재성과 재를 담는 그릇을 짚어보는 중", delay: 15_000 },
  { message: "재물이 강해지는 시기를 찾는 중", delay: 45_000 },
  { message: "결과를 정리하고 있어", delay: 80_000 },
];

export default function WealthTeaserPage() {
  const router = useRouter();
  const { status } = useSession();
  const inputs = useAllInputs();
  const interest = useWealthStore((s) => s.interest);
  const { balance, setBalance, fetchBalance } = useCoinStore();

  const isAuthenticated = status === "authenticated";

  // store hydration 대기 (useInputStore + useWealthStore) — persist 값 로드 전 판단 금지.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const check = () => {
      if (hasInputHydrated() && hasWealthHydrated()) {
        setHydrated(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const unsub1 = useInputStore.persist.onFinishHydration(() => check());
    const unsub2 = useWealthStore.persist.onFinishHydration(() => check());
    return () => { unsub1(); unsub2(); };
  }, []);

  // 입력 검증 — 서버 필수(birth·gender) + 관심사. 부족하면 자체입력으로 되돌린다.
  const hasRequiredInput = useMemo(() => {
    if (!hydrated) return true; // hydration 전 redirect 방지
    return !!(
      inputs.birthYear &&
      inputs.birthMonth &&
      inputs.birthDay &&
      inputs.birthLocation &&
      inputs.gender &&
      interest
    );
  }, [hydrated, inputs, interest]);

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

  // ★ 재발 차단(2층): teaser fetch는 객체가 아니라 이 "문자열 키"로만 걸린다.
  // 서버가 buildInputHash에 쓰는 필드 전부 + interest를 담으므로, 정상 재진입(입력 수정·관심사
  // 변경)은 키가 바뀌어 정상 재요청되고, 참조만 새로 생기는 경우는 키가 같아 재요청이 불가능하다.
  // 2026-07-29 사고: 미러 파일인 career/teaser에서 selfInput 참조가 렌더마다 새로 생겨 effect가
  // 무한 재실행되며 /api/career/start에 5분간 22,674건이 나갔다. 1층(useShallow)이 원인을
  // 없앴지만, 이 키+ref 가드는 selector가 다시 깨져도 루프가 열리지 않게 하는 구조적 차단이다.
  const teaserKey = useMemo(
    () => JSON.stringify({ selfInput, interest }),
    [selfInput, interest],
  );
  const teaserFetchedKeyRef = useRef<string | null>(null);

  // 화면 상태
  const [sajuData, setSajuData] = useState<SajuData | null>(null);
  const [enriched, setEnriched] = useState<EnrichedSajuData | null>(null);
  const [calculating, setCalculating] = useState(true);
  const [wonguExpanded, setWonguExpanded] = useState(true);
  const wonguRef = useRef<HTMLDivElement>(null);

  const [teaserState, setTeaserState] = useState<"loading" | "ready" | "error">("loading");
  const [teaserFacts, setTeaserFacts] = useState<TeaserFacts | null>(null);
  // 재시도는 유저 탭으로만 일어난다(자동 재시도 없음) — 자동 재시도를 두면 실패 응답이 다시
  // 루프의 연료가 된다. 가드가 막다른 화면을 만들지 않도록 에러 UI에 "다시 시도"를 붙였다.
  const [teaserRetry, setTeaserRetry] = useState(0);

  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChargeSheet, setShowChargeSheet] = useState(false);

  // 비인증/입력부족 → 되돌리기
  useEffect(() => {
    if (!hydrated || status === "loading") return;
    if (status === "unauthenticated") {
      signIn("kakao", { callbackUrl: "/wealth/teaser" });
      return;
    }
    if (!hasRequiredInput) {
      router.replace("/wealth/self");
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
        // ★계산은 서버 액션이 한다 — 화면에서 계산하면 서버 분석값과 갈라진다(D-14).
        const chart = await computeChartFromInput({
          birthYear: inputs.birthYear,
          birthMonth: inputs.birthMonth,
          birthDay: inputs.birthDay,
          calendarType: inputs.calendarType,
          isLeapMonth: inputs.isLeapMonth ?? false,
          birthHour: inputs.birthHour,
          birthMinute: inputs.birthMinute,
          birthLocation: inputs.birthLocation,
          unknownBirthTime: inputs.unknownBirthTime,
        });
        if (!cancelled) { setSajuData(chart?.sajuData ?? null); setEnriched(chart?.enriched ?? null); }
      } catch {
        if (!cancelled) { setSajuData(null); setEnriched(null); }
      } finally {
        if (!cancelled) setCalculating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hydrated, hasRequiredInput, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps



  // teaser(무료) 생성 — 등급/재성 유형 구조값 로드. 생명선 selfInput 사용.
  useEffect(() => {
    if (!hydrated || !hasRequiredInput || !isAuthenticated || !interest) return;
    // 같은 요청은 두 번 쏘지 않는다. 이 가드가 열리는 건 (a) 키가 실제로 바뀌었을 때,
    // (b) 유저가 "다시 시도"를 눌러 ref를 비웠을 때 뿐이다 → 자가발전 루프가 불가능하다.
    if (teaserFetchedKeyRef.current === teaserKey) return;
    teaserFetchedKeyRef.current = teaserKey;
    let cancelled = false;
    (async () => {
      setTeaserState("loading");
      try {
        const res = await fetch("/api/wealth/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "self", selfInput, interest }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || "재물운 미리보기를 준비하지 못했어.");
          setTeaserState("error");
          return;
        }
        setTeaserFacts((data?.teaser ?? null) as TeaserFacts | null);
        setTeaserState("ready");
      } catch {
        if (!cancelled) {
          setError("재물운 미리보기를 준비하지 못했어.");
          setTeaserState("error");
        }
      }
    })();
    return () => { cancelled = true; };
    // selfInput은 의존성에서 의도적으로 뺐다 — 참조가 아니라 teaserKey(값 직렬화)로 걸어야
    // 루프가 막힌다. selfInput의 모든 필드가 teaserKey에 들어있으므로 값이 바뀌면 키가 바뀐다.
  }, [hydrated, hasRequiredInput, isAuthenticated, interest, teaserKey, teaserRetry]); // eslint-disable-line react-hooks/exhaustive-deps

  // 유저가 명시적으로 누르는 재시도 — ref를 비워 가드를 한 번만 열어준다.
  const retryTeaser = useCallback(() => {
    teaserFetchedKeyRef.current = null;
    setError(null);
    setTeaserRetry((n) => n + 1);
  }, []);

  // 결제 + 분석 — start(row 보장) → analyze(차감·분석). 생명선 selfInput을 양쪽에 동일하게 넘긴다.
  const runUnlock = useCallback(async (overrideBalance?: number) => {
    if (!interest) return;
    const effectiveBalance = overrideBalance ?? balance;
    if (effectiveBalance !== null && effectiveBalance < WEALTH_COST) {
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
      const startRes = await fetch("/api/wealth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "self", selfInput, interest }),
      });
      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok) throw new Error(startData?.error || "재물운 준비에 실패했어.");

      // 2) analyze — 실제 차감 + 분석. selfInput = 위 생명선 객체(start와 완전히 동일).
      const analyzeRes = await fetch("/api/wealth/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "self", selfInput, interest }),
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

      sessionStorage.setItem("wealthJustPaid", "1");
      router.replace(`/wealth/result?id=${resultId}`);
    } catch (err: any) {
      setError(err?.message || "처리 중 오류가 발생했어.");
      setConfirming(false);
      setPaying(false);
    }
  }, [interest, balance, selfInput, router, setBalance]);

  const handleChargeComplete = useCallback(async (newBalance: number) => {
    setBalance(newBalance);
    setShowChargeSheet(false);
    await runUnlock(newBalance);
  }, [setBalance, runUnlock]);

  // charge-success 복귀 처리 — 충전 완료 후 자동 재시도 (today/wealth entry 패턴 미러).
  const afterChargeRanRef = useRef(false);
  useEffect(() => {
    if (afterChargeRanRef.current) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("afterCharge") !== "1") return;
    if (!hydrated || !isAuthenticated) return; // 준비 전 — 로드되면 재실행
    if (!hasRequiredInput || !interest) {
      afterChargeRanRef.current = true;
      window.history.replaceState({}, "", "/wealth/teaser");
      return;
    }
    afterChargeRanRef.current = true;
    setConfirming(true);
    window.history.replaceState({}, "", "/wealth/teaser");
    (async () => {
      const r = await fetch("/api/coins/balance").then((res) => res.json()).catch(() => null);
      const bal = typeof r?.balance === "number" ? r.balance : undefined;
      if (typeof bal === "number") setBalance(bal);
      await runUnlock(bal);
    })();
  }, [hydrated, isAuthenticated, hasRequiredInput, interest, runUnlock, setBalance]);

  // ───── 렌더 ─────
  if (confirming) {
    return (
      <FullScreenLoading
        steps={WEALTH_LOADING_STEPS}
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

  const jaeseongChip = teaserFacts?.jaeseongType ?? null;

  const displayBirthDate = `${inputs.birthYear}.${inputs.birthMonth}.${inputs.birthDay}`;

  return (
    <div className="min-h-screen bg-background-primary text-text-primary animate-fadeIn">
      <Header showBack sticky onBack={() => router.push("/wealth/self")} />

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

          {/* 등급 잠금(물음표) + 결제 CTA — 등급은 유료 리포트의 결론이라 결제 전에는 공개하지 않는다.
              개인사주 티저(app/teaser/page.tsx)와 동일한 rank-unknown 패턴. 배경 글로우도 등급별
              색이라 색만으로 등급이 새므로 함께 제거했다. */}
          <div className="relative overflow-hidden rounded-3xl p-6 md:p-8" style={{ backgroundColor: "#141414" }}>
            <div className="relative flex flex-col items-center text-center">
              {interest && (
                <span className="mb-5 text-[13px] text-text-secondary">{interest} · 재물운 심층 검사</span>
              )}
              {teaserState === "loading" ? (
                <>
                  <SkeletonBar className="w-[120px] h-[120px] rounded-full" />
                  <SkeletonBar className="h-5 w-28 mt-4" />
                </>
              ) : teaserState === "error" ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <p className="text-body-2 text-text-secondary">{error || "미리보기를 준비하지 못했어."}</p>
                  <button
                    type="button"
                    onClick={retryTeaser}
                    className="btn-secondary h-[44px] rounded-xl px-5 text-[15px] font-bold active:scale-[0.98] transition-transform"
                  >
                    다시 시도
                  </button>
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/badges/rank-unknown.svg"
                    alt="등급 미공개"
                    className="object-contain"
                    style={{ width: 120, height: 120 }}
                    draggable={false}
                  />
                  <div className="mt-4 text-lg font-bold text-white/20">재물운 ?등급</div>
                  <h2 className="mt-4 font-aggro text-[24px] leading-[1.3] tracking-tight text-text-primary break-keep max-w-[380px]">
                    네 재물운 등급이 나왔어
                  </h2>
                  <p className="mt-4 max-w-[380px] text-[15px] leading-[1.7] text-text-secondary break-keep">
                    돈을 담는 그릇이 어떤지, 돈이 들어오는 시기가 언제인지까지 — 등급부터 확인해봐.
                  </p>
                  {(interest || jaeseongChip) && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {interest && (
                        <span className="rounded-full border border-white/10 bg-background-secondary px-3 py-1.5 text-[13px] text-text-secondary">
                          {interest}
                        </span>
                      )}
                      {jaeseongChip && (
                        <span className="rounded-full border border-white/10 bg-background-secondary px-3 py-1.5 text-[13px] text-text-secondary">
                          {jaeseongChip}
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
                <span className="text-[17px] font-bold text-text-primary">{WEALTH_COST}알</span>
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
              {paying ? "준비 중…" : `${WEALTH_COST}알로 재물운 전체 보기`}
            </button>
          </div>
        </div>
      </main>

      <ChargeBottomSheet
        isOpen={showChargeSheet}
        onClose={() => setShowChargeSheet(false)}
        requiredCoins={WEALTH_COST}
        currentBalance={balance ?? 0}
        onChargeComplete={handleChargeComplete}
        redirectPath="/wealth/teaser"
      />
    </div>
  );
}
