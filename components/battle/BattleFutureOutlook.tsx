"use client";

import { useState } from "react";
import { HourglassHigh, CaretDown } from "@phosphor-icons/react";
import type { BattleLlmAnalysis } from "@/types/battle";

type Props = {
  futureOutlook: BattleLlmAnalysis["futureOutlook"];
};

const TIMELINE_BLOCKS = [
  { key: "now" as const, label: "지금" },
  { key: "midTerm" as const, label: "3~5년 후" },
  { key: "longTerm" as const, label: "10년 후" },
];

export default function BattleFutureOutlook({ futureOutlook }: Props) {
  const [expanded, setExpanded] = useState(false);

  const hasContent = futureOutlook.now || futureOutlook.midTerm || futureOutlook.longTerm;
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
          className="w-full px-6 py-5 flex items-center justify-between text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-2">
            <HourglassHigh weight="bold" size={28} color="#6366F1" aria-hidden="true" />
            <span className="text-title-3 text-text-primary">10년 뒤 이 관계</span>
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
            <div className="px-6 pb-6 pt-2 space-y-5">
              {TIMELINE_BLOCKS.map(({ key, label }) => {
                const text = futureOutlook[key];
                if (!text) return null;
                return (
                  <div key={key}>
                    <p className="text-[13px] font-bold text-gray-500 mb-1.5">
                      {label}
                    </p>
                    <p className="text-[15px] text-gray-300 leading-[1.7]">
                      {text}
                    </p>
                  </div>
                );
              })}

              {futureOutlook.verdict && (
                <p className="text-[15px] text-text-primary leading-[1.7] pt-2">
                  {futureOutlook.verdict}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
