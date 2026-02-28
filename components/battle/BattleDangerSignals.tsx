"use client";

import { useState } from "react";
import { Warning, CaretDown } from "@phosphor-icons/react";
type DangerSignals = {
  triggers: { situation: string; description: string }[];
  summary?: string;
};

type Props = {
  dangerSignals: DangerSignals;
};

export default function BattleDangerSignals({ dangerSignals }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!dangerSignals.triggers || dangerSignals.triggers.length === 0) return null;

  return (
    <div className="flex bg-background-secondary rounded-2xl overflow-hidden">
      <div
        className="w-1 shrink-0 rounded-full my-2 ml-1.5"
        style={{ backgroundColor: "#F59E0B" }}
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
            <Warning weight="bold" size={28} color="#F59E0B" aria-hidden="true" />
            <span className="text-title-3 text-text-primary">위험 시그널</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{ color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.15)" }}
            >
              주의
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
            <div className="px-6 pb-6 pt-2 space-y-4">
              {dangerSignals.triggers.map((trigger: { situation: string; description: string }, i: number) => (
                <div
                  key={i}
                  className="rounded-xl p-4"
                  style={{ backgroundColor: "rgba(245,158,11,0.06)" }}
                >
                  <p className="text-[14px] font-bold text-text-primary mb-2">
                    {trigger.situation}
                  </p>
                  <p className="text-[15px] text-gray-300 leading-[1.7]">
                    {trigger.description}
                  </p>
                </div>
              ))}

              {dangerSignals.summary && (
                <p className="text-[15px] text-text-primary leading-[1.7] pt-2">
                  {dangerSignals.summary}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
