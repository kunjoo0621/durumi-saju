"use client";

import { memo } from "react";
import type { ShinsalMatch, ShinsalType } from "@/lib/utils/saju-enrichment";

const TYPE_STYLES: Record<ShinsalType, { bg: string; text: string }> = {
  good:    { bg: "bg-saju-wood/10",        text: "text-saju-wood-muted" },
  bad:     { bg: "bg-saju-fire/10",        text: "text-saju-fire-muted" },
  neutral: { bg: "bg-background-tertiary", text: "text-text-secondary" },
};

interface ShinsalBadgesProps {
  matches: ShinsalMatch[];
  note?: string;
}

function ShinsalBadgesInner({ matches, note }: ShinsalBadgesProps) {
  if (matches.length === 0) return null;

  return (
    <div className="pt-4 mt-4">
      <p className="text-[13px] text-text-tertiary mb-2">신살</p>
      <div className="flex flex-wrap gap-2">
        {matches.map((m) => {
          const style = TYPE_STYLES[m.type];
          return (
            <span
              key={m.key}
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[13px] font-medium ${style.bg} ${style.text}`}
            >
              {m.label}
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
