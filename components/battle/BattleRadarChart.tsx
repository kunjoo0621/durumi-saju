"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ServerScores } from "@/lib/utils/saju-scoring";

type CategoryKey = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";

const CATEGORY_ORDER: CategoryKey[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];
const BASE_ANGLE_OFFSET = -90;
const LEVELS = [20, 40, 60, 80, 100];
const GRID_OPACITIES = [0.04, 0.06, 0.08, 0.10, 0.12];

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
  bare?: boolean;
};

function BattleRadarChartInner({ scoresA, scoresB, nameA, nameB, bare = false }: Props) {
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
  const labelRadius = 146;

  const axisAngles = useMemo(
    () => CATEGORY_ORDER.map((_, i) => BASE_ANGLE_OFFSET + i * angleStep),
    [angleStep]
  );

  const guidePaths = useMemo(
    () => LEVELS.map((level, i) => {
      const r = outerRadius * (level / 100);
      const points = axisAngles.map((a) => polarToCartesian(r, a));
      return { level, d: buildPolygonPath(points), opacity: GRID_OPACITIES[i] };
    }),
    [axisAngles]
  );

  const dataPointsA = useMemo(
    () => CATEGORY_ORDER.map((k, i) => {
      const r = outerRadius * (clampScore(scoresA[k]) / 100) * progress;
      return polarToCartesian(r, axisAngles[i]);
    }),
    [scoresA, axisAngles, progress]
  );

  const dataPointsB = useMemo(
    () => CATEGORY_ORDER.map((k, i) => {
      const r = outerRadius * (clampScore(scoresB[k]) / 100) * progress;
      return polarToCartesian(r, axisAngles[i]);
    }),
    [scoresB, axisAngles, progress]
  );

  const dataPathA = useMemo(() => buildPolygonPath(dataPointsA), [dataPointsA]);
  const dataPathB = useMemo(() => buildPolygonPath(dataPointsB), [dataPointsB]);

  const labelPoints = useMemo(
    () => CATEGORY_ORDER.map((key, i) => {
      const angle = axisAngles[i];
      const p = polarToCartesian(labelRadius, angle);
      const anchor = p.x > 10 ? "start" : p.x < -10 ? "end" : "middle";
      const dy = p.y > 10 ? 16 : p.y < -10 ? -8 : 4;
      const scoreA = clampScore(scoresA[key]);
      const scoreB = clampScore(scoresB[key]);
      return { key, x: p.x, y: p.y, anchor, dy, scoreA, scoreB };
    }),
    [axisAngles, scoresA, scoresB]
  );

  return (
    <div className={bare ? "pt-2" : "bg-background-secondary rounded-3xl p-6 md:p-8"}>
      <div className="mx-auto w-full">
        <svg viewBox="-210 -190 420 400" className="h-auto w-full" aria-label="배틀 레이더 차트">
          <defs>
            <radialGradient id="battleFillA" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={COLOR_A} stopOpacity="0.30" />
              <stop offset="100%" stopColor={COLOR_A} stopOpacity="0.06" />
            </radialGradient>
            <radialGradient id="battleFillB" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={COLOR_B} stopOpacity="0.30" />
              <stop offset="100%" stopColor={COLOR_B} stopOpacity="0.06" />
            </radialGradient>
            <filter id="glowA">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glowB">
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
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
              );
            })}
          </g>

          {/* Player B data (drawn first = behind) */}
          <g>
            <path
              d={dataPathB}
              fill="none"
              stroke={COLOR_B}
              strokeWidth="8"
              strokeLinejoin="round"
              opacity="0.15"
              filter="url(#glowB)"
            />
            <path
              d={dataPathB}
              fill="url(#battleFillB)"
              stroke={COLOR_B}
              strokeWidth="2.5"
              strokeLinejoin="round"
              opacity="0.9"
            />
            {dataPointsB.map((p, i) => (
              <circle
                key={i}
                cx={p.x.toFixed(2)}
                cy={p.y.toFixed(2)}
                r="3.5"
                fill={COLOR_B}
                stroke="white"
                strokeWidth="1.5"
              />
            ))}
          </g>

          {/* Player A data (drawn second = on top) */}
          <g>
            <path
              d={dataPathA}
              fill="none"
              stroke={COLOR_A}
              strokeWidth="8"
              strokeLinejoin="round"
              opacity="0.15"
              filter="url(#glowA)"
            />
            <path
              d={dataPathA}
              fill="url(#battleFillA)"
              stroke={COLOR_A}
              strokeWidth="2.5"
              strokeLinejoin="round"
              opacity="0.9"
            />
            {dataPointsA.map((p, i) => (
              <circle
                key={i}
                cx={p.x.toFixed(2)}
                cy={p.y.toFixed(2)}
                r="3.5"
                fill={COLOR_A}
                stroke="white"
                strokeWidth="1.5"
              />
            ))}
          </g>

          {/* Labels + scores */}
          <g>
            {labelPoints.map((label) => (
              <g key={label.key}>
                <text
                  x={label.x.toFixed(2)}
                  y={label.y.toFixed(2)}
                  dy={label.dy}
                  textAnchor={label.anchor as any}
                  fill="rgba(209,213,219,1)"
                  style={{ fontSize: 12, fontWeight: 500, letterSpacing: "-0.01em" }}
                >
                  {label.key}
                </text>
                <text
                  x={label.x.toFixed(2)}
                  y={label.y.toFixed(2)}
                  dy={label.dy + 16}
                  textAnchor={label.anchor as any}
                  style={{ fontSize: 11, fontWeight: 500 }}
                >
                  <tspan fill={COLOR_A}>{label.scoreA}점</tspan>
                  <tspan fill="rgba(255,255,255,0.2)"> · </tspan>
                  <tspan fill={COLOR_B}>{label.scoreB}점</tspan>
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 text-[12px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_A }} />
          <span className="text-gray-300">{nameA}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_B }} />
          <span className="text-gray-300">{nameB}</span>
        </span>
      </div>
    </div>
  );
}

export default memo(BattleRadarChartInner);
