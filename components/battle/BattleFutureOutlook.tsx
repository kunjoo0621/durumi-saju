"use client";

import { useMemo, useState } from "react";
import { Binoculars, CaretDown, TrendUp, TrendDown, Minus } from "@phosphor-icons/react";
import type { BattleLlmAnalysis, FutureTimelineEntry } from "@/types/battle";

type Props = {
  futureOutlook: BattleLlmAnalysis["futureOutlook"];
  nameA: string;
  nameB: string;
};

const MOOD_CONFIG = {
  up: { icon: TrendUp, color: "#22C55E", bg: "rgba(34,197,94,0.1)", label: "관계 ↑" },
  down: { icon: TrendDown, color: "#EF4444", bg: "rgba(239,68,68,0.1)", label: "관계 ↓" },
  neutral: { icon: Minus, color: "#6B7280", bg: "rgba(107,114,128,0.1)", label: "유지" },
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
          className="w-full pl-4 pr-6 py-5 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Binoculars weight="duotone" size={28} color="#6366F1" />
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
              className={`text-gray-500 transition-transform duration-300 ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {/* Content */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-6 pb-6 pt-4">
              {/* Punchline */}
              {normalized.punchline && (
                <p className="text-[16px] font-semibold text-white leading-[1.6] mb-5">
                  {normalized.punchline}
                </p>
              )}

              {/* Vertical Timeline */}
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-white/[0.06]" />

                <div className="space-y-6">
                  {normalized.timeline.map((entry, i) => {
                    const moodCfg = MOOD_CONFIG[entry.mood] || MOOD_CONFIG.neutral;
                    const MoodIcon = moodCfg.icon;
                    const isLast = i === normalized.timeline.length - 1;

                    return (
                      <div key={entry.year} className="relative flex gap-4">
                        {/* Timeline node */}
                        <div className="relative z-10 shrink-0 flex flex-col items-center">
                          <div
                            className="w-[32px] h-[32px] rounded-full flex items-center justify-center"
                            style={{ backgroundColor: moodCfg.bg }}
                          >
                            <MoodIcon weight="bold" size={16} color={moodCfg.color} />
                          </div>
                        </div>

                        {/* Content */}
                        <div className={`flex-1 min-w-0 ${!isLast ? "pb-1" : ""}`}>
                          {/* Year + mood label */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[14px] font-bold text-white">
                              {entry.year}년
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {entry.label}
                            </span>
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                              style={{ color: moodCfg.color, backgroundColor: moodCfg.bg }}
                            >
                              {moodCfg.label}
                            </span>
                          </div>

                          {/* Events */}
                          {entry.eventA && (
                            <div className="flex gap-2 mb-1.5">
                              <span
                                className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded mt-0.5"
                                style={{ color: "#FF6B6B", backgroundColor: "rgba(255,107,107,0.1)" }}
                              >
                                {nameA}
                              </span>
                              <p className="text-[14px] text-gray-400 leading-[1.6]">
                                {entry.eventA}
                              </p>
                            </div>
                          )}
                          {entry.eventB && (
                            <div className="flex gap-2 mb-2">
                              <span
                                className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded mt-0.5"
                                style={{ color: "#A855F7", backgroundColor: "rgba(168,85,247,0.1)" }}
                              >
                                {nameB}
                              </span>
                              <p className="text-[14px] text-gray-400 leading-[1.6]">
                                {entry.eventB}
                              </p>
                            </div>
                          )}

                          {/* Relationship impact */}
                          {entry.relationship && (
                            <div
                              className="mt-2 px-3 py-2.5 rounded-xl"
                              style={{ backgroundColor: "rgba(99,102,241,0.06)" }}
                            >
                              <p className="text-[13px] leading-[1.65]" style={{ color: "#A5B4FC" }}>
                                {entry.relationship}
                              </p>
                            </div>
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
