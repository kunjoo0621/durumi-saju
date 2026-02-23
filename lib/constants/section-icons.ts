import type { Icon } from "@phosphor-icons/react";
import {
  Compass,
  Diamond,
  UsersThree,
  CurrencyCircleDollar,
  HeartHalf,
  Briefcase,
  Heartbeat,
  Warning,
  Star,
} from "@phosphor-icons/react";

export type SectionKey =
  | "personality"
  | "strength"
  | "relationship"
  | "wealth"
  | "romance"
  | "career"
  | "health"
  | "warning"
  | "overall";

export const SECTION_META: Record<
  SectionKey,
  { Icon: Icon; label: string; color: string; bg: string; accent: string }
> = {
  personality: { Icon: Compass, label: "성격", color: "#60A5FA", bg: "rgba(96, 165, 250, 0.15)", accent: "#60A5FA" },
  strength:    { Icon: Diamond, label: "강점", color: "#4ADE80", bg: "rgba(74, 222, 128, 0.15)", accent: "#4ADE80" },
  relationship:{ Icon: UsersThree, label: "관계", color: "#9CA3AF", bg: "rgba(156, 163, 175, 0.12)", accent: "#D1D5DB" },
  wealth:      { Icon: CurrencyCircleDollar, label: "재물", color: "#9CA3AF", bg: "rgba(156, 163, 175, 0.12)", accent: "#D1D5DB" },
  romance:     { Icon: HeartHalf, label: "연애", color: "#9CA3AF", bg: "rgba(156, 163, 175, 0.12)", accent: "#D1D5DB" },
  career:      { Icon: Briefcase, label: "직장", color: "#9CA3AF", bg: "rgba(156, 163, 175, 0.12)", accent: "#D1D5DB" },
  health:      { Icon: Heartbeat, label: "건강", color: "#9CA3AF", bg: "rgba(156, 163, 175, 0.12)", accent: "#D1D5DB" },
  warning:     { Icon: Warning, label: "주의", color: "#F87171", bg: "rgba(248, 113, 113, 0.15)", accent: "#F87171" },
  overall:     { Icon: Star, label: "종합", color: "#9CA3AF", bg: "rgba(156, 163, 175, 0.12)", accent: "#D1D5DB" },
};

export const SECTION_ORDER: SectionKey[] = [
  "personality",
  "strength",
  "relationship",
  "wealth",
  "romance",
  "career",
  "health",
  "warning",
  "overall",
];

const EMOJI_TO_KEY: Record<string, SectionKey> = {
  "🧭": "personality",
  "💎": "strength",
  "🧩": "relationship",
  "💰": "wealth",
  "💞": "romance",
  "💼": "career",
  "🩺": "health",
  "🚧": "warning",
  "✅": "overall",
};

/** LLM이 출력한 이모지 → SectionKey 변환. 매칭 실패 시 "relationship" 폴백. */
export function resolveKey(icon: string): SectionKey {
  return EMOJI_TO_KEY[icon] ?? "relationship";
}
