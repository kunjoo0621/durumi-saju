"use client";

import type { CategoryMatchResult } from "@/types/battle";
import type { BattleLlmAnalysis } from "@/types/battle";

const COLOR_WINNER = "#FF6B6B";
const COLOR_LOSER = "#5A5A6A";

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
    <div className="flex rounded-2xl overflow-hidden" style={{ backgroundColor: "#1A1A1A" }}>
      {/* Left accent bar — matching personal SectionItem */}
      <div
        className="w-1 shrink-0 rounded-full my-2 ml-1.5"
        style={{ backgroundColor: COLOR_WINNER }}
      />
      <div className="flex-1 min-w-0 p-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-md"
            style={{ color: "#FF6B6B", backgroundColor: "rgba(255,107,107,0.15)" }}
          >
            결정적 항목
          </span>
        </div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[17px] font-bold text-text-primary">{m.category}</span>
          {m.winner !== "draw" && (
            <span
              className="text-[12px] font-semibold px-2.5 py-1 rounded-md"
              style={{ backgroundColor: "rgba(255,107,107,0.15)", color: "#FF6B6B" }}
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
          <>
            <div className="mt-5 mb-4 h-px bg-white/[0.06]" />
            <div className="space-y-6">
              {comment.split(/\n\s*\n/).map((para, i) => (
                <p key={i} className="text-[16px] text-text-primary leading-[1.75]">{para.trim()}</p>
              ))}
            </div>
          </>
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
          <>
            <div className="mt-4 mb-4 h-px bg-white/[0.06]" />
            <div className="space-y-6">
              {comment.split(/\n\s*\n/).map((para, i) => (
                <p key={i} className="text-[16px] text-text-primary leading-[1.75]">{para.trim()}</p>
              ))}
            </div>
          </>
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
    <div className="space-y-4">
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
