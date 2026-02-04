"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import JSON5 from "json5";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import ResultTable from "@/components/result/ResultTable";
import MenuDrawer from "../MenuDrawer";
import SajuChart from "@/components/saju/SajuChart";
import { useAllInputs, type AnalysisResult } from "@/store/useInputStore";
import { calculateSaju, type SajuData } from "@/lib/utils/saju";
import { convertLunarToSolar, formatDisplayDate, type CalendarType } from "@/lib/utils/lunar";
import { normalizeScores } from "@/lib/analysis";

// JSON 추출 함수를 컴포넌트 외부로 이동 (매 렌더링마다 재생성 방지)
const extractJson = (text: string) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1).trim();
  }
  return text.trim();
};

const CORE_FEAR_LABELS: Record<string, string> = {
  DISMISS: "인간관계",
  ABANDON: "이직·커리어",
  INCOMPETENT: "돈·재정",
  LOSS_OF_CONTROL: "건강·컨디션",
};

export default function ResultClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

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

  const [sajuData, setSajuData] = useState<SajuData | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [displayCalendarType, setDisplayCalendarType] = useState<CalendarType>("solar");
  const [displayBirthDate, setDisplayBirthDate] = useState<string>("");
  const resultIdParam = useMemo(() => searchParams?.get("resultId"), [searchParams]);
  const [allowedByPayment, setAllowedByPayment] = useState(false);

  // 입력값 해시 - 의존성 최적화
  const inputHash = useMemo(
    () => JSON.stringify(inputs),
    [inputs]
  );

  useEffect(() => {
    const fetchResult = async () => {
      try {
        setLoading(true);
        setRequiresLogin(false);

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

        const res = await fetch("/api/results/full", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(payload || {}),
            ...(resultIdParam ? { resultId: resultIdParam } : {}),
          }),
        });

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
          typeof data.result === "string" ? JSON5.parse(extractJson(data.result)) : data.result;
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
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
    // inputHash를 사용하여 의존성 단순화 (불필요한 재실행 방지)
  }, [inputHash, resultIdParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const justPaid = sessionStorage.getItem("sajuJustPaid") === "1";
    if (justPaid) {
      sessionStorage.removeItem("sajuJustPaid");
      setAllowedByPayment(true);
    }
  }, []);

  useEffect(() => {
    if (!resultIdParam && !allowedByPayment && session?.user) {
      router.replace("/my/results");
    }
  }, [resultIdParam, allowedByPayment, session, router]);


  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" aria-label="로딩 중" />
          </div>
          <h2 className="text-title-2 text-text-primary mb-2">운명을 분석하고 있어요</h2>
          <p className="text-body-2 text-text-secondary">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

  if (requiresLogin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
        <div className="max-w-md w-full text-center">
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
        <div className="max-w-md w-full text-center">
          <div className="mb-6 text-6xl" aria-hidden="true">⚠️</div>
          <h2 className="text-title-2 text-text-primary mb-4">분석에 실패했습니다</h2>
          <p className="text-body-2 text-text-secondary mb-8">{error}</p>
          <button
            onClick={() => router.push("/start")}
            className="btn-primary px-8 py-4 rounded-2xl text-button-md transition-colors"
          >
            처음으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background-primary">
      {/* 헤더 */}
      <header className="px-6 py-5 sticky top-0 z-[100] bg-background-primary">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="w-10" />
          <h1 className="text-title-3 text-text-primary text-center font-aggro">사주보는 두루미</h1>
          <MenuDrawer />
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {!session?.user && (
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

          {/* 만세력 (사주팔자) */}
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

          <ResultTable result={result} locked={false} statusLabel="언락" initialExpandedCount={2} />
        </div>
      </main>

      {/* 다시 보기 버튼 */}
      <div className="px-6 py-8">
        <div className="max-w-3xl mx-auto">
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
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] text-text-tertiary">
            이 분석은 AI를 활용한 참고 자료입니다.
            <br />
            실제 운명은 당신의 선택과 노력에 달려있습니다.
          </p>
        </div>
      </footer>

    </div>
  );
}
