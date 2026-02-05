"use client";

import { memo, useEffect, useMemo, useState } from "react";

type ScoreGridProps = {
  scores: Record<string, number>;
};

type CategoryName = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";

const CATEGORY_ORDER: CategoryName[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];

const FILL_DURATION_MS = 820;
const STEP_DELAY_MS = 60;
const SEGMENT_GAP_DEG = 8;
const INNER_RADIUS = 38;
const OUTER_RADIUS = 138;
const LABEL_RADIUS = 92;
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

function createRingSegmentPath(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  if (outerRadius <= innerRadius) return "";

  const startOuter = polarToCartesian(outerRadius, startAngle);
  const endOuter = polarToCartesian(outerRadius, endAngle);
  const endInner = polarToCartesian(innerRadius, endAngle);
  const startInner = polarToCartesian(innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${startInner.x} ${startInner.y}`,
    "Z",
  ].join(" ");
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
          {normalizedScores.map((item, index) => {
            const segmentSize = 360 / normalizedScores.length;
            const startAngle = -90 + index * segmentSize + SEGMENT_GAP_DEG / 2;
            const endAngle = startAngle + segmentSize - SEGMENT_GAP_DEG;
            const midAngle = (startAngle + endAngle) / 2;
            const targetRatio = targetRatios[index] || 0;
            const animatedRatio = animatedRatios[index] || 0;
            const animatedOuterRadius =
              INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) * animatedRatio;

            const basePath = createRingSegmentPath(
              INNER_RADIUS,
              OUTER_RADIUS,
              startAngle,
              endAngle
            );
            const fillPath = createRingSegmentPath(
              INNER_RADIUS + 1.5,
              animatedOuterRadius,
              startAngle + 0.7,
              endAngle - 0.7
            );

            const labelPoint = polarToCartesian(LABEL_RADIUS, midAngle);
            const localProgress = targetRatio > 0 ? animatedRatio / targetRatio : 1;
            const labelOpacity = clamp((localProgress - 0.52) / 0.2, 0, 1);

            return (
              <g key={item.category}>
                <path
                  d={basePath}
                  fill="rgba(132, 130, 136, 0.55)"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                {fillPath && (
                  <path
                    d={fillPath}
                    fill={SOFT_FILL_COLORS[index % SOFT_FILL_COLORS.length]}
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="1"
                    strokeLinejoin="round"
                  />
                )}
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
            r={INNER_RADIUS - 7}
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
