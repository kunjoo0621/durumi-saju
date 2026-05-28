"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading, SkeletonBar } from "@/components/loading";
import ChargeBottomSheet from "@/components/ChargeBottomSheet";
import { TODAY_COST } from "@/lib/constants/coins";
import { TODAY_LOADING_STEPS } from "@/lib/constants/today";
import { callTodayStart, callTodayAnalyze } from "@/lib/today-payment-flow";
import {
  DEFAULT_RELATIONSHIP_STATUS,
  DEFAULT_EMPLOYMENT_STATUS,
  DEFAULT_CORE_FEAR_AXIS,
} from "@/lib/constants/saju-defaults";
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

export default function TodayEntryClient() {
  const router = useRouter();
  const { status } = useSession();
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

  const handleStart = useCallback(async (overrideBalance?: number) => {
    if (!isAuthenticated) {
      signIn("kakao", { callbackUrl: "/today" });
      return;
    }
    if (!primary) return;

    // 클라이언트 잔액 체크 — 부족하면 API 호출 없이 충전 시트
    // overrideBalance: 충전 직후 setBalance가 비동기라 closure의 balance가 stale일 때 명시적 fresh 값
    const effectiveBalance = overrideBalance ?? balance;
    if (effectiveBalance !== null && effectiveBalance < TODAY_COST) {
      // afterCharge 경유 시 confirming 로딩이 켜진 채 진입 — 충전 시트가 로딩에 덮이지 않게 해제
      setConfirming(false);
      setShowChargeSheet(true);
      return;
    }

    setError(null);
    setPaying(true);
    // 클릭 즉시 로딩 화면 — start API 대기 동안 버튼 상태로 머무는 어색함 차단
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

      // 클릭 시점 KST 날짜 — 자정 넘겨 결제 케이스 대비 매번 fresh
      const targetDate = getKSTDateString();
      const startResult = await callTodayStart({
        sessionId: sid,
        targetDate,
        sourceResultId: primary.sourceResultId,
      });

      if (startResult.kind === "insufficient") {
        setBalance(startResult.balance);
        setConfirming(false);
        setPaying(false);
        setShowChargeSheet(true);
        return;
      }
      if (startResult.kind === "failed") {
        throw new Error(startResult.message);
      }
      if (startResult.kind === "reused") {
        sessionStorage.setItem("todayJustPaid", "1");
        router.replace(`/today/result/${startResult.resultId}`);
        return;
      }
      if (typeof startResult.balance === "number") {
        setBalance(startResult.balance);
      }

      const analyzeResult = await callTodayAnalyze(startResult.resultId);
      if (analyzeResult.kind === "failed") {
        throw new Error(analyzeResult.message);
      }
      sessionStorage.setItem("todayJustPaid", "1");
      router.replace(`/today/result/${startResult.resultId}`);
    } catch (err: any) {
      setError(err?.message || "처리에 실패했어.");
      setConfirming(false);
    }
  }, [isAuthenticated, primary, balance, sessionId, createSession, router, setBalance]);

  // 충전 완료 콜백 — balance 갱신 후 자동으로 분석 재시도
  const handleChargeComplete = useCallback(async (newBalance: number) => {
    setBalance(newBalance);
    setShowChargeSheet(false);
    await handleStart(newBalance);
  }, [setBalance, handleStart]);

  // charge-success 복귀 처리 — 운영자가 결제 완료 화면 거쳐 돌아온 경우.
  // 충전은 charge-success 가 이미 끝냄 → balance fresh 조회 후 handleStart(분석, targetDate 재계산) 직행.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("afterCharge") !== "1") return;
    setConfirming(true); // 대표사주 카드 노출 없이 즉시 로딩 — 깜빡임 방지
    window.history.replaceState({}, "", "/today");
    (async () => {
      const r = await fetch("/api/coins/balance").then((res) => res.json()).catch(() => null);
      const bal = typeof r?.balance === "number" ? r.balance : undefined;
      if (typeof bal === "number") setBalance(bal);
      await handleStart(bal);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (confirming) {
    return (
      <FullScreenLoading
        steps={TODAY_LOADING_STEPS}
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
            <>
              {/* 사주 카드 스켈레톤 */}
              <div className="rounded-2xl bg-background-secondary border border-white/5 p-6">
                <div className="flex items-center gap-4">
                  <SkeletonBar className="w-[64px] h-[64px] rounded-2xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBar className="h-5 w-32" />
                    <SkeletonBar className="h-4 w-44" />
                    <SkeletonBar className="h-3.5 w-28" />
                  </div>
                </div>
              </div>
              {/* 결제 영역 스켈레톤 */}
              <div className="px-1 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <SkeletonBar className="h-4 w-16" />
                    <SkeletonBar className="h-5 w-12" />
                  </div>
                  <div className="flex items-center justify-between">
                    <SkeletonBar className="h-4 w-16" />
                    <SkeletonBar className="h-4 w-12" />
                  </div>
                </div>
                <div className="space-y-3 pt-2">
                  <SkeletonBar className="h-[54px] w-full rounded-xl" />
                  <SkeletonBar className="h-[48px] w-full rounded-xl" />
                </div>
              </div>
            </>
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
                    onClick={() => handleStart()}
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
