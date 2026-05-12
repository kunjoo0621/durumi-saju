"use client";

import Link from "next/link";
import { Sparkle } from "@phosphor-icons/react";

/**
 * 사전 페이지(/dict/**)에 떠 있는 사주 분석 CTA.
 * 두루미 사이트 톤앤매너 (다크 베이스·브랜드 액센트·Phosphor 아이콘) 일관.
 * 모바일·데스크톱 공통, 우하단 fixed.
 */
export default function FloatingSajuCTA() {
  return (
    <Link
      href="/start"
      aria-label="내 사주 보기"
      className="group fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full border border-white/[0.08] bg-[rgb(var(--c-dark-elevated))] px-5 text-[14px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] transition-all hover:bg-[rgb(var(--c-brand))] hover:border-transparent active:scale-95 sm:bottom-6 sm:right-6 sm:h-12"
    >
      <Sparkle
        size={18}
        weight="fill"
        className="text-[rgb(var(--c-brand))] transition-colors group-hover:text-white"
        aria-hidden
      />
      <span>내 사주 보기</span>
    </Link>
  );
}
