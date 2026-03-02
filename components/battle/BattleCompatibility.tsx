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
          className={`w-full px-6 py-5 text-left transition-colors ${
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

export default function BattleCompatibility({ chemistry }: Props) {
  const { label, punchline: chemPunchline, analysis: baseAnalysis, mainScenario, bonusScenarios } = chemistry;
  const MainIcon = SCENARIO_ICONS[mainScenario.type] || Handshake;
  const mainDisplay = MAIN_SCENARIO_DISPLAY[mainScenario.type as RelationshipType] || "상성 분석";
  const [mainExpanded, setMainExpanded] = useState(false);

  return (
    <div className="space-y-5">
      {/* Combined card: baseAnalysis + mainScenario — accordion */}
      {(baseAnalysis || mainScenario.analysis) && (
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
              className="w-full px-6 py-5 flex items-center justify-between text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
              aria-expanded={mainExpanded}
            >
              <div className="flex items-center gap-2">
                <Handshake weight="duotone" size={28} color="#A855F7" aria-hidden="true" />
                <span className="text-title-3 text-text-primary">상성 진단</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                  style={{ color: "#A855F7", backgroundColor: "rgba(168,85,247,0.15)" }}
                >
                  상성
                </span>
                <CaretDown
                  weight="bold"
                  size={20}
                  className={`text-text-secondary transition-transform ${mainExpanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </div>
            </button>

            {/* Content — grid animation */}
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                mainExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-6 pb-6 pt-4">
                  {/* Chemistry label */}
                  {label.title && (
                    <div className="mb-5">
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

                  {/* Chemistry punchline */}
                  {chemPunchline && (
                    <p className="text-[16px] font-semibold text-white leading-[1.6] mt-4 mb-2">{chemPunchline}</p>
                  )}

                  {/* baseAnalysis body */}
                  {baseAnalysis && (
                    <div className="space-y-6">
                      {baseAnalysis.split(/\n\s*\n/).map((para: string, i: number) => (
                        <p key={i} className="text-[15px] text-gray-400 leading-[1.75]">
                          {para.trim()}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  {baseAnalysis && mainScenario.analysis && (
                    <div className="h-px bg-white/[0.06] my-5" />
                  )}

                  {/* mainScenario sub-header + body */}
                  {mainScenario.analysis && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MainIcon weight="duotone" size={22} color="#FF6B6B" aria-hidden="true" />
                        <span className="text-[14px] font-semibold text-text-primary">{mainDisplay}</span>
                      </div>
                      <div className="space-y-6">
                        {mainScenario.analysis.split(/\n\s*\n/).map((para: string, i: number) => (
                          <p key={i} className="text-[15px] text-gray-400 leading-[1.75]">
                            {para.trim()}
                          </p>
                        ))}
                      </div>
                    </div>
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
