"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import ResultTable from "@/components/result/ResultTable";
import MenuDrawer from "../MenuDrawer";
import SajuChart from "@/components/saju/SajuChart";
import { useAllInputs, type AnalysisResult } from "@/store/useInputStore";
import { calculateSaju, enrichSajuData, type SajuData } from "@/lib/utils/saju";
import ShinsalBadges from "@/components/saju/ShinsalBadges";
import { convertLunarToSolar, formatDisplayDate, type CalendarType } from "@/lib/utils/lunar";
import { normalizeScores } from "@/lib/resultSchema";
import { parseJson5Loose } from "@/lib/json5Utils";

const CORE_FEAR_LABELS: Record<string, string> = {
  DISMISS: "인간관계",
  ABANDON: "이직·커리어",
  INCOMPETENT: "돈·재정",
  LOSS_OF_CONTROL: "건강·컨디션",
};

export default function ResultClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  // 최적화된 선택자 사용
  const inputs = useAllInputs();
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

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [paidButFailed, setPaidButFailed] = useState(false);

  const [sajuData, setSajuData] = useState<SajuData | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [displayCalendarType, setDisplayCalendarType] = useState<CalendarType>("solar");
  const [displayBirthDate, setDisplayBirthDate] = useState<string>("");
  const resultIdParam = useMemo(() => searchParams?.get("resultId"), [searchParams]);
  const shinsalResult = useMemo(() => {
    if (!sajuData) return null;
    return enrichSajuData(sajuData, { isTimeUnknown: unknownBirthTime }).shinsal;
  }, [sajuData, unknownBirthTime]);
  const [allowedByPayment, setAllowedByPayment] = useState(() => {
    if (typeof window === "undefined") return false;
    const justPaid = sessionStorage.getItem("sajuJustPaid") === "1";
    if (justPaid) {
      sessionStorage.removeItem("sajuJustPaid");
      return true;
    }
    return false;
  });

  // 로딩 단계 표시
  const LOADING_STEPS = [
    { message: "사주 데이터를 계산하고 있어요", delay: 0 },
    { message: "해석을 작성하고 있어요", delay: 5000 },
    { message: "마무리하고 있어요", delay: 12000 },
  ];
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!loading) {
      loadingTimerRef.current.forEach(clearTimeout);
      loadingTimerRef.current = [];
      setLoadingStep(0);
      return;
    }
    setLoadingStep(0);
    const timers = LOADING_STEPS.slice(1).map((step, i) =>
      setTimeout(() => setLoadingStep(i + 1), step.delay)
    );
    loadingTimerRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [loading]);

  // 입력값 해시 - 의존성 최적화
  const inputHash = useMemo(
    () => JSON.stringify(inputs),
    [inputs]
  );

  const fetchResult = useCallback(async () => {
    try {
      setLoading(true);
      setRequiresLogin(false);
      setError("");
      setPaidButFailed(false);

      const hasStoreInput = Boolean(birthYear && birthMonth && birthDay);
      const payload = hasStoreInput
        ? {
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
          }
          : null;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const res = await fetch("/api/results/full", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(payload || {}),
            ...(resultIdParam ? { resultId: resultIdParam } : {}),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.status === 401) {
          setRequiresLogin(true);
          setError("");
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "결과를 불러오는데 실패했습니다.");
        }

        const data = await res.json();
        const parsed =
          typeof data.result === "string"
            ? parseJson5Loose<AnalysisResult>(data.result)
            : (data.result as AnalysisResult);
        parsed.scores = normalizeScores(parsed.scores);
        if (!parsed.coreFearAxisBlock || !parsed.coreFearAxisBlock.trim()) {
          const axis = data.input?.coreFearAxis;
          const label = axis ? CORE_FEAR_LABELS[String(axis)] || String(axis) : "미선택";
          parsed.coreFearAxisBlock = `선택한 고민: ${label}\n\n요즘 고민 선택이 없어 일반적인 기준으로 요약했어요.`;
        }
        setResult(parsed);

        const inputBirthDate = data.input?.birthDate;
        const inputCalendarType = (data.input?.calendarType as CalendarType) || calendarType;
        if (inputBirthDate) {
          const [year, month, day] = inputBirthDate.split("-").map((value: string) => Number(value));
          setDisplayCalendarType(inputCalendarType);
          setDisplayBirthDate(formatDisplayDate(year, month, day));

          let calcYear = year;
          let calcMonth = month;
          let calcDay = day;
          if (inputCalendarType === "lunar") {
            const converted = convertLunarToSolar(calcYear, calcMonth, calcDay);
            if (converted) {
              calcYear = converted.year;
              calcMonth = converted.month;
              calcDay = converted.day;
            }
          }
          const timeValue = data.input?.birthTime;
          const [hourValue, minuteValue] = timeValue
            ? timeValue.split(":").map((value: string) => Number(value))
            : [undefined, undefined];
          const saju = await calculateSaju(calcYear, calcMonth, calcDay, hourValue, minuteValue);
          setSajuData(saju);
          return;
        }

        if (hasStoreInput) {
          setDisplayCalendarType(calendarType);
          setDisplayBirthDate(formatDisplayDate(Number(birthYear), Number(birthMonth), Number(birthDay)));

          let calcYear = Number(birthYear);
          let calcMonth = Number(birthMonth);
          let calcDay = Number(birthDay);
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
          setSajuData(saju);
        } else {
          setError("입력 정보가 없어 결과를 표시할 수 없습니다.");
        }
      } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("분석이 오래 걸리고 있어요. 다시 시도해 주세요.");
        const justPaid = sessionStorage.getItem("sajuJustPaid") === "1";
        if (justPaid || allowedByPayment) {
          setPaidButFailed(true);
        }
        return;
      }
      const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      if (typeof message === "string" && message.includes("JSON5")) {
        setError("결과 데이터 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setError(message);
      }
      // 결제 직후 실패인 경우 구분
      const justPaid = sessionStorage.getItem("sajuJustPaid") === "1";
      if (justPaid || allowedByPayment) {
        setPaidButFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }, [inputHash, resultIdParam, allowedByPayment]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);


  useEffect(() => {
    if (!resultIdParam && !allowedByPayment && status === "authenticated" && session?.user) {
      router.replace("/my/results");
    }
  }, [resultIdParam, allowedByPayment, session, router, status]);


  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
        <div className="max-w-[640px] w-full text-center">
          <div className="mb-6">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" aria-label="로딩 중" />
          </div>
          <h2 className="text-title-2 text-text-primary mb-2">{LOADING_STEPS[loadingStep].message}</h2>
          <p className="text-body-2 text-text-secondary">보통 10~20초 정도 걸려요</p>
        </div>
      </div>
    );
  }

  if (requiresLogin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
        <div className="max-w-[640px] w-full text-center">
          <div className="mb-6 text-6xl" aria-hidden="true">🔒</div>
          <h2 className="text-title-2 text-text-primary mb-4">재조회는 로그인 후 가능합니다</h2>
          <p className="text-body-2 text-text-secondary mb-8">
            결제 직후에는 바로 확인할 수 있지만, 나중에 다시 보려면 로그인이 필요해요.
          </p>
          <button
            onClick={() => signIn("kakao", { callbackUrl: "/result" })}
            className="btn-primary px-8 py-4 rounded-2xl text-button-md transition-colors"
          >
            카카오로 로그인
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
        <div className="max-w-[640px] w-full text-center">
          <div className="mb-6 text-6xl" aria-hidden="true">⚠️</div>
          <h2 className="text-title-2 text-text-primary mb-4">분석에 실패했습니다</h2>
          <p className="text-body-2 text-text-secondary mb-4">{error}</p>
          {paidButFailed && (
            <p className="text-body-2 text-text-secondary mb-8">
              결제는 완료되었어요. 추가 결제 없이 다시 시도할 수 있어요.
            </p>
          )}
          <div className="space-y-3">
            {paidButFailed && (
              <button
                onClick={() => fetchResult()}
                className="btn-primary w-full px-8 py-4 rounded-2xl text-button-md transition-colors"
              >
                다시 시도
              </button>
            )}
            <button
              onClick={() => router.push(paidButFailed ? "/menu" : "/start")}
              className={paidButFailed
                ? "w-full px-8 py-4 rounded-2xl text-button-md text-text-secondary border border-white/10 bg-background-secondary transition-colors"
                : "btn-primary w-full px-8 py-4 rounded-2xl text-button-md transition-colors"
              }
            >
              {paidButFailed ? "메뉴로 돌아가기" : "처음으로 돌아가기"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
        <div className="max-w-[640px] w-full text-center">
          <h2 className="text-title-2 text-text-primary mb-4">결과를 불러올 수 없습니다</h2>
          <p className="text-body-2 text-text-secondary mb-8">입력 정보가 없거나 결과를 찾을 수 없어요.</p>
          <button
            onClick={() => router.push("/start")}
            className="btn-primary w-full px-8 py-4 rounded-2xl text-button-md transition-colors"
          >
            처음으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary animate-fadeIn">
      {/* 헤더 */}
      <header className="px-6 py-5 sticky top-0 z-[100] bg-[#0D0D0D] border-b border-white/5">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <div className="w-10" />
          <h1 className="text-title-3 text-text-primary text-center font-aggro">사주보는 두루미</h1>
          <MenuDrawer />
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="px-6 py-8">
        <div className="max-w-[640px] mx-auto space-y-6">
          {status !== "loading" && !session?.user && (
            <div className="rounded-2xl bg-background-secondary p-4 text-text-secondary flex flex-col gap-3">
              <p className="text-[14px]">
                나중에 다시 보려면 로그인하고 내역에 저장하세요.
              </p>
              <button
                onClick={() => signIn("kakao", { callbackUrl: "/result" })}
                className="w-full rounded-xl px-4 py-3 text-[14px] font-semibold text-text-primary bg-primary"
              >
                카카오로 저장하기
              </button>
            </div>
          )}

          {/* 내 사주 원본 — 최상단 */}
          {sajuData && (
            <div className="bg-background-secondary rounded-3xl p-6 md:p-8">
              <h3 className="text-lg font-bold text-white mb-1">내 사주 원본</h3>
              {displayBirthDate && (
                <p className="text-sm text-gray-500 mb-4">
                  ({displayCalendarType === "lunar" ? "음력" : "양력"} {displayBirthDate} 기준)
                </p>
              )}
              <SajuChart sajuData={sajuData} />
              {shinsalResult && shinsalResult.matches.length > 0 && (
                <ShinsalBadges matches={shinsalResult.matches} note={shinsalResult.meta?.note} />
              )}
            </div>
          )}

          <ResultTable result={result} locked={false} initialExpandedCount={2} />
        </div>
      </main>

      {/* 다시 보기 버튼 */}
      <div className="px-6 py-8">
        <div className="max-w-[640px] mx-auto">
          <button
            onClick={() => router.push("/start")}
            className="btn-primary w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none transition-all duration-200"
          >
            다시 보기
          </button>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="px-6 py-12">
        <div className="max-w-[640px] mx-auto text-center">
          <p className="text-caption text-text-tertiary">
            이 분석은 AI를 활용한 참고 자료입니다.
            <br />
            실제 운명은 당신의 선택과 노력에 달려있습니다.
          </p>
        </div>
      </footer>

    </div>
  );
}
