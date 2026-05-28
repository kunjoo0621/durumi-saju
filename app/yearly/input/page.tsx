"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Warning } from "@phosphor-icons/react";
import { useAllInputs } from "@/store/useInputStore";
import { FullScreenLoading } from "@/components/loading";
import ChargeBottomSheet from "@/components/ChargeBottomSheet";
import SajuInputFlow from "@/components/saju-input/SajuInputFlow";
import { resolveSolarYear } from "@/lib/utils/ipchun";
import { YEARLY_COST } from "@/lib/constants/coins";
import { useCoinStore } from "@/store/useCoinStore";

const TARGET_YEAR = resolveSolarYear(new Date()).solarYear;

const CONFIRM_STEPS = [
  { message: "사주 데이터를 계산하고 있어", delay: 0 },
  { message: `그 해의 세운 흐름을 분석하고 있어`, delay: 40_000 },
  { message: "결과를 정리하고 있어", delay: 120_000 },
];

export default function YearlyInputPage() {
  const router = useRouter();
  const formData = useAllInputs();
  const { balance, setBalance, fetchBalance } = useCoinStore();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChargeSheet, setShowChargeSheet] = useState(false);

  // 진입 시 잔액 한 번 가져오기 — client 선체크용
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // overrideBalance: 충전 직후 setBalance 비동기로 closure balance 가 stale 일 때 명시 전달.
  const runYearlyFlow = useCallback((overrideBalance?: number) => {
    void (async () => {
      // client 잔액 선체크 — 부족하면 로딩 없이 즉시 충전 시트 (today/input 패턴).
      let effectiveBalance = overrideBalance ?? balance;
      if (effectiveBalance === null) {
        const r = await fetch("/api/coins/balance").then((res) => res.json()).catch(() => null);
        if (typeof r?.balance === "number") {
          effectiveBalance = r.balance;
          setBalance(r.balance);
        }
      }
      if (effectiveBalance !== null && effectiveBalance < YEARLY_COST) {
        // afterCharge 경유 시 processing 로딩이 켜진 채 진입 — 충전 시트가 로딩에 덮이지 않게 해제
        setProcessing(false);
        setShowChargeSheet(true);
        return;
      }

      setProcessing(true);
      setError(null);
      try {
        // 1) intake session 생성
        const sessionRes = await fetch("/api/intake/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const sessionData = await sessionRes.json().catch(() => ({}));
        if (!sessionRes.ok) {
          throw new Error(sessionData?.error || "세션 생성에 실패했어.");
        }
        const sid: string | undefined = sessionData.sessionId;
        if (!sid) throw new Error("세션 ID를 받지 못했어.");

        // 2) yearly start (결제 + pending row 생성)
        const startRes = await fetch("/api/yearly/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, targetYear: TARGET_YEAR }),
        });
        const startData = await startRes.json().catch(() => ({}));

        if (startData?.insufficient) {
          if (typeof startData.balance === "number") setBalance(startData.balance);
          setShowChargeSheet(true);
          setProcessing(false);
          return;
        }
        if (!startRes.ok) {
          if (startData?.refunded) {
            throw new Error("분석 준비에 실패했어. 알은 환불됐어.");
          }
          throw new Error(startData?.error || "처리에 실패했어.");
        }

        const resultId: string | undefined = startData?.resultId;
        if (!resultId) throw new Error("결과 ID를 받지 못했어.");

        // 재사용된 결과면 바로 결과로
        if (startData?.reused) {
          sessionStorage.setItem("yearlyJustPaid", "1");
          router.replace(`/yearly/result/${resultId}`);
          return;
        }

        // 3) analyze
        const analyzeRes = await fetch("/api/yearly/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultId }),
        });
        const analyzeData = await analyzeRes.json().catch(() => ({}));
        if (!analyzeRes.ok) {
          if (analyzeData?.refunded) {
            throw new Error("분석에 실패했어. 알은 환불됐어.");
          }
          throw new Error(analyzeData?.error || "분석에 실패했어.");
        }

        sessionStorage.setItem("yearlyJustPaid", "1");
        router.replace(`/yearly/result/${resultId}`);
      } catch (err: any) {
        setError(err?.message || "처리 중 오류가 발생했어.");
        setProcessing(false);
      }
    })();
  }, [balance, formData, router, setBalance]);

  const handleComplete = useCallback(() => {
    runYearlyFlow();
  }, [runYearlyFlow]);

  // 충전 완료 콜백 — balance 갱신 후 자동 재시도 (overrideBalance 로 stale 회피)
  const handleChargeComplete = useCallback(async (newBalance: number) => {
    setBalance(newBalance);
    setShowChargeSheet(false);
    runYearlyFlow(newBalance);
  }, [setBalance, runYearlyFlow]);

  // charge-success 복귀 — 운영자가 결제 완료 화면 거쳐 돌아온 경우 자동 분석
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("afterCharge") !== "1") return;
    setProcessing(true); // 입력 폼 노출 없이 즉시 로딩 — 깜빡임 방지
    window.history.replaceState({}, "", "/yearly/input");
    (async () => {
      const r = await fetch("/api/coins/balance").then((res) => res.json()).catch(() => null);
      const bal = typeof r?.balance === "number" ? r.balance : undefined;
      if (typeof bal === "number") setBalance(bal);
      runYearlyFlow(bal);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (processing && !error) {
    return (
      <FullScreenLoading
        steps={CONFIRM_STEPS}
        estimatedDuration={180000}
        subMessage="보통 3분 정도 걸려"
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center px-6">
        <div className="max-w-[640px] w-full text-center">
          <div className="mb-6 flex justify-center">
            <Warning weight="duotone" size={64} className="text-amber-400" />
          </div>
          <h2 className="text-title-2 text-text-primary mb-4">분석에 실패했어</h2>
          <p className="text-body-2 text-text-secondary mb-8">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setProcessing(false);
            }}
            className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold mb-3"
          >
            다시 입력하기
          </button>
          <button
            onClick={() => router.push("/menu")}
            className="text-[13px] text-text-tertiary underline"
          >
            메뉴로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SajuInputFlow
        onComplete={handleComplete}
        callbackUrl="/yearly/input"
        backUrl="/menu"
        trackName="yearly"
        skipQuestions={["coreFearAxis"]}
        submitLabel={`${YEARLY_COST}알 사용해서 결과 받기`}
      />
      <ChargeBottomSheet
        isOpen={showChargeSheet}
        onClose={() => setShowChargeSheet(false)}
        requiredCoins={YEARLY_COST}
        currentBalance={balance ?? 0}
        onChargeComplete={handleChargeComplete}
        redirectPath="/yearly/input"
      />
    </>
  );
}
