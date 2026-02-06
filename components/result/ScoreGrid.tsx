"use client";

import { memo, useEffect, useMemo, useState } from "react";

type ScoreGridProps = {
  scores: Record<string, number>;
};

type CategoryName = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";

const CATEGORY_ORDER: CategoryName[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];

const FILL_DURATION_MS = 820;
const STEP_DELAY_MS = 60;
const LABEL_RADIUS = 87;
const BASE_ANGLE_OFFSET = -90;
const PETAL_FILL_PIVOT_Y = -26;
const PETAL_PATH =
  "M -54 -34 C -68 -39 -80 -52 -86 -70 L -95 -118 C -98 -137 -87 -148 -68 -152 L 68 -152 C 87 -148 98 -137 95 -118 L 86 -70 C 80 -52 68 -39 54 -34 C 40 -29 -40 -29 -54 -34 Z";
const TRACK_COLORS = [
  "rgba(116, 114, 120, 0.62)",
  "rgba(126, 123, 132, 0.56)",
  "rgba(116, 114, 120, 0.62)",
  "rgba(126, 123, 132, 0.56)",
  "rgba(116, 114, 120, 0.62)",
];
const SOFT_FILL_COLORS = ["#f6ecef", "#f8eef1", "#f7edf2", "#f8edf4", "#f7eef3"];

function clampScore(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function polarToCartesian(radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: radius * Math.cos(rad),
    y: radius * Math.sin(rad),
  };
}

function ScoreGridInner({ scores }: ScoreGridProps) {
  const normalizedScores = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        score: clampScore(scores[category] ?? 0),
      })),
    [scores]
  );

  const scoreHash = useMemo(
    () => normalizedScores.map((item) => item.score).join("-"),
    [normalizedScores]
  );

  const targetRatios = useMemo(
    () => normalizedScores.map((item) => item.score / 100),
    [normalizedScores]
  );

  const [animatedRatios, setAnimatedRatios] = useState<number[]>(
    () => targetRatios.map(() => 0)
  );

  useEffect(() => {
    setAnimatedRatios(targetRatios.map(() => 0));

    let frame = 0;
    const startedAt = performance.now();

    const render = (now: number) => {
      let done = true;

      const nextRatios = targetRatios.map((targetRatio, index) => {
        const elapsed = now - startedAt - index * STEP_DELAY_MS;
        if (elapsed <= 0) {
          done = false;
          return 0;
        }

        const progress = clamp(elapsed / FILL_DURATION_MS, 0, 1);
        if (progress < 1) done = false;

        return targetRatio * easeOutCubic(progress);
      });

      setAnimatedRatios(nextRatios);
      if (!done) {
        frame = requestAnimationFrame(render);
      }
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [scoreHash, targetRatios]);

  return (
    <div className="bg-background-secondary rounded-3xl p-6 md:p-8 border border-white/5">
      <div className="mb-4">
        <h3 className="text-title-3 text-text-primary font-semibold">카테고리별 등급</h3>
      </div>

      <div className="mx-auto w-full">
        <svg
          viewBox="-170 -170 340 340"
          className="h-auto w-full"
          aria-label="카테고리별 5-꽃잎 점수 게이지"
        >
          {normalizedScores.map((item, index) => {
            const angle = BASE_ANGLE_OFFSET + index * (360 / normalizedScores.length);
            const midAngle = angle;
            const targetRatio = targetRatios[index] || 0;
            const animatedRatio = animatedRatios[index] || 0;
            const labelPoint = polarToCartesian(LABEL_RADIUS, midAngle);
            const localProgress = targetRatio > 0 ? animatedRatio / targetRatio : 1;
            const labelOpacity = clamp((localProgress - 0.52) / 0.2, 0, 1);
            const fillTransform = `translate(0 ${PETAL_FILL_PIVOT_Y}) scale(1 ${animatedRatio}) translate(0 ${-PETAL_FILL_PIVOT_Y})`;

            return (
              <g key={item.category}>
                <g transform={`rotate(${angle})`}>
                  <path
                    d={PETAL_PATH}
                    fill={TRACK_COLORS[index % TRACK_COLORS.length]}
                    stroke="rgba(16,16,18,0.74)"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                  <g transform="translate(0 -8) scale(0.84)">
                    <path
                      d={PETAL_PATH}
                      fill={SOFT_FILL_COLORS[index % SOFT_FILL_COLORS.length]}
                      stroke="rgba(255,255,255,0.18)"
                      strokeWidth="1.05"
                      strokeLinejoin="round"
                      transform={fillTransform}
                    />
                  </g>
                </g>
                <g
                  transform={`translate(${labelPoint.x}, ${labelPoint.y})`}
                  style={{ opacity: labelOpacity }}
                >
                  <text
                    x="0"
                    y="-5"
                    textAnchor="middle"
                    fill="rgba(28,28,33,0.95)"
                    style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}
                  >
                    {item.score}
                  </text>
                  <text
                    x="0"
                    y="16"
                    textAnchor="middle"
                    fill="rgba(40,40,46,0.92)"
                    style={{ fontSize: 12.5, fontWeight: 600 }}
                  >
                    {item.category}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default memo(ScoreGridInner);
