"use client";

import OverallGradeBadgeSlot from "@/components/result/OverallGradeBadgeSlot";
import type { OverallGradeLabel } from "@/components/result/OverallGradeBadgeSlot";
import { getGradeColor } from "@/lib/utils/grade-colors";
import type { BattleComparison, BattleIntensity } from "@/types/battle";

type Props = {
  nameA: string;
  nameB: string;
  gradeA: string;
  gradeB: string;
  comparison: BattleComparison;
  heroComment: string;
};

const INTENSITY_LABELS: Record<BattleIntensity, string> = {
  "압승": "압승",
  "승리": "승리",
  "신승": "신승",
  "무승부": "대등한 대결",
};

export default function BattleHero({ nameA, nameB, gradeA, gradeB, comparison, heroComment }: Props) {
  const isDraw = comparison.overallWinner === "draw";
  const winnerIsA = comparison.overallWinner === "A";
  const winnerName = isDraw ? null : winnerIsA ? nameA : nameB;

  const colorA = getGradeColor(gradeA);
  const colorB = getGradeColor(gradeB);

  return (
    <div className="rounded-3xl p-6 md:p-8" style={{ backgroundColor: "#141414" }}>
      {/* Hero comment */}
      <div className="rounded-xl px-4 py-3 mb-8" style={{ backgroundColor: "rgba(255,107,107,0.08)" }}>
        <p className="text-[20px] font-aggro font-bold text-text-primary leading-snug text-center">
          {heroComment}
        </p>
      </div>

      {/* Grade badges VS layout */}
      <div className="flex justify-center items-end gap-4">
        {/* Player A */}
        <div className="flex flex-col items-center flex-1">
          <div className={isDraw || winnerIsA ? "" : "opacity-50"}>
            <OverallGradeBadgeSlot
              grade={gradeA as OverallGradeLabel}
              size={isDraw || winnerIsA ? 80 : 60}
            />
          </div>
          <span
            className="text-[13px] font-semibold mt-3"
            style={{ color: colorA.text }}
          >
            {gradeA}
          </span>
          <span className="text-[14px] text-text-secondary mt-1 truncate max-w-[100px]">{nameA}</span>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center pb-4">
          <span className="text-[13px] text-text-tertiary font-medium tracking-wider">VS</span>
        </div>

        {/* Player B */}
        <div className="flex flex-col items-center flex-1">
          <div className={isDraw || !winnerIsA ? "" : "opacity-50"}>
            <OverallGradeBadgeSlot
              grade={gradeB as OverallGradeLabel}
              size={isDraw || !winnerIsA ? 80 : 60}
            />
          </div>
          <span
            className="text-[13px] font-semibold mt-3"
            style={{ color: colorB.text }}
          >
            {gradeB}
          </span>
          <span className="text-[14px] text-text-secondary mt-1 truncate max-w-[100px]">{nameB}</span>
        </div>
      </div>

      {/* Score + intensity */}
      <div className="mt-6 text-center">
        <div className="flex justify-center items-baseline gap-3">
          <span
            className="text-[28px] font-aggro font-bold"
            style={{ color: isDraw || winnerIsA ? "#FFFFFF" : "rgba(255,255,255,0.3)" }}
          >
            {comparison.winsA}
          </span>
          <span className="text-text-tertiary text-lg">:</span>
          <span
            className="text-[28px] font-aggro font-bold"
            style={{ color: isDraw || !winnerIsA ? "#FFFFFF" : "rgba(255,255,255,0.3)" }}
          >
            {comparison.winsB}
          </span>
          {comparison.draws > 0 && (
            <span className="text-text-tertiary text-[13px] ml-1">(무 {comparison.draws})</span>
          )}
        </div>
        <div className="mt-2">
          {winnerName ? (
            <span className="text-lg font-semibold" style={{ color: "#FF6B6B" }}>
              {winnerName}의 {INTENSITY_LABELS[comparison.overallIntensity] || comparison.overallIntensity}
            </span>
          ) : (
            <span className="text-lg font-semibold text-text-secondary">
              {INTENSITY_LABELS[comparison.overallIntensity] || comparison.overallIntensity}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
