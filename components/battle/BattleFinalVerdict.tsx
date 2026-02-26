"use client";

import { Scales } from "@phosphor-icons/react";

type Props = {
  finalVerdict: string;
};

export default function BattleFinalVerdict({ finalVerdict }: Props) {
  if (!finalVerdict) return null;

  return (
    <div className="flex bg-background-secondary rounded-2xl overflow-hidden">
      <div
        className="w-1 shrink-0 rounded-full my-2 ml-1.5"
        style={{ backgroundColor: "#FF6B6B" }}
      />
      <div className="flex-1 min-w-0">
        {/* Header — matches personal SectionHeader layout */}
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scales weight="duotone" size={28} color="#FF6B6B" aria-hidden="true" />
            <span className="text-title-3 text-text-primary">두루미의 최종 심판</span>
          </div>
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0"
            style={{ color: "#FF6B6B", backgroundColor: "rgba(255,107,107,0.15)" }}
          >
            심판
          </span>
        </div>

        {/* Content — matches personal SectionBody padding */}
        <div className="px-6 pb-6 pt-4">
          <div className="space-y-6">
            {finalVerdict.split(/\n\s*\n/).map((para, i) => (
              <p key={i} className="text-[16px] text-text-primary leading-[1.75]">
                {para.trim()}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
