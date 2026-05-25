"use client";

// 오늘의 운세 입력 페이지 — yearly input 패턴 + targetDate (오늘)
// SajuInputFlow 재사용 + coreFearAxis/relationshipStatus skip (today 안 씀)
// 잔액 부족 시 ChargeBottomSheet 등장 → 충전 후 자동 재시도 (개인 사주 패턴 미러)

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Warning } from "@phosphor-icons/react";
import { useAllInputs } from "@/store/useInputStore";
import { FullScreenLoading } from "@/components/loading";
import ChargeBottomSheet from "@/components/ChargeBottomSheet";
import SajuInputFlow from "@/components/saju-input/SajuInputFlow";
import { TODAY_COST } from "@/lib/constants/coins";
import { TODAY_LOADING_STEPS } from "@/lib/constants/today";
import { callTodayStart, callTodayAnalyze } from "@/lib/today-payment-flow";
import { getKSTDateString } from "@/lib/utils/kst-date";
import { useCoinStore } from "@/store/useCoinStore";

export default function TodayInputPage() {
  const router = useRouter();
  const formData = useAllInputs();
  const { balance, setBalance, fetchBalance } = useCoinStore();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChargeSheet, setShowChargeSheet] = useState(false);
  const [chargeToast, setChargeToast] = useState<string | null>(null);

  // 진입 시 잔액 한 번 가져오기 — client 체크용
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const runTodayFlow = useCallback(async () => {
    // ★ client 잔액 체크 — 부족하면 session/start API 호출 안 하고 즉시 충전 시트
    //   (balance가 null이면 fetch 못 끝낸 케이스 — backend가 fallback으로 처리)
    if (balance !== null && balance < TODAY_COST) {
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

      // 2) today start — targetDate는 클릭 시점 KST (자정 넘김 케이스 대비)
      const targetDate = getKSTDateString();
      const startResult = await callTodayStart({ sessionId: sid, targetDate });

      if (startResult.kind === "insufficient") {
        setBalance(startResult.balance);
        setShowChargeSheet(true);
        setProcessing(false);
        return;
      }
      if (startResult.kind === "failed") {
        throw new Error(startResult.message);
      }
      if (typeof startResult.balance === "number") {
        setBalance(startResult.balance);
      }
      if (startResult.kind === "reused") {
        router.replace(`/today/result/${startResult.resultId}`);
        return;
      }

      // 3) analyze
      const analyzeResult = await callTodayAnalyze(startResult.resultId);
      if (analyzeResult.kind === "failed") {
        throw new Error(analyzeResult.message);
      }
      router.replace(`/today/result/${startResult.resultId}`);
    } catch (err: any) {
      setError(err?.message || "처리 중 오류가 발생했어.");
      setProcessing(false);
    }
  }, [balance, formData, router, setBalance]);

  const handleComplete = useCallback(() => {
    void runTodayFlow();
  }, [runTodayFlow]);

  const handleChargeComplete = useCallback(async (newBalance: number) => {
    setBalance(newBalance);
    setShowChargeSheet(false);
    // 충전 완료 토스트 — 분석 풀스크린 위에서도 보이게 z-[300]
    setChargeToast(`충전 완료! ${newBalance}알 사용 가능`);
    setTimeout(() => setChargeToast(null), 3000);
    await runTodayFlow();
  }, [setBalance, runTodayFlow]);

  if (processing && !error) {
    return (
      <FullScreenLoading
        steps={TODAY_LOADING_STEPS}
        estimatedDuration={90000}
        subMessage="보통 1~2분 걸려"
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
        callbackUrl="/today/input"
        backUrl="/menu"
        trackName="today"
        skipQuestions={["coreFearAxis"]}
        submitLabel={`${TODAY_COST}알 사용해서 오늘 운세 받기`}
      />

      <ChargeBottomSheet
        isOpen={showChargeSheet}
        onClose={() => setShowChargeSheet(false)}
        requiredCoins={TODAY_COST}
        currentBalance={balance ?? 0}
        onChargeComplete={handleChargeComplete}
        redirectPath="/today/input"
      />

      {/* 충전 완료 토스트 — 분석 풀스크린 위에 떠도 보이도록 z-[300] */}
      {chargeToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] bg-saju-wood-muted/95 text-white px-5 py-3 rounded-xl text-[14px] font-semibold shadow-lg backdrop-blur-sm animate-fadeIn flex items-center gap-2"
        >
          <span className="text-saju-wood">✓</span>
          <span>{chargeToast}</span>
        </div>
      )}
    </>
  );
}
