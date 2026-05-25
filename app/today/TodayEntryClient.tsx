"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import ChargeBottomSheet from "@/components/ChargeBottomSheet";
import { TODAY_COST } from "@/lib/constants/coins";
import { useCoinStore } from "@/store/useCoinStore";
import { getKSTDateString } from "@/lib/utils/kst-date";
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

// KST 날짜 라벨 — 표시용. 진입 시점 1회 계산 (자정 넘기는 사용자는 새로고침 자연 유도).
// ★ 실제 분석 targetDate는 handleStart 클릭 시점에 fresh 계산 (자정 넘겨 결제 시 정확한 날짜 보장).
const INITIAL_DATE = getKSTDateString();
const [INITIAL_YEAR_STR, INITIAL_MONTH_STR, INITIAL_DAY_STR] = INITIAL_DATE.split("-");
const TARGET_DATE_LABEL = `${INITIAL_YEAR_STR}.${INITIAL_MONTH_STR}.${INITIAL_DAY_STR}`;

// today/input의 CONFIRM_STEPS와 동일 (사용자 체감 일관성)
const CONFIRM_STEPS = [
  { message: "사주 데이터를 계산하고 있어", delay: 0 },
  { message: "오늘 일진과 너의 사주를 매칭하는 중", delay: 8_000 },
  { message: "두루미가 오늘 너의 하루를 읽는 중", delay: 30_000 },
  { message: "결과를 정리하고 있어", delay: 70_000 },
];

export default function TodayEntryClient() {
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
        const res = await fetch("/api/today/from-primary");
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

  // 대표사주 정보로 intake 세션 만들기
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
      signIn("kakao", { callbackUrl: "/today" });
      return;
    }
    if (!primary) return;

    // ★ client 잔액 체크 — 부족하면 API 호출 안 하고 즉시 충전 시트 (TodayInputPage 패턴 미러)
    if (balance !== null && balance < TODAY_COST) {
      setShowChargeSheet(true);
      return;
    }

    setError(null);
    setPaying(true);  // 더블탭 방어
    // ★ 클릭 즉시 FullScreenLoading 전환 — "버튼 회색 → 가만히" 구간 제거
    // 사용자 체감 시간 ↓ (start API 1~3초 + balance fetch 1초 = 2~5초 동안 화면 전환 없던 문제 해결)
    setConfirming(true);
    try {
      let sid = sessionId;
      if (!sid) {
        sid = await createSession();
      }
      if (!sid) {
        setConfirming(false);
        setPaying(false);
        return;
      }

      // 클릭 시점 KST 날짜 fresh 산출 (모듈 로드 시점 X — 자정 넘겨 결제 케이스 대비)
      const targetDate = getKSTDateString();
      const startRes = await fetch("/api/today/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          targetDate,
          sourceResultId: primary.sourceResultId,
        }),
      });
      const startData = await startRes.json().catch(() => ({}));

      if (startData.insufficient) {
        if (typeof startData.balance === "number") {
          setBalance(startData.balance);
        }
        setConfirming(false);
        setPaying(false);
        setShowChargeSheet(true);
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
        sessionStorage.setItem("todayJustPaid", "1");
        router.replace(`/today/result/${resultId}`);
        return;
      }

      // 잔액 갱신 — fire-and-forget (대기 불필요)
      if (typeof startData.balance === "number") {
        void fetchBalance();
      }

      // 분석 호출
      const analyzeRes = await fetch("/api/today/analyze", {
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

      sessionStorage.setItem("todayJustPaid", "1");
      router.replace(`/today/result/${resultId}`);
    } catch (err: any) {
      setError(err?.message || "처리에 실패했어.");
      setConfirming(false);
    }
  }, [isAuthenticated, primary, balance, sessionId, createSession, router, fetchBalance, setBalance]);

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
        estimatedDuration={90000}
        subMessage="보통 1~2분 걸려"
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
              오늘 운세
            </h1>
            <p className="text-body-2 text-text-secondary">
              {TARGET_DATE_LABEL} · 내 사주 위에 오늘 일진이 얹힌 하루 풀이
            </p>
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
                오늘 운세는 본인 사주를 기반으로 풀어줘.
                <br />
                대표사주가 있으면 그걸로 풀고, 없으면 입력해서 바로 볼 수 있어.
              </p>
              <button
                onClick={() => router.push("/today/input")}
                className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
              >
                오늘 운세만 보기
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
              {/* 사주 요약 카드 — [등급 SVG] | 정보 | [변경] (세로 중앙 정렬, yearly entry 패턴 그대로) */}
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-body-2 text-text-secondary">소비 알</span>
                    <span className="text-[17px] font-bold text-text-primary">{TODAY_COST}알</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-body-2 text-text-secondary">현재 보유</span>
                    <span className="text-[15px] text-text-primary">{balance ?? "-"}알</span>
                  </div>
                </div>

                {error && (
                  <p className="text-[13px] text-amber-400 text-center">{error}</p>
                )}

                <div className="space-y-3">
                  <button
                    onClick={handleStart}
                    disabled={paying}
                    className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold disabled:opacity-60 active:scale-[0.98] transition-transform"
                  >
                    {paying ? "준비 중…" : "오늘 운세 분석 시작"}
                  </button>

                  <button
                    onClick={() => router.push("/today/input")}
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
        requiredCoins={TODAY_COST}
        currentBalance={balance ?? 0}
        onChargeComplete={handleChargeComplete}
        redirectPath="/today"
      />
    </div>
  );
}
