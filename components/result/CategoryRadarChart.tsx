"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { getGradeColor } from "@/lib/utils/grade-colors";

export type CategoryKey = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";

export type CategoryItem = {
  key: CategoryKey;
  score: number;
  grade: string;
};

type CategoryRadarChartProps = {
  categories: CategoryItem[];
};

const CATEGORY_ORDER: CategoryKey[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];

const BASE_ANGLE_OFFSET = -90;
const LEVELS = [20, 40, 60, 80, 100];
const GRID_OPACITIES = [0.03, 0.04, 0.06, 0.07, 0.08];

const ACCENT = "#FF6B6B";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

function polarToCartesian(radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

function formatPoint(p: { x: number; y: number }) {
  return `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
}

function buildPolygonPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return `M ${points.map(formatPoint).join(" L ")} Z`;
}

function clampScore(raw: number) {
  if (!Number.isFinite(raw)) return 0;
  return clamp(Math.round(raw), 0, 100);
}

function CategoryRadarChartInner({ categories }: CategoryRadarChartProps) {
  const orderedCategories = useMemo(() => {
    const map = new Map(categories.map((item) => [item.key, item]));
    return CATEGORY_ORDER.map((key) => {
      const found = map.get(key);
      return {
        key,
        score: clampScore(found?.score ?? 0),
        grade: typeof found?.grade === "string" && found.grade.trim() ? found.grade.trim() : "-",
      };
    });
  }, [categories]);

  const [progress, setProgress] = useState(0);
  const hasAnimatedRef = useRef(false);

  const scoreHash = useMemo(
    () => orderedCategories.map((item) => `${item.key}:${item.score}:${item.grade}`).join("|"),
    [orderedCategories]
  );

  useEffect(() => {
    if (hasAnimatedRef.current) { setProgress(1); return; }
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) { setProgress(1); hasAnimatedRef.current = true; return; }

    setProgress(0);
    hasAnimatedRef.current = true;
    let frame = 0;
    const startedAt = performance.now();
    const duration = 480;

    const tick = (now: number) => {
      const t = clamp((now - startedAt) / duration, 0, 1);
      setProgress(easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [scoreHash]);

  const angleStep = 360 / orderedCategories.length;
  const outerRadius = 100;
  const labelRadius = 130;

  const axisAngles = useMemo(
    () => orderedCategories.map((_, i) => BASE_ANGLE_OFFSET + i * angleStep),
    [orderedCategories, angleStep]
  );

  const guidePaths = useMemo(
    () => LEVELS.map((level, i) => {
      const r = outerRadius * (level / 100);
      const points = axisAngles.map((a) => polarToCartesian(r, a));
      return { level, d: buildPolygonPath(points), opacity: GRID_OPACITIES[i] };
    }),
    [axisAngles]
  );

  const dataPoints = useMemo(
    () => orderedCategories.map((item, i) => {
      const r = outerRadius * (item.score / 100) * progress;
      return polarToCartesian(r, axisAngles[i]);
    }),
    [orderedCategories, axisAngles, progress]
  );

  const dataPath = useMemo(() => buildPolygonPath(dataPoints), [dataPoints]);

  const labelPoints = useMemo(
    () => orderedCategories.map((item, i) => {
      const angle = axisAngles[i];
      const p = polarToCartesian(labelRadius, angle);
      const anchor = p.x > 10 ? "start" : p.x < -10 ? "end" : "middle";
      const dy = p.y > 10 ? 10 : p.y < -10 ? -22 : -6;
      return { item, x: p.x, y: p.y, anchor, dy };
    }),
    [orderedCategories, axisAngles]
  );

  return (
    <div className="rounded-3xl p-6 md:p-8" style={{ backgroundColor: '#141414' }}>
      <div className="mb-4">
        <h3 className="text-title-3 text-text-primary font-semibold">카테고리별 등급</h3>
      </div>

      <div className="mx-auto w-full">
        <svg
          viewBox="-180 -180 360 360"
          className="h-auto w-full"
          aria-label="카테고리별 오각형 레이더 차트"
        >
          <defs>
            <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.15" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0.03" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid */}
          <g>
            {guidePaths.map((g) => (
              <path
                key={g.level}
                d={g.d}
                fill="none"
                stroke={`rgba(255,255,255,${g.opacity})`}
                strokeWidth="1"
              />
            ))}
            {axisAngles.map((angle) => {
              const p = polarToCartesian(outerRadius, angle);
              return (
                <line
                  key={angle}
                  x1="0" y1="0"
                  x2={p.x.toFixed(2)} y2={p.y.toFixed(2)}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="1"
                />
              );
            })}
          </g>

          {/* Data area */}
          <g>
            {/* Glow layer */}
            <path
              d={dataPath}
              fill="none"
              stroke={ACCENT}
              strokeWidth="6"
              strokeLinejoin="round"
              opacity="0.10"
              filter="url(#glow)"
            />
            {/* Fill */}
            <path
              d={dataPath}
              fill="url(#radarFill)"
              stroke={ACCENT}
              strokeWidth="2.5"
              strokeLinejoin="round"
              opacity="0.85"
            />
            {/* Data point dots */}
            {dataPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x.toFixed(2)}
                cy={p.y.toFixed(2)}
                r="3"
                fill={ACCENT}
                stroke="white"
                strokeWidth="1.5"
              />
            ))}
          </g>

          {/* Labels (2-line: 카테고리명 / 등급 · 점수) */}
          <g>
            {labelPoints.map((label) => {
              const gradeColor = getGradeColor(label.item.grade).main;
              const y1 = label.y + label.dy;
              const y2 = y1 + 16;
              return (
                <g key={label.item.key}>
                  <text
                    x={label.x.toFixed(2)}
                    y={y1.toFixed(2)}
                    textAnchor={label.anchor as any}
                    fill="white"
                    style={{ fontSize: 12, fontWeight: 500 }}
                  >
                    {label.item.key}
                  </text>
                  <text
                    x={label.x.toFixed(2)}
                    y={y2.toFixed(2)}
                    textAnchor={label.anchor as any}
                    style={{ fontSize: 12 }}
                  >
                    <tspan fill={gradeColor} fontWeight={700}>{label.item.grade}</tspan>
                    <tspan fill="rgba(156,163,175,1)" fontWeight={500}> · {label.item.score}점</tspan>
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

export default memo(CategoryRadarChartInner);
