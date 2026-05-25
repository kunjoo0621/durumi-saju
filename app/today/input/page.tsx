"use client";

// 오늘의 운세 입력 페이지 — yearly input 패턴 + targetDate (오늘)
// SajuInputFlow 재사용 + coreFearAxis/relationshipStatus skip (today 안 씀)

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Warning } from "@phosphor-icons/react";
import { useAllInputs } from "@/store/useInputStore";
import { FullScreenLoading } from "@/components/loading";
import SajuInputFlow from "@/components/saju-input/SajuInputFlow";
import { TODAY_COST } from "@/lib/constants/coins";
import { getKSTDateString } from "@/lib/utils/kst-date";

const CONFIRM_STEPS = [
  { message: "사주 데이터를 계산하고 있어", delay: 0 },
  { message: "오늘 일진과 너의 사주를 매칭하는 중", delay: 8_000 },
  { message: "두루미가 오늘 너의 하루를 읽는 중", delay: 30_000 },
  { message: "결과를 정리하고 있어", delay: 70_000 },
];

export default function TodayInputPage() {
  const router = useRouter();
  const formData = useAllInputs();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = useCallback(() => {
    void (async () => {
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

        // 2) today start (결제 + pending row)
        //    targetDate는 클릭 시점의 KST 날짜 — 자정 직전 입력 시작해서
        //    자정 넘겨 제출하는 케이스 있어 매번 fresh 산출.
        const targetDate = getKSTDateString();
        const startRes = await fetch("/api/today/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, targetDate }),
        });
        const startData = await startRes.json().catch(() => ({}));

        if (startData?.insufficient) {
          throw new Error(
            `알이 부족해. ${startData.required}알이 필요해 (현재 ${startData.balance}알).`,
          );
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
          router.replace(`/today/result/${resultId}`);
          return;
        }

        // 3) analyze
        const analyzeRes = await fetch("/api/today/analyze", {
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

        router.replace(`/today/result/${resultId}`);
      } catch (err: any) {
        setError(err?.message || "처리 중 오류가 발생했어.");
        setProcessing(false);
      }
    })();
  }, [formData, router]);

  if (processing && !error) {
    return (
      <FullScreenLoading
        steps={CONFIRM_STEPS}
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
    <SajuInputFlow
      onComplete={handleComplete}
      callbackUrl="/today/input"
      backUrl="/menu"
      trackName="today"
      skipQuestions={["coreFearAxis"]}
      submitLabel={`${TODAY_COST}알 사용해서 오늘 운세 받기`}
    />
  );
}
