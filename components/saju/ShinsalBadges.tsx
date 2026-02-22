"use client";

import { memo } from "react";
import type { ShinsalMatch, ShinsalType } from "@/lib/utils/saju-enrichment";
import { SHINSAL_DESCRIPTIONS } from "@/lib/utils/saju-enrichment";

const TYPE_DOT_COLOR: Record<ShinsalType, string> = {
  good: "#22C55E",
  bad: "#EF4444",
  neutral: "#6B7280",
};

const TYPE_LABEL: Record<ShinsalType, string> = {
  good: "길성",
  bad: "흉살",
  neutral: "중성",
};

interface ShinsalBadgesProps {
  matches: ShinsalMatch[];
  note?: string;
}

function ShinsalBadgesInner({ matches, note }: ShinsalBadgesProps) {
  if (matches.length === 0) return null;

  return (
    <div>
      <p className="text-sm font-medium text-gray-400 mb-2">신살</p>
      <div className="grid grid-cols-2 gap-2">
        {matches.map((m) => {
          const dotColor = TYPE_DOT_COLOR[m.type];
          const desc = SHINSAL_DESCRIPTIONS[m.key] ?? "";
          return (
            <div
              key={m.key}
              className="bg-[#1A1A1A] rounded-xl px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dotColor }}
                />
                <span className="text-xs font-medium text-gray-300 truncate">
                  {m.label}
                </span>
                <span
                  className="text-[10px] ml-auto flex-shrink-0"
                  style={{ color: dotColor }}
                >
                  {TYPE_LABEL[m.type]}
                </span>
              </div>
              {desc && (
                <p className="text-[11px] text-gray-500 leading-tight">
                  {desc}
                </p>
              )}
              {m.detectedAt.length > 0 && (
                <p className="text-[10px] text-gray-600 mt-1">
                  {m.detectedAt
                    .map((pos) =>
                      pos === "year" ? "년주" : pos === "month" ? "월주" : pos === "day" ? "일주" : "시주"
                    )
                    .join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {note && (
        <p className="text-[12px] text-text-tertiary mt-2">{note}</p>
      )}
    </div>
  );
}

const ShinsalBadges = memo(ShinsalBadgesInner);
export default ShinsalBadges;
