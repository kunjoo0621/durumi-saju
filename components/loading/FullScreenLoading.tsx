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

  // 프로그레스 바 애니메이션 (로그 곡선 — 처음 빠르게, 뒤로 갈수록 느리게)
  useEffect(() => {
    if (!estimatedDuration) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = elapsed / estimatedDuration; // 0~1 (1 이상도 가능)
      // 로그 곡선: 처음 50%가 빠르게, 이후 점점 느려짐. 최대 95%
      const pct = Math.min(95, (1 - Math.pow(1 - Math.min(t, 1), 2.5)) * 85 + (t > 1 ? Math.min((t - 1) * 5, 10) : 0));
      setProgress(pct);
      if (pct < 95) raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [estimatedDuration]);

  const displayMessage = steps ? steps[stepIndex]?.message : message;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
      <div className="max-w-[640px] w-full text-center">
        <div className="mb-6 flex justify-center">
          <Spinner size="lg" />
        </div>
        {displayMessage && (
          <h2
            key={displayMessage}
            className="text-title-2 text-text-primary mb-2 animate-text-fade-in"
          >
            {displayMessage}
          </h2>
        )}
        {subMessage && (
          <p className="text-body-2 text-text-secondary">{subMessage}</p>
        )}
        {estimatedDuration && (
          <div className="mt-6 mx-auto max-w-[280px]">
            <div className="h-1.5 bg-background-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
