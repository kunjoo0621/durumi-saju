"use client";

import { Heart, Users, Briefcase, House, Handshake } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { BattleLlmAnalysis, RelationshipType } from "@/types/battle";

type Props = {
  compatibility: BattleLlmAnalysis["compatibility"];
};

const SCENARIO_ICONS: Record<string, Icon> = {
  lover: Heart,
  friend: Users,
  colleague: Briefcase,
  family: House,
  other: Handshake,
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
  const MainIcon = SCENARIO_ICONS[mainScenario.type] || Handshake;
  const mainLabel = RELATIONSHIP_LABELS[mainScenario.type as RelationshipType] || mainScenario.type;

  return (
    <div className="space-y-3">
      <h3 className="text-title-3 text-text-primary font-semibold">상성 시나리오 분석</h3>

      {/* Base analysis — left bar card */}
      {baseAnalysis && (
        <div className="rounded-2xl bg-background-secondary overflow-hidden flex">
          <div className="w-1 shrink-0 rounded-full my-2 ml-1.5" style={{ backgroundColor: "#A855F7" }} />
          <div className="p-6 flex-1">
            <h4 className="text-[15px] font-bold text-text-primary mb-3">기본 상성</h4>
            <div className="space-y-4">
              {baseAnalysis.split(/\n\s*\n/).map((para, i) => (
                <p key={i} className="text-[16px] text-text-primary leading-[1.75]">{para.trim()}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main scenario — primary accent card */}
      {mainScenario.analysis && (
        <div className="rounded-2xl bg-background-secondary overflow-hidden flex">
          <div className="w-1 shrink-0 rounded-full my-2 ml-1.5" style={{ backgroundColor: "#FF6B6B" }} />
          <div className="p-6 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                style={{ color: "#FF6B6B", backgroundColor: "rgba(255,107,107,0.15)" }}
              >
                선택한 관계
              </span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <MainIcon weight="duotone" size={22} color="#FF6B6B" aria-hidden="true" />
              <h4 className="text-[17px] font-bold text-text-primary">
                {mainLabel}로 만났다면
              </h4>
            </div>
            <p className="text-[16px] text-text-primary leading-[1.75]">{mainScenario.analysis}</p>
          </div>
        </div>
      )}

      {/* Bonus scenarios — muted accent cards */}
      {bonusScenarios.map((scenario, i) => {
        if (!scenario.analysis) return null;
        const BonusIcon = SCENARIO_ICONS[scenario.type] || Handshake;
        return (
          <div key={i} className="rounded-2xl bg-background-secondary overflow-hidden flex">
            <div className="w-1 shrink-0 rounded-full my-2 ml-1.5" style={{ backgroundColor: "#D1D5DB" }} />
            <div className="p-5 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <BonusIcon weight="duotone" size={20} color="#9CA3AF" aria-hidden="true" />
                <h4 className="text-[15px] font-semibold text-text-primary">{scenario.label}</h4>
              </div>
              <p className="text-[15px] text-text-primary leading-[1.7]">{scenario.analysis}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
