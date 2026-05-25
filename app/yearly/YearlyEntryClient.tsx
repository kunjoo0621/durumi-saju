"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import ChargeBottomSheet from "@/components/ChargeBottomSheet";
import { YEARLY_COST } from "@/lib/constants/coins";
import {
  DEFAULT_RELATIONSHIP_STATUS,
  DEFAULT_EMPLOYMENT_STATUS,
  DEFAULT_CORE_FEAR_AXIS,
} from "@/lib/constants/saju-defaults";
import { useCoinStore } from "@/store/useCoinStore";
import { resolveSolarYear, formatIpchunLabel } from "@/lib/utils/ipchun";
import { getGradeBadge } from "@/lib/utils/grade-colors";
import { displayGrade } from "@/lib/gradeSystem";

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
  grade?: string | null;
  ownedCount?: number;
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
  const { balance, fetchBalance, setBalance } = useCoinStore();

  const [primary, setPrimary] = useState<PrimarySaju | null>(null);
  const [primaryLoading, setPrimaryLoading] = useState(true);
  const [primaryError, setPrimaryError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChargeSheet, setShowChargeSheet] = useState(false);

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
        relationshipStatus: primary.relationshipStatus || DEFAULT_RELATIONSHIP_STATUS,
        employmentStatus: primary.employmentStatus || DEFAULT_EMPLOYMENT_STATUS,
        coreFearAxis: primary.coreFearAxis || DEFAULT_CORE_FEAR_AXIS,
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
        if (typeof startData.balance === "number") {
          setBalance(startData.balance);
        }
        setShowChargeSheet(true);
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
  }, [isAuthenticated, primary, sessionId, createSession, router, fetchBalance, setBalance]);

  // 충전 완료 콜백 — balance 갱신 후 자동으로 분석 재시도
  const handleChargeComplete = useCallback(async (newBalance: number) => {
    setBalance(newBalance);
    setShowChargeSheet(false);
    await handleStart();
  }, [setBalance, handleStart]);

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
        <div className="max-w-[640px] mx-auto pt-12 space-y-10">
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

          {/* 본문 — 서버에서 비로그인 차단하므로 항상 로그인 상태로 진입 */}
          {primaryLoading ? (
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
              {/* 사주 요약 카드 — [등급 SVG] | 정보 | [변경] (세로 중앙 정렬) */}
              <div className="rounded-2xl bg-background-secondary border border-white/5 p-6">
                <div className="flex items-center gap-4">
                  {/* 좌: 등급 SVG */}
                  {primary.grade && (
                    <div className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getGradeBadge(primary.grade)}
                        alt={`${displayGrade(primary.grade as any)}등급`}
                        className="w-[64px] h-[64px]"
                      />
                    </div>
                  )}

                  {/* 중: 사주 정보 */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="text-[19px] font-bold font-aggro text-text-primary truncate">
                      {primary.name}
                    </div>
                    <div className="text-[13.5px] text-text-secondary">
                      {primary.calendarType === "lunar" ? "음력 " : ""}
                      {primary.birthYear}.{String(primary.birthMonth).padStart(2, "0")}.{String(primary.birthDay).padStart(2, "0")}
                      {primary.unknownBirthTime
                        ? " (시간 미상)"
                        : ` ${String(primary.birthHour).padStart(2, "0")}:${String(primary.birthMinute).padStart(2, "0")}`}
                    </div>
                    <div className="text-[12px] text-text-tertiary">
                      {primary.birthLocation} · {primary.gender}
                    </div>
                  </div>

                  {/* 우: 변경 버튼 (사주 ≥2개일 때만) */}
                  {(primary.ownedCount ?? 0) >= 2 && (
                    <button
                      type="button"
                      onClick={() => router.push("/my/results")}
                      className="shrink-0 text-[12px] font-semibold text-text-tertiary hover:text-text-primary transition-colors px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 active:scale-95"
                    >
                      변경
                    </button>
                  )}
                </div>
              </div>

              {/* 그룹 2: 결제 (비용 + CTA) — 박스 없이 내부 정렬로 그룹핑 */}
              <div className="px-1 space-y-6">
                {/* 비용 정보 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-body-2 text-text-secondary">소비 알</span>
                    <span className="text-[17px] font-bold text-text-primary">{YEARLY_COST}알</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-body-2 text-text-secondary">현재 보유</span>
                    <span className="text-[15px] text-text-primary">{balance ?? "-"}알</span>
                  </div>
                </div>

                {error && (
                  <p className="text-[13px] text-amber-400 text-center">{error}</p>
                )}

                {/* CTA */}
                <div className="space-y-3">
                  <button
                    onClick={handleStart}
                    disabled={paying}
                    className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold disabled:opacity-60 active:scale-[0.98] transition-transform"
                  >
                    {paying ? "준비 중…" : `${TARGET_YEAR}년 운세 분석 시작`}
                  </button>

                  <button
                    onClick={() => router.push("/yearly/input")}
                    className="btn-secondary w-full h-[48px] rounded-xl text-[14px] font-semibold active:scale-[0.98] transition-transform"
                  >
                    다른 사주로 진행
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <ChargeBottomSheet
        isOpen={showChargeSheet}
        onClose={() => setShowChargeSheet(false)}
        requiredCoins={YEARLY_COST}
        currentBalance={balance ?? 0}
        onChargeComplete={handleChargeComplete}
        redirectPath="/yearly"
      />
    </div>
  );
}
