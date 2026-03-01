"use client";

import { useState } from "react";
import { Heart, Users, Briefcase, House, Handshake, CaretDown } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { BattleLlmAnalysis, RelationshipType } from "@/types/battle";

type Props = {
  chemistry: BattleLlmAnalysis["chemistry"];
};

const SCENARIO_ICONS: Record<string, Icon> = {
  lover: Heart,
  friend: Users,
  colleague: Briefcase,
  family: House,
  other: Handshake,
};

const MAIN_SCENARIO_DISPLAY: Record<RelationshipType, string> = {
  lover: "연인으로서",
  friend: "친구로서",
  colleague: "직장동료로서",
  family: "가족으로서",
  other: "지인으로서",
};

/* ── Reusable collapsible card for bonus scenarios ── */

function SectionCard({
  icon: IconComp,
  iconColor,
  title,
  accentColor,
  content,
  collapsible = false,
  defaultExpanded = true,
}: {
  icon: Icon;
  iconColor: string;
  title: string;
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
          {collapsible && (
            <CaretDown
              weight="bold"
              size={20}
              className={`text-text-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          )}
        </button>

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

export default function BattleCompatibility({ chemistry }: Props) {
  const { label, analysis: baseAnalysis, mainScenario, bonusScenarios } = chemistry;
  const MainIcon = SCENARIO_ICONS[mainScenario.type] || Handshake;
  const mainDisplay = MAIN_SCENARIO_DISPLAY[mainScenario.type as RelationshipType] || "상성 분석";

  return (
    <div className="space-y-5">
      {/* Combined card: baseAnalysis + mainScenario — always visible (not accordion) */}
      {(baseAnalysis || mainScenario.analysis) && (
        <div className="flex bg-background-secondary rounded-2xl overflow-hidden">
          <div
            className="w-1 shrink-0 rounded-full my-2 ml-1.5"
            style={{ backgroundColor: "#A855F7" }}
          />
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="px-6 py-5 flex items-center gap-2">
              <Handshake weight="duotone" size={28} color="#A855F7" aria-hidden="true" />
              <span className="text-title-3 text-text-primary">상성 진단</span>
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-md ml-auto"
                style={{ color: "#A855F7", backgroundColor: "rgba(168,85,247,0.15)" }}
              >
                상성
              </span>
            </div>

            {/* Chemistry label */}
            {label.title && (
              <div className="px-6 pb-4">
                <div
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ backgroundColor: "rgba(168,85,247,0.08)" }}
                >
                  <span className="text-[28px] leading-none shrink-0">{label.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-text-primary">{label.title}</p>
                    <p className="text-[13px] text-text-secondary mt-0.5">{label.description}</p>
                  </div>
                </div>
              </div>
            )}

            {/* baseAnalysis body */}
            {baseAnalysis && (
              <div className="px-6 pb-5">
                <div className="space-y-6">
                  {baseAnalysis.split(/\n\s*\n/).map((para: string, i: number) => (
                    <p key={i} className="text-[16px] text-text-primary leading-[1.75]">
                      {para.trim()}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            {baseAnalysis && mainScenario.analysis && (
              <div className="h-px bg-white/[0.06] mx-6" />
            )}

            {/* mainScenario sub-header + body */}
            {mainScenario.analysis && (
              <div className="px-6 py-5">
                <div className="flex items-center gap-2 mb-3">
                  <MainIcon weight="duotone" size={22} color="#FF6B6B" aria-hidden="true" />
                  <span className="text-[14px] font-semibold text-text-primary">{mainDisplay}</span>
                </div>
                <div className="space-y-6">
                  {mainScenario.analysis.split(/\n\s*\n/).map((para: string, i: number) => (
                    <p key={i} className="text-[16px] text-text-primary leading-[1.75]">
                      {para.trim()}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bonus scenarios — individual accordions, collapsed by default */}
      {bonusScenarios.map((scenario: { type: string; label: string; analysis: string }, i: number) => {
        if (!scenario.analysis?.trim()) return null;
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
