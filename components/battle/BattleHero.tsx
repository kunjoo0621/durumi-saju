"use client";

import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import BattleRadarChart from "@/components/battle/BattleRadarChart";
import type { BattleComparison, BattleIntensity } from "@/types/battle";
import type { ServerScores } from "@/lib/utils/saju-scoring";

type Props = {
  nameA: string;
  nameB: string;
  gradeA: string;
  gradeB: string;
  compositeA: number;
  compositeB: number;
  comparison: BattleComparison;
  heroQuip: string;
  scoresA: ServerScores;
  scoresB: ServerScores;
};

const INTENSITY_LABELS: Record<BattleIntensity, string> = {
  "압승": "압승",
  "승리": "승리",
  "신승": "신승",
  "무승부": "대등한 대결",
};

const COLOR_A = "#FF6B6B";
const COLOR_B = "#A855F7";

export default function BattleHero({
  nameA,
  nameB,
  gradeA,
  gradeB,
  compositeA,
  compositeB,
  comparison,
  heroQuip,
  scoresA,
  scoresB,
}: Props) {
  const isDraw = comparison.overallWinner === "draw";
  const winnerIsA = comparison.overallWinner === "A";
  const winnerName = isDraw ? null : winnerIsA ? nameA : nameB;
  const [chartExpanded, setChartExpanded] = useState(false);

  return (
    <div className="rounded-3xl relative overflow-hidden" style={{ backgroundColor: "#141414" }}>
      <div className="p-6">
        {/* Top: Player names + grades (composite) */}
        <div className="flex justify-between items-start mb-6">
          {/* Player A */}
          <div className="flex flex-col items-center flex-1">
            <span
              className="text-[16px] font-semibold truncate max-w-[120px]"
              style={{ color: COLOR_A }}
            >
              {nameA}
            </span>
            <span className="text-[13px] mt-1" style={{ color: COLOR_A, opacity: 0.7 }}>
              {gradeA} ({compositeA}점)
            </span>
          </div>

          <span className="text-[13px] text-text-tertiary font-medium tracking-wider mt-1">VS</span>

          {/* Player B */}
          <div className="flex flex-col items-center flex-1">
            <span
              className="text-[16px] font-semibold truncate max-w-[120px]"
              style={{ color: COLOR_B }}
            >
              {nameB}
            </span>
            <span className="text-[13px] mt-1" style={{ color: COLOR_B, opacity: 0.7 }}>
              {gradeB} ({compositeB}점)
            </span>
          </div>
        </div>

        {/* Center: Large score */}
        <div className="text-center mb-4">
          <div className="flex justify-center items-baseline gap-3">
            <span
              className="text-6xl font-aggro font-bold"
              style={{
                color: isDraw || winnerIsA
                  ? COLOR_A
                  : `${COLOR_A}4D`, // 30% opacity
              }}
            >
              {comparison.winsA}
            </span>
            <span className="text-text-tertiary text-2xl font-light">:</span>
            <span
              className="text-6xl font-aggro font-bold"
              style={{
                color: isDraw || !winnerIsA
                  ? COLOR_B
                  : `${COLOR_B}4D`, // 30% opacity
              }}
            >
              {comparison.winsB}
            </span>
          </div>

          {comparison.draws > 0 && (
            <span className="text-text-tertiary text-[13px] mt-1 inline-block">
              (무승부 {comparison.draws})
            </span>
          )}
        </div>

        {/* Bottom: Winner intensity + heroQuip */}
        <div className="text-center">
          {winnerName ? (
            <p className="text-lg font-semibold" style={{ color: winnerIsA ? COLOR_A : COLOR_B }}>
              {winnerName}의 {INTENSITY_LABELS[comparison.overallIntensity] || comparison.overallIntensity}
            </p>
          ) : (
            <p className="text-lg font-semibold text-text-secondary">
              {INTENSITY_LABELS[comparison.overallIntensity] || comparison.overallIntensity}
            </p>
          )}

          {heroQuip && (
            <p className="text-[16px] font-medium text-white/80 leading-relaxed mt-1">
              {heroQuip}
            </p>
          )}
        </div>
      </div>

      {/* Toggle: 상세 비교 보기 (접힌 상태에서만) */}
      <div className="px-5 pb-5">
        {!chartExpanded && (
          <button
            type="button"
            onClick={() => setChartExpanded(true)}
            className="w-full bg-[#252525] text-sm font-medium text-gray-200 py-3 rounded-lg mt-4 transition-colors hover:bg-[#2A2A2A] active:bg-[#2A2A2A] flex items-center justify-center gap-1.5"
          >
            상세 비교 보기
            <CaretDown weight="bold" size={16} />
          </button>
        )}

        {/* Radar chart accordion */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
            chartExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <BattleRadarChart
              scoresA={scoresA}
              scoresB={scoresB}
              nameA={nameA}
              nameB={nameB}
              bare
            />

            <button
              type="button"
              onClick={() => setChartExpanded(false)}
              className="w-full bg-[#252525] text-sm font-medium text-gray-200 py-3 rounded-lg mt-4 transition-colors hover:bg-[#2A2A2A] active:bg-[#2A2A2A] flex items-center justify-center gap-1.5"
            >
              상세 비교 접기
              <CaretUp weight="bold" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
