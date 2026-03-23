"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import ResultView from "@/components/result/ResultView";
import { useAllInputs, useInputStore, type AnalysisResult } from "@/store/useInputStore";
import { calculateSaju, type SajuData } from "@/lib/utils/saju";
import { convertLunarToSolar, formatDisplayDate, type CalendarType } from "@/lib/utils/lunar";
import { normalizeScores } from "@/lib/resultSchema";
import { parseJson5Loose } from "@/lib/json5Utils";
import { Warning } from "@phosphor-icons/react";
import { FullScreenLoading } from "@/components/loading";
import Modal from "@/components/Modal";

const CORE_FEAR_LABELS: Record<string, string> = {
  DISMISS: "인간관계",
  ABANDON: "이직·커리어",
  INCOMPETENT: "돈·재정",
  LOSS_OF_CONTROL: "건강·컨디션",
};

const LOADING_STEPS = [
  { message: "결과를 불러오고 있어", delay: 0 },
];

const PENDING_ANALYSIS_STEPS = [
  { message: "사주 데이터를 계산하고 있어", delay: 0 },
  { message: "해석을 작성하고 있어", delay: 5000 },
  { message: "마무리하고 있어", delay: 15000 },
];

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
  const usedCacheRef = useRef(false);
  const [error, setError] = useState<string>("");
  const [paidButFailed, setPaidButFailed] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);

  const [sajuData, setSajuData] = useState<SajuData | null>(null);
  const [displayCalendarType, setDisplayCalendarType] = useState<CalendarType>("solar");
  const [displayBirthDate, setDisplayBirthDate] = useState<string>("");
  const [resultBirthYear, setResultBirthYear] = useState<number>(0);
  const resultIdParam = useMemo(() => searchParams?.get("resultId"), [searchParams]);
  const pendingParam = useMemo(() => searchParams?.get("pending") === "true", [searchParams]);
  const claimParam = useMemo(() => searchParams?.get("claim") === "true", [searchParams]);
  const [claimPending, setClaimPending] = useState(claimParam);
  const [analysisStatus, setAnalysisStatus] = useState<"pending" | "completed" | "failed" | null>(
    pendingParam ? "pending" : null
  );
  const [allowedByPayment, setAllowedByPayment] = useState(() => {
    if (typeof window === "undefined") return false;
    const justPaid = sessionStorage.getItem("sajuJustPaid") === "1";
    if (justPaid) {
      sessionStorage.removeItem("sajuJustPaid");
      return true;
    }
    return false;
  });

  // 입력값 해시 - 의존성 최적화
  const inputHash = useMemo(
    () => JSON.stringify(inputs),
    [inputs]
  );

  const fetchResult = useCallback(async () => {
    try {
      setError("");
      setPaidButFailed(false);

      // 캐시된 결과가 있으면 fetch 생략
      const cached = useInputStore.getState().cachedResultResponse;
      const hasStoreInput = Boolean(birthYear && birthMonth && birthDay);
      let data: any;

      if (cached) {
        data = cached;
        usedCacheRef.current = true;
      } else {
        setLoading(true);

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

        // 분석 진행 중 (202 Accepted)
        if (res.status === 202) {
          const pendingData = await res.json().catch(() => ({}));
          if (pendingData.resultId) setResultId(pendingData.resultId);
          setAnalysisStatus("pending");
          return;
        }

        if (!res.ok) {
          if (res.status === 404 && status !== "authenticated") {
            setError("결과가 사라졌거나 못 찾겠어.\n게스트 결과는 24시간 뒤에 지워져.");
            return;
          }
          const errData = await res.json().catch(() => ({}));
          if (errData?.failed && errData?.refunded) {
            setError("분석에 실패했어. 알은 환불됐으니 걱정마.");
            // paidButFailed 설정 안 함 — 알이 환불되었으므로 "처음으로" 유도
            return;
          }
          throw new Error(errData?.error || "결과를 못 불러왔어.");
        }

        data = await res.json();
      }
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
          setError("입력 정보가 없어서 결과를 보여줄 수 없어.");
        }
      } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("분석이 오래 걸리고 있어. 다시 시도해봐.");
        const justPaid = sessionStorage.getItem("sajuJustPaid") === "1";
        if (justPaid || allowedByPayment) {
          setPaidButFailed(true);
        }
        return;
      }
      const message = err instanceof Error ? err.message : "뭔가 잘못됐어. 다시 시도해봐.";
      if (typeof message === "string" && message.includes("JSON5")) {
        setError("결과가 이상하게 왔어. 잠깐 뒤에 다시 해봐.");
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
      // 캐시 1회 소비 후 store 정리 (결과 설정 이후에 실행하여 불필요한 리렌더 방지)
      if (usedCacheRef.current) {
        useInputStore.getState().setCachedResultResponse(null);
      }
    }
  }, [inputHash, resultIdParam, allowedByPayment, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // analysisStatus를 ref로도 추적 (main effect의 deps에서 제외하기 위함)
  const analysisStatusRef = useRef(analysisStatus);
  analysisStatusRef.current = analysisStatus;

  useEffect(() => {
    if (claimPending) return;
    if (analysisStatusRef.current === "pending") return;
    fetchResult();
  }, [fetchResult, claimPending]); // analysisStatus 의존성 제거 → 이중 호출 방지

  // pending 상태 진입 시 분석 트리거 + polling 시작
  const analyzeTriggeredRef = useRef(false);
  useEffect(() => {
    if (analysisStatus !== "pending") return;
    const rid = resultId || resultIdParam;
    if (!rid) return;

    // 분석 API 호출 (fire-and-forget — 별도 함수에서 LLM 실행)
    if (!analyzeTriggeredRef.current) {
      analyzeTriggeredRef.current = true;
      fetch("/api/results/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: rid }),
        keepalive: true, // 탭 닫혀도 요청이 서버에 도달하도록
      }).catch(() => {});
    }

    // polling: 분석은 최소 8초 걸리므로 첫 poll은 7초 후, 이후 3초 간격
    const poll = async () => {
      try {
        const res = await fetch(`/api/results/progress?resultId=${rid}`);
        const data = await res.json();
        if (data.status === "completed") {
          setAnalysisStatus(null);
          fetchResult(); // 직접 호출 (state 변경 경유 X → 이중 호출 방지)
        } else if (data.status === "failed") {
          setAnalysisStatus("failed");
          setError("분석에 실패했어. 알은 환불됐으니 걱정마.");
          setLoading(false);
          // paidButFailed 설정 안 함 — 알이 환불되었으므로 "다시 시도" 대신 처음으로 유도
        }
      } catch {
        // polling 실패는 무시, 다음 interval에서 재시도
      }
    };

    const firstTimeout = setTimeout(poll, 7000);
    const interval = setInterval(poll, 3000);
    return () => { clearTimeout(firstTimeout); clearInterval(interval); };
  }, [analysisStatus, resultId, resultIdParam, fetchResult]);


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

  const [showToast, setShowToast] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingLeaveUrl, setPendingLeaveUrl] = useState<string | null>(null);

  const handleLeave = (url: string) => {
    if (isGuest) {
      setPendingLeaveUrl(url);
      setShowLeaveDialog(true);
    } else {
      router.push(url);
    }
  };
  const handleShare = async () => {
    const id = resultId || resultIdParam;
    if (!id) return;
    const shareUrl = `${window.location.origin}/result/share/${id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      // fallback ignored
    }
  };

  if (analysisStatus === "pending") {
    return (
      <FullScreenLoading
        steps={PENDING_ANALYSIS_STEPS}
        subMessage="잠깐이면 돼"
      />
    );
  }

  if (loading && !usedCacheRef.current) {
    return (
      <FullScreenLoading
        steps={LOADING_STEPS}
        subMessage="잠깐이면 돼"
      />
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
                className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors"
              >
                다시 시도
              </button>
            )}
            <button
              onClick={() => router.push(paidButFailed ? "/menu" : "/start")}
              className={paidButFailed
                ? "btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                : "btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors"
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
            className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors"
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
      onBack={() => handleLeave("/menu")}
      footer={
        <>
          {/* 공유 + 다시 보기 */}
          <div className="px-6 py-8">
            <div className="max-w-[640px] mx-auto space-y-3">
              {shareableId && (
                <button
                  onClick={handleShare}
                  className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors duration-200"
                >
                  결과 공유하기
                </button>
              )}
              <button
                onClick={() => handleLeave("/menu")}
                className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
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

          {/* 게스트 이탈 방지 다이얼로그 */}
          <Modal
            isOpen={showLeaveDialog}
            onClose={() => setShowLeaveDialog(false)}
            maxWidth="340px"
            ariaLabel="결과 저장 안내"
          >
            <div className="p-6">
              <h3 className="text-[17px] font-bold text-text-primary text-center mb-2">
                지금 나가면 결과가 저장 안 돼
              </h3>
              <p className="text-[13px] text-text-secondary text-center mb-6">
                카카오 로그인하면 결과가 계속 저장돼
              </p>
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveDialog(false);
                    signIn("kakao", { callbackUrl: "/result?claim=true" });
                  }}
                  className="w-full h-[54px] rounded-xl bg-primary-kakao text-black text-[15px] font-semibold flex items-center justify-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="text-black">
                    <path
                      d="M12 4c-5.06 0-9 3.15-9 7.03 0 2.47 1.54 4.63 3.9 5.87l-.7 3.06a.5.5 0 0 0 .75.54l3.56-2.26c.5.07 1.02.1 1.55.1 5.06 0 9-3.15 9-7.03S17.06 4 12 4z"
                      fill="currentColor"
                    />
                  </svg>
                  카카오로 저장하기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveDialog(false);
                    if (pendingLeaveUrl) router.push(pendingLeaveUrl);
                  }}
                  className="w-full h-[54px] rounded-xl text-[14px] text-text-tertiary transition-colors"
                >
                  저장하지 않고 나가기
                </button>
              </div>
            </div>
          </Modal>

          {/* 클립보드 복사 토스트 */}
          <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[150] bg-background-tertiary text-text-primary px-4 py-2 rounded-lg text-[14px] shadow-lg transition-opacity duration-300 ${showToast ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            결과 링크가 복사되었어요
          </div>

          {/* 게스트용 하단 스티키 카카오 로그인 CTA */}
          {isGuest && (
            <div className="fixed inset-x-0 bottom-0 z-[130] border-t border-white/10 bg-black/45 px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] backdrop-blur-xl">
              <div className="max-w-[640px] mx-auto">
                <p className="text-[12px] text-white/78 text-center mb-2">
                  지금 로그인하면 결과가 계속 저장돼
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
