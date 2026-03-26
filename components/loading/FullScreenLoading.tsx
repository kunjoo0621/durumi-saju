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

  // 프로그레스 바 애니메이션
  useEffect(() => {
    if (!estimatedDuration) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      // 90%까지만 자연스럽게 채움 (완료는 페이지 전환으로)
      const pct = Math.min(90, (elapsed / estimatedDuration) * 100);
      setProgress(pct);
      if (pct < 90) raf = requestAnimationFrame(tick);
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
            <p className="text-[12px] text-text-tertiary mt-2">
              {progress < 30 ? "잠깐이면 돼" : progress < 70 ? "거의 다 됐어" : "마무리하고 있어"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
