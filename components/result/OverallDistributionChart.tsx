"use client";

import { useEffect, useMemo, useState } from "react";
import { percentileRankFromComposite, topPercentFromPercentileRank } from "@/lib/gradeSystem";

export type GradeCutoffs = {
  S: number;
  A: number;
  B: number;
  C: number;
  D: number;
};

type OverallDistributionChartProps = {
  percentileRank: number;
  markerLabel: string;
  gradeCutoffs: GradeCutoffs | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type GradeSegment = {
  label: string;
  start: number;
  end: number;
  mid: number;
  topRange: string;
};

function buildGradeSegments(cutoffs: GradeCutoffs | null): GradeSegment[] {
  if (!cutoffs) return [];

  const entries = Object.entries(cutoffs)
    .map(([label, min]) => ({ label, min }))
    .filter((item) => Number.isFinite(item.min))
    .sort((a, b) => a.min - b.min);

  if (entries.length === 0) return [];

  return entries.map((entry, index) => {
    const next = entries[index + 1];
    const start = clamp(entry.min, 0, 100);
    const rawEnd = next ? next.min - 1 : 100;
    const end = clamp(rawEnd, 0, 100);
    const safeEnd = end < start ? start : end;
    const mid = (start + safeEnd) / 2;
    const startRank = percentileRankFromComposite(start);
    const endRank = percentileRankFromComposite(safeEnd);
    const topStart = topPercentFromPercentileRank(startRank);
    const topEnd = topPercentFromPercentileRank(endRank);
    const topMin = Math.min(topStart, topEnd);
    const topMax = Math.max(topStart, topEnd);
    const topRange = `상위 ${topMin}~${topMax}%`;
    return { label: entry.label, start, end: safeEnd, mid, topRange };
  });
}

export default function OverallDistributionChart({
  percentileRank,
  markerLabel,
  gradeCutoffs,
}: OverallDistributionChartProps) {
  const targetPercent = clamp(Number.isFinite(percentileRank) ? percentileRank : 50, 1, 99);
  const [animatedPercent, setAnimatedPercent] = useState(0);

  useEffect(() => {
    setAnimatedPercent(0);
    const frame = requestAnimationFrame(() => setAnimatedPercent(targetPercent));
    return () => cancelAnimationFrame(frame);
  }, [targetPercent]);

  const segments = useMemo(() => buildGradeSegments(gradeCutoffs), [gradeCutoffs]);
  const labelLeft = clamp(targetPercent, 6, 94);

  return (
    <div className="mt-6">
      <div className="relative h-[170px] rounded-2xl bg-background-primary/40 border border-white/5 overflow-hidden">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 320 170"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="distribution-curve"
            d="M10 120 C 70 120, 96 24, 160 24 C 224 24, 250 120, 310 120"
            fill="none"
            stroke="rgba(255, 109, 166, 0.85)"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={1}
          />
          <line x1="10" y1="120" x2="310" y2="120" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
        </svg>

        <div
          className="absolute bottom-[34px] transition-[left] duration-700 ease-out"
          style={{ left: `calc(${animatedPercent}% - 8px)` }}
        >
          <span className="h-4 w-4 rounded-full bg-primary border-2 border-background-primary shadow-[0_0_0_3px_rgba(255,255,255,0.09)] block" />
        </div>

        <div
          className="absolute bottom-[58px] marker-label text-[11px] leading-tight text-primary font-semibold text-center max-w-[140px]"
          style={{ left: `calc(${labelLeft}% - 70px)` }}
        >
          {markerLabel}
        </div>

        <div
          className="absolute bottom-[8px] text-[10px] text-text-tertiary font-medium"
          style={{ left: `calc(${labelLeft}% - 18px)` }}
        >
          {Math.round(targetPercent)}%
        </div>
      </div>

      {segments.length > 1 && (
        <div
          className="mt-3 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
        >
          {segments.map((segment) => (
            <div key={segment.label} className="text-center leading-tight">
              <div className="text-[11px] text-text-tertiary font-semibold">{segment.label}</div>
              <div className="text-[10px] text-text-tertiary/80">{segment.topRange}</div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .distribution-curve {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: curve-draw 0.9s ease-out forwards;
        }

        .marker-label {
          opacity: 0;
          animation: label-fade 0.5s ease-out 0.35s forwards;
        }

        @keyframes curve-draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes label-fade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .distribution-curve,
          .marker-label {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
