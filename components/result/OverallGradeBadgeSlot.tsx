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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSize(size?: number) {
  if (typeof size !== "number" || !Number.isFinite(size)) return 152;
  return clampNumber(Math.round(size), 96, 220);
}

function getPlaceholderTone(grade: OverallGradeLabel) {
  switch (grade) {
    case "S":
      return "from-white/14 via-white/8 to-primary/10";
    case "A":
      return "from-white/12 via-white/7 to-primary/8";
    case "B":
      return "from-white/11 via-white/6 to-white/3";
    case "C":
      return "from-white/10 via-white/5 to-white/2";
    case "D":
    default:
      return "from-white/9 via-white/4 to-white/1";
  }
}

export default function OverallGradeBadgeSlot({
  grade,
  badgeSrc = null,
  size,
  className,
}: OverallGradeBadgeSlotProps) {
  const normalizedSize = useMemo(() => normalizeSize(size), [size]);
  const placeholderTone = useMemo(() => getPlaceholderTone(grade), [grade]);

  const rootClassName = [
    "relative isolate overflow-hidden",
    "rounded-full",
    "bg-background-primary/30",
    "shadow-[0_12px_34px_rgba(0,0,0,0.38)]",
    "ring-1 ring-white/10",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClassName}
      style={{ width: normalizedSize, height: normalizedSize }}
      aria-label={`등급 배지 슬롯 (${grade})`}
    >
      {badgeSrc ? (
        // 이미지가 들어오면 그대로 교체 가능한 슬롯
        <img
          src={badgeSrc}
          alt={`등급 배지 ${grade}`}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <>
          <div className={`absolute inset-0 bg-gradient-to-br ${placeholderTone}`} />
          <div className="absolute inset-0 opacity-[0.45] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.18),transparent_55%)]" />
          <div
            className="absolute -inset-8 bg-primary/12 blur-2xl"
            aria-hidden="true"
          />

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="text-[44px] leading-none font-extrabold tracking-[-0.03em] text-white/26">
              {grade}
            </div>
            <div className="mt-1 text-[11px] font-semibold tracking-[0.22em] text-white/55">
              BADGE
            </div>
          </div>
        </>
      )}
    </div>
  );
}
