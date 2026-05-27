import Link from "next/link";
import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { StoryCTA as StoryCTAType } from "@/lib/stories/types";

const TONE_STYLES: Record<
  NonNullable<StoryCTAType["tone"]> | "default",
  { ring: string; bg: string; accent: string; icon: string }
> = {
  default: {
    ring: "border-white/[0.08]",
    bg: "rgba(255,107,107,0.08)",
    accent: "#FF6B6B",
    icon: "#FF6B6B",
  },
  brand: {
    ring: "border-white/[0.08]",
    bg: "rgba(255,107,107,0.08)",
    accent: "#FF6B6B",
    icon: "#FF6B6B",
  },
  earth: {
    ring: "border-white/[0.08]",
    bg: "rgba(234,179,8,0.08)",
    accent: "#EAB308",
    icon: "#EAB308",
  },
  love: {
    ring: "border-white/[0.08]",
    bg: "rgba(244,114,182,0.08)",
    accent: "#F472B6",
    icon: "#F472B6",
  },
};

interface Props {
  cta: StoryCTAType;
  variant: "inline" | "block";
  /** block variant 시 작은 안내 한 줄 */
  caption?: string;
}

/**
 * 본문 중간 = "block" (카드형 — 토스보다 노골적, 전환 우선).
 * 본문 하단 = "block" 동일 컴포넌트, 더 큰 패딩 톤.
 * inline은 다른 글 끝맺음 인용용 (예비).
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
      className={`block rounded-2xl border ${tone.ring} px-5 py-5 transition-colors hover:bg-white/[0.02]`}
      style={{ background: tone.bg }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${tone.accent}1a` }}
        >
          <Sparkle size={20} weight="fill" color={tone.icon} />
        </div>
        <div className="flex-1 min-w-0">
          {caption && (
            <p className="text-[12px] text-text-tertiary leading-[1.4] mb-0.5">
              {caption}
            </p>
          )}
          <p
            className="text-[15px] font-semibold leading-[1.4]"
            style={{ color: tone.accent }}
          >
            {cta.label}
          </p>
        </div>
        <ArrowRight
          size={18}
          weight="bold"
          className="shrink-0"
          style={{ color: tone.accent }}
        />
      </div>
    </Link>
  );
}
