"use client";

import { useEffect, useState } from "react";
import Spinner from "./Spinner";

interface FullScreenLoadingProps {
  message?: string;
  subMessage?: string;
  steps?: Array<{ message: string; delay: number }>;
  /** 예상 소요 시간(ms) — 설정하면 프로그레스 바 표시 */
  estimatedDuration?: number;
}

export default function FullScreenLoading({
  message,
  subMessage,
  steps,
  estimatedDuration,
}: FullScreenLoadingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!steps || steps.length <= 1) return;
    setStepIndex(0);
    const timers = steps.slice(1).map((step, i) =>
      setTimeout(() => setStepIndex(i + 1), step.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  // 프로그레스 바 애니메이션 (setInterval 기반 — 탭 전환·저사양 환경에서도 안정)
  useEffect(() => {
    if (!estimatedDuration) return;
    setProgress(3); // 즉시 3% 점프로 "시작됐다" 신호
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const t = elapsed / estimatedDuration; // 0~1+
      // 3% + sqrt 곡선으로 초반 빠르게, 뒤로 완만, 최대 95%
      const base = 3 + Math.sqrt(Math.min(t, 1)) * 84;
      const overshoot = t > 1 ? Math.min((t - 1) * 4, 8) : 0;
      const pct = Math.min(95, base + overshoot);
      setProgress(pct);
      if (elapsed > estimatedDuration * 2) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  }, [estimatedDuration]);

  const displayMessage = steps ? steps[stepIndex]?.message : message;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
      <div className="max-w-[640px] w-full text-center">
        {!estimatedDuration && (
          <div className="mb-6 flex justify-center">
            <Spinner size="lg" />
          </div>
        )}
        {displayMessage && (
          <h2
            key={displayMessage}
            className="text-title-2 text-text-primary mb-3 animate-text-fade-in"
          >
            {displayMessage}
          </h2>
        )}
        {subMessage && (
          <p className="text-body-2 text-text-secondary mb-6">{subMessage}</p>
        )}
        {estimatedDuration && (
          <div className="mx-auto max-w-[280px]">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[rgb(var(--c-brand))] rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(3, progress)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
