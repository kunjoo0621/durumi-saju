"use client";

import { memo } from "react";
import type { ShinsalMatch, ShinsalType } from "@/lib/utils/saju-enrichment";

const TYPE_DOT_COLOR: Record<ShinsalType, string> = {
  good: "#22C55E",
  bad: "#EF4444",
  neutral: "#6B7280",
};

const SHINSAL_MEANING: Record<string, string> = {
  dohwa: "매력과 인기",
  yeokma: "이동과 변화",
  hwagae: "예술과 고독",
  gyeopsal: "돌발 위기",
  yangin: "강렬한 기운",
  chuneul: "귀인의 도움",
  munchang: "학문과 지혜",
  hongryeom: "강렬한 이성 매력",
  hyunchim: "예리함, 불안정",
};

interface ShinsalBadgesProps {
  matches: ShinsalMatch[];
  note?: string;
}

function ShinsalBadgesInner({ matches, note }: ShinsalBadgesProps) {
  if (matches.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-sm text-gray-500 mb-2">신살</p>
      <div className="flex flex-wrap gap-2">
        {matches.map((m) => {
          const dotColor = TYPE_DOT_COLOR[m.type];
          const meaning = SHINSAL_MEANING[m.key];
          return (
            <span
              key={m.key}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] text-xs"
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: dotColor }}
              />
              <span className="font-medium text-gray-300">{m.label}</span>
              {meaning && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className="text-gray-500">{meaning}</span>
                </>
              )}
            </span>
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
