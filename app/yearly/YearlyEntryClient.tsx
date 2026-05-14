"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import { YEARLY_COST } from "@/lib/constants/coins";
import { useCoinStore } from "@/store/useCoinStore";
import { resolveSolarYear, formatIpchunLabel } from "@/lib/utils/ipchun";

type PrimarySaju = {
  sourceResultId: string;
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  calendarType: "solar" | "lunar";
  birthHour: string;
  birthMinute: string;
  birthLocation: string;
  gender: string;
  relationshipStatus: string;
  employmentStatus: string;
  coreFearAxis: string;
  unknownBirthTime: boolean;
};

// 입춘 기준 명리학 연도. 1/1~입춘 사이면 전년도 세운으로 자동 보정.
const YEAR_RESOLUTION = resolveSolarYear(new Date());
const TARGET_YEAR = YEAR_RESOLUTION.solarYear;
const IPCHUN_LABEL = formatIpchunLabel(YEAR_RESOLUTION.ipchunDate);

const CONFIRM_STEPS = [
  { message: "사주 데이터를 계산하고 있어", delay: 0 },
  { message: `${TARGET_YEAR}년 세운과 원국 상호작용을 분석하고 있어`, delay: 16_000 },
  { message: `${TARGET_YEAR}년의 흐름을 작성하고 있어`, delay: 50_000 },
  { message: "결과를 정리하고 있어", delay: 100_000 },
];

export default function YearlyEntryClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { balance, fetchBalance } = useCoinStore();

  const [primary, setPrimary] = useState<PrimarySaju | null>(null);
  const [primaryLoading, setPrimaryLoading] = useState(true);
  const [primaryError, setPrimaryError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = status === "authenticated";

  // 대표사주 로딩
  useEffect(() => {
    if (!isAuthenticated) {
      setPrimaryLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/yearly/from-primary");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setPrimaryError(data?.error || "사주 정보를 불러올 수 없습니다.");
        } else {
          setPrimary(data.result || null);
        }
      } catch {
        if (!cancelled) setPrimaryError("사주 정보를 불러올 수 없습니다.");
      } finally {
        if (!cancelled) setPrimaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // 잔액 로딩
  useEffect(() => {
    if (isAuthenticated) fetchBalance();
  }, [isAuthenticated, fetchBalance]);

  // 대표사주 정보로 intake 세션 만들기 (사용자 확인 클릭 시 곧장 spend 가능하도록)
  const createSession = useCallback(async () => {
    if (!primary) return null;
    try {
      const payload = {
        name: primary.name,
        birthYear: primary.birthYear,
        birthMonth: primary.birthMonth,
        birthDay: primary.birthDay,
        calendarType: primary.calendarType,
        birthHour: primary.birthHour,
        birthMinute: primary.birthMinute,
        birthLocation: primary.birthLocation,
        gender: primary.gender,
        relationshipStatus: primary.relationshipStatus || "솔로",
        employmentStatus: primary.employmentStatus || "직장인",
        coreFearAxis: primary.coreFearAxis || "DISMISS",
        unknownBirthTime: primary.unknownBirthTime,
      };
      const res = await fetch("/api/intake/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "준비가 안 됐어.");
      const sid = typeof data?.sessionId === "string" ? data.sessionId : "";
      if (!sid) throw new Error("연결이 안 됐어.");
      setSessionId(sid);
      return sid;
    } catch (err: any) {
      setError(err?.message || "준비 중 오류가 발생했어.");
      return null;
    }
  }, [primary]);

  useEffect(() => {
    if (primary && !sessionId) {
      void createSession();
    }
  }, [primary, sessionId, createSession]);

  // 결제 + 분석
  const handleStart = useCallback(async () => {
    if (!isAuthenticated) {
      signIn("kakao", { callbackUrl: "/yearly" });
      return;
    }
    if (!primary) return;

    setError(null);
    setPaying(true);
    try {
      let sid = sessionId;
      if (!sid) {
        sid = await createSession();
      }
      if (!sid) {
        setPaying(false);
        return;
      }

      const startRes = await fetch("/api/yearly/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          targetYear: TARGET_YEAR,
          sourceResultId: primary.sourceResultId,
        }),
      });
      const startData = await startRes.json().catch(() => ({}));

      if (startData.insufficient) {
        setError(`알이 부족해. ${YEARLY_COST}알이 필요해 (현재 ${startData.balance}알).`);
        setPaying(false);
        return;
      }
      if (!startRes.ok) {
        if (startData.refunded) {
          throw new Error("분석 준비에 실패했어. 알은 환불됐어.");
        }
        throw new Error(startData?.error || "처리에 실패했어.");
      }

      const resultId: string | undefined = startData.resultId;
      if (!resultId) throw new Error("결과 ID를 받지 못했어.");

      // 재사용된 결과면 곧장 결과로 이동
      if (startData.reused) {
        setPaying(false);
        sessionStorage.setItem("yearlyJustPaid", "1");
        router.replace(`/yearly/result/${resultId}`);
        return;
      }

      // 잔액 갱신
      if (typeof startData.balance === "number") {
        await fetchBalance();
      }

      // 분석 호출
      setConfirming(true);
      setPaying(false);
      const analyzeRes = await fetch("/api/yearly/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId }),
      });
      const analyzeData = await analyzeRes.json().catch(() => ({}));
      if (!analyzeRes.ok) {
        if (analyzeData.refunded) {
          throw new Error("분석에 실패했어. 알은 환불됐어.");
        }
        throw new Error(analyzeData?.error || "분석에 실패했어.");
      }

      sessionStorage.setItem("yearlyJustPaid", "1");
      router.replace(`/yearly/result/${resultId}`);
    } catch (err: any) {
      setError(err?.message || "처리에 실패했어.");
    } finally {
      setPaying(false);
      setConfirming(false);
    }
  }, [isAuthenticated, primary, sessionId, createSession, router, fetchBalance]);

  if (confirming) {
    return (
      <FullScreenLoading
        steps={CONFIRM_STEPS}
        estimatedDuration={180000}
        subMessage="보통 3분 정도 걸려"
      />
    );
  }

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="flex-1 px-5 pb-24">
        <div className="max-w-[640px] mx-auto pt-10 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold font-aggro text-text-primary">
              {TARGET_YEAR}년 운세
            </h1>
            <p className="text-body-2 text-text-secondary">
              내 사주 위에 {TARGET_YEAR}년 세운이 얹힌 한 해 풀이
            </p>
            {YEAR_RESOLUTION.beforeIpchun && (
              <p className="text-[12px] text-text-tertiary pt-2 leading-relaxed">
                명리학상 한 해의 시작은 입춘(立春).
                <br />
                {YEAR_RESOLUTION.gregorianYear}년 입춘 ({IPCHUN_LABEL}) 전이라
                {" "}
                <span className="text-text-secondary font-semibold">{TARGET_YEAR}년 세운</span>
                으로 봅니다.
              </p>
            )}
          </div>

          {/* 본문 */}
          {!isAuthenticated && status !== "loading" ? (
            <div className="rounded-2xl bg-background-secondary border border-white/5 p-6 text-center space-y-4">
              <p className="text-body-2 text-text-secondary">
                {TARGET_YEAR}년 한 해 운세만 빠르게 풀어볼 수 있어.
                <br />
                대표사주가 있으면 그걸로 풀이해.
              </p>
              <button
                onClick={() => router.push("/yearly/input")}
                className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
              >
                {TARGET_YEAR}년 운세만 보기
              </button>
              <button
                onClick={() => signIn("kakao", { callbackUrl: "/yearly" })}
                className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
              >
                카카오로 로그인해서 대표사주로 풀이
              </button>
            </div>
          ) : primaryLoading ? (
            <div className="text-center text-text-secondary py-12">불러오는 중…</div>
          ) : primaryError ? (
            <div className="rounded-2xl bg-background-secondary border border-white/5 p-6 text-center space-y-4">
              <p className="text-body-2 text-text-secondary">{primaryError}</p>
              <button
                onClick={() => router.push("/menu")}
                className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
              >
                메뉴로 가기
              </button>
            </div>
          ) : !primary ? (
            <div className="rounded-2xl bg-background-secondary border border-white/5 p-6 text-center space-y-4">
              <p className="text-body-2 text-text-secondary">
                {TARGET_YEAR}년 운세는 본인 사주를 기반으로 풀어줘.
                <br />
                대표사주가 있으면 그걸로 풀고, 없으면 입력해서 바로 볼 수 있어.
              </p>
              <button
                onClick={() => router.push("/yearly/input")}
                className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
              >
                {TARGET_YEAR}년 운세만 보기
              </button>
              <button
                onClick={() => router.push("/start")}
                className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
              >
                내 사주부터 보고 풀이
              </button>
            </div>
          ) : (
            <>
              {/* 사주 요약 카드 */}
              <div className="rounded-2xl bg-background-secondary border border-white/5 p-6 space-y-3">
                <div className="text-[12px] font-bold tracking-[0.05em] text-text-tertiary">
                  내 사주 정보
                </div>
                <div className="text-[20px] font-bold font-aggro text-text-primary">
                  {primary.name}
                </div>
                <div className="text-[14px] text-text-secondary">
                  {primary.calendarType === "lunar" ? "음력 " : ""}
                  {primary.birthYear}년 {Number(primary.birthMonth)}월 {Number(primary.birthDay)}일
                  {primary.unknownBirthTime
                    ? " (시간 미상)"
                    : ` ${primary.birthHour}:${primary.birthMinute}`}
                </div>
                <div className="text-[13px] text-text-tertiary">
                  {primary.birthLocation} · {primary.gender}
                </div>
              </div>

              {/* 비용 + 시작 */}
              <div className="rounded-2xl bg-background-secondary border border-white/5 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-body-2 text-text-secondary">소비 알</span>
                  <span className="text-[17px] font-bold text-text-primary">{YEARLY_COST}알</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body-2 text-text-secondary">현재 보유</span>
                  <span className="text-[15px] text-text-primary">{balance ?? "-"}알</span>
                </div>
                {error && (
                  <p className="text-[13px] text-amber-400 text-center">{error}</p>
                )}
                <button
                  onClick={handleStart}
                  disabled={paying}
                  className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold disabled:opacity-60"
                >
                  {paying ? "준비 중…" : `${TARGET_YEAR}년 운세 분석 시작`}
                </button>
                <button
                  onClick={() => router.push("/yearly/input")}
                  className="btn-secondary w-full h-[48px] rounded-xl text-[14px] font-semibold"
                >
                  다른 사주로 진행
                </button>
                {balance !== null && balance < YEARLY_COST && (
                  <button
                    onClick={() => router.push("/coins/charge")}
                    className="btn-secondary w-full h-[48px] rounded-xl text-[14px] font-semibold"
                  >
                    알 충전하기
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
