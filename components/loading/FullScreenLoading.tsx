"use client";

import { useEffect, useRef, useState } from "react";
import Spinner from "./Spinner";

interface FullScreenLoadingProps {
  message?: string;
  subMessage?: string;
  steps?: Array<{ message: string; delay: number }>;
}

export default function FullScreenLoading({
  message,
  subMessage,
  steps,
}: FullScreenLoadingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!steps || steps.length <= 1) return;
    setStepIndex(0);
    const timers = steps.slice(1).map((step, i) =>
      setTimeout(() => setStepIndex(i + 1), step.delay)
    );
    timersRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [steps]);

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
      </div>
    </div>
  );
}
