"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo } from "react";

export type OverallGradeLabel = "S" | "A" | "B" | "C" | "D";

type OverallGradeBadgeSlotProps = {
  grade: OverallGradeLabel;
  badgeSrc?: string | null;
  size?: number;
  className?: string;
};

const GRADE_GLOWS: Record<OverallGradeLabel, string> = {
  S: "radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)",
  A: "radial-gradient(circle, rgba(239,68,68,0.2) 0%, transparent 70%)",
  B: "radial-gradient(circle, rgba(34,197,94,0.2) 0%, transparent 70%)",
  C: "radial-gradient(circle, rgba(161,161,170,0.2) 0%, transparent 70%)",
  D: "radial-gradient(circle, rgba(82,82,91,0.15) 0%, transparent 70%)",
};

export default function OverallGradeBadgeSlot({
  grade,
  badgeSrc = null,
  size,
  className,
}: OverallGradeBadgeSlotProps) {
  const isCompact = typeof size === "number" && size < 100;
  const glow = useMemo(() => GRADE_GLOWS[grade] || GRADE_GLOWS.D, [grade]);

  if (badgeSrc) {
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
          src={badgeSrc}
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
