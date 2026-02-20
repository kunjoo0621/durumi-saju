"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo } from "react";
import { getGradeColor, getGradeBadge } from "@/lib/utils/grade-colors";

export type OverallGradeLabel = "S" | "A" | "B" | "C" | "D";

type OverallGradeBadgeSlotProps = {
  grade: OverallGradeLabel;
  badgeSrc?: string | null;
  size?: number;
  className?: string;
};

export const GRADE_GLOWS: Record<OverallGradeLabel, string> = {
  S: `radial-gradient(circle, ${getGradeColor("S").glow} 0%, transparent 70%)`,
  A: `radial-gradient(circle, ${getGradeColor("A").glow} 0%, transparent 70%)`,
  B: `radial-gradient(circle, ${getGradeColor("B").glow} 0%, transparent 70%)`,
  C: `radial-gradient(circle, ${getGradeColor("C").glow} 0%, transparent 70%)`,
  D: `radial-gradient(circle, ${getGradeColor("D").glow} 0%, transparent 70%)`,
};

export default function OverallGradeBadgeSlot({
  grade,
  badgeSrc,
  size,
  className,
}: OverallGradeBadgeSlotProps) {
  const isCompact = typeof size === "number" && size < 100;
  const glow = useMemo(() => GRADE_GLOWS[grade] || GRADE_GLOWS.D, [grade]);
  const resolvedBadge = badgeSrc ?? getGradeBadge(grade);

  if (resolvedBadge) {
    const normalizedSize = typeof size === "number" && Number.isFinite(size)
      ? Math.min(220, Math.max(96, Math.round(size)))
      : 152;
    return (
      <div
        className={`relative isolate overflow-hidden rounded-full ${className || ""}`}
        style={{ width: normalizedSize, height: normalizedSize }}
        aria-label={`등급 배지 슬롯 (${grade})`}
      >
        <img
          src={resolvedBadge}
          alt={`등급 배지 ${grade}`}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      </div>
    );
  }

  if (isCompact) {
    return (
      <div
        className={`relative flex items-center justify-center ${className || ""}`}
        style={{ width: size, height: size }}
        aria-label={`등급 배지 슬롯 (${grade})`}
      >
        <div
          className="absolute -inset-4 rounded-full"
          style={{ background: glow }}
          aria-hidden="true"
        />
        <span className="relative text-[28px] font-aggro font-bold text-white/90">
          {grade}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center ${className || ""}`}
      aria-label={`등급 배지 슬롯 (${grade})`}
    >
      <div
        className="absolute -inset-12 rounded-full"
        style={{ background: glow }}
        aria-hidden="true"
      />
      <span className="relative text-8xl font-aggro font-bold text-white/90">
        {grade}
      </span>
    </div>
  );
}
