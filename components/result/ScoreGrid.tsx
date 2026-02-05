"use client";

import { memo, useEffect, useId, useMemo, useState } from "react";

type ScoreGridProps = {
  scores: Record<string, number>;
};

type CategoryName = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";

const CATEGORY_ORDER: CategoryName[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];

const PETAL_CENTER_Y = -70;
const PETAL_RX = 27;
const PETAL_RY = 56;
const PETAL_TOP = -126;
const PETAL_HEIGHT = 112;
const FILL_DURATION_MS = 820;
const STEP_DELAY_MS = 60;
const TEXT_FADE_DELAY_MS = 430;

function clampScore(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

function ScoreGridInner({ scores }: ScoreGridProps) {
  const uid = useId().replace(/:/g, "");
  const [animated, setAnimated] = useState(false);

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

  const averageScore = useMemo(() => {
    const total = normalizedScores.reduce((sum, item) => sum + item.score, 0);
    return Math.round(total / normalizedScores.length);
  }, [normalizedScores]);

  useEffect(() => {
    setAnimated(false);
    const raf = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, [scoreHash]);

  return (
    <div className="bg-background-secondary rounded-3xl p-6 md:p-8 border border-white/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-title-3 text-text-primary font-semibold">카테고리별 흐름</h3>
        <span className="text-[12px] text-text-secondary">점수 기반 5-꽃잎</span>
      </div>

      <div className="mx-auto w-full max-w-[360px]">
        <svg viewBox="-150 -150 300 300" className="h-auto w-full" aria-label="카테고리별 5-꽃잎 점수 게이지">
          <defs>
            <radialGradient id={`${uid}-petal-fill`} cx="50%" cy="60%" r="70%">
              <stop offset="0%" stopColor="#ff85b7" />
              <stop offset="100%" stopColor="#ff5f9e" />
            </radialGradient>
          </defs>

          {normalizedScores.map((item, index) => {
            const scoreRatio = item.score / 100;
            const angle = -90 + index * 72;
            const clipId = `${uid}-petal-clip-${index}`;
            const delay = index * STEP_DELAY_MS;

            return (
              <g key={item.category} transform={`rotate(${angle})`}>
                <clipPath id={clipId}>
                  <ellipse cx="0" cy={PETAL_CENTER_Y} rx={PETAL_RX} ry={PETAL_RY} />
                </clipPath>
                <ellipse
                  cx="0"
                  cy={PETAL_CENTER_Y}
                  rx={PETAL_RX}
                  ry={PETAL_RY}
                  fill="rgba(255, 255, 255, 0.07)"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1"
                />
                <g clipPath={`url(#${clipId})`}>
                  <rect
                    x={-PETAL_RX - 2}
                    y={PETAL_TOP}
                    width={(PETAL_RX + 2) * 2}
                    height={PETAL_HEIGHT}
                    fill={`url(#${uid}-petal-fill)`}
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "50% 100%",
                      transform: `scaleY(${animated ? scoreRatio : 0})`,
                      transition: `transform ${FILL_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
                    }}
                  />
                </g>
              </g>
            );
          })}

          <circle cx="0" cy="0" r="36" fill="rgba(12, 12, 16, 0.92)" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
          <text x="0" y="-3" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.62)">
            평균 점수
          </text>
          <text x="0" y="15" textAnchor="middle" fontSize="18" fontWeight="700" fill="#ff6da6">
            {averageScore}
          </text>
        </svg>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {normalizedScores.map((item, index) => {
          const delay = index * STEP_DELAY_MS + TEXT_FADE_DELAY_MS;
          return (
            <div
              key={`${item.category}-label`}
              className="rounded-xl bg-background-primary/40 px-3 py-2 border border-white/5"
              style={{
                opacity: animated ? 1 : 0,
                transform: animated ? "translateY(0px)" : "translateY(4px)",
                transition: `opacity 220ms ease ${delay}ms, transform 220ms ease ${delay}ms`,
              }}
            >
              <div className="text-[12px] text-text-secondary">{item.category}</div>
              <div className="text-[14px] font-semibold text-text-primary">{item.score}점</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(ScoreGridInner);
