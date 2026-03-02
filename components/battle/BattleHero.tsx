"use client";

import { useState } from "react";
import Image from "next/image";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import BattleRadarChart from "@/components/battle/BattleRadarChart";
import { getGradeColor, getGradeBadge } from "@/lib/utils/grade-colors";
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
const LOSER_COLOR = "#374151";

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
  const winnerColor = winnerIsA ? COLOR_A : COLOR_B;
  const [chartExpanded, setChartExpanded] = useState(false);

  const gradeColorA = getGradeColor(gradeA);
  const gradeColorB = getGradeColor(gradeB);

  return (
    <div className="rounded-2xl relative overflow-hidden bg-[#141414]">
      {/* Winner glow */}
      {!isDraw && (
        <div
          className="absolute top-0 inset-x-0 h-[100px] pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at ${winnerIsA ? "30%" : "70%"} 0%, ${winnerColor}0A, transparent 70%)`,
          }}
        />
      )}

      <div className="relative pt-7 px-5 pb-5">
        {/* Player row */}
        <div className="flex items-start justify-center gap-2">
          {/* Player A */}
          <div className="flex flex-col items-center flex-1 min-w-0">
            {/* Badge */}
            <div className="relative mb-2.5">
              <div
                className="absolute -inset-1 rounded-full"
                style={{ background: `radial-gradient(circle, ${gradeColorA.main}25, transparent 70%)` }}
              />
              <Image
                src={getGradeBadge(gradeA)}
                alt={`${gradeA}등급`}
                width={52}
                height={52}
                className="relative"
              />
            </div>
            {/* Name */}
            <span
              className="text-lg font-bold truncate max-w-[120px] text-white"
            >
              {nameA}
            </span>
            {/* Grade + Score */}
            <div className="flex items-center mt-0.5">
              <span className="text-[13px] font-semibold" style={{ color: gradeColorA.text }}>
                {gradeA}등급
              </span>
              <span className="text-[13px] text-gray-600 mx-1">·</span>
              <span className="text-[13px] font-semibold text-gray-500">
                {compositeA}점
              </span>
            </div>
          </div>

          {/* Center Score */}
          <div className="flex flex-col items-center pt-4 shrink-0">
            <span className="text-[11px] font-medium text-gray-600 tracking-[0.1em] mb-1">
              VS
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className="font-aggro font-bold"
                style={{
                  fontSize: isDraw || winnerIsA ? 48 : 36,
                  color: isDraw || winnerIsA ? COLOR_A : LOSER_COLOR,
                }}
              >
                {comparison.winsA}
              </span>
              <span className="text-gray-600 text-xl font-light">:</span>
              <span
                className="font-aggro font-bold"
                style={{
                  fontSize: isDraw || !winnerIsA ? 48 : 36,
                  color: isDraw || !winnerIsA ? COLOR_B : LOSER_COLOR,
                }}
              >
                {comparison.winsB}
              </span>
            </div>
          </div>

          {/* Player B */}
          <div className="flex flex-col items-center flex-1 min-w-0">
            {/* Badge */}
            <div className="relative mb-2.5">
              <div
                className="absolute -inset-1 rounded-full"
                style={{ background: `radial-gradient(circle, ${gradeColorB.main}25, transparent 70%)` }}
              />
              <Image
                src={getGradeBadge(gradeB)}
                alt={`${gradeB}등급`}
                width={52}
                height={52}
                className="relative"
              />
            </div>
            {/* Name */}
            <span
              className="text-lg font-bold truncate max-w-[120px] text-white"
            >
              {nameB}
            </span>
            {/* Grade + Score */}
            <div className="flex items-center mt-0.5">
              <span className="text-[13px] font-semibold" style={{ color: gradeColorB.text }}>
                {gradeB}등급
              </span>
              <span className="text-[13px] text-gray-600 mx-1">·</span>
              <span className="text-[13px] font-semibold text-gray-500">
                {compositeB}점
              </span>
            </div>
          </div>
        </div>

        {/* Result tag + heroQuip */}
        <div className="flex flex-col items-center gap-2.5 mt-5">
          {/* Result pill tag */}
          {winnerName ? (
            <span
              className="text-[13px] font-bold rounded-full"
              style={{
                padding: "7px 16px",
                color: winnerIsA ? COLOR_A : COLOR_B,
                backgroundColor: `${winnerIsA ? COLOR_A : COLOR_B}14`,
              }}
            >
              {winnerName}의 {INTENSITY_LABELS[comparison.overallIntensity] || comparison.overallIntensity}
            </span>
          ) : (
            <span
              className="text-[13px] font-bold text-gray-400 rounded-full"
              style={{
                padding: "7px 16px",
                backgroundColor: "rgba(107,114,128,0.08)",
              }}
            >
              {INTENSITY_LABELS[comparison.overallIntensity] || comparison.overallIntensity}
            </span>
          )}

          {/* Divider */}
          {heroQuip && <div className="h-px bg-white/[0.04] mx-8 w-full" />}

          {/* heroQuip */}
          {heroQuip && (
            <p className="text-sm text-gray-400 text-center max-w-[280px] leading-[1.5]">
              {heroQuip}
            </p>
          )}
        </div>
      </div>

      {/* Toggle: 상세 비교 보기 */}
      <div className="px-5 pb-5">
        {!chartExpanded && (
          <button
            type="button"
            onClick={() => setChartExpanded(true)}
            className="w-full bg-[#1A1A1A] text-[13px] font-semibold text-gray-400 py-3 rounded-lg mt-1 transition-colors hover:bg-[#222222] active:bg-[#222222] flex items-center justify-center gap-1.5"
          >
            상세 비교 보기
            <CaretDown weight="bold" size={14} />
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
              className="w-full bg-[#1A1A1A] text-[13px] font-semibold text-gray-400 py-3 rounded-lg mt-4 transition-colors hover:bg-[#222222] active:bg-[#222222] flex items-center justify-center gap-1.5"
            >
              상세 비교 접기
              <CaretUp weight="bold" size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
