"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import ResultView from "@/components/result/ResultView";
import { useAllInputs, type AnalysisResult } from "@/store/useInputStore";
import { calculateSaju, type SajuData } from "@/lib/utils/saju";
import { convertLunarToSolar, formatDisplayDate, type CalendarType } from "@/lib/utils/lunar";
import { normalizeScores } from "@/lib/resultSchema";
import { parseJson5Loose } from "@/lib/json5Utils";
import { Warning } from "@phosphor-icons/react";

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
  const [isGuest, setIsGuest] = useState(false);

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
  const [resultId, setResultId] = useState<string | null>(null);

  const [sajuData, setSajuData] = useState<SajuData | null>(null);
  const [displayCalendarType, setDisplayCalendarType] = useState<CalendarType>("solar");
  const [displayBirthDate, setDisplayBirthDate] = useState<string>("");
  const [resultBirthYear, setResultBirthYear] = useState<number>(0);
  const resultIdParam = useMemo(() => searchParams?.get("resultId"), [searchParams]);
  const claimParam = useMemo(() => searchParams?.get("claim") === "true", [searchParams]);
  const [claimPending, setClaimPending] = useState(claimParam);
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

        if (!res.ok) {
          if (res.status === 404 && status !== "authenticated") {
            setError("결과가 만료되었거나 찾을 수 없습니다.\n게스트 결과는 24시간 후 자동 삭제돼요.");
            return;
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "결과를 불러오는데 실패했습니다.");
        }

        const data = await res.json();
        setIsGuest(Boolean(data.is_guest));
        if (data.resultId) setResultId(data.resultId);
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
          setResultBirthYear(year);

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
  }, [inputHash, resultIdParam, allowedByPayment, status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (claimPending) return;
    fetchResult();
  }, [fetchResult, claimPending]);


  // 로그인 후 돌아왔을 때 자동 claim
  const claimedRef = useRef(false);
  useEffect(() => {
    if (!claimPending || status !== "authenticated" || claimedRef.current) return;
    claimedRef.current = true;
    fetch("/api/results/claim", { method: "POST" })
      .then((res) => {
        if (res.ok) {
          setIsGuest(false);
          const url = new URL(window.location.href);
          url.searchParams.delete("claim");
          router.replace(url.pathname + url.search);
        }
      })
      .catch(() => {})
      .finally(() => setClaimPending(false));
  }, [claimPending, status, router]);

  // 로그인 사용자 + resultId 없음 + 결제 직후 아님 → 내 결과 목록으로
  useEffect(() => {
    if (claimedRef.current) return;
    if (!resultIdParam && !allowedByPayment && !claimParam && status === "authenticated" && session?.user) {
      router.replace("/my/results");
    }
  }, [resultIdParam, allowedByPayment, claimParam, session, router, status]);

  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    const id = resultId || resultIdParam;
    if (!id) return;
    const shareUrl = `${window.location.origin}/result/share/${id}`;
    const grade = result?.tier?.grade;
    const title = grade ? `${grade}등급 | 사주보는 두루미` : "사주보는 두루미";

    if (navigator.share) {
      try {
        await navigator.share({ title, text: result?.tier?.title || "", url: shareUrl });
      } catch (err) {
        if ((err as Error).name !== "AbortError") console.error("Share failed:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback ignored
      }
    }
  };

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

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
        <div className="max-w-[640px] w-full text-center">
          <div className="mb-6 flex justify-center" aria-hidden="true"><Warning weight="duotone" size={64} className="text-amber-400" /></div>
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

  const shareableId = resultId || resultIdParam;

  return (
    <ResultView
      result={result}
      sajuData={sajuData}
      displayBirthDate={displayBirthDate}
      displayCalendarType={displayCalendarType}
      unknownBirthTime={unknownBirthTime}
      resultBirthYear={resultBirthYear}
      birthYear={birthYear}
      footer={
        <>
          {/* 공유 + 다시 보기 */}
          <div className="px-6 py-8">
            <div className="max-w-[640px] mx-auto space-y-3">
              {shareableId && (
                <button
                  onClick={handleShare}
                  className="btn-primary w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none transition-all duration-200"
                >
                  {copied ? "링크가 복사됐어요!" : "결과 공유하기"}
                </button>
              )}
              <button
                onClick={() => router.push("/start")}
                className="w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none text-gray-400 transition-all duration-200"
              >
                다시 보기
              </button>
            </div>
          </div>

          {/* 푸터 */}
          <footer className={`px-6 py-12 ${isGuest ? "pb-28" : ""}`}>
            <div className="max-w-[640px] mx-auto text-center">
              <p className="text-caption text-text-tertiary">
                이 분석은 AI를 활용한 참고 자료입니다.
                <br />
                실제 운명은 당신의 선택과 노력에 달려있습니다.
              </p>
            </div>
          </footer>

          {/* 게스트용 하단 스티키 카카오 로그인 CTA */}
          {isGuest && (
            <div className="fixed inset-x-0 bottom-0 z-[130] border-t border-white/10 bg-black/45 px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] backdrop-blur-xl">
              <div className="max-w-[640px] mx-auto">
                <p className="text-[12px] text-white/78 text-center mb-2">
                  지금 로그인하면 결과가 영구 저장돼요
                </p>
                <button
                  type="button"
                  onClick={() => signIn("kakao", { callbackUrl: "/result?claim=true" })}
                  className="w-full h-[54px] rounded-xl bg-[#FEE500] text-black text-[15px] font-semibold flex items-center justify-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="text-black">
                    <path
                      d="M12 4c-5.06 0-9 3.15-9 7.03 0 2.47 1.54 4.63 3.9 5.87l-.7 3.06a.5.5 0 0 0 .75.54l3.56-2.26c.5.07 1.02.1 1.55.1 5.06 0 9-3.15 9-7.03S17.06 4 12 4z"
                      fill="currentColor"
                    />
                  </svg>
                  카카오로 저장하기
                </button>
              </div>
            </div>
          )}
        </>
      }
    />
  );
}
