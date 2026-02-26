"use client";

import { Scales } from "@phosphor-icons/react";

type Props = {
  finalVerdict: string;
};

export default function BattleFinalVerdict({ finalVerdict }: Props) {
  if (!finalVerdict) return null;

  return (
    <div className="rounded-2xl bg-background-secondary overflow-hidden flex">
      <div className="w-1 shrink-0 rounded-full my-2 ml-1.5" style={{ backgroundColor: "#FF6B6B" }} />
      <div className="p-6 flex-1">
        <div className="flex items-center gap-2 mb-4">
          <Scales weight="duotone" size={28} color="#FF6B6B" aria-hidden="true" />
          <h3 className="text-title-3 text-text-primary font-semibold">두루미의 최종 심판</h3>
        </div>
        <div className="space-y-4">
          {finalVerdict.split(/\n\s*\n/).map((para, i) => (
            <p key={i} className="text-[16px] text-text-primary leading-[1.75]">{para.trim()}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
