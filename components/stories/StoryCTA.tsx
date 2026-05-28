import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { StoryCTA as StoryCTAType } from "@/lib/stories/types";

/**
 * 톤 컬러 — 메인 메뉴(/menu) 카드와 시각 매칭.
 * brand=사주(#FF6B6B), earth=재물·돈(#F59E0B, 메뉴 yearly와 매칭), love=궁합(#A855F7, 메뉴 battle과 매칭).
 */
const TONE_STYLES: Record<
  NonNullable<StoryCTAType["tone"]> | "default",
  { accent: string; glow: string; chipBg: string }
> = {
  default: {
    accent: "#FF6B6B",
    glow: "rgba(255,107,107,0.10)",
    chipBg: "rgba(255,107,107,0.08)",
  },
  brand: {
    accent: "#FF6B6B",
    glow: "rgba(255,107,107,0.10)",
    chipBg: "rgba(255,107,107,0.08)",
  },
  earth: {
    accent: "#F59E0B",
    glow: "rgba(245,158,11,0.10)",
    chipBg: "rgba(245,158,11,0.10)",
  },
  love: {
    accent: "#A855F7",
    glow: "rgba(168,85,247,0.10)",
    chipBg: "rgba(168,85,247,0.08)",
  },
};

interface Props {
  cta: StoryCTAType;
  variant: "inline" | "block";
  /** block variant 시 작은 안내 한 줄 */
  caption?: string;
}

/**
 * 매거진 본문 CTA — 메인 메뉴 카드와 동일한 시각 톤.
 * block: 카드형 (본문 중간·하단), inline: 짧은 한 줄 링크.
 */
export default function StoryCTA({ cta, variant, caption }: Props) {
  const tone = TONE_STYLES[cta.tone ?? "default"];

  if (variant === "inline") {
    return (
      <Link
        href={cta.href}
        className="inline-flex items-center gap-1.5 text-[14px] font-semibold"
        style={{ color: tone.accent }}
      >
        {cta.label}
        <ArrowRight size={14} weight="bold" />
      </Link>
    );
  }

  return (
    <Link
      href={cta.href}
      className="group relative block bg-[#141414] hover:bg-[#1A1A1A] active:bg-[#111111] active:scale-[0.97] rounded-2xl py-6 pl-6 pr-5 overflow-hidden transition-[transform,background-color] duration-200"
      style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
    >
      {/* 우상단 컬러 글로우 (메뉴 카드 결과 동일) */}
      <div
        className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-[140px] h-[140px] rounded-full blur-[60px] z-[1] pointer-events-none"
        style={{ background: tone.glow }}
      />

      <div className="relative z-[2] flex items-center gap-4">
        <div className="flex-1 min-w-0">
          {caption && (
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold mb-2"
              style={{ background: tone.chipBg, color: tone.accent }}
            >
              {caption}
            </span>
          )}
          <p
            className="text-[15px] font-bold leading-[1.4] text-white"
          >
            {cta.label}
          </p>
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 group-active:translate-x-0.5"
          style={{ background: tone.chipBg }}
        >
          <ArrowRight size={18} weight="bold" color={tone.accent} />
        </div>
      </div>
    </Link>
  );
}
