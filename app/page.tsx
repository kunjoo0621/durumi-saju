"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import MenuDrawer from "./MenuDrawer";
import { CaretDown } from "@phosphor-icons/react";

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

/* ─── image placeholder ─── */

function ImagePlaceholder({ ratio = "4:3" }: { ratio?: "16:9" | "4:3" }) {
  const paddingTop = ratio === "16:9" ? "56.25%" : "75%";

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{ paddingTop }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgb(30 30 30)",
          backgroundImage:
            "linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%), linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 10px 10px",
        }}
      />
    </div>
  );
}

/* ─── feature card ─── */

function FeatureCard({
  badge,
  title,
  body,
  imageSrc,
  imageAlt,
}: {
  badge: string;
  title: string;
  body: string;
  imageSrc?: string;
  imageAlt?: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl bg-[rgb(var(--c-dark-surface))] overflow-hidden">
      <div className="px-6 pt-6 pb-5">
        <div className="flex justify-center mb-4">
          <span className="inline-block rounded-full bg-[rgb(var(--c-brand))] px-3 py-1 text-[12px] font-semibold text-white">
            {badge}
          </span>
        </div>
        <h3 className="text-center text-[22px] font-bold leading-[130%] text-white mb-2">
          {title}
        </h3>
        <p className="text-center text-[15px] font-normal leading-[160%] text-[rgb(var(--c-text-sub))] break-keep">
          {body}
        </p>
      </div>
      <div className="mt-auto">
        {imageSrc ? (
          <div className="relative w-full" style={{ paddingTop: "75%" }}>
            <Image
              src={imageSrc}
              alt={imageAlt || ""}
              fill
              sizes="(max-width: 640px) 100vw, 320px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="px-6 pb-6">
            <ImagePlaceholder ratio="4:3" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── FAQ data ─── */

const FAQ_ITEMS = [
  {
    q: "출생 시간을 모르면 어떻게 돼?",
    a: '시간을 "모름"으로 선택하면 시주를 빼고 일주·월주·년주로 분석해. 핵심 결과는 나오지만 정확도는 떨어질 수 있어.',
  },
  {
    q: "결과표에서 뭘 볼 수 있어?",
    a: "만세력 원국 테이블, 종합 등급(S~D), 재물·연애·직장·건강·대인 5개 항목별 점수, 각 항목의 근거 해석, 대운·세운 타임라인, 터닝포인트까지 들어있어.",
  },
  {
    q: "배틀은 뭘 보여줘?",
    a: "두 사람의 사주를 5개 항목으로 비교해서 승패를 가려줘. 거기에 관계 유형별 시나리오, 시뮬레이션, 앞으로의 전망까지 분석해줘.",
  },
  {
    q: "결과를 저장하거나 공유할 수 있어?",
    a: "카카오 로그인을 하면 결과가 자동 저장돼. 공유 링크를 보내면 상대방은 로그인 없이 결과를 볼 수 있어.",
  },
  {
    q: "결제는 어떻게 해?",
    a: "사주 분석 1,000원, 배틀 2,000원이야. 로그인 없이 바로 결제하고 결과를 볼 수 있어. 나중에 카카오로 로그인하면 결과가 자동으로 저장돼.",
  },
];

/* ─── FAQ accordion ─── */

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, i) => (
        <div
          key={i}
          className="rounded-2xl bg-[rgb(var(--c-dark-surface))] overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="flex w-full items-center justify-between p-5 text-left"
          >
            <span className="text-[15px] font-semibold text-white pr-4">
              Q. {item.q}
            </span>
            <CaretDown
              size={20}
              weight="bold"
              className={`shrink-0 text-zinc-400 transition-transform duration-200 ${
                openIndex === i ? "rotate-180" : ""
              }`}
            />
          </button>
          {openIndex === i && (
            <div className="px-5 pb-5">
              <p className="text-[15px] font-normal leading-[160%] text-[rgb(var(--c-text-sub))] break-keep">
                {item.a}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
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

  const router = useRouter();

  const handleStart = useCallback(() => {
    router.push(callbackUrl);
  }, [callbackUrl, router]);

  /* scroll-reveal refs */
  const hero = useScrollReveal<HTMLElement>();
  const analysis = useScrollReveal<HTMLElement>();
  const battle = useScrollReveal<HTMLElement>();
  const faq = useScrollReveal<HTMLElement>();

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
          isScrolled ? "bg-[rgb(var(--c-dark-bg))]" : "bg-transparent"
        }`}
      >
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <div className="w-10" />
          <h1 className="text-title-3 font-aggro text-white">사주보는 두루미</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="pb-[calc(120px+env(safe-area-inset-bottom))]">
        {/* ── 섹션 1: 히어로 ── */}
        <section
          ref={hero.ref}
          style={revealStyle(hero.visible)}
          className="relative py-16 md:py-20"
        >
          <div className="relative mx-auto max-w-[640px] px-5 sm:px-8 text-center">
            <h2 className="font-aggro text-[28px] leading-[130%] font-bold text-white break-keep">
              사주 보면 결국
              <br />
              똑같은 말 나오지?
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[rgb(var(--c-text-sub))] break-keep">
              두루미가 진짜 네 사주만 말해줄게
            </p>
            <div className="mt-8">
              <div className="relative w-full overflow-hidden rounded-2xl" style={{ paddingTop: "56.25%" }}>
                <Image
                  src="/images/landing/section-01.png"
                  alt="S·A·B 등급 카드를 들고 있는 두루미"
                  fill
                  priority
                  sizes="(max-width: 640px) 100vw, 640px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── 섹션 2: 개인 사주 분석 ── */}
        <section
          ref={analysis.ref}
          style={revealStyle(analysis.visible)}
          className="relative py-16 md:py-20"
        >
          <div className="relative mx-auto max-w-[640px] px-5 sm:px-8">
            <h2 className="font-aggro text-[28px] leading-[130%] font-bold text-white text-center break-keep mb-8">
              너 사주가 어떻게 생겼고
              <br />
              그게 뭘 뜻하는지 알려줄게
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FeatureCard
                badge="원국 분석표"
                title="사주 원국, 표 하나로 정리"
                body="사주 원국을 정리해서, 어떤 기운이 강하고 뭐가 빠졌는지 한눈에 알 수 있어"
                imageSrc="/images/landing/card-2-1.png"
                imageAlt="사주 원국 분석표 예시"
              />
              <FeatureCard
                badge="결과표"
                title="등급과 점수, 근거까지 한 장에"
                body="종합 등급 + 5개 항목별 점수, 거기에 왜 그렇게 나왔는지 근거까지 붙여줘"
                imageSrc="/images/landing/card-2-2.png"
                imageAlt="등급 결과표 예시"
              />
            </div>
          </div>
        </section>

        {/* ── 섹션 3: 사주 배틀 ── */}
        <section
          ref={battle.ref}
          style={revealStyle(battle.visible)}
          className="relative py-16 md:py-20"
        >
          <div className="relative mx-auto max-w-[640px] px-5 sm:px-8">
            <h2 className="font-aggro text-[28px] leading-[130%] font-bold text-white text-center break-keep mb-8">
              두 사람의 사주를 비교해서,
              <br />
              누가 더 강한지 알려줄게
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FeatureCard
                badge="항목별 승부"
                title="5개 항목, 하나씩 비교"
                body="재물·연애·직장·건강·대인 각각 누가 우세한지 판정하고, 최종 승패를 정리해줘"
                imageSrc="/images/landing/card-3-1.png"
                imageAlt="배틀 항목별 승부 예시"
              />
              <FeatureCard
                badge="관계별 분석"
                title="관계 유형별로 따로 분석"
                body="연인일 때와 동료일 때는 보는 포인트가 달라. 관계에 맞는 조합 분석을 보여줘"
                imageSrc="/images/landing/card-3-2.png"
                imageAlt="관계 유형별 분석 예시"
              />
            </div>
          </div>
        </section>

        {/* ── 섹션 4: FAQ ── */}
        <section
          ref={faq.ref}
          style={revealStyle(faq.visible)}
          className="relative py-16 md:py-20"
        >
          <div className="relative mx-auto max-w-[640px] px-5 sm:px-8">
            <h2 className="font-aggro text-[28px] leading-[130%] font-bold text-white text-center break-keep mb-8">
              자주 묻는 질문
            </h2>
            <FaqAccordion />
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
            사주 보러가기
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
