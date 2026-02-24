"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import MenuDrawer from "./MenuDrawer";
import {
  Trophy,
  CurrencyCircleDollar,
  Heart,
  Briefcase,
  Pulse,
  Users,
  Sword,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

/* ─── scroll-reveal hook ─── */

function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/* ─── image placeholder (carried over) ─── */

function ImagePlaceholder({
  src,
  alt,
  priority,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  const orbA =
    "bg-[radial-gradient(circle_at_center,rgba(var(--primary),0.26)_0%,transparent_64%)]";
  const orbB =
    "bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,transparent_70%)]";

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div className="relative h-[240px] w-full overflow-hidden rounded-[24px] border border-white/10 bg-zinc-900 sm:h-[300px] lg:h-[340px]">
        <div className="absolute -left-24 -top-24 h-[340px] w-[340px] rounded-full blur-3xl opacity-90 sm:-left-28 sm:-top-28 sm:h-[380px] sm:w-[380px]">
          <div className={`h-full w-full ${orbA}`} />
        </div>
        <div className="absolute -bottom-28 -right-24 h-[360px] w-[360px] rounded-full blur-3xl opacity-75 sm:-bottom-32 sm:-right-28 sm:h-[420px] sm:w-[420px]">
          <div className={`h-full w-full ${orbB}`} />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(255,255,255,0.08)_0%,transparent_62%)] opacity-70" />
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, 640px"
          className="object-cover"
        />
      </div>
    </div>
  );
}

/* ─── icon constants ─── */

const AWARD_COLORS = ["#FF3B2F", "#F840F0", "#F09000", "#A0BCC8", "#B87A40"];

const CATEGORY_ICONS: Icon[] = [CurrencyCircleDollar, Heart, Briefcase, Pulse, Users];

/* ─── main page ─── */

function LandingPageInner() {
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(() => {
    const returnTo = searchParams?.get("returnTo");
    return returnTo && returnTo.startsWith("/") ? returnTo : "/menu";
  }, [searchParams]);

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const router = useRouter();

  const handleStart = useCallback(() => {
    router.push(callbackUrl);
  }, [callbackUrl, router]);

  /* scroll-reveal refs */
  const hero = useScrollReveal<HTMLElement>();
  const gradeSection = useScrollReveal<HTMLElement>();
  const battle = useScrollReveal<HTMLElement>();

  const revealStyle = (visible: boolean): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
  });

  /* ── hero: Trophy color cycling ── */
  const [awardColorIndex, setAwardColorIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setAwardColorIndex((prev) => (prev + 1) % AWARD_COLORS.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  /* ── section 2: category icons sequential fade-in ── */
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev >= 5) return 0;
        return prev + 1;
      });
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[rgb(var(--c-dark-bg))] text-white">
      <style>{`
        @keyframes swordPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>

      {/* ── header ── */}
      <header
        className={`sticky top-0 z-[120] px-5 py-4 transition-all duration-300 ${
          isScrolled
            ? "bg-[#0D0D0D]"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <div className="w-10" />
          <h1 className="text-title-3 font-aggro text-white">사주보는 두루미</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="pb-[calc(180px+env(safe-area-inset-bottom))]">
        {/* ── 섹션 1: 히어로 ── */}
        <section
          ref={hero.ref}
          style={revealStyle(hero.visible)}
          className="relative py-16 md:py-20"
        >
          <div className="relative mx-auto max-w-[640px] px-5 sm:px-8 text-center">
            <div className="flex justify-center w-full mb-4">
              <Trophy
                weight="duotone"
                size={32}
                style={{
                  color: AWARD_COLORS[awardColorIndex],
                  transition: "color 0.8s ease-in-out",
                }}
              />
            </div>
            <h2 className="font-aggro text-[32px] leading-[1.15] sm:text-[40px] font-bold text-white break-keep">
              내 사주, S등급일까{" "}
              <span className="inline-block">D등급일까.</span>
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-zinc-400 break-keep">
              <span className="block">비싼데 뻔한 사주 말고,</span>
              <span className="block">천원으로 내 사주 등급부터 확인해.</span>
            </p>
            <div className="mt-10">
              <ImagePlaceholder
                src="/images/landing/section-01.png"
                alt="사주보는 두루미 소개 이미지"
                priority
              />
            </div>
          </div>
        </section>

        {/* ── 섹션 2: 등급 프리뷰 ── */}
        <section
          ref={gradeSection.ref}
          style={revealStyle(gradeSection.visible)}
          className="relative py-16 md:py-20"
        >
          <div className="relative mx-auto max-w-[640px] px-5 sm:px-8 text-center">
            <div className="flex justify-center items-center gap-3 w-full mb-4">
              {CATEGORY_ICONS.map((IconComp, i) => (
                <IconComp
                  key={i}
                  weight="duotone"
                  size={20}
                  className="text-gray-400"
                  style={{
                    opacity: i < visibleCount ? 1 : 0,
                    transition: "opacity 0.4s ease",
                  }}
                />
              ))}
            </div>
            <h2 className="font-aggro text-[32px] leading-[1.15] sm:text-[40px] font-bold text-white break-keep">
              등급만 던지고 끝내지 않아
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-zinc-400 break-keep">
              <span className="block">등급 → 근거 → 해석을 한 번에</span>
              <span className="block">정리해줌. 빈틈없이.</span>
            </p>

            <div className="mt-10">
              <ImagePlaceholder
                src="/images/landing/section-02.png"
                alt="사주 분석 소개 이미지"
              />
            </div>
          </div>
        </section>

        {/* ── 섹션 3: 배틀 소개 ── */}
        <section
          ref={battle.ref}
          style={revealStyle(battle.visible)}
          className="relative py-16 md:py-20"
        >
          <div className="relative mx-auto max-w-[640px] px-5 sm:px-8 text-center">
            <div className="flex justify-center w-full mb-4">
              <Sword
                weight="duotone"
                size={32}
                style={{
                  color: "#FF6B6B",
                  animation: "swordPulse 2.5s ease-in-out infinite",
                }}
              />
            </div>
            <h2 className="font-aggro text-[32px] leading-[1.15] sm:text-[40px] font-bold text-white break-keep">
              누가 더 좋은 사주인지,{" "}
              <span className="inline-block">딱 정리</span>
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-zinc-400 break-keep">
              <span className="block">2천원으로 둘을 비교해줌.</span>
              <span className="block">결과는 등급으로 깔끔하게.</span>
            </p>

            <div className="mt-10">
              <ImagePlaceholder
                src="/images/landing/section-03.png"
                alt="1:1 사주배틀 소개 이미지"
              />
            </div>
          </div>
        </section>
      </main>

      {/* ── 하단 스티키 CTA ── */}
      <div className="fixed inset-x-0 bottom-0 z-[130] bg-[linear-gradient(0deg,rgba(0,0,0,1)_0%,rgba(0,0,0,1)_calc(70px+env(safe-area-inset-bottom)),rgba(0,0,0,0)_100%)] px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="max-w-[640px] mx-auto">
          <button
            type="button"
            onClick={handleStart}
            className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <LandingPageInner />
    </Suspense>
  );
}
