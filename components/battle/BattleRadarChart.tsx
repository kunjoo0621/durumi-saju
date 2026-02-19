"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ServerScores } from "@/lib/utils/saju-scoring";
import { scoreToGrade } from "@/lib/utils/saju-scoring";

type CategoryKey = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";

const CATEGORY_ORDER: CategoryKey[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];
const BASE_ANGLE_OFFSET = -90;
const LEVELS = [20, 40, 60, 80, 100];

const COLOR_A = "#FF6B6B";
const COLOR_B = "#A855F7";

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

type Props = {
  scoresA: ServerScores;
  scoresB: ServerScores;
  nameA: string;
  nameB: string;
};

function BattleRadarChartInner({ scoresA, scoresB, nameA, nameB }: Props) {
  const [progress, setProgress] = useState(0);
  const hasAnimatedRef = useRef(false);

  const scoreHash = useMemo(
    () => CATEGORY_ORDER.map((k) => `${scoresA[k]}:${scoresB[k]}`).join("|"),
    [scoresA, scoresB]
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

  const angleStep = 360 / CATEGORY_ORDER.length;
  const outerRadius = 112;
  const labelRadius = 142;

  const axisAngles = useMemo(
    () => CATEGORY_ORDER.map((_, i) => BASE_ANGLE_OFFSET + i * angleStep),
    [angleStep]
  );

  const guidePaths = useMemo(
    () => LEVELS.map((level) => {
      const r = outerRadius * (level / 100);
      const points = axisAngles.map((a) => polarToCartesian(r, a));
      return { level, d: buildPolygonPath(points) };
    }),
    [axisAngles]
  );

  const dataPathA = useMemo(() => {
    const points = CATEGORY_ORDER.map((k, i) => {
      const r = outerRadius * (clampScore(scoresA[k]) / 100) * progress;
      return polarToCartesian(r, axisAngles[i]);
    });
    return buildPolygonPath(points);
  }, [scoresA, axisAngles, progress]);

  const dataPathB = useMemo(() => {
    const points = CATEGORY_ORDER.map((k, i) => {
      const r = outerRadius * (clampScore(scoresB[k]) / 100) * progress;
      return polarToCartesian(r, axisAngles[i]);
    });
    return buildPolygonPath(points);
  }, [scoresB, axisAngles, progress]);

  const labelPoints = useMemo(
    () => CATEGORY_ORDER.map((key, i) => {
      const angle = axisAngles[i];
      const p = polarToCartesian(labelRadius, angle);
      const anchor = p.x > 10 ? "start" : p.x < -10 ? "end" : "middle";
      const dy = p.y > 10 ? 14 : p.y < -10 ? -10 : 4;
      return { key, x: p.x, y: p.y, anchor, dy };
    }),
    [axisAngles]
  );

  return (
    <div className="bg-background-secondary rounded-3xl p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-title-3 text-text-primary font-semibold">카테고리 비교</h3>
        <div className="flex items-center gap-4 text-[12px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: COLOR_A }} />
            {nameA}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: COLOR_B }} />
            {nameB}
          </span>
        </div>
      </div>

      <div className="mx-auto w-full">
        <svg viewBox="-180 -180 360 360" className="h-auto w-full" aria-label="배틀 레이더 차트">
          <g>
            {guidePaths.map((g) => (
              <path key={g.level} d={g.d} fill="none" stroke="#1F1F1F" strokeWidth={g.level === 100 ? 1 : 0.8} />
            ))}
            {axisAngles.map((angle) => {
              const p = polarToCartesian(outerRadius, angle);
              return <line key={angle} x1="0" y1="0" x2={p.x.toFixed(2)} y2={p.y.toFixed(2)} stroke="#1A1A1A" strokeWidth="0.8" />;
            })}
          </g>

          <g>
            <path d={dataPathA} fill={`${COLOR_A}1F`} stroke={`${COLOR_A}8C`} strokeWidth="1.5" strokeLinejoin="round" />
            <path d={dataPathB} fill={`${COLOR_B}1F`} stroke={`${COLOR_B}8C`} strokeWidth="1.5" strokeLinejoin="round" />
          </g>

          <g>
            {labelPoints.map((label) => (
              <text
                key={label.key}
                x={label.x.toFixed(2)}
                y={label.y.toFixed(2)}
                dy={label.dy}
                textAnchor={label.anchor as any}
                fill="rgb(var(--text-primary) / 0.70)"
                style={{ fontSize: 12, fontWeight: 500, letterSpacing: "-0.01em" }}
              >
                {label.key}
              </text>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

export default memo(BattleRadarChartInner);
