"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

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

function buildPolygonPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return `M ${points.map((point) => formatPoint(point)).join(" L ")} Z`;
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
    if (hasAnimatedRef.current) {
      setProgress(1);
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setProgress(1);
      hasAnimatedRef.current = true;
      return;
    }

    setProgress(0);
    hasAnimatedRef.current = true;
    let frame = 0;
    const startedAt = performance.now();
    const duration = 480;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const t = clamp(elapsed / duration, 0, 1);
      setProgress(easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [scoreHash]);

  const angleStep = 360 / orderedCategories.length;
  const outerRadius = 112;
  const labelRadius = 142;

  const axisAngles = useMemo(
    () => orderedCategories.map((_, index) => BASE_ANGLE_OFFSET + index * angleStep),
    [orderedCategories, angleStep]
  );

  const guidePaths = useMemo(() => {
    return LEVELS.map((level) => {
      const radius = outerRadius * (level / 100);
      const points = axisAngles.map((angle) => polarToCartesian(radius, angle));
      return { level, d: buildPolygonPath(points) };
    });
  }, [axisAngles]);

  const dataPath = useMemo(() => {
    const points = orderedCategories.map((item, index) => {
      const radius = outerRadius * (item.score / 100) * progress;
      return polarToCartesian(radius, axisAngles[index]);
    });
    return buildPolygonPath(points);
  }, [orderedCategories, axisAngles, progress]);

  const labelPoints = useMemo(() => {
    return orderedCategories.map((item, index) => {
      const angle = axisAngles[index];
      const point = polarToCartesian(labelRadius, angle);
      const anchor = point.x > 10 ? "start" : point.x < -10 ? "end" : "middle";
      const dy = point.y > 10 ? 14 : point.y < -10 ? -10 : 4;
      return { item, x: point.x, y: point.y, anchor, dy };
    });
  }, [orderedCategories, axisAngles]);

  return (
    <div className="bg-background-secondary rounded-3xl p-6 md:p-8 border border-white/8">
      <div className="mb-4">
        <h3 className="text-title-3 text-text-primary font-semibold">카테고리별 등급</h3>
      </div>

      <div className="mx-auto w-full">
        <svg
          viewBox="-180 -180 360 360"
          className="h-auto w-full"
          aria-label="카테고리별 오각형 레이더 차트"
        >
          <g>
            {guidePaths.map((guide) => (
              <path
                key={guide.level}
                d={guide.d}
                fill="none"
                stroke="rgb(var(--text-primary) / 0.12)"
                strokeWidth={guide.level === 100 ? 1 : 0.8}
              />
            ))}

            {axisAngles.map((angle) => {
              const point = polarToCartesian(outerRadius, angle);
              return (
                <line
                  key={angle}
                  x1="0"
                  y1="0"
                  x2={point.x.toFixed(2)}
                  y2={point.y.toFixed(2)}
                  stroke="rgb(var(--text-primary) / 0.10)"
                  strokeWidth="0.8"
                />
              );
            })}
          </g>

          <g>
            <path
              d={dataPath}
              fill="rgb(var(--primary) / 0.12)"
              stroke="rgb(var(--primary) / 0.55)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </g>

          <g>
            {labelPoints.map((label) => (
              <text
                key={label.item.key}
                x={label.x.toFixed(2)}
                y={label.y.toFixed(2)}
                dy={label.dy}
                textAnchor={label.anchor as any}
                fill="rgb(var(--text-primary) / 0.70)"
                style={{ fontSize: 12, fontWeight: 500, letterSpacing: "-0.01em" }}
              >
                <tspan>{label.item.key}</tspan>
                <tspan dx="6" fill="rgb(var(--primary) / 0.72)" style={{ fontWeight: 600 }}>
                  {label.item.grade}
                </tspan>
              </text>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

export default memo(CategoryRadarChartInner);
