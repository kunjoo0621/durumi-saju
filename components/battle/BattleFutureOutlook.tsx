"use client";

import { useMemo, useState } from "react";
import { Binoculars, CaretDown } from "@phosphor-icons/react";
import type { BattleLlmAnalysis, FutureTimelineEntry } from "@/types/battle";

type Props = {
  futureOutlook: BattleLlmAnalysis["futureOutlook"];
  nameA: string;
  nameB: string;
};

const MOOD_DOT: Record<string, string> = {
  up: "bg-green-400",
  down: "bg-red-400",
  neutral: "bg-white/50",
};

/** DB에 저장된 레거시 형식(nextYear/threeYears)을 timeline[]로 변환 */
function normalizeFutureOutlook(
  fo: any,
): { punchline: string; timeline: FutureTimelineEntry[] } {
  // 이미 새 형식
  if (Array.isArray(fo?.timeline) && fo.timeline.length > 0) {
    return { punchline: fo.punchline || "", timeline: fo.timeline };
  }
  // 레거시 형식 변환
  const year = new Date().getFullYear();
  const timeline: FutureTimelineEntry[] = [];
  if (fo?.nextYear) {
    timeline.push({ year: year + 1, label: "1년 후", eventA: fo.nextYear, eventB: "", relationship: "", mood: "neutral" });
  }
  if (fo?.threeYears) {
    timeline.push({ year: year + 3, label: "3년 후", eventA: fo.threeYears, eventB: "", relationship: "", mood: "neutral" });
  }
  return { punchline: fo?.punchline || "", timeline };
}

export default function BattleFutureOutlook({ futureOutlook, nameA, nameB }: Props) {
  const [expanded, setExpanded] = useState(false);
  const normalized = useMemo(() => normalizeFutureOutlook(futureOutlook), [futureOutlook]);
  const hasContent = normalized.timeline.some(
    (e) => e.eventA || e.eventB || e.relationship
  );
  if (!hasContent) return null;

  return (
    <div className="flex bg-background-secondary rounded-2xl overflow-hidden">
      <div
        className="w-1 shrink-0 rounded-full my-2 ml-1.5"
        style={{ backgroundColor: "#6366F1" }}
      />
      <div className="flex-1 min-w-0">
        {/* Header */}
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="w-full pl-4 pr-6 py-5 flex items-center justify-between text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-2">
            <Binoculars weight="duotone" size={28} color="#6366F1" aria-hidden="true" />
            <span className="text-title-3 text-text-primary">미래 예측</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{ color: "#6366F1", backgroundColor: "rgba(99,102,241,0.15)" }}
            >
              전망
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
            <div className="px-6 pb-6 pt-2">
              {/* Punchline */}
              {normalized.punchline && (
                <p className="text-[16px] font-semibold text-white leading-[1.6] mb-5">
                  {normalized.punchline}
                </p>
              )}

              {/* Timeline */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[3.5px] top-2 bottom-2 w-px bg-white/[0.08]" />

                <div className="space-y-0">
                  {normalized.timeline.map((entry, i) => {
                    const dotColor = MOOD_DOT[entry.mood] || MOOD_DOT.neutral;
                    const isLast = i === normalized.timeline.length - 1;

                    return (
                      <div key={entry.year}>
                        {/* dot + year row */}
                        <div className="relative flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${dotColor} shrink-0 z-[1]`} />
                          <span className="text-[14px] font-bold text-white">
                            {entry.year}년
                          </span>
                          <span className="text-[12px] text-white/40">{entry.label}</span>
                        </div>

                        {/* content */}
                        <div className={`ml-[3.5px] pl-[16.5px] border-l border-transparent ${isLast ? "pb-0" : "pb-5"}`}>
                          {entry.eventA && (
                            <p className="text-[14px] text-gray-400 leading-[1.65] mt-1.5">
                              <span className="text-gray-300 font-medium">{nameA}</span>
                              {" · "}{entry.eventA}
                            </p>
                          )}
                          {entry.eventB && (
                            <p className="text-[14px] text-gray-400 leading-[1.65] mt-1">
                              <span className="text-gray-300 font-medium">{nameB}</span>
                              {" · "}{entry.eventB}
                            </p>
                          )}
                          {entry.relationship && (
                            <p
                              className="text-[13px] leading-[1.6] mt-2 px-3 py-2 rounded-lg"
                              style={{ color: "#A5B4FC", backgroundColor: "rgba(99,102,241,0.06)" }}
                            >
                              {entry.relationship}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
