"use client";

import type { CategoryMatchResult, BattleIntensity } from "@/types/battle";
import type { BattleLlmAnalysis } from "@/types/battle";

const COLOR_A = "#FF6B6B";
const COLOR_B = "#A855F7";

function intensityBadgeColor(intensity: BattleIntensity): string {
  switch (intensity) {
    case "압승": return "bg-red-500/20 text-red-400";
    case "승리": return "bg-orange-500/20 text-orange-400";
    case "신승": return "bg-yellow-500/20 text-yellow-400";
    case "무승부": return "bg-zinc-500/20 text-zinc-400";
  }
}

function winnerBadge(winner: "A" | "B" | "draw", nameA: string, nameB: string) {
  if (winner === "draw") return <span className="text-[12px] text-zinc-400 font-medium">무승부</span>;
  const name = winner === "A" ? nameA : nameB;
  const color = winner === "A" ? COLOR_A : COLOR_B;
  return <span className="text-[12px] font-semibold" style={{ color }}>{name} 승</span>;
}

function accentBarColor(winner: "A" | "B" | "draw"): string {
  if (winner !== "draw") return "#22C55E";
  return "#2A2A2A";
}

type Props = {
  matches: CategoryMatchResult[];
  nameA: string;
  nameB: string;
  llmComments: BattleLlmAnalysis["categoryComments"];
};

export default function BattleVsCard({ matches, nameA, nameB, llmComments }: Props) {
  const commentMap = new Map(llmComments.map((c) => [c.category, c.comment]));

  return (
    <div className="space-y-3">
      {matches.map((m) => {
        const pctA = (m.scoreA / 100) * 100;
        const pctB = (m.scoreB / 100) * 100;
        const comment = commentMap.get(m.category);

        return (
          <div key={m.category} className="flex rounded-2xl bg-background-secondary overflow-hidden">
            <div
              className="w-1 shrink-0 rounded-full my-2 ml-1.5"
              style={{ backgroundColor: accentBarColor(m.winner) }}
            />
            <div className="flex-1 min-w-0 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[15px] font-semibold text-text-primary">{m.category}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${intensityBadgeColor(m.intensity)}`}>
                    {m.intensity}
                  </span>
                  {winnerBadge(m.winner, nameA, nameB)}
                </div>
              </div>

              <div className="space-y-2">
                {/* Player A bar */}
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-text-tertiary w-12 shrink-0 truncate">{nameA}</span>
                  <div className="flex-1 h-5 bg-background-primary rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pctA}%`, backgroundColor: `${COLOR_A}99` }}
                    />
                  </div>
                  <span className="text-[13px] font-semibold w-8 text-right" style={{ color: COLOR_A }}>{m.scoreA}</span>
                </div>

                {/* Player B bar */}
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-text-tertiary w-12 shrink-0 truncate">{nameB}</span>
                  <div className="flex-1 h-5 bg-background-primary rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pctB}%`, backgroundColor: `${COLOR_B}99` }}
                    />
                  </div>
                  <span className="text-[13px] font-semibold w-8 text-right" style={{ color: COLOR_B }}>{m.scoreB}</span>
                </div>
              </div>

              {comment && (
                <p className="mt-3 text-[13px] text-text-secondary leading-relaxed pt-3">
                  {comment}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
