"use client";

import type { CategoryMatchResult } from "@/types/battle";
import type { BattleLlmAnalysis } from "@/types/battle";

const COLOR_WINNER = "#FF6B6B";
const COLOR_LOSER = "#4A4A5A";

type Props = {
  matches: CategoryMatchResult[];
  nameA: string;
  nameB: string;
  llmComments: BattleLlmAnalysis["categoryComments"];
  highlightCategory?: string;
};

function barColor(isWinner: boolean): string {
  return isWinner ? COLOR_WINNER : COLOR_LOSER;
}

function HighlightCard({
  m,
  nameA,
  nameB,
  comment,
}: {
  m: CategoryMatchResult;
  nameA: string;
  nameB: string;
  comment?: string;
}) {
  const pctA = (m.scoreA / 100) * 100;
  const pctB = (m.scoreB / 100) * 100;
  const aWins = m.winner === "A";
  const bWins = m.winner === "B";

  return (
    <div className="rounded-2xl bg-background-secondary overflow-hidden border border-[#FF6B6B]/20">
      <div className="p-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold tracking-wide" style={{ color: "#FF6B6B" }}>
            이번 배틀의 결정적 항목
          </span>
        </div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[17px] font-bold text-text-primary">{m.category}</span>
          {m.winner !== "draw" && (
            <span
              className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "#FF6B6B20", color: "#FF6B6B" }}
            >
              +{m.diff}점 차이
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {/* Player A bar */}
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-text-tertiary w-12 shrink-0 truncate">{nameA}</span>
            <div className="flex-1 h-7 bg-background-primary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pctA}%`, backgroundColor: barColor(aWins || m.winner === "draw") }}
              />
            </div>
            <span
              className="text-lg font-bold w-9 text-right"
              style={{ color: aWins ? COLOR_WINNER : m.winner === "draw" ? COLOR_WINNER : COLOR_LOSER }}
            >
              {m.scoreA}
            </span>
          </div>

          {/* Player B bar */}
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-text-tertiary w-12 shrink-0 truncate">{nameB}</span>
            <div className="flex-1 h-7 bg-background-primary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pctB}%`, backgroundColor: barColor(bWins || m.winner === "draw") }}
              />
            </div>
            <span
              className="text-lg font-bold w-9 text-right"
              style={{ color: bWins ? COLOR_WINNER : m.winner === "draw" ? COLOR_WINNER : COLOR_LOSER }}
            >
              {m.scoreB}
            </span>
          </div>
        </div>

        {comment && (
          <p className="mt-4 text-base text-text-secondary leading-7 pt-3 border-t border-white/5">
            {comment}
          </p>
        )}
      </div>
    </div>
  );
}

function CompactCard({
  m,
  nameA,
  nameB,
  comment,
}: {
  m: CategoryMatchResult;
  nameA: string;
  nameB: string;
  comment?: string;
}) {
  const pctA = (m.scoreA / 100) * 100;
  const pctB = (m.scoreB / 100) * 100;
  const aWins = m.winner === "A";
  const bWins = m.winner === "B";

  return (
    <div className="rounded-2xl bg-background-secondary overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[15px] font-semibold text-text-primary">{m.category}</span>
          <div className="flex items-center gap-2">
            {m.winner !== "draw" && (
              <span className="text-[11px] font-medium text-text-tertiary">
                +{m.diff}점
              </span>
            )}
            {m.winner === "draw" ? (
              <span className="text-[12px] text-zinc-400 font-medium">무승부</span>
            ) : (
              <span className="text-[12px] font-semibold" style={{ color: COLOR_WINNER }}>
                {m.winner === "A" ? nameA : nameB} 승
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {/* Player A bar */}
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-text-tertiary w-12 shrink-0 truncate">{nameA}</span>
            <div className="flex-1 h-5 bg-background-primary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pctA}%`, backgroundColor: barColor(aWins || m.winner === "draw") }}
              />
            </div>
            <span
              className="text-[13px] font-semibold w-8 text-right"
              style={{ color: aWins ? COLOR_WINNER : m.winner === "draw" ? COLOR_WINNER : COLOR_LOSER }}
            >
              {m.scoreA}
            </span>
          </div>

          {/* Player B bar */}
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-text-tertiary w-12 shrink-0 truncate">{nameB}</span>
            <div className="flex-1 h-5 bg-background-primary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pctB}%`, backgroundColor: barColor(bWins || m.winner === "draw") }}
              />
            </div>
            <span
              className="text-[13px] font-semibold w-8 text-right"
              style={{ color: bWins ? COLOR_WINNER : m.winner === "draw" ? COLOR_WINNER : COLOR_LOSER }}
            >
              {m.scoreB}
            </span>
          </div>
        </div>

        {comment && (
          <p className="mt-3 text-[13px] text-text-secondary leading-relaxed pt-3 border-t border-white/5">
            {comment}
          </p>
        )}
      </div>
    </div>
  );
}

const CATEGORY_KEY_MAP: Record<string, keyof BattleLlmAnalysis["categoryComments"]> = {
  "재물운": "wealth",
  "연애운": "love",
  "직장운": "career",
  "건강운": "health",
  "대인운": "social",
};

function getComment(llmComments: BattleLlmAnalysis["categoryComments"], category: string): string | undefined {
  const key = CATEGORY_KEY_MAP[category];
  return key ? llmComments[key] || undefined : undefined;
}

export default function BattleVsCard({ matches, nameA, nameB, llmComments, highlightCategory }: Props) {

  const highlightMatch = highlightCategory
    ? matches.find((m) => m.category === highlightCategory)
    : null;

  const compactMatches = highlightMatch
    ? matches.filter((m) => m.category !== highlightCategory)
    : matches;

  return (
    <div className="space-y-3">
      {highlightMatch && (
        <HighlightCard
          m={highlightMatch}
          nameA={nameA}
          nameB={nameB}
          comment={getComment(llmComments, highlightMatch.category)}
        />
      )}
      {compactMatches.map((m) => (
        <CompactCard
          key={m.category}
          m={m}
          nameA={nameA}
          nameB={nameB}
          comment={getComment(llmComments, m.category)}
        />
      ))}
    </div>
  );
}
