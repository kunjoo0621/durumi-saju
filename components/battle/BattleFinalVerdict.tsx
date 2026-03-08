"use client";

import { useState } from "react";
import { Scales, CaretDown } from "@phosphor-icons/react";
import type { BattleLlmAnalysis } from "@/types/battle";

type Props = {
  finalVerdict: BattleLlmAnalysis["finalVerdict"] | string;
  nameA?: string;
  nameB?: string;
};

export default function BattleFinalVerdict({ finalVerdict, nameA, nameB }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Support both old (string) and new ({ punchline, verdict }) formats
  const punchline = typeof finalVerdict === "object" ? finalVerdict.punchline : "";
  const verdictA = typeof finalVerdict === "object" ? finalVerdict.verdictA : undefined;
  const verdictB = typeof finalVerdict === "object" ? finalVerdict.verdictB : undefined;
  const verdict = typeof finalVerdict === "object" ? finalVerdict.verdict : finalVerdict;

  if (!verdict && !punchline) return null;

  return (
    <div className="flex bg-background-secondary rounded-2xl overflow-hidden">
      <div
        className="w-1 shrink-0 rounded-full my-2 ml-1.5"
        style={{ backgroundColor: "#FF6B6B" }}
      />
      <div className="flex-1 min-w-0">
        {/* Header — accordion matching personal SectionHeader */}
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="w-full pl-4 pr-6 py-5 flex items-center justify-between text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-2">
            <Scales weight="duotone" size={28} color="#FF6B6B" aria-hidden="true" />
            <span className="text-title-3 text-text-primary">두루미의 최종 심판</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{ color: "#FF6B6B", backgroundColor: "rgba(255,107,107,0.15)" }}
            >
              판정
            </span>
            <CaretDown
              weight="bold"
              size={20}
              className={`text-text-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </div>
        </button>

        {/* Content — grid animation */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-6 pb-6 pt-4">
              {punchline && (
                <p className="text-[16px] font-semibold text-white leading-[1.6] mb-4">{punchline}</p>
              )}

              {/* 개인 판정 (레거시 호환: verdictA/verdictB 없으면 스킵) */}
              {verdictA && nameA && (
                <p className="text-[14px] text-gray-400 leading-[1.65] mt-1.5 mb-3">
                  <span className="text-gray-300 font-medium">{nameA}</span>
                  {" · 판정  "}{verdictA}
                </p>
              )}
              {verdictB && nameB && (
                <p className="text-[14px] text-gray-400 leading-[1.65] mb-4">
                  <span className="text-gray-300 font-medium">{nameB}</span>
                  {" · 판정  "}{verdictB}
                </p>
              )}

              {/* 종합 판정 */}
              {verdict && (
                <>
                  {(verdictA || verdictB) && (
                    <div className="border-t border-white/[0.06] my-4" />
                  )}
                  <div className="space-y-6">
                    {verdict.split(/\n\s*\n/).map((para, i) => (
                      <p key={i} className="text-[15px] text-gray-400 leading-[1.75]">
                        {para.trim()}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
