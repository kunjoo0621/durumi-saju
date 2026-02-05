"use client";

import { memo, useEffect, useId, useMemo, useState } from "react";

type ScoreGridProps = {
  scores: Record<string, number>;
};

type CategoryName = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";

const CATEGORY_ORDER: CategoryName[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];

const FILL_DURATION_MS = 820;
const STEP_DELAY_MS = 60;
const LABEL_RADIUS = 86;
const BASE_ANGLE_OFFSET = -90;
const PETAL_INNER_PIVOT_Y = -36;
const PETAL_PATH =
  "M -42 -36 C -58 -40 -70 -52 -74 -70 L -87 -121 C -90 -139 -80 -150 -62 -152 L 62 -152 C 80 -150 90 -139 87 -121 L 74 -70 C 70 -52 58 -40 42 -36 C 27 -30 -27 -30 -42 -36 Z";
const SOFT_FILL_COLORS = ["#f6eff4", "#f6f0f7", "#f5eef9", "#f4edfa", "#f7f1f6"];

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
  const uid = useId().replace(/:/g, "");
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-title-3 text-text-primary font-semibold">카테고리별 등급</h3>
        <span className="text-[12px] text-text-secondary">점수 기반 5-꽃잎</span>
      </div>

      <div className="mx-auto w-full max-w-[420px]">
        <svg
          viewBox="-170 -170 340 340"
          className="h-auto w-full"
          aria-label="카테고리별 5-꽃잎 점수 게이지"
        >
          <defs>
            {normalizedScores.map((item, index) => {
              const clipId = `${uid}-petal-clip-${index}`;
              return (
                <clipPath id={clipId} key={`${item.category}-${clipId}`}>
                  <path d={PETAL_PATH} />
                </clipPath>
              );
            })}
          </defs>

          {normalizedScores.map((item, index) => {
            const angle = BASE_ANGLE_OFFSET + index * (360 / normalizedScores.length);
            const midAngle = angle;
            const targetRatio = targetRatios[index] || 0;
            const animatedRatio = animatedRatios[index] || 0;
            const labelPoint = polarToCartesian(LABEL_RADIUS, midAngle);
            const localProgress = targetRatio > 0 ? animatedRatio / targetRatio : 1;
            const labelOpacity = clamp((localProgress - 0.52) / 0.2, 0, 1);
            const clipId = `${uid}-petal-clip-${index}`;
            const fillTransform = `translate(0 ${PETAL_INNER_PIVOT_Y}) scale(1 ${animatedRatio}) translate(0 ${-PETAL_INNER_PIVOT_Y})`;

            return (
              <g key={item.category}>
                <g transform={`rotate(${angle})`}>
                  <path
                    d={PETAL_PATH}
                    fill="rgba(122, 120, 128, 0.56)"
                    stroke="rgba(255,255,255,0.085)"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                  <path
                    d={PETAL_PATH}
                    fill={SOFT_FILL_COLORS[index % SOFT_FILL_COLORS.length]}
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth="1.1"
                    strokeLinejoin="round"
                    clipPath={`url(#${clipId})`}
                    transform={fillTransform}
                  />
                </g>
                <g
                  transform={`translate(${labelPoint.x}, ${labelPoint.y})`}
                  style={{ opacity: labelOpacity }}
                >
                  <text
                    x="0"
                    y="-4"
                    textAnchor="middle"
                    className="fill-text-primary"
                    style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}
                  >
                    {item.score}
                  </text>
                  <text
                    x="0"
                    y="20"
                    textAnchor="middle"
                    className="fill-text-secondary"
                    style={{ fontSize: 14, fontWeight: 600 }}
                  >
                    {item.category}
                  </text>
                </g>
              </g>
            );
          })}

          <circle
            cx="0"
            cy="0"
            r={28}
            fill="rgba(18, 18, 23, 0.95)"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1.2"
          />
        </svg>
      </div>
    </div>
  );
}

export default memo(ScoreGridInner);
