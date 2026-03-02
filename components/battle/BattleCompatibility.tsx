"use client";

import { useState } from "react";
import { Heart, UsersThree, Briefcase, House, Handshake, CaretDown } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { BattleLlmAnalysis, RelationshipType } from "@/types/battle";

type Props = {
  chemistry: BattleLlmAnalysis["chemistry"];
  relationshipType: RelationshipType;
};

const CHEMISTRY_TITLES: Record<string, string> = {
  lover: "연인으로서 둘은",
  friend: "친구로서 둘은",
  colleague: "동료로서 둘은",
  family: "가족으로서 둘은",
  other: "둘의 관계는",
};

const CHEMISTRY_ICONS: Record<string, Icon> = {
  lover: Heart,
  friend: UsersThree,
  colleague: Briefcase,
  family: House,
  other: Handshake,
};

const SCENARIO_ICONS: Record<string, Icon> = {
  lover: Heart,
  friend: UsersThree,
  colleague: Briefcase,
  family: House,
  other: Handshake,
};

/* ── Reusable collapsible card for bonus scenarios ── */

function SectionCard({
  icon: IconComp,
  iconColor,
  title,
  accentColor,
  punchline,
  content,
  collapsible = false,
  defaultExpanded = true,
}: {
  icon: Icon;
  iconColor: string;
  title: string;
  accentColor: string;
  punchline?: string;
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
        <button
          type="button"
          onClick={collapsible ? () => setExpanded((p) => !p) : undefined}
          className={`w-full pl-4 pr-6 py-5 text-left transition-colors ${
            collapsible ? "hover:bg-white/[0.03] active:bg-white/[0.06]" : ""
          }`}
          aria-expanded={expanded}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconComp weight="duotone" size={28} color={iconColor} aria-hidden="true" />
              <span className="text-title-3 text-text-primary">{title}</span>
            </div>
            {collapsible && (
              <CaretDown
                weight="bold"
                size={20}
                className={`text-text-secondary transition-transform shrink-0 ml-2 ${expanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            )}
          </div>
        </button>

        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-6 pb-6 pt-4">
              {punchline && (
                <p className="text-[16px] font-semibold text-white leading-[1.6] mb-3">{punchline}</p>
              )}
              <div className="space-y-6">
                {content.split(/\n\s*\n/).map((para, i) => (
                  <p key={i} className="text-[15px] text-gray-400 leading-[1.75]">
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

export default function BattleCompatibility({ chemistry, relationshipType }: Props) {
  const { punchline: chemPunchline, analysis, bonusScenarios } = chemistry;

  // 레거시 호환: loveAnalysis가 있으면 analysis fallback
  const displayAnalysis = analysis || (chemistry as any).loveAnalysis || "";

  const sectionTitle = CHEMISTRY_TITLES[relationshipType] || "둘의 관계는";
  const MainIcon = CHEMISTRY_ICONS[relationshipType] || Handshake;
  const [mainExpanded, setMainExpanded] = useState(false);

  return (
    <div className="space-y-5">
      {/* Main chemistry card — accordion */}
      {(displayAnalysis || chemPunchline) && (
        <div className="flex bg-background-secondary rounded-2xl overflow-hidden">
          <div
            className="w-1 shrink-0 rounded-full my-2 ml-1.5"
            style={{ backgroundColor: "#A855F7" }}
          />
          <div className="flex-1 min-w-0">
            {/* Header */}
            <button
              type="button"
              onClick={() => setMainExpanded((p) => !p)}
              className="w-full pl-4 pr-6 py-5 flex items-center justify-between text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
              aria-expanded={mainExpanded}
            >
              <div className="flex items-center gap-2">
                <MainIcon weight="duotone" size={28} color="#A855F7" aria-hidden="true" />
                <span className="text-title-3 text-text-primary">{sectionTitle}</span>
              </div>
              <CaretDown
                weight="bold"
                size={20}
                className={`text-text-secondary transition-transform shrink-0 ml-2 ${mainExpanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {/* Content — grid animation */}
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                mainExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-6 pb-6 pt-4">
                  {/* Punchline */}
                  {chemPunchline && (
                    <p className="text-[16px] font-semibold text-white leading-[1.6] mb-4">{chemPunchline}</p>
                  )}

                  {/* Analysis body */}
                  {displayAnalysis && (
                    <p className="text-[15px] text-gray-400 leading-[1.75]">
                      {displayAnalysis}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bonus scenarios — individual accordions, collapsed by default */}
      {bonusScenarios.map((scenario, i: number) => {
        if (!scenario.analysis?.trim()) return null;
        const BonusIcon = SCENARIO_ICONS[scenario.type] || Handshake;
        return (
          <SectionCard
            key={i}
            icon={BonusIcon}
            iconColor="#9CA3AF"
            title={scenario.label}
            accentColor="#D1D5DB"
            punchline={scenario.punchline}
            content={scenario.analysis}
            collapsible
            defaultExpanded={false}
          />
        );
      })}
    </div>
  );
}
