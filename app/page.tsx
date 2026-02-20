"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import MenuDrawer from "./MenuDrawer";
import { GRADE_GLOWS, type OverallGradeLabel } from "@/components/result/OverallGradeBadgeSlot";

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

/* ─── grade badge ─── */

function GradeBadge({
  grade,
  size = 80,
  delay = 0,
  visible,
}: {
  grade: OverallGradeLabel;
  size?: number;
  delay?: number;
  visible: boolean;
}) {
  const glow = GRADE_GLOWS[grade] ?? GRADE_GLOWS.D;
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: size,
        height: size,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: `opacity 0.5s ease-out ${delay}ms, transform 0.5s ease-out ${delay}ms`,
      }}
    >
      <div
        className="absolute -inset-4 rounded-full"
        style={{ background: glow }}
        aria-hidden="true"
      />
      <span className="relative text-3xl font-aggro font-bold text-white/90">
        {grade}
      </span>
    </div>
  );
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

/* ─── kakao CTA button ─── */

function KakaoCTA({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-[54px] rounded-xl bg-primary-kakao text-black text-[15px] font-semibold flex items-center justify-center gap-2"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="text-black">
        <path
          d="M12 4c-5.06 0-9 3.15-9 7.03 0 2.47 1.54 4.63 3.9 5.87l-.7 3.06a.5.5 0 0 0 .75.54l3.56-2.26c.5.07 1.02.1 1.55.1 5.06 0 9-3.15 9-7.03S17.06 4 12 4z"
          fill="currentColor"
        />
      </svg>
      카카오로 시작하기
    </button>
  );
}

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

  const handleStart = useCallback(() => {
    signIn("kakao", { callbackUrl });
  }, [callbackUrl]);

  /* scroll-reveal refs */
  const hero = useScrollReveal<HTMLElement>();
  const grade = useScrollReveal<HTMLElement>();
  const battle = useScrollReveal<HTMLElement>();
  const cta = useScrollReveal<HTMLElement>();

  const revealStyle = (visible: boolean): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
  });

  return (
    <div className="min-h-screen bg-[rgb(var(--c-dark-bg))] text-white">
      {/* ── header ── */}
      <header
        className={`sticky top-0 z-[120] px-5 py-4 transition-all duration-300 ${
          isScrolled
            ? "bg-white/[0.08] backdrop-blur-md border-b border-white/10"
            : "bg-transparent border-b border-transparent"
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
            <h2 className="font-aggro text-2xl font-bold text-white">
              내 사주, S등급일까 D등급일까.
            </h2>
            <p className="mt-3 text-sm text-gray-400">천원. 3분. 끝.</p>
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
          ref={grade.ref}
          style={revealStyle(grade.visible)}
          className="relative py-16 md:py-20"
        >
          <div className="relative mx-auto max-w-[640px] px-5 sm:px-8 text-center">
            <h2 className="font-aggro text-xl font-bold text-white">
              등급만 주고 끝?
            </h2>
            <h2 className="font-aggro text-xl font-bold text-white mt-1">
              그건 점집이지.
            </h2>
            <p className="mt-3 text-sm text-gray-400">
              왜 이 등급인지 전부 까발림.
            </p>

            {/* 등급 배지 S B D */}
            <div className="mt-8 flex items-center justify-center gap-10">
              {(["S", "B", "D"] as const).map((g, i) => (
                <div key={g} className="relative">
                  <GradeBadge
                    grade={g}
                    size={80}
                    delay={i * 100}
                    visible={grade.visible}
                  />
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs text-gray-500">
              재물운 · 연애운 · 직장운 · 건강운 · 대인운
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
            <h2 className="font-aggro text-xl font-bold text-white">
              사주 배틀 한판.
            </h2>
            <p className="mt-3 text-sm text-gray-400 leading-relaxed">
              <span className="block">친구 사주가 나보다 나은지,</span>
              <span className="block">2천원이면 결판남.</span>
              <span className="block">지면 할 말 없음.</span>
            </p>

            <div className="mt-10">
              <ImagePlaceholder
                src="/images/landing/section-03.png"
                alt="1:1 사주배틀 소개 이미지"
              />
            </div>

            {/* 미니 VS 프리뷰 */}
            <div className="mt-8 flex items-center justify-center gap-6">
              {/* A등급 (왕관) */}
              <div className="flex flex-col items-center">
                <span className="text-sm mb-1">👑</span>
                <div className="relative">
                  <GradeBadge grade="A" size={60} delay={0} visible={battle.visible} />
                </div>
              </div>

              <span className="font-aggro text-lg font-bold text-white/60">VS</span>

              {/* D등급 */}
              <div className="flex flex-col items-center">
                <span className="text-sm mb-1 opacity-0">👑</span>
                <div className="relative">
                  <GradeBadge grade="D" size={60} delay={100} visible={battle.visible} />
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm text-gray-400">3승 2패 — 신승</p>
          </div>
        </section>

        {/* ── 섹션 4: 최종 CTA ── */}
        <section
          ref={cta.ref}
          style={revealStyle(cta.visible)}
          className="relative py-16 md:py-20 pb-40"
        >
          <div className="relative mx-auto max-w-[640px] px-5 sm:px-8 text-center">
            <h2 className="font-aggro text-lg font-bold text-white">
              준비됐으면, 시작.
            </h2>
            <div className="mt-6">
              <KakaoCTA onClick={handleStart} />
            </div>
          </div>
        </section>
      </main>

      {/* ── 하단 스티키 CTA ── */}
      <div className="fixed inset-x-0 bottom-0 z-[130] bg-[linear-gradient(0deg,rgba(0,0,0,1)_0%,rgba(0,0,0,1)_calc(70px+env(safe-area-inset-bottom)),rgba(0,0,0,0)_100%)] px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="max-w-[640px] mx-auto">
          <p className="mb-2 text-center text-[12px] text-zinc-400">로그인하면 결과가 저장돼요</p>
          <KakaoCTA onClick={handleStart} />
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
