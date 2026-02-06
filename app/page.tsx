"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import MenuDrawer from "./MenuDrawer";

type LandingSection = {
  key: string;
  title: string;
  bodyLines: [string, string];
  accent: "brand" | "violet" | "indigo";
};

const SECTIONS: LandingSection[] = [
  {
    key: "intro",
    title: "사주보는 두루미",
    bodyLines: ["비싼데 뻔한 사주 말고,", "천원으로 내 사주 등급부터 확인해요."],
    accent: "brand",
  },
  {
    key: "analysis",
    title: "등급만 던지고 끝내지 않아요",
    bodyLines: ["등급 → 근거 → 해석을 한 번에 정리해요.", "마지막엔 2주 실행 팁까지 줘요."],
    accent: "violet",
  },
  {
    key: "battle",
    title: "누가 더 좋은 사주인지, 딱 정리",
    bodyLines: ["2,000원으로 둘을 비교해요.", "결과는 등급으로 깔끔하게 보여줘요."],
    accent: "indigo",
  },
];

function SectionGlow({ accent }: { accent: LandingSection["accent"] }) {
  const gradient =
    accent === "brand"
      ? "bg-[radial-gradient(circle_at_50%_0%,rgba(var(--primary),0.22)_0%,transparent_62%)]"
      : accent === "violet"
        ? "bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.18)_0%,transparent_62%)]"
        : "bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.18)_0%,transparent_62%)]";

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 h-[260px] opacity-80 blur-2xl ${gradient}`}
    />
  );
}

function ImagePlaceholder({
  accent,
  src,
  alt,
  priority,
}: {
  accent: LandingSection["accent"];
  src?: string;
  alt?: string;
  priority?: boolean;
}) {
  const orbA =
    accent === "brand"
      ? "bg-[radial-gradient(circle_at_center,rgba(var(--primary),0.26)_0%,transparent_64%)]"
      : accent === "violet"
        ? "bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.22)_0%,transparent_64%)]"
        : "bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.20)_0%,transparent_64%)]";

  const orbB =
    accent === "brand"
      ? "bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.14)_0%,transparent_70%)]"
      : accent === "violet"
        ? "bg-[radial-gradient(circle_at_center,rgba(var(--primary),0.14)_0%,transparent_70%)]"
        : "bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.12)_0%,transparent_70%)]";

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
        {src ? (
          <Image
            src={src}
            alt={alt || ""}
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, 640px"
            className="object-cover"
          />
        ) : null}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const callbackUrl = useMemo(() => "/menu", []);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleStart = () => {
    signIn("kakao", { callbackUrl });
  };

  return (
    <div className="min-h-screen bg-[rgb(var(--c-dark-bg))] text-white">
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
        {SECTIONS.map((section) => (
          <section key={section.key} className="relative py-16 md:py-20">
            <SectionGlow accent={section.accent} />

            <div className="relative mx-auto max-w-[640px] px-5 sm:px-8 text-center">
              <h2 className="font-aggro text-white text-[32px] leading-[1.15] sm:text-[40px]">
                {section.title}
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-zinc-400">
                <span className="block">{section.bodyLines[0]}</span>
                <span className="block">{section.bodyLines[1]}</span>
              </p>

              <div className="mt-10">
                <ImagePlaceholder
                  accent={section.accent}
                  src={
                    section.key === "intro"
                      ? "/images/landing/section-01.png"
                      : section.key === "battle"
                        ? "/images/landing/section-03.png"
                        : undefined
                  }
                  alt={
                    section.key === "intro"
                      ? "사주보는 두루미 소개 이미지"
                      : section.key === "battle"
                        ? "1:1 사주배틀 소개 이미지"
                        : undefined
                  }
                  priority={section.key === "intro"}
                />
              </div>
            </div>
          </section>
        ))}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-[130] bg-[linear-gradient(0deg,rgba(0,0,0,1)_0%,rgba(0,0,0,1)_calc(70px+env(safe-area-inset-bottom)),rgba(0,0,0,0)_100%)] px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="max-w-[640px] mx-auto">
          <p className="mb-2 text-center text-[12px] text-zinc-400">로그인하면 결과가 저장돼요</p>
          <button
            type="button"
            onClick={handleStart}
            className="w-full h-[54px] rounded-xl bg-[#FEE500] text-black text-[15px] font-semibold flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="text-black">
              <path
                d="M12 4c-5.06 0-9 3.15-9 7.03 0 2.47 1.54 4.63 3.9 5.87l-.7 3.06a.5.5 0 0 0 .75.54l3.56-2.26c.5.07 1.02.1 1.55.1 5.06 0 9-3.15 9-7.03S17.06 4 12 4z"
                fill="currentColor"
              />
            </svg>
            카카오로 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
