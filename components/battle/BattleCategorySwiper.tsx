"use client";

import { useRef, useState, useCallback } from "react";
import {
  CurrencyCircleDollar,
  HeartHalf,
  Briefcase,
  Heartbeat,
  UsersThree,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { CategoryMatchResult } from "@/types/battle";
import type { BattleLlmAnalysis } from "@/types/battle";

type Props = {
  matches: CategoryMatchResult[];
  nameA: string;
  nameB: string;
  llmComments: BattleLlmAnalysis["categoryResults"];
  highlightCategory?: string;
};

const CATEGORY_KEY_MAP: Record<string, keyof BattleLlmAnalysis["categoryResults"]> = {
  "재물운": "wealth",
  "연애운": "love",
  "직장운": "career",
  "건강운": "health",
  "대인운": "social",
};

const CATEGORY_ICONS: Record<string, Icon> = {
  "재물운": CurrencyCircleDollar,
  "연애운": HeartHalf,
  "직장운": Briefcase,
  "건강운": Heartbeat,
  "대인운": UsersThree,
};

function getComment(
  llmComments: BattleLlmAnalysis["categoryResults"],
  category: string,
): { killingLine: string; detail: string } | undefined {
  const key = CATEGORY_KEY_MAP[category];
  return key ? llmComments[key] || undefined : undefined;
}

export default function BattleCategorySwiper({
  matches,
  nameA,
  nameB,
  llmComments,
  highlightCategory,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // 고정 순서 유지: wealth → love → career → health → social
  const sorted = matches;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;

      // Only swipe if horizontal movement > vertical (prevent scroll interference)
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;

      if (dx < 0 && activeIndex < sorted.length - 1) {
        setActiveIndex((prev) => prev + 1);
      } else if (dx > 0 && activeIndex > 0) {
        setActiveIndex((prev) => prev - 1);
      }
    },
    [activeIndex, sorted.length],
  );

  return (
    <div className="space-y-4">
      {/* Swiper container */}
      <div
        className="overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {sorted.map((m) => {
            const IconComp = CATEGORY_ICONS[m.category];
            const comment = getComment(llmComments, m.category);
            const isHighlight = highlightCategory === m.category;
            const aWins = m.winner === "A";
            const bWins = m.winner === "B";
            const isDraw = m.winner === "draw";

            const maxScore = Math.max(m.scoreA, m.scoreB, 1);
            const barA = (m.scoreA / maxScore) * 100;
            const barB = (m.scoreB / maxScore) * 100;

            return (
              <div
                key={m.category}
                className="w-full shrink-0 px-0.5"
              >
                <div className="bg-background-secondary rounded-2xl p-5 relative">
                  {/* 결정타 배지 */}
                  {isHighlight && (
                    <span
                      className="absolute top-3 right-4 text-[11px] font-medium px-2 py-0.5 rounded-md"
                      style={{
                        color: "#FF6B6B",
                        backgroundColor: "rgba(255,107,107,0.12)",
                      }}
                    >
                      결정타
                    </span>
                  )}

                  {/* Category icon + name + winner */}
                  <div className="flex items-center gap-2 mb-4">
                    {IconComp && (
                      <IconComp weight="duotone" size={28} color="#9CA3AF" aria-hidden="true" />
                    )}
                    <span className="text-[15px] font-semibold text-text-primary">
                      {m.category}
                    </span>
                    <span className="ml-auto text-[12px] font-semibold" style={{
                      color: isDraw ? "#9CA3AF" : "#FF6B6B",
                    }}>
                      {isDraw ? "무승부" : `${m.winner === "A" ? nameA : nameB} 승`}
                    </span>
                  </div>

                  {/* Score comparison bars */}
                  <div className="flex items-center gap-3">
                    {/* A score */}
                    <span
                      className="text-[18px] font-aggro font-bold w-8 text-left shrink-0"
                      style={{ color: aWins || isDraw ? "#FF6B6B" : "#666" }}
                    >
                      {m.scoreA}
                    </span>

                    {/* Double bar */}
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#282828" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${barA}%`,
                            background: aWins
                              ? "linear-gradient(90deg, #FF6B6B, #FF8A8A)"
                              : isDraw ? "linear-gradient(90deg, #FF6B6B80, #FF8A8A80)" : "#282828",
                          }}
                        />
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#282828" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${barB}%`,
                            background: bWins
                              ? "linear-gradient(90deg, #A855F7, #C084FC)"
                              : isDraw ? "linear-gradient(90deg, #A855F780, #C084FC80)" : "#282828",
                          }}
                        />
                      </div>
                    </div>

                    {/* B score */}
                    <span
                      className="text-[18px] font-aggro font-bold w-8 text-right shrink-0"
                      style={{ color: bWins || isDraw ? "#A855F7" : "#666" }}
                    >
                      {m.scoreB}
                    </span>
                  </div>

                  {/* Divider + killingLine + detail */}
                  {comment && (
                    <>
                      <div className="mt-4 mb-4 h-px bg-white/[0.06]" />
                      {comment.killingLine && (
                        <p className="text-[15px] font-bold text-text-primary mb-2">
                          {comment.killingLine}
                        </p>
                      )}
                      {comment.detail && (
                        <div className="space-y-6">
                          {comment.detail.split(/\n\s*\n/).map((para: string, i: number) => (
                            <p
                              key={i}
                              className="text-[16px] text-text-primary leading-[1.75]"
                            >
                              {para.trim()}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center items-center gap-2">
        {sorted.map((m, i) => (
          <button
            key={m.category}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === activeIndex ? "w-6 bg-white" : "w-2 bg-white/30"
            }`}
            aria-label={`${m.category} 카드로 이동`}
          />
        ))}
      </div>
    </div>
  );
}
