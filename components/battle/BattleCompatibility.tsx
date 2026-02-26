"use client";

import type { BattleLlmAnalysis, RelationshipType } from "@/types/battle";

type Props = {
  compatibility: BattleLlmAnalysis["compatibility"];
};

const SCENARIO_EMOJI: Record<string, string> = {
  lover: "\u2764\uFE0F",
  friend: "\uD83C\uDF7A",
  colleague: "\uD83C\uDFE2",
  family: "\uD83C\uDFE0",
  other: "\uD83E\uDD1D",
};

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  lover: "연인",
  friend: "친구",
  colleague: "직장동료",
  family: "가족",
  other: "지인",
};

export default function BattleCompatibility({ compatibility }: Props) {
  const { baseAnalysis, mainScenario, bonusScenarios } = compatibility;
  const mainEmoji = SCENARIO_EMOJI[mainScenario.type] || SCENARIO_EMOJI.other;
  const mainLabel = RELATIONSHIP_LABELS[mainScenario.type as RelationshipType] || mainScenario.type;

  return (
    <div className="space-y-3">
      <h3 className="text-[16px] font-semibold text-text-primary">상성 시나리오 분석</h3>

      {/* Base analysis */}
      {baseAnalysis && (
        <div className="rounded-2xl overflow-hidden flex" style={{ backgroundColor: "#141414" }}>
          <div className="w-1 shrink-0" style={{ backgroundColor: "#A855F7" }} />
          <div className="p-6 flex-1">
            <h4 className="text-[15px] font-bold text-text-primary mb-3">기본 상성</h4>
            <div className="space-y-4">
              {baseAnalysis.split(/\n\s*\n/).map((para, i) => (
                <p key={i} className="text-base text-gray-300 leading-7">{para.trim()}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main scenario */}
      {mainScenario.analysis && (
        <div
          className="rounded-2xl overflow-hidden border border-[#A855F7]/20"
          style={{ backgroundColor: "#141414" }}
        >
          <div className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: "#A855F7" }}>
                선택한 관계
              </span>
            </div>
            <h4 className="text-[17px] font-bold text-text-primary mb-3">
              {mainEmoji} {mainLabel}
            </h4>
            <p className="text-base text-gray-300 leading-7">{mainScenario.analysis}</p>
          </div>
        </div>
      )}

      {/* Bonus scenarios */}
      {bonusScenarios.map((scenario, i) => {
        if (!scenario.analysis) return null;
        const emoji = SCENARIO_EMOJI[scenario.type] || SCENARIO_EMOJI.other;
        return (
          <div
            key={i}
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: "#141414" }}
          >
            <div className="p-5">
              <h4 className="text-[15px] font-semibold text-text-primary mb-2">
                {emoji} {scenario.label}
              </h4>
              <p className="text-[14px] text-text-secondary leading-relaxed">{scenario.analysis}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
