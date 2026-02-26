"use client";

import { useRef, useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

type Props = {
  nameA: string;
  nameB: string;
};

export default function BattleSajuCompare({ nameA, nameB }: Props) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="bg-background-secondary rounded-3xl p-5 md:p-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">사주 원국 비교</h3>
        <span className="text-xs text-gray-500">
          {nameA} · {nameB}
        </span>
      </div>

      {/* Collapsed preview */}
      <div className="space-y-2">
        <div className="rounded-xl bg-background-primary px-4 py-3">
          <span className="text-[14px] text-text-secondary">{nameA}의 사주 원국</span>
        </div>
        <div className="rounded-xl bg-background-primary px-4 py-3">
          <span className="text-[14px] text-text-secondary">{nameB}의 사주 원국</span>
        </div>
      </div>

      {/* Expand button */}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full bg-[#252525] text-sm font-medium text-gray-200 py-3 rounded-lg mt-6 transition-colors hover:bg-[#2A2A2A] active:bg-[#2A2A2A] flex items-center justify-center gap-1.5"
        >
          상세 비교 보기
          <CaretDown weight="bold" size={16} aria-hidden="true" />
        </button>
      )}

      {/* Expandable content */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="pt-6 space-y-3">
            <p className="text-[13px] text-text-tertiary leading-relaxed">
              상세 원국은 개인 사주 분석에서 확인할 수 있어요.
              아래 &quot;사주 자세히 보기&quot;를 눌러보세요.
            </p>

            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="w-full bg-[#252525] text-sm font-medium text-gray-200 py-3 rounded-lg mt-4 transition-colors hover:bg-[#2A2A2A] active:bg-[#2A2A2A] flex items-center justify-center gap-1.5"
            >
              접기
              <CaretUp weight="bold" size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
