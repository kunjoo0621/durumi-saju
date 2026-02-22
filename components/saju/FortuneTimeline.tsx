"use client";

import { useEffect, useRef } from "react";
import { IconMessageCircleFilled } from "@tabler/icons-react";
import type { FortuneResult, DaeunEntry, SeunEntry } from "@/lib/utils/saju-fortune";

// ── 한줄평 템플릿 (십성 기반, deterministic) ──

const TENSTAR_SUMMARIES: Record<string, string> = {
  비견: "자기 힘으로 개척하는 시기. 경쟁이 치열해",
  겁재: "예상 못 한 변수가 튀어나오는 시기. 지출 주의",
  식신: "재능이 빛나는 시기. 표현력과 창의성이 올라가",
  상관: "기존 틀을 깨는 시기. 자유롭지만 마찰도 커",
  편재: "돈이 크게 움직이는 시기. 투자 기회가 열려",
  정재: "안정적으로 돈이 쌓이는 시기. 저축이 잘 돼",
  편관: "책임과 압박이 커지는 시기. 승진 아니면 시련",
  정관: "조직에서 인정받는 시기. 안정적이지만 자유도 줄어",
  편인: "공부하고 내면을 다지는 시기. 느리지만 단단해져",
  정인: "지원과 후원이 들어오는 시기. 배움이 깊어져",
};

function getSummary(tenStar: string): string {
  return TENSTAR_SUMMARIES[tenStar] || "흐름이 바뀌는 시기야";
}

// ── 컴포넌트 ──

type FortuneTimelineProps = {
  fortune: FortuneResult;
  birthYear: number;
};

export default function FortuneTimeline({ fortune, birthYear }: FortuneTimelineProps) {
  const { daeun, seun } = fortune;
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear + 1; // 한국 나이

  const currentDaeun = daeun.pillars.find(
    (p) => age >= p.startAge && age <= p.endAge
  );
  const currentSeun = seun.find((s) => s.year === currentYear);

  const daeunScrollRef = useRef<HTMLDivElement>(null);
  const seunScrollRef = useRef<HTMLDivElement>(null);

  // 현재 대운/세운 카드로 초기 스크롤
  useEffect(() => {
    if (daeunScrollRef.current && currentDaeun) {
      const idx = daeun.pillars.indexOf(currentDaeun);
      const cardWidth = 88; // w-[80px] + gap
      const containerWidth = daeunScrollRef.current.clientWidth;
      const scrollLeft = Math.max(0, idx * cardWidth - containerWidth / 2 + cardWidth / 2);
      daeunScrollRef.current.scrollLeft = scrollLeft;
    }
  }, [currentDaeun, daeun.pillars]);

  useEffect(() => {
    if (seunScrollRef.current && currentSeun) {
      const idx = seun.indexOf(currentSeun);
      const cardWidth = 76; // w-[68px] + gap
      const containerWidth = seunScrollRef.current.clientWidth;
      const scrollLeft = Math.max(0, idx * cardWidth - containerWidth / 2 + cardWidth / 2);
      seunScrollRef.current.scrollLeft = scrollLeft;
    }
  }, [currentSeun, seun]);

  const daeunSummary = currentDaeun ? getSummary(currentDaeun.tenStar) : null;
  const seunSummary = currentSeun ? getSummary(currentSeun.tenStar) : null;

  return (
    <div className="space-y-5">
      {/* 블록 제목 */}
      <p className="text-base font-semibold text-gray-300 mb-6">운세 흐름</p>

      {/* 대운 (10년 주기) */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 tracking-wide">대운 (10년 주기)</p>
        <div
          ref={daeunScrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
        >
          {daeun.pillars.map((p) => {
            const isCurrent = currentDaeun?.index === p.index;
            return (
              <DaeunCard key={p.index} entry={p} isCurrent={isCurrent} />
            );
          })}
        </div>
        {daeunSummary && (
          <div className="bg-[#1A1A1A] rounded-xl px-4 py-3 mt-3 flex items-start gap-2">
            <IconMessageCircleFilled className="w-4 h-4 text-[#FF6B6B] mt-0.5 shrink-0" />
            <p className="text-sm text-gray-300">
              지금 대운: {currentDaeun!.tenStar}운 — {daeunSummary}
            </p>
          </div>
        )}
      </div>

      {/* 세운 (올해의 운) */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 tracking-wide">세운 (올해의 운)</p>
        <div
          ref={seunScrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
        >
          {seun.map((s) => {
            const isCurrent = s.year === currentYear;
            return (
              <SeunCard key={s.year} entry={s} isCurrent={isCurrent} />
            );
          })}
        </div>
        {seunSummary && (
          <div className="bg-[#1A1A1A] rounded-xl px-4 py-3 mt-3 flex items-start gap-2">
            <IconMessageCircleFilled className="w-4 h-4 text-[#FF6B6B] mt-0.5 shrink-0" />
            <p className="text-sm text-gray-300">
              올해: {currentSeun!.tenStar}운 — {seunSummary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 대운 카드 ──

function DaeunCard({ entry, isCurrent }: { entry: DaeunEntry; isCurrent: boolean }) {
  return (
    <div
      className={`flex-shrink-0 w-[80px] rounded-xl py-3 px-2 flex flex-col items-center gap-1 transition-colors ${
        isCurrent
          ? "bg-[#FF6B6B]/10 ring-1 ring-[#FF6B6B]/30"
          : "bg-[#1A1A1A]"
      }`}
    >
      <span className="text-[10px] text-gray-500">
        {entry.startAge}~{entry.endAge}세
      </span>
      <span className={`text-lg font-aggro leading-tight ${isCurrent ? "text-white" : "text-gray-300"}`}>
        {entry.pillar}
      </span>
      <span className={`text-xs ${isCurrent ? "text-[#FF6B6B]" : "text-gray-400"}`}>
        {entry.tenStar}
      </span>
      <span className="text-[10px] text-gray-600">
        {entry.twelveStage}
      </span>
      {isCurrent && (
        <span className="text-[9px] text-[#FF6B6B] font-semibold mt-0.5">현재</span>
      )}
    </div>
  );
}

// ── 세운 카드 ──

function SeunCard({ entry, isCurrent }: { entry: SeunEntry; isCurrent: boolean }) {
  return (
    <div
      className={`flex-shrink-0 w-[68px] rounded-xl py-2.5 px-2 flex flex-col items-center gap-1 transition-colors ${
        isCurrent
          ? "bg-[#FF6B6B]/10 ring-1 ring-[#FF6B6B]/30"
          : "bg-[#1A1A1A]"
      }`}
    >
      <span className="text-[10px] text-gray-500">
        {entry.year}
      </span>
      <span className={`text-base font-aggro leading-tight ${isCurrent ? "text-white" : "text-gray-300"}`}>
        {entry.pillar}
      </span>
      <span className={`text-xs ${isCurrent ? "text-[#FF6B6B]" : "text-gray-400"}`}>
        {entry.tenStar}
      </span>
      {isCurrent && (
        <span className="text-[9px] text-[#FF6B6B] font-semibold mt-0.5">올해</span>
      )}
    </div>
  );
}
