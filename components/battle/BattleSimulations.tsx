"use client";

import { useState } from "react";
import {
  CaretDown,
  House,
  BeerBottle,
  UsersThree,
  HeartBreak,
  Suitcase,
  CurrencyCircleDollar,
  SmileyAngry,
  SmileySad,
  Cake,
  AirplaneTilt,
  Megaphone,
  ChatCircle,
  Confetti,
  EyeSlash,
  Heart,
  PersonSimpleRun,
  Phone,
  Drop,
  Sword,
  ChartBar,
  TrendUp,
  Rocket,
  Moon,
  EnvelopeSimple,
  Trophy,
  Scissors,
  Shuffle,
  ShirtFolded,
  Sparkle,
  Coins,
  Crown,
  Smiley,
  ClipboardText,
  Lightning,
  Diamond,
  HandWaving,
  Buildings,
  HouseLine,
  FolderOpen,
  Hourglass,
  Handshake,
  GameController,
  HeartStraight,
  Star,
  ChatCircleDots,
  ArrowsClockwise,
  Question,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const EMOJI_TO_ICON: Record<string, Icon> = {
  "🏠": House,
  "🍺": BeerBottle,
  "👫": UsersThree,
  "💔": HeartBreak,
  "🧳": Suitcase,
  "💸": CurrencyCircleDollar,
  "😤": SmileyAngry,
  "😑": SmileySad,
  "🎂": Cake,
  "💍": HeartStraight,
  "✈️": AirplaneTilt,
  "🗣️": Megaphone,
  "📱": ChatCircle,
  "🎉": Confetti,
  "🤫": EyeSlash,
  "❤️": Heart,
  "🏃": PersonSimpleRun,
  "📞": Phone,
  "😢": Drop,
  "⚔️": Sword,
  "📊": ChartBar,
  "📈": TrendUp,
  "🚀": Rocket,
  "🌙": Moon,
  "📩": EnvelopeSimple,
  "🏆": Trophy,
  "🍻": BeerBottle,
  "✂️": Scissors,
  "🔀": Shuffle,
  "👔": ShirtFolded,
  "🎆": Sparkle,
  "💰": Coins,
  "🗳️": Megaphone,
  "👑": Crown,
  "😇": Smiley,
  "📋": ClipboardText,
  "💥": Lightning,
  "💎": Diamond,
  "🤗": HandWaving,
  "🏙️": Buildings,
  "🏡": HouseLine,
  "🏘️": Buildings,
  "📂": FolderOpen,
  "⏳": Hourglass,
  "🤝": Handshake,
  "🎮": GameController,
  "💘": HeartStraight,
  "⭐": Star,
  "💬": ChatCircleDots,
  "🔁": ArrowsClockwise,
};

type Simulation = {
  question: string;
  punchline?: string;
  reasoning?: string;
  answer?: string;  // legacy fallback
  basis: string;
};

type Props = {
  simulations: Simulation[];
  icons?: string[];
};

export default function BattleSimulations({ simulations, icons }: Props) {
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());

  const filtered = simulations.filter((s) => s.punchline || s.answer);
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
    <div className="space-y-5">
      {filtered.map((sim, i) => {
        const expanded = expandedSet.has(i);
        const emoji = icons?.[i] || "";
        const IconComp = EMOJI_TO_ICON[emoji] || Question;

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
                className="w-full pl-4 pr-6 py-5 flex items-center justify-between text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
                aria-expanded={expanded}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <IconComp weight="duotone" size={28} color="#F59E0B" className="shrink-0" aria-hidden="true" />
                  <span className="text-title-3 text-text-primary">
                    {sim.question}
                  </span>
                </div>
                <CaretDown
                  weight="bold"
                  size={20}
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
                  <div className="px-6 pb-6 pt-4">
                    {sim.punchline ? (
                      <>
                        <p className="text-[16px] font-semibold text-white leading-[1.6] mb-3">
                          {sim.punchline}
                        </p>
                        {sim.reasoning && (
                          <p className="text-[15px] text-gray-400 leading-[1.75]">
                            {sim.reasoning}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-[15px] text-gray-400 leading-[1.75]">
                        {sim.answer}
                      </p>
                    )}
                    {sim.basis && (
                      <span className="inline-block text-[11px] text-gray-400 bg-white/[0.06] px-2 py-0.5 rounded-full mt-3">
                        {sim.basis}
                      </span>
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
