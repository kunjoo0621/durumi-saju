"use client";

import { useRef, useState, useCallback } from "react";
import {
  CurrencyCircleDollar,
  Heart,
  Briefcase,
  Heartbeat,
  UsersThree,
  CaretLeft,
  CaretRight,
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
  "연애운": Heart,
  "직장운": Briefcase,
  "건강운": Heartbeat,
  "대인운": UsersThree,
};

const COLOR_A = "#FF6B6B";
const COLOR_B = "#A855F7";

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

  const sorted = matches;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
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

            // Tug-of-war ratio
            const total = m.scoreA + m.scoreB || 1;
            const ratioA = (m.scoreA / total) * 100;

            // Header gradient
            const headerBg = aWins
              ? "linear-gradient(180deg, rgba(255,107,107,0.04) 0%, transparent 100%)"
              : bWins
                ? "linear-gradient(180deg, rgba(168,85,247,0.04) 0%, transparent 100%)"
                : "transparent";

            // Winner stripe pattern
            const stripeA = aWins
              ? "repeating-linear-gradient(-55deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 5px)"
              : "none";
            const stripeB = bWins
              ? "repeating-linear-gradient(55deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 5px)"
              : "none";

            // Bar colors
            const barColorA = aWins ? COLOR_A : isDraw ? "rgba(255,107,107,0.8)" : "#2A2A2A";
            const barColorB = bWins ? COLOR_B : isDraw ? "rgba(168,85,247,0.8)" : "#2A2A2A";

            // Winner badge
            const winnerLabel = isDraw
              ? "무승부"
              : `${aWins ? nameA : nameB} 승`;
            const badgeColor = isDraw ? "#9CA3AF" : aWins ? COLOR_A : COLOR_B;

            return (
              <div key={m.category} className="w-full shrink-0 px-0.5">
                <div className="rounded-[20px] overflow-hidden" style={{ backgroundColor: "#141414" }}>
                  {/* Header area */}
                  <div style={{ background: headerBg, padding: "22px 22px 18px" }}>
                    {/* Top row: icon+label ↔ badges */}
                    <div className="flex items-center justify-between mb-[18px]">
                      <div className="flex items-center gap-2.5">
                        {/* Icon container */}
                        {IconComp && (
                          <div
                            className="flex items-center justify-center shrink-0"
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              backgroundColor: "rgba(255,255,255,0.06)",
                            }}
                          >
                            <IconComp
                              weight="duotone"
                              size={20}
                              color="rgba(255,255,255,0.7)"
                              aria-hidden="true"
                            />
                          </div>
                        )}
                        <span style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                          {m.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isHighlight && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#FCD34D",
                              backgroundColor: "rgba(252,211,77,0.1)",
                              padding: "4px 8px",
                              borderRadius: 6,
                            }}
                          >
                            결정타
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: badgeColor,
                            backgroundColor: `${badgeColor}12`,
                            padding: "4px 10px",
                            borderRadius: 8,
                          }}
                        >
                          {winnerLabel}
                        </span>
                      </div>
                    </div>

                    {/* Player names above bar */}
                    <div className="flex justify-between" style={{ marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: aWins || isDraw ? COLOR_A : "rgba(255,255,255,0.25)",
                        }}
                      >
                        {nameA}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: bWins || isDraw ? COLOR_B : "rgba(255,255,255,0.25)",
                        }}
                      >
                        {nameB}
                      </span>
                    </div>

                    {/* Tug-of-war bar */}
                    <div
                      className="flex overflow-hidden"
                      style={{ height: 44, borderRadius: 14, gap: 2 }}
                    >
                      {/* A side */}
                      <div
                        className="relative flex items-center justify-center transition-all duration-500"
                        style={{ width: `${ratioA}%`, backgroundColor: barColorA }}
                      >
                        {stripeA !== "none" && (
                          <div
                            className="absolute inset-0"
                            style={{ backgroundImage: stripeA, opacity: 0.1 }}
                          />
                        )}
                        <span
                          className="relative z-[1] font-aggro"
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: aWins || isDraw ? "white" : "rgba(255,255,255,0.35)",
                          }}
                        >
                          {m.scoreA}
                        </span>
                      </div>

                      {/* B side */}
                      <div
                        className="relative flex items-center justify-center transition-all duration-500"
                        style={{ width: `${100 - ratioA}%`, backgroundColor: barColorB }}
                      >
                        {stripeB !== "none" && (
                          <div
                            className="absolute inset-0"
                            style={{ backgroundImage: stripeB, opacity: 0.1 }}
                          />
                        )}
                        <span
                          className="relative z-[1] font-aggro"
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: bWins || isDraw ? "white" : "rgba(255,255,255,0.35)",
                          }}
                        >
                          {m.scoreB}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Divider + Content */}
                  {comment && (
                    <>
                      <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)", margin: "0 22px" }} />

                      <div style={{ padding: "20px 22px 24px" }}>
                        {comment.killingLine && (
                          <p
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: "rgba(255,255,255,0.92)",
                              lineHeight: 1.5,
                              marginBottom: 10,
                            }}
                          >
                            {comment.killingLine}
                          </p>
                        )}
                        {comment.detail && (
                          <div>
                            {comment.detail.split(/\n\s*\n/).map((para: string, i: number) => (
                              <p
                                key={i}
                                style={{
                                  fontSize: 15,
                                  fontWeight: 400,
                                  color: "rgba(255,255,255,0.4)",
                                  lineHeight: 1.75,
                                  margin: 0,
                                }}
                              >
                                {para.trim()}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation: arrows + dots */}
      <div className="flex justify-center items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveIndex((p) => Math.max(0, p - 1))}
          disabled={activeIndex === 0}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.16] disabled:opacity-20 disabled:pointer-events-none"
          aria-label="이전 카테고리"
        >
          <CaretLeft weight="bold" size={16} className="text-text-secondary" />
        </button>

        <div className="flex items-center gap-2">
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

        <button
          type="button"
          onClick={() => setActiveIndex((p) => Math.min(sorted.length - 1, p + 1))}
          disabled={activeIndex === sorted.length - 1}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.16] disabled:opacity-20 disabled:pointer-events-none"
          aria-label="다음 카테고리"
        >
          <CaretRight weight="bold" size={16} className="text-text-secondary" />
        </button>
      </div>
    </div>
  );
}
