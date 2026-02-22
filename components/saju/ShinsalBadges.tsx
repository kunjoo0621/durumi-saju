"use client";

import { memo } from "react";
import type { ShinsalMatch, ShinsalType } from "@/lib/utils/saju-enrichment";
import { SHINSAL_DESCRIPTIONS, getShinsalFeedback } from "@/lib/utils/saju-enrichment";
import { IconMessageCircleFilled } from "@tabler/icons-react";

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

const POS_LABEL: Record<string, string> = {
  year: "년주",
  month: "월주",
  day: "일주",
  hour: "시주",
};

interface ShinsalBadgesProps {
  matches: ShinsalMatch[];
  note?: string;
}

function ShinsalBadgesInner({ matches, note }: ShinsalBadgesProps) {
  if (matches.length === 0) return null;

  return (
    <div>
      <p className="text-base font-semibold text-gray-300 mb-6">신살</p>
      <div className="bg-[rgba(255,107,107,0.08)] rounded-xl px-4 py-3 mb-6 flex items-start gap-2">
        <IconMessageCircleFilled className="w-4 h-4 text-[#FF6B6B] mt-0.5 shrink-0" />
        <p className="text-sm text-gray-300">{getShinsalFeedback(matches)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {matches.map((m) => {
          const dotColor = TYPE_DOT_COLOR[m.type];
          const desc = SHINSAL_DESCRIPTIONS[m.key] ?? "";
          const posStr = m.detectedAt.map((p) => POS_LABEL[p] ?? p).join(", ");
          // 한자 제거: "화개살(華蓋殺)" → "화개살"
          const name = m.label.replace(/\(.*?\)/g, "").trim();
          // 설명 · 위치 합침
          const detail = [desc, posStr].filter(Boolean).join(" · ");
          return (
            <div
              key={m.key}
              className="bg-[#1A1A1A] rounded-xl px-3 py-2.5"
            >
              {/* 1줄: 도트 + 신살명 + 길흉태그 */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />
                  <span className="text-sm font-medium text-white">
                    {name}
                  </span>
                </div>
                <span
                  className="text-xs flex-shrink-0"
                  style={{ color: dotColor }}
                >
                  {TYPE_LABEL[m.type]}
                </span>
              </div>
              {/* 2줄: 설명 · 위치 */}
              {detail && (
                <p className="text-sm text-gray-400 mt-1">
                  {detail}
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
