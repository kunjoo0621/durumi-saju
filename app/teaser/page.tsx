"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import MenuDrawer from "../MenuDrawer";
import ResultTable from "@/components/result/ResultTable";
import SajuChart from "@/components/saju/SajuChart";
import { useInputStore, useAllInputs, useStoreActions, type TeaserResult } from "@/store/useInputStore";
import { calculateSaju, type SajuData } from "@/lib/utils/saju";
import { convertLunarToSolar, formatDisplayDate, type CalendarType } from "@/lib/utils/lunar";
import { MOCK_RESULT } from "@/lib/mockResult";

export default function TeaserPage() {
  const router = useRouter();
  const { data: session } = useSession();

  // 최적화된 선택자 사용 - 개별 필드 변경시 전체 리렌더링 방지
  const inputs = useAllInputs();
  const { setAnalysisResult } = useStoreActions();
  const analysisResult = useInputStore((state) => state.analysisResult);

  const {
    name,
    birthYear,
    birthMonth,
    birthDay,
    calendarType,
    birthHour,
    birthMinute,
    birthLocation,
    gender,
    relationshipStatus,
    employmentStatus,
    coreFearAxis,
    unknownBirthTime,
  } = inputs;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [alreadyUnlocked, setAlreadyUnlocked] = useState(false);
  const [unlockedResultId, setUnlockedResultId] = useState<string | null>(null);
  const [sajuData, setSajuData] = useState<SajuData | null>(null);
  const [displayCalendarType, setDisplayCalendarType] = useState<CalendarType>("solar");
  const [displayBirthDate, setDisplayBirthDate] = useState<string>("");
  const previewFull = process.env.NEXT_PUBLIC_PREVIEW_RESULT === "true";

  const displayResult = useMemo(() => {
    if (!analysisResult) return previewFull ? MOCK_RESULT : null;
    if (previewFull) return analysisResult;
    return {
      ...analysisResult,
      sections: (analysisResult.sections || []).map((section) => ({
        icon: section.icon,
        title: section.title,
      })),
    } as TeaserResult;
  }, [analysisResult, previewFull]);

  const hasRequiredInput = useMemo(() => {
    return (
      name.trim() &&
      birthYear &&
      birthMonth &&
      birthDay &&
      birthLocation &&
      gender &&
      relationshipStatus &&
      employmentStatus &&
      coreFearAxis
    );
  }, [name, birthYear, birthMonth, birthDay, birthLocation, gender, relationshipStatus, employmentStatus, coreFearAxis]);

  const hasBirthInput = useMemo(() => {
    return Boolean(birthYear && birthMonth && birthDay);
  }, [birthYear, birthMonth, birthDay]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paymentFail = params.get("error");
    if (paymentFail === "payment") {
      setPaymentError("결제가 완료되지 않았습니다. 다시 시도해주세요.");
    }
  }, []);

  // 입력값 해시 - 의존성 최적화를 위한 안정적인 키
  const inputHash = useMemo(
    () =>
      JSON.stringify({
        name,
        birthYear,
        birthMonth,
        birthDay,
        calendarType,
        birthHour,
        birthMinute,
        birthLocation,
        gender,
        relationshipStatus,
        employmentStatus,
        unknownBirthTime,
      }),
    [
      name,
      birthYear,
      birthMonth,
      birthDay,
      calendarType,
      birthHour,
      birthMinute,
      birthLocation,
      gender,
      relationshipStatus,
      employmentStatus,
      unknownBirthTime,
    ]
  );

  // 진행 중인 요청 추적 (중복 요청 방지)
  const pendingAnalysis = useRef(false);

  // 통합된 useEffect - API 호출 + 사주 계산을 병렬로 실행
  useEffect(() => {
    if (!hasRequiredInput) {
      router.push("/start");
      return;
    }

    let cancelled = false;

    const runAll = async () => {
      const startedAt = Date.now();
      const promises: Promise<void>[] = [];

      // 1. 사주 계산 (항상 실행)
      if (hasBirthInput) {
        const sajuPromise = (async () => {
          const year = Number(birthYear);
          const month = Number(birthMonth);
          const day = Number(birthDay);
          if (!year || !month || !day) return;

          setDisplayCalendarType(calendarType);
          setDisplayBirthDate(formatDisplayDate(year, month, day));

          let calcYear = year;
          let calcMonth = month;
          let calcDay = day;
          if (calendarType === "lunar") {
            const converted = convertLunarToSolar(calcYear, calcMonth, calcDay);
            if (converted) {
              calcYear = converted.year;
              calcMonth = converted.month;
              calcDay = converted.day;
            }
          }

          const hour = unknownBirthTime ? undefined : Number(birthHour || "0");
          const minute = unknownBirthTime ? undefined : Number(birthMinute || "0");
          const saju = await calculateSaju(calcYear, calcMonth, calcDay, hour, minute);
          if (!cancelled) {
            setSajuData(saju);
          }
        })();
        promises.push(sajuPromise);
      }

      if (previewFull) {
        if (!analysisResult) {
          setAnalysisResult(MOCK_RESULT);
        }
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      // 2. API 분석 (결과가 없을 때만)
      if (!analysisResult && !pendingAnalysis.current) {
        pendingAnalysis.current = true;
        const analyzePromise = (async () => {
          try {
            const res = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                birthYear,
                birthMonth,
                birthDay,
                calendarType,
                birthHour,
                birthMinute,
                birthLocation,
                gender,
                relationshipStatus,
                employmentStatus,
                coreFearAxis,
                unknownBirthTime,
                mode: "teaser",
              }),
            });

            const data = await res.json();
            if (!res.ok) {
              throw new Error(data?.error || "분석에 실패했습니다.");
            }

            const result = data?.result as TeaserResult;
            if (!cancelled) {
              setAnalysisResult(result);
            }
          } catch (err: any) {
            if (!cancelled) {
              setError(err?.message || "분석에 실패했습니다.");
            }
          } finally {
            pendingAnalysis.current = false;
          }
        })();
        promises.push(analyzePromise);
      }

      // 3. 언락 상태 체크 (로그인 상태일 때만)
      if (session?.user) {
        const statusPromise = (async () => {
          try {
            const res = await fetch("/api/results/status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                birthYear,
                birthMonth,
                birthDay,
                calendarType,
                birthHour,
                birthMinute,
                birthLocation,
                gender,
                relationshipStatus,
                employmentStatus,
                coreFearAxis,
                unknownBirthTime,
              }),
            });

            if (!res.ok) return;
            const data = await res.json();
            if (!cancelled) {
              setAlreadyUnlocked(Boolean(data.unlocked));
              setUnlockedResultId(data.resultId || null);
            }
          } catch {
            // 상태 체크 실패는 무시
          }
        })();
        promises.push(statusPromise);
      }

      // 모든 작업 완료 대기
      await Promise.all(promises);

      // 최소 로딩 시간 보장
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, 3000 - elapsed);
      if (!cancelled) {
        setTimeout(() => setLoading(false), remaining);
      }
    };

    // 이미 결과가 있으면 로딩만 해제
    if (analysisResult && sajuData) {
      setLoading(false);
    } else {
      runAll();
    }

    return () => {
      cancelled = true;
    };
    // inputHash를 사용하여 의존성 단순화
  }, [hasRequiredInput, hasBirthInput, inputHash, analysisResult, session?.user, router, setAnalysisResult, previewFull]);

  const handleUnlock = async () => {
    if (alreadyUnlocked && unlockedResultId) {
      router.push(`/result?resultId=${unlockedResultId}`);
      return;
    }
    if (!session?.user) {
      signIn("kakao", { callbackUrl: "/payment?returnTo=/result" });
      return;
    }
    router.push("/payment?returnTo=/result");
  };

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      <header className="px-6 py-5 sticky top-0 z-[100] bg-background-primary">
        <div className="max-w-[420px] mx-auto flex items-center justify-between">
          <div className="w-10" />
          <h1 className="text-title-3 text-text-primary font-aggro">사주보는 두루미</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="flex-1 px-5 pb-48">
        <div className="max-w-[420px] w-full mx-auto pt-10 space-y-6">
          <div className="text-center">
            <h2 className="text-[24px] font-semibold text-text-primary font-aggro">
              {loading ? "사주 분석 중..." : "맛보기 결과"}
            </h2>
            <p className="text-body-2 text-text-secondary mt-2">
              결제하면 전체 결과를 바로 확인할 수 있어요
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && error && (
            <div className="bg-background-secondary rounded-2xl p-6 text-center text-text-secondary">
              {error}
            </div>
          )}

          {paymentError && (
            <div className="bg-background-secondary rounded-2xl p-4 text-center text-text-secondary">
              {paymentError}
            </div>
          )}

          {sajuData && (
            <div className="bg-background-secondary rounded-3xl p-6 md:p-8 border-0">
              {displayBirthDate && (
                <p className="text-[14px] text-text-tertiary mb-4">
                  ({displayCalendarType === "lunar" ? "음력" : "양력"} {displayBirthDate} 기준)
                </p>
              )}
              <SajuChart sajuData={sajuData} />
            </div>
          )}

          {!loading && !error && displayResult && (
            <ResultTable
              result={displayResult}
              locked={!previewFull}
              onUnlock={handleUnlock}
              unlockLabel={alreadyUnlocked ? "전체 결과 다시 보기" : "1,000원으로 전체 결과 보기"}
              statusLabel={previewFull ? "언락" : "잠금"}
              initialExpandedCount={0}
            />
          )}
        </div>
      </main>

      {!previewFull && (
        <div className="fixed left-0 right-0 bottom-0 z-[120] bg-background-primary px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <div className="max-w-[420px] mx-auto">
            <button
              onClick={handleUnlock}
              className="w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none transition-all duration-200 bg-primary text-text-primary"
            >
              {alreadyUnlocked ? "전체 결과 다시 보기" : "1,000원으로 전체 결과 보기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
