"use client";

// ① 히어로 캐러셀 — 제목 baked 시네마틱 포스터(2:3) snap 스와이프 + 페이지네이션·도트.
import Image from "next/image";
import { useRef, useState } from "react";
import HubSectionHeader from "./HubSectionHeader";
import Reveal from "./Reveal";
import { HUB_HERO_SLIDES } from "./services";
import { useServiceActions } from "./useServiceActions";

const YEARLY_ENABLED = process.env.NEXT_PUBLIC_FEATURE_YEARLY === "1";

export default function HubHeroCarousel() {
  const slides = HUB_HERO_SLIDES.filter((s) => s.id !== "yearly" || YEARLY_ENABLED);
  const { run } = useServiceActions();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    if (!first) return;
    const stride = first.getBoundingClientRect().width + 12; // gap-3
    setActive(Math.min(slides.length - 1, Math.max(0, Math.round(el.scrollLeft / stride))));
  };

  return (
    <section className="pt-4">
      <Reveal>
        <HubSectionHeader eyebrow="요즘 다들 보는" title="이번 주 인기 사주" moreHref="/menu" />
      </Reveal>
      <div
        ref={trackRef}
        onScroll={onScroll}
        role="region"
        aria-label="인기 사주 콘텐츠"
        className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2"
        style={{ scrollPaddingLeft: 20 }}
      >
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => run(s.id)}
            aria-label={s.alt}
            className="relative snap-start w-[86%] shrink-0 overflow-hidden rounded-3xl border border-white/[0.04] bg-background-secondary"
            style={{ aspectRatio: "2 / 3" }}
          >
            <Image
              src={s.src}
              alt={s.alt}
              fill
              priority={i === 0}
              sizes="(max-width: 440px) 86vw, 378px"
              className="object-cover"
            />
            <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white/80">
              {i + 1} / {slides.length}
            </span>
          </button>
        ))}
        <div className="w-1 shrink-0" />
      </div>
      <div className="flex justify-center gap-1.5 pt-1" aria-hidden>
        {slides.map((s, i) => (
          <span
            key={s.id}
            className={
              i === active
                ? "h-1.5 w-5 rounded-full bg-primary transition-all"
                : "h-1.5 w-1.5 rounded-full bg-white/25 transition-all"
            }
          />
        ))}
      </div>
    </section>
  );
}
