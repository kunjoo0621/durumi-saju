"use client";

import OverallGradeBadgeSlot from "@/components/result/OverallGradeBadgeSlot";
import type { OverallGradeLabel } from "@/components/result/OverallGradeBadgeSlot";
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

  return (
    <div className="rounded-3xl bg-background-secondary p-6 text-center">
      {/* heroComment */}
      <p className="text-[18px] font-aggro font-bold text-text-primary leading-tight mb-6">
        {heroComment}
      </p>

      {/* Grade badges */}
      <div className="flex justify-center items-center gap-6">
        {/* Player A */}
        <div className="flex flex-col items-center">
          <OverallGradeBadgeSlot
            grade={gradeA as OverallGradeLabel}
            size={isDraw || winnerIsA ? 80 : 64}
            className={isDraw || winnerIsA ? "" : "opacity-50"}
          />
          <span className="text-[13px] text-text-secondary mt-3">{nameA}</span>
        </div>

        <span className="text-sm text-gray-500 font-medium">VS</span>

        {/* Player B */}
        <div className="flex flex-col items-center">
          <OverallGradeBadgeSlot
            grade={gradeB as OverallGradeLabel}
            size={isDraw || !winnerIsA ? 80 : 64}
            className={isDraw || !winnerIsA ? "" : "opacity-50"}
          />
          <span className="text-[13px] text-text-secondary mt-3">{nameB}</span>
        </div>
      </div>

      {/* Win score */}
      <div className="mt-5 flex justify-center items-center gap-2">
        <span className={`text-xl font-bold ${isDraw || winnerIsA ? "text-white" : "text-gray-500"}`}>
          {comparison.winsA}
        </span>
        <span className="text-text-tertiary">:</span>
        <span className={`text-xl font-bold ${isDraw || !winnerIsA ? "text-white" : "text-gray-500"}`}>
          {comparison.winsB}
        </span>
        {comparison.draws > 0 && (
          <span className="text-text-tertiary text-sm ml-1">(무 {comparison.draws})</span>
        )}
      </div>

      {/* Intensity */}
      <div className="mt-2">
        <span className="text-2xl font-bold" style={{ color: "#FF6B6B" }}>
          {INTENSITY_LABELS[comparison.overallIntensity] || comparison.overallIntensity}
        </span>
      </div>
    </div>
  );
}
