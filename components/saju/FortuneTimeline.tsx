"use client";

import { useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight, ChatCircleDots } from "@phosphor-icons/react";
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

const TWELVE_STAGE_SUMMARIES: Record<string, string> = {
  장생: "새롭게 시작하는 에너지. 배움과 성장이 활발한 시기야",
  목욕: "변화가 많고 감정이 요동치는 시기. 유혹과 도화가 따라와",
  관대: "실력이 갖춰지고 자신감이 붙는 시기. 사회적 성장이 빨라",
  건록: "가장 안정적인 시기. 직업과 수입이 탄탄해져",
  제왕: "에너지가 최고조인 시기. 권한과 영향력이 정점에 올라",
  쇠: "기운이 서서히 빠지는 시기. 무리하면 탈이 나기 쉬워",
  병: "체력과 의욕이 떨어지는 시기. 건강 관리가 중요해",
  사: "한 사이클이 끝나는 전환점. 과거를 정리하고 방향을 바꿔야 해",
  묘: "에너지가 저장되는 시기. 겉으로 조용하지만 속은 단단해져",
  절: "완전히 새로운 국면. 기존 것과 단절하고 리셋되는 시기야",
  태: "새로운 가능성이 잉태되는 시기. 아이디어와 계획이 싹터",
  양: "조용히 준비하고 축적하는 시기. 때를 기다리면 좋아",
};

function getSummary(tenStar: string): string {
  return TENSTAR_SUMMARIES[tenStar] || "흐름이 바뀌는 시기야";
}

function getTwelveStageSummary(stage: string): string {
  return TWELVE_STAGE_SUMMARIES[stage] ?? "흐름이 전환되는 시기야";
}

function getCardClasses(isCurrent: boolean, isSelected: boolean): string {
  if (isCurrent && isSelected) return "bg-[#FF6B6B]/10 ring-2 ring-[#FF6B6B]/60";
  if (isSelected) return "bg-[#222222] ring-1 ring-white/40";
  if (isCurrent) return "bg-[#FF6B6B]/10 ring-1 ring-[#FF6B6B]/30";
  return "bg-[#1A1A1A] hover:bg-[#222222]";
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

  const [selectedDaeunIdx, setSelectedDaeunIdx] = useState<number | null>(null);
  const [selectedSeunYear, setSelectedSeunYear] = useState<number | null>(null);

  const [daeunScroll, setDaeunScroll] = useState({ left: false, right: false });
  const [seunScroll, setSeunScroll] = useState({ left: false, right: false });

  function updateScrollState(
    el: HTMLDivElement | null,
    setter: (v: { left: boolean; right: boolean }) => void
  ) {
    if (!el) return;
    setter({
      left: el.scrollLeft > 0,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 1,
    });
  }

  const activeDaeun = selectedDaeunIdx !== null
    ? daeun.pillars.find(p => p.index === selectedDaeunIdx) ?? currentDaeun
    : currentDaeun;

  const activeSeun = selectedSeunYear !== null
    ? seun.find(s => s.year === selectedSeunYear) ?? currentSeun
    : currentSeun;

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
      updateScrollState(daeunScrollRef.current, setDaeunScroll);
    }
  }, [currentDaeun, daeun.pillars]);

  useEffect(() => {
    if (seunScrollRef.current && currentSeun) {
      const idx = seun.indexOf(currentSeun);
      const cardWidth = 76; // w-[68px] + gap
      const containerWidth = seunScrollRef.current.clientWidth;
      const scrollLeft = Math.max(0, idx * cardWidth - containerWidth / 2 + cardWidth / 2);
      seunScrollRef.current.scrollLeft = scrollLeft;
      updateScrollState(seunScrollRef.current, setSeunScroll);
    }
  }, [currentSeun, seun]);

  return (
    <div className="space-y-5">
      {/* 블록 제목 */}
      <p className="text-base font-semibold text-gray-300 mb-6">운세 흐름</p>

      {/* 대운 (10년 주기) */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 tracking-wide">대운 (10년 주기)</p>
        <div className="relative">
          <div
            ref={daeunScrollRef}
            onScroll={() => updateScrollState(daeunScrollRef.current, setDaeunScroll)}
            className="flex gap-2 overflow-x-auto scrollbar-hide py-1"
          >
            {daeun.pillars.map((p) => {
              const isCurrent = currentDaeun?.index === p.index;
              const isSelected = selectedDaeunIdx === null ? isCurrent : selectedDaeunIdx === p.index;
              return (
                <DaeunCard
                  key={p.index}
                  entry={p}
                  isCurrent={isCurrent}
                  isSelected={isSelected}
                  onSelect={() => setSelectedDaeunIdx(p.index)}
                />
              );
            })}
          </div>
          {/* 그라데이션 오버레이 */}
          {daeunScroll.left && (
            <div className="absolute left-0 top-1 bottom-1 w-8 bg-gradient-to-r from-[rgb(20,20,20)] to-transparent pointer-events-none z-[1]" />
          )}
          {daeunScroll.right && (
            <div className="absolute right-0 top-1 bottom-1 w-8 bg-gradient-to-l from-[rgb(20,20,20)] to-transparent pointer-events-none z-[1]" />
          )}
          {/* 화살표 버튼 — PC only */}
          {daeunScroll.left && (
            <button
              type="button"
              onClick={() => daeunScrollRef.current?.scrollBy({ left: -264, behavior: "smooth" })}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-[2] w-7 h-7 rounded-full items-center justify-center bg-white/[0.08] hover:bg-white/[0.15] active:bg-white/[0.20] transition-colors"
              aria-label="이전 카드"
            >
              <CaretLeft weight="bold" size={14} className="text-gray-300" />
            </button>
          )}
          {daeunScroll.right && (
            <button
              type="button"
              onClick={() => daeunScrollRef.current?.scrollBy({ left: 264, behavior: "smooth" })}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-[2] w-7 h-7 rounded-full items-center justify-center bg-white/[0.08] hover:bg-white/[0.15] active:bg-white/[0.20] transition-colors"
              aria-label="다음 카드"
            >
              <CaretRight weight="bold" size={14} className="text-gray-300" />
            </button>
          )}
        </div>
        {activeDaeun && (
          <div
            key={activeDaeun.index}
            className="bg-[#1A1A1A] rounded-xl px-4 py-3 mt-3 space-y-2.5 animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300 font-semibold">
                {activeDaeun.pillar}
                <span className="text-gray-500 font-normal ml-2 text-xs">
                  {activeDaeun.startAge}~{activeDaeun.endAge}세
                </span>
              </span>
              {currentDaeun?.index === activeDaeun.index && (
                <span className="text-[10px] text-[#FF6B6B] font-semibold bg-[#FF6B6B]/10 px-2 py-0.5 rounded-full">
                  현재
                </span>
              )}
            </div>
            <div className="flex items-start gap-2">
              <ChatCircleDots weight="fill" size={14} color="#FF6B6B" className="mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-[#FF6B6B] font-semibold">{activeDaeun.tenStar}운</p>
                <p className="text-sm text-gray-300 mt-0.5">{getSummary(activeDaeun.tenStar)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs mt-0.5 shrink-0">運</span>
              <div>
                <p className="text-xs text-gray-400 font-semibold">12운성: {activeDaeun.twelveStage}</p>
                <p className="text-sm text-gray-300 mt-0.5">{getTwelveStageSummary(activeDaeun.twelveStage)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 세운 (올해의 운) */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 tracking-wide">세운 (올해의 운)</p>
        <div className="relative">
          <div
            ref={seunScrollRef}
            onScroll={() => updateScrollState(seunScrollRef.current, setSeunScroll)}
            className="flex gap-2 overflow-x-auto scrollbar-hide py-1"
          >
            {seun.map((s) => {
              const isCurrent = s.year === currentYear;
              const isSelected = selectedSeunYear === null ? isCurrent : selectedSeunYear === s.year;
              return (
                <SeunCard
                  key={s.year}
                  entry={s}
                  isCurrent={isCurrent}
                  isSelected={isSelected}
                  onSelect={() => setSelectedSeunYear(s.year)}
                />
              );
            })}
          </div>
          {/* 그라데이션 오버레이 */}
          {seunScroll.left && (
            <div className="absolute left-0 top-1 bottom-1 w-8 bg-gradient-to-r from-[rgb(20,20,20)] to-transparent pointer-events-none z-[1]" />
          )}
          {seunScroll.right && (
            <div className="absolute right-0 top-1 bottom-1 w-8 bg-gradient-to-l from-[rgb(20,20,20)] to-transparent pointer-events-none z-[1]" />
          )}
          {/* 화살표 버튼 — PC only */}
          {seunScroll.left && (
            <button
              type="button"
              onClick={() => seunScrollRef.current?.scrollBy({ left: -228, behavior: "smooth" })}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-[2] w-7 h-7 rounded-full items-center justify-center bg-white/[0.08] hover:bg-white/[0.15] active:bg-white/[0.20] transition-colors"
              aria-label="이전 카드"
            >
              <CaretLeft weight="bold" size={14} className="text-gray-300" />
            </button>
          )}
          {seunScroll.right && (
            <button
              type="button"
              onClick={() => seunScrollRef.current?.scrollBy({ left: 228, behavior: "smooth" })}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-[2] w-7 h-7 rounded-full items-center justify-center bg-white/[0.08] hover:bg-white/[0.15] active:bg-white/[0.20] transition-colors"
              aria-label="다음 카드"
            >
              <CaretRight weight="bold" size={14} className="text-gray-300" />
            </button>
          )}
        </div>
        {activeSeun && (
          <div
            key={activeSeun.year}
            className="bg-[#1A1A1A] rounded-xl px-4 py-3 mt-3 space-y-2.5 animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300 font-semibold">
                {activeSeun.pillar}
                <span className="text-gray-500 font-normal ml-2 text-xs">
                  {activeSeun.year}년 ({activeSeun.age}세)
                </span>
              </span>
              {activeSeun.year === currentYear && (
                <span className="text-[10px] text-[#FF6B6B] font-semibold bg-[#FF6B6B]/10 px-2 py-0.5 rounded-full">
                  올해
                </span>
              )}
            </div>
            <div className="flex items-start gap-2">
              <ChatCircleDots weight="fill" size={14} color="#FF6B6B" className="mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-[#FF6B6B] font-semibold">{activeSeun.tenStar}운</p>
                <p className="text-sm text-gray-300 mt-0.5">{getSummary(activeSeun.tenStar)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs mt-0.5 shrink-0">運</span>
              <div>
                <p className="text-xs text-gray-400 font-semibold">12운성: {activeSeun.twelveStage}</p>
                <p className="text-sm text-gray-300 mt-0.5">{getTwelveStageSummary(activeSeun.twelveStage)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 대운 카드 ──

function DaeunCard({
  entry,
  isCurrent,
  isSelected,
  onSelect,
}: {
  entry: DaeunEntry;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`대운 ${entry.pillar} ${entry.startAge}~${entry.endAge}세 ${entry.tenStar}`}
      className={`flex-shrink-0 w-[80px] rounded-xl py-3 px-2 flex flex-col items-center gap-1 transition-[transform,background-color,color] duration-200 cursor-pointer active:scale-[0.98] ${getCardClasses(isCurrent, isSelected)}`}
    >
      <span className="text-[10px] text-gray-500">
        {entry.startAge}~{entry.endAge}세
      </span>
      <span className={`text-lg font-aggro leading-tight ${isSelected ? "text-white" : "text-gray-300"}`}>
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
    </button>
  );
}

// ── 세운 카드 ──

function SeunCard({
  entry,
  isCurrent,
  isSelected,
  onSelect,
}: {
  entry: SeunEntry;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`세운 ${entry.pillar} ${entry.year}년 ${entry.tenStar}`}
      className={`flex-shrink-0 w-[68px] rounded-xl py-2.5 px-2 flex flex-col items-center gap-1 transition-[transform,background-color,color] duration-200 cursor-pointer active:scale-[0.98] ${getCardClasses(isCurrent, isSelected)}`}
    >
      <span className="text-[10px] text-gray-500">
        {entry.year}
      </span>
      <span className={`text-base font-aggro leading-tight ${isSelected ? "text-white" : "text-gray-300"}`}>
        {entry.pillar}
      </span>
      <span className={`text-xs ${isCurrent ? "text-[#FF6B6B]" : "text-gray-400"}`}>
        {entry.tenStar}
      </span>
      {isCurrent && (
        <span className="text-[9px] text-[#FF6B6B] font-semibold mt-0.5">올해</span>
      )}
    </button>
  );
}
