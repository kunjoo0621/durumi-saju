"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

type Simulation = {
  question: string;
  answer: string;
  basis: string;
};

type Props = {
  simulations: Simulation[];
  icons?: string[];
};

export default function BattleSimulations({ simulations, icons }: Props) {
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());

  const filtered = simulations.filter((s) => s.answer);
  if (filtered.length === 0) return null;

  const toggle = (i: number) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-title-3 text-text-primary font-semibold">시뮬레이션</h3>
      {filtered.map((sim, i) => {
        const expanded = expandedSet.has(i);
        const icon = icons?.[i] || "🎯";

        return (
          <div
            key={i}
            className="flex bg-background-secondary rounded-2xl overflow-hidden"
          >
            <div
              className="w-1 shrink-0 rounded-full my-2 ml-1.5"
              style={{ backgroundColor: "#F59E0B" }}
            />
            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => toggle(i)}
                className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
                aria-expanded={expanded}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[20px] leading-none shrink-0">{icon}</span>
                  <span className="text-[14px] font-semibold text-text-primary truncate">
                    {sim.question}
                  </span>
                </div>
                <CaretDown
                  weight="bold"
                  size={18}
                  className={`text-text-secondary transition-transform shrink-0 ml-2 ${
                    expanded ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-4 pt-1">
                    <p className="text-[15px] text-text-primary leading-[1.75]">
                      {sim.answer}
                    </p>
                    {sim.basis && (
                      <p className="text-[12px] text-text-tertiary mt-2">
                        {sim.basis}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
