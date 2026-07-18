"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { getGradeColor } from "@/lib/utils/grade-colors";
import { safeDisplayGrade } from "@/lib/gradeSystem";

export type CategoryKey = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";

export type CategoryItem = {
  key: CategoryKey;
  score: number;
  grade: string;
};

// v0.3(펫): 범용 축 — 등급 없는 지표(호흡·사랑 등) N개를 레이더로. label 2행째는 grade 있으면 등급, 없으면 subLabel.
export type RadarAxis = {
  key: string;
  label?: string;
  score: number;
  grade?: string;
  subLabel?: string;
};

type CategoryRadarChartProps = {
  categories?: CategoryItem[];
  axes?: RadarAxis[];       // 전달 시 categories 대신 범용 축 렌더 (미전달 시 기존 경로 그대로)
};

type RadarItem = { key: string; label: string; score: number; grade: string; subLabel?: string };

const CATEGORY_ORDER: CategoryKey[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];

const BASE_ANGLE_OFFSET = -90;
const LEVELS = [25, 50, 75, 100, 125];
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

function CategoryRadarChartInner({ categories, axes }: CategoryRadarChartProps) {
  const orderedCategories = useMemo<RadarItem[]>(() => {
    if (axes && axes.length) {
      return axes.map((a) => ({
        key: a.key,
        label: a.label ?? a.key,
        score: clampScore(a.score),
        grade: typeof a.grade === "string" && a.grade.trim() ? a.grade.trim() : "",
        subLabel: a.subLabel,
      }));
    }
    const map = new Map((categories ?? []).map((item) => [item.key, item]));
    return CATEGORY_ORDER.map((key) => {
      const found = map.get(key);
      return {
        key,
        label: key,
        score: clampScore(found?.score ?? 0),
        grade: typeof found?.grade === "string" && found.grade.trim() ? found.grade.trim() : "-",
      };
    });
  }, [categories, axes]);

  const [progress, setProgress] = useState(0);
  const hasAnimatedRef = useRef(false);

  const scoreHash = useMemo(
    () => orderedCategories.map((item) => `${item.key}:${item.score}:${item.grade}:${item.subLabel ?? ""}`).join("|"),
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
  const outerRadius = 125;
  const labelRadius = 150;

  const axisAngles = useMemo(
    () => orderedCategories.map((_, i) => BASE_ANGLE_OFFSET + i * angleStep),
    [orderedCategories, angleStep]
  );

  const guidePaths = useMemo(
    () => LEVELS.map((level, i) => {
      const r = level;
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
      const dy1 = p.y < -80 ? -16 : p.y > 80 ? 4 : -6;
      const dy2 = dy1 + 22;
      return { item, x: p.x, y: p.y, dy1, dy2 };
    }),
    [orderedCategories, axisAngles]
  );

  return (
    <div className="rounded-3xl p-4 md:p-5" style={{ backgroundColor: '#141414' }}>
      <div className="mx-auto w-full">
        <svg
          viewBox="-220 -200 440 400"
          className="h-auto w-full"
          aria-label="카테고리별 오각형 레이더 차트"
        >
          <defs>
            <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.15" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0.03" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="6" result="blur" />
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
              strokeWidth="10"
              strokeLinejoin="round"
              opacity="0.20"
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
              <g key={i}>
                <circle
                  cx={p.x.toFixed(2)}
                  cy={p.y.toFixed(2)}
                  r="8"
                  fill={ACCENT}
                  opacity="0.15"
                />
                <circle
                  cx={p.x.toFixed(2)}
                  cy={p.y.toFixed(2)}
                  r="4"
                  fill={ACCENT}
                  stroke="white"
                  strokeWidth="1.5"
                />
              </g>
            ))}
          </g>

          {/* Labels (2-line: 카테고리명 / 등급 · 점수) */}
          <g>
            {labelPoints.map((label) => {
              const hasGrade = label.item.grade !== ""; // categories 경로는 항상 등급 표시(기존 동작 보존), axes는 grade 없으면 subLabel
              const gradeColor = hasGrade ? getGradeColor(label.item.grade).main : "";
              return (
                <g key={label.item.key}>
                  <text
                    x={label.x.toFixed(2)}
                    y={(label.y + label.dy1).toFixed(2)}
                    textAnchor="middle"
                    style={{ fontSize: 14, fontWeight: 600 }}
                    fill="rgba(255,255,255,0.85)"
                  >
                    {label.item.label}
                  </text>
                  <text
                    x={label.x.toFixed(2)}
                    y={(label.y + label.dy2).toFixed(2)}
                    textAnchor="middle"
                    style={{ fontSize: 12, fontWeight: 500 }}
                  >
                    {hasGrade ? (
                      <>
                        <tspan fill={gradeColor}>{safeDisplayGrade(label.item.grade)}</tspan>
                        <tspan fill="rgba(255,255,255,0.4)">{" · "}{label.item.score}점</tspan>
                      </>
                    ) : (
                      <tspan fill="rgba(255,255,255,0.45)">{label.item.subLabel ?? `${label.item.score}점`}</tspan>
                    )}
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
