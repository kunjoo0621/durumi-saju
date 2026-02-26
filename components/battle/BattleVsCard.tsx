"use client";

import type { CategoryMatchResult } from "@/types/battle";
import type { BattleLlmAnalysis } from "@/types/battle";

const COLOR_WINNER = "#FF6B6B";
const COLOR_LOSER  = "#5A5A6A";

type Props = {
  matches: CategoryMatchResult[];
  nameA: string;
  nameB: string;
  llmComments: BattleLlmAnalysis["categoryComments"];
  highlightCategory?: string;
};

function CategoryCard({
  m,
  nameA,
  nameB,
  comment,
  isHighlight,
}: {
  m: CategoryMatchResult;
  nameA: string;
  nameB: string;
  comment?: string;
  isHighlight?: boolean;
}) {
  const pctA = (m.scoreA / 100) * 100;
  const pctB = (m.scoreB / 100) * 100;
  const aWins = m.winner === "A";
  const bWins = m.winner === "B";
  const isDraw = m.winner === "draw";

  return (
    <div className="rounded-2xl bg-background-secondary overflow-hidden">
      <div className="p-4">
        {isHighlight && (
          <div className="mb-2">
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{ color: "#FF6B6B", backgroundColor: "rgba(255,107,107,0.15)" }}
            >
              결정적 항목
            </span>
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[15px] font-semibold text-text-primary">{m.category}</span>
          <div className="flex items-center gap-2">
            {!isDraw && (
              <span className="text-[11px] font-medium text-text-tertiary">
                +{m.diff}점
              </span>
            )}
            {isDraw ? (
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
                style={{ width: `${pctA}%`, backgroundColor: aWins ? COLOR_WINNER : COLOR_LOSER }}
              />
            </div>
            <span
              className="text-[13px] font-semibold w-8 text-right"
              style={{ color: aWins ? COLOR_WINNER : COLOR_LOSER }}
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
                style={{ width: `${pctB}%`, backgroundColor: bWins ? COLOR_WINNER : COLOR_LOSER }}
              />
            </div>
            <span
              className="text-[13px] font-semibold w-8 text-right"
              style={{ color: bWins ? COLOR_WINNER : COLOR_LOSER }}
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
  // Put highlight category first, rest in original order
  const sorted = highlightCategory
    ? [
        ...matches.filter((m) => m.category === highlightCategory),
        ...matches.filter((m) => m.category !== highlightCategory),
      ]
    : matches;

  return (
    <div className="space-y-4">
      {sorted.map((m) => (
        <CategoryCard
          key={m.category}
          m={m}
          nameA={nameA}
          nameB={nameB}
          comment={getComment(llmComments, m.category)}
          isHighlight={m.category === highlightCategory}
        />
      ))}
    </div>
  );
}
