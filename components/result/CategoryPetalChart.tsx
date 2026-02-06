"use client";

import { memo, useEffect, useMemo, useState } from "react";

export type CategoryKey = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";

export type CategoryItem = {
  key: CategoryKey;
  score: number;
  grade: string;
};

type CategoryPetalChartProps = {
  categories: CategoryItem[];
};

const CATEGORY_ORDER: CategoryKey[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];
const FILL_DURATION_MS = 520;
const STEP_DELAY_MS = 60;
const BASE_ANGLE_OFFSET = -90;
const R_OUTER = 128;
const R_INNER = 54;
const GAP_ANGLE = 2.6;
const ROUND = 14;
const VALUE_INSET = 15;
const VALUE_MIN_OUTER = R_INNER + 18;
const VALUE_MAX_OUTER = R_OUTER - 10;

const TRACK_COLORS = [
  "rgba(52, 52, 58, 0.94)",
  "rgba(60, 59, 67, 0.9)",
  "rgba(52, 52, 58, 0.94)",
  "rgba(60, 59, 67, 0.9)",
  "rgba(52, 52, 58, 0.94)",
];

const BASE_STROKE_COLORS = [
  "rgba(98, 98, 106, 0.14)",
  "rgba(104, 103, 112, 0.16)",
  "rgba(98, 98, 106, 0.14)",
  "rgba(104, 103, 112, 0.16)",
  "rgba(98, 98, 106, 0.14)",
];

const FILL_COLORS = [
  "rgba(241, 236, 239, 0.98)",
  "rgba(241, 239, 242, 0.98)",
  "rgba(238, 241, 244, 0.98)",
  "rgba(239, 243, 240, 0.98)",
  "rgba(240, 238, 244, 0.98)",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

const RAD_TO_DEG = 180 / Math.PI;

function polarToCartesian(radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: radius * Math.cos(rad),
    y: radius * Math.sin(rad),
  };
}

function formatPoint(point: { x: number; y: number }) {
  return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
}

export function buildPetalPath(
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number,
  round: number,
  innerBias = 1
) {
  if (rOuter <= rInner) return "";
  const span = Math.max(endAngle - startAngle, 0.1);
  const maxRound = Math.max(4, (rOuter - rInner) / 2 - 1);
  const safeRound = clamp(round, 4, maxRound);
  const outerInset = Math.min((safeRound / rOuter) * RAD_TO_DEG, span / 3);
  const innerInset = Math.min((safeRound / rInner) * RAD_TO_DEG * innerBias, span / 3);

  const outerStart = polarToCartesian(rOuter, startAngle + outerInset);
  const outerEnd = polarToCartesian(rOuter, endAngle - outerInset);
  const innerEnd = polarToCartesian(rInner, endAngle - innerInset);
  const innerStart = polarToCartesian(rInner, startAngle + innerInset);

  const endOuterCtrl = polarToCartesian(rOuter - safeRound, endAngle);
  const endInnerCtrl = polarToCartesian(rInner + safeRound * 1.35, endAngle);
  const startInnerCtrl = polarToCartesian(rInner + safeRound * 1.35, startAngle);
  const startOuterCtrl = polarToCartesian(rOuter - safeRound, startAngle);

  const outerSweep = endAngle - startAngle - outerInset * 2;
  const largeArc = outerSweep > 180 ? 1 : 0;

  return [
    `M ${formatPoint(outerStart)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${formatPoint(outerEnd)}`,
    `C ${formatPoint(endOuterCtrl)} ${formatPoint(endInnerCtrl)} ${formatPoint(innerEnd)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${formatPoint(innerStart)}`,
    `C ${formatPoint(startInnerCtrl)} ${formatPoint(startOuterCtrl)} ${formatPoint(outerStart)}`,
    "Z",
  ].join(" ");
}

function clampScore(raw: number) {
  if (!Number.isFinite(raw)) return 0;
  return clamp(Math.round(raw), 0, 100);
}

function lerp(min: number, max: number, t: number) {
  return min + (max - min) * t;
}

function CategoryPetalChartInner({ categories }: CategoryPetalChartProps) {
  const orderedCategories = useMemo(() => {
    const map = new Map(categories.map((item) => [item.key, item]));
    return CATEGORY_ORDER.map((key) => {
      const found = map.get(key);
      return {
        key,
        score: clampScore(found?.score ?? 0),
        grade: found?.grade ?? "-",
      };
    });
  }, [categories]);

  const scoreHash = useMemo(
    () => orderedCategories.map((item) => `${item.score}-${item.grade}`).join("|"),
    [orderedCategories]
  );

  const [animatedRatios, setAnimatedRatios] = useState<number[]>(() =>
    orderedCategories.map(() => 0)
  );

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setAnimatedRatios(orderedCategories.map((item) => item.score / 100));
      return;
    }

    setAnimatedRatios(orderedCategories.map(() => 0));

    let frame = 0;
    const startedAt = performance.now();

    const render = (now: number) => {
      let done = true;
      const nextRatios = orderedCategories.map((item, index) => {
        const elapsed = now - startedAt - index * STEP_DELAY_MS;
        if (elapsed <= 0) {
          done = false;
          return 0;
        }
        const progress = clamp(elapsed / FILL_DURATION_MS, 0, 1);
        if (progress < 1) done = false;
        return easeOutCubic(progress) * (item.score / 100);
      });

      setAnimatedRatios(nextRatios);
      if (!done) {
        frame = requestAnimationFrame(render);
      }
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [scoreHash, orderedCategories]);

  const angleStep = 360 / orderedCategories.length;

  return (
    <div className="bg-background-secondary rounded-3xl p-6 md:p-8 border border-white/5">
      <div className="mb-4">
        <h3 className="text-title-3 text-text-primary font-semibold">카테고리별 등급</h3>
      </div>

      <div className="mx-auto w-full">
        <svg
          viewBox="-160 -160 320 320"
          className="h-auto w-full"
          aria-label="카테고리별 5-꽃잎 점수 게이지"
        >
          {orderedCategories.map((item, index) => {
            const rawStart = BASE_ANGLE_OFFSET + index * angleStep - angleStep / 2;
            const rawEnd = rawStart + angleStep;
            const startAngle = rawStart + GAP_ANGLE / 2;
            const endAngle = rawEnd - GAP_ANGLE / 2;
    const valueStartAngle = rawStart + GAP_ANGLE * 1.2;
    const valueEndAngle = rawEnd - GAP_ANGLE * 1.2;
            const ratio = animatedRatios[index] ?? 0;
            const rValueOuter = lerp(VALUE_MIN_OUTER, VALUE_MAX_OUTER, ratio);
            const rValueInner = R_INNER + VALUE_INSET;
    const pathBase = buildPetalPath(R_INNER, R_OUTER, startAngle, endAngle, ROUND, 1.08);
    const pathFill = buildPetalPath(rValueInner, rValueOuter, valueStartAngle, valueEndAngle, ROUND - 2, 1.18);
            const textRadius = (R_INNER + rValueOuter) * 0.55;
            const labelPoint = polarToCartesian(textRadius, BASE_ANGLE_OFFSET + index * angleStep);
            const targetRatio = item.score / 100;
            const localProgress = targetRatio > 0 ? ratio / targetRatio : 1;
            const labelOpacity = clamp((localProgress - 0.5) / 0.18, 0, 1);
            const labelText = item.grade ? `${item.key} ${item.grade}` : item.key;

            return (
              <g key={item.key}>
                <path
                  d={pathBase}
                  fill={TRACK_COLORS[index % TRACK_COLORS.length]}
                  stroke={BASE_STROKE_COLORS[index % BASE_STROKE_COLORS.length]}
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
                <path
                  d={pathFill}
                  fill={FILL_COLORS[index % FILL_COLORS.length]}
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                />
                <g transform={`translate(${labelPoint.x}, ${labelPoint.y})`} style={{ opacity: labelOpacity }}>
                  <text
                    x="0"
                    y="-6"
                    textAnchor="middle"
                    fill="rgba(22,22,28,0.96)"
                    style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}
                  >
                    {item.score}
                  </text>
                  <text
                    x="0"
                    y="15"
                    textAnchor="middle"
                    fill="rgba(36,36,44,0.76)"
                    style={{ fontSize: 11, fontWeight: 600 }}
                  >
                    {labelText}
                  </text>
                </g>
              </g>
            );
          })}
          <circle cx="0" cy="0" r={R_INNER - 8} fill="rgba(16,16,18,0.95)" />
        </svg>
      </div>
    </div>
  );
}

export default memo(CategoryPetalChartInner);
