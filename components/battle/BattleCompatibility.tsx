"use client";

import { useState } from "react";
import { Heart, Users, Briefcase, House, Handshake, CaretDown } from "@phosphor-icons/react";
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

const MAIN_SCENARIO_DISPLAY: Record<RelationshipType, string> = {
  lover: "연인으로 만났다면",
  friend: "친구로 만났다면",
  colleague: "직장동료로 만났다면",
  family: "가족으로 만났다면",
  other: "지인으로 만났다면",
};

/* ── Reusable section card matching personal SectionItem style ── */

function SectionCard({
  icon: IconComp,
  iconColor,
  title,
  badge,
  badgeColor,
  badgeBg,
  accentColor,
  content,
  collapsible = false,
  defaultExpanded = true,
}: {
  icon: Icon;
  iconColor: string;
  title: string;
  badge?: string;
  badgeColor?: string;
  badgeBg?: string;
  accentColor: string;
  content: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="flex bg-background-secondary rounded-2xl overflow-hidden">
      <div
        className="w-1 shrink-0 rounded-full my-2 ml-1.5"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex-1 min-w-0">
        {/* Header — matches personal SectionHeader layout */}
        <button
          type="button"
          onClick={collapsible ? () => setExpanded((p) => !p) : undefined}
          className={`w-full px-6 py-5 flex items-center justify-between text-left transition-colors ${
            collapsible ? "hover:bg-white/[0.03] active:bg-white/[0.06]" : ""
          }`}
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-2">
            <IconComp weight="duotone" size={28} color={iconColor} aria-hidden="true" />
            <span className="text-title-3 text-text-primary">{title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {badge && (
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                style={{ color: badgeColor, backgroundColor: badgeBg }}
              >
                {badge}
              </span>
            )}
            {collapsible && (
              <CaretDown
                weight="bold"
                size={20}
                className={`text-text-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            )}
          </div>
        </button>

        {/* Content — grid animation matching personal SectionList */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-6 pb-6 pt-4">
              <div className="space-y-6">
                {content.split(/\n\s*\n/).map((para, i) => (
                  <p key={i} className="text-[16px] text-text-primary leading-[1.75]">
                    {para.trim()}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BattleCompatibility({ compatibility }: Props) {
  const { baseAnalysis, mainScenario, bonusScenarios } = compatibility;
  const MainIcon = SCENARIO_ICONS[mainScenario.type] || Handshake;
  const mainDisplay = MAIN_SCENARIO_DISPLAY[mainScenario.type as RelationshipType] || `${mainScenario.type}로 만났다면`;

  return (
    <div className="space-y-5">
      {/* Base analysis — always expanded */}
      {baseAnalysis && (
        <SectionCard
          icon={Handshake}
          iconColor="#A855F7"
          title="기본 상성"
          accentColor="#A855F7"
          badge="상성"
          badgeColor="#A855F7"
          badgeBg="rgba(168,85,247,0.15)"
          content={baseAnalysis}
        />
      )}

      {/* Main scenario — always expanded */}
      {mainScenario.analysis && (
        <SectionCard
          icon={MainIcon}
          iconColor="#FF6B6B"
          title={mainDisplay}
          accentColor="#FF6B6B"
          badge="선택한 관계"
          badgeColor="#FF6B6B"
          badgeBg="rgba(255,107,107,0.15)"
          content={mainScenario.analysis}
        />
      )}

      {/* Bonus scenarios — collapsed by default */}
      {bonusScenarios.map((scenario, i) => {
        if (!scenario.analysis) return null;
        const BonusIcon = SCENARIO_ICONS[scenario.type] || Handshake;
        return (
          <SectionCard
            key={i}
            icon={BonusIcon}
            iconColor="#9CA3AF"
            title={scenario.label}
            accentColor="#D1D5DB"
            content={scenario.analysis}
            collapsible
            defaultExpanded={false}
          />
        );
      })}
    </div>
  );
}
