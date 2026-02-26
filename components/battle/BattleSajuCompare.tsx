"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

type Props = {
  nameA: string;
  nameB: string;
};

export default function BattleSajuCompare({ nameA, nameB }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl bg-background-secondary overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full px-6 py-5 flex items-center justify-between text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
        aria-expanded={expanded}
      >
        <span className="text-title-3 text-text-primary">사주 원국 비교</span>
        <CaretDown
          weight="bold"
          size={20}
          className={`text-text-secondary transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-6 pt-2 space-y-3">
            <div className="rounded-xl bg-background-primary px-4 py-3">
              <span className="text-[14px] text-text-secondary">{nameA}의 사주 원국</span>
            </div>
            <div className="rounded-xl bg-background-primary px-4 py-3">
              <span className="text-[14px] text-text-secondary">{nameB}의 사주 원국</span>
            </div>
            <p className="text-[13px] text-text-tertiary leading-relaxed pt-2">
              상세 원국은 개인 사주 분석에서 확인할 수 있어요.
              아래 &quot;사주 자세히 보기&quot;를 눌러보세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
