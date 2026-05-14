"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import {
  Warning,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
} from "@phosphor-icons/react";
import SectionList from "@/components/result/SectionList";
import type { YearlyResult } from "@/lib/yearly-prompt";

type Props = {
  resultId: string;
};

const POLL_INTERVAL_MS = 2_500;
const POLL_MAX_ATTEMPTS = 120; // 5분 한도

const LOADING_STEPS = [
  { message: "결과를 불러오고 있어", delay: 0 },
];

const PENDING_STEPS = [
  { message: "사주 데이터를 계산하고 있어", delay: 0 },
  { message: "그 해의 세운 흐름을 분석하고 있어", delay: 20_000 },
  { message: "결과를 정리하고 있어", delay: 60_000 },
];

export default function YearlyResultClient({ resultId }: Props) {
  const router = useRouter();
  const { status } = useSession();

  const [result, setResult] = useState<YearlyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResult = useCallback(async () => {
    try {
      const res = await fetch("/api/yearly/full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "결과를 불러오지 못했어.");
      }
      const fullResult = data.result;
      // 진행 중 (full_json null)
      if (!fullResult || (fullResult as any)?._error) {
        if ((fullResult as any)?._error) {
          setError("분석이 실패했어. 알은 환불됐어.");
          setPending(false);
          return { done: true } as const;
        }
        return { done: false } as const;
      }
      setResult(fullResult as YearlyResult);
      setPending(false);
      return { done: true } as const;
    } catch (err: any) {
      setError(err?.message || "결과를 불러오지 못했어.");
      return { done: true } as const;
    }
  }, [resultId]);

  // 마운트 + 폴링
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    let attempts = 0;
    setLoading(true);

    (async () => {
      const first = await fetchResult();
      if (cancelled) return;
      if (first.done) {
        setLoading(false);
        return;
      }
      // pending — 폴링 시작
      setPending(true);
      setLoading(false);
      const interval = setInterval(async () => {
        attempts += 1;
        const r = await fetchResult();
        if (cancelled) return;
        if (r.done) {
          clearInterval(interval);
        } else if (attempts >= POLL_MAX_ATTEMPTS) {
          clearInterval(interval);
          setError("분석이 너무 오래 걸려. 잠시 후 다시 확인해줘.");
          setPending(false);
        }
      }, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    })();

    return () => {
      cancelled = true;
    };
  }, [status, fetchResult]);

  if (status === "loading" || loading) {
    return <FullScreenLoading steps={LOADING_STEPS} />;
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
        <div className="max-w-[640px] w-full text-center space-y-4">
          <h2 className="text-title-2 text-text-primary">로그인이 필요해</h2>
          <button
            onClick={() => router.push("/yearly")}
            className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
          >
            운세 메뉴로 가기
          </button>
        </div>
      </div>
    );
  }

  if (pending) {
    return <FullScreenLoading steps={PENDING_STEPS} subMessage="최대 1분 정도 걸려" />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
        <div className="max-w-[640px] w-full text-center">
          <div className="mb-6 flex justify-center">
            <Warning weight="duotone" size={64} className="text-amber-400" />
          </div>
          <h2 className="text-title-2 text-text-primary mb-4">분석에 실패했어</h2>
          <p className="text-body-2 text-text-secondary mb-8">{error}</p>
          <button
            onClick={() => router.push("/yearly")}
            className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
          >
            운세 메뉴로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
        <div className="max-w-[640px] w-full text-center space-y-4">
          <h2 className="text-title-2 text-text-primary">결과를 찾을 수 없어</h2>
          <button
            onClick={() => router.push("/yearly")}
            className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
          >
            운세 메뉴로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return <YearlyResultBody result={result} onBack={() => router.push("/menu")} />;
}

/* ─────────── 결과 본문 ─────────── */

export function YearlyResultBody({ result, onBack }: { result: YearlyResult; onBack: () => void }) {
  const router = useRouter();
  const totalChars = useMemo(
    () => result.sections.reduce((s, sec) => s + sec.content.length, 0),
    [result.sections],
  );

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <Header showBack sticky onBack={onBack} />

      <main className="flex-1 px-5 pb-20">
        <div className="max-w-[640px] mx-auto pt-8 space-y-8 durumi-stagger">
          {/* Hero 시그니처 카드 — 토스풍 */}
          <HeroCard
            targetYear={result.yearlyMeta.targetYear}
            title={result.tier.title}
            pillarKorean={result.yearlyMeta.pillarKorean}
            tenStar={result.yearlyMeta.tenStar}
            twelveStage={result.yearlyMeta.twelveStage}
            napumKorean={result.yearlyMeta.napumKorean}
            keywords={result.yearlyKeywords}
          />

          {/* 프롤로그 — tier description */}
          <section className="rounded-3xl bg-background-secondary px-8 py-9">
            <div className="text-[11px] font-semibold tracking-[0.08em] text-text-tertiary uppercase mb-4">
              한 줄 프롤로그
            </div>
            <p className="text-body-1 text-text-primary leading-relaxed whitespace-pre-line">
              {result.tier.description}
            </p>
          </section>

          {/* 행운 메타 — 색/방위/숫자/아이템 */}
          {result.luckyMeta && (
            <LuckyMetaCard meta={result.luckyMeta} targetYear={result.yearlyMeta.targetYear} />
          )}

          {/* 월별 흐름 */}
          {result.monthlyFlow && result.monthlyFlow.length === 12 && (
            <MonthlyFlowCard
              monthly={result.monthlyFlow}
              hints={result.monthlyHints}
              bigEvents={result.yearlyBigEvents}
            />
          )}

          {/* 섹션 6개 — 아코디언 */}
          <section className="space-y-4 pt-3">
            <h2 className="text-title-3 text-text-primary px-1">{result.yearlyMeta.targetYear}년의 흐름</h2>
            <SectionList sections={result.sections} initialExpandedCount={1} />
          </section>

          {/* 푸터 */}
          <div className="space-y-3 pt-6">
            <ShareButton targetYear={result.yearlyMeta.targetYear} />
            <button
              onClick={() => router.push("/menu")}
              className="btn-secondary w-full h-[54px] rounded-2xl text-[15px] font-semibold"
            >
              메뉴로 가기
            </button>
            <p className="text-caption text-text-tertiary text-center pt-6">
              이 분석은 AI를 활용한 참고 자료입니다.
              <br />
              실제 운명은 당신의 선택과 노력에 달려있습니다.
            </p>
            <p className="text-[11px] text-text-tertiary text-center opacity-40">
              총 {totalChars.toLocaleString()}자
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ─────────── Hero 시그니처 카드 (토스풍) ─────────── */

type HeroCardProps = {
  targetYear: number;
  title: string;
  pillarKorean: string;
  tenStar: string;
  twelveStage: string;
  napumKorean?: string | null;
  keywords?: string[] | null;
};

function HeroCard({ targetYear, title, pillarKorean, tenStar, twelveStage, napumKorean, keywords }: HeroCardProps) {
  return (
    <section
      className="relative rounded-3xl px-8 pt-10 pb-10 space-y-10 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgb(28, 26, 32) 0%, rgb(20, 21, 26) 60%, rgb(18, 19, 24) 100%)",
      }}
    >
      {/* 우상단 거대 연도 워터마크 (distinctive 시그니처) */}
      <div
        className="absolute -top-4 -right-3 text-[150px] font-black font-aggro leading-none pointer-events-none select-none tabular-nums"
        style={{
          color: "rgba(255, 62, 92, 0.06)",
          letterSpacing: "-0.06em",
        }}
        aria-hidden
      >
        {targetYear}
      </div>

      <div className="relative space-y-10">
        {/* 상단 메타 라인 */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold tracking-[0.12em] text-text-tertiary uppercase">
            {targetYear} 운세
          </div>
          <div className="text-[14px] text-text-secondary">
            {pillarKorean}년 · {tenStar}운
          </div>
        </div>

        {/* 큰 헤드라인 */}
        <h1 className="text-[30px] font-bold font-aggro text-text-primary leading-[1.35] tracking-[-0.01em]">
          {title}
        </h1>

        {/* 올해의 키워드 3개 — 큰 chip */}
        {keywords && keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {keywords.map((k, i) => (
              <KeywordPill key={i} label={k} index={i} />
            ))}
          </div>
        )}

        {/* 하단 메타 — 작은 chip */}
        <div className="flex items-center gap-2 flex-wrap pt-6 border-t border-white/5 -mx-8 px-8">
          <MetaChip label={`12운성 ${twelveStage}`} />
          {napumKorean && <MetaChip label={`납음 ${napumKorean}`} subtle />}
        </div>
      </div>
    </section>
  );
}

function KeywordPill({ label, index }: { label: string; index: number }) {
  // 첫 키워드 강조, 나머지는 보조
  const isPrimary = index === 0;
  return (
    <span
      className={
        isPrimary
          ? "inline-flex items-center px-4 py-2 rounded-full text-[15px] font-bold text-text-primary bg-white/[0.08]"
          : "inline-flex items-center px-4 py-2 rounded-full text-[14px] font-semibold text-text-secondary bg-white/[0.04]"
      }
    >
      {label}
    </span>
  );
}

function MetaChip({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span
      className={
        subtle
          ? "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] text-text-tertiary bg-white/[0.03]"
          : "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium text-text-secondary bg-white/[0.05]"
      }
    >
      {label}
    </span>
  );
}

/* ─────────── 행운 메타 카드 ─────────── */

type LuckyMetaCardProps = {
  meta: NonNullable<YearlyResult["luckyMeta"]>;
  targetYear: number;
};

function LuckyMetaCard({ meta, targetYear }: LuckyMetaCardProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-title-3 text-text-primary">{targetYear}년의 행운</h2>
        <span className="text-[12px] text-text-tertiary">
          용신 {meta.yongshin}
        </span>
      </div>

      <div className="rounded-3xl border border-white/[0.06] divide-y divide-white/5">
        {/* 색 */}
        <div className="flex items-center justify-between px-7 py-5">
          <span className="text-[13px] text-text-tertiary">색</span>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: meta.color.primary }}
              aria-hidden
            />
            <span className="text-[14px] text-text-primary font-medium">{meta.color.korean}</span>
          </div>
        </div>

        {/* 방위 */}
        <div className="flex items-center justify-between px-7 py-5">
          <span className="text-[13px] text-text-tertiary">방위</span>
          <span className="text-[14px] text-text-primary font-medium">
            {meta.direction.korean}
          </span>
        </div>

        {/* 숫자 */}
        <div className="flex items-center justify-between px-7 py-5">
          <span className="text-[13px] text-text-tertiary">숫자</span>
          <span className="text-[14px] text-text-primary font-medium tabular-nums">
            {meta.numbers.join(", ")}
          </span>
        </div>

        {/* 아이템 */}
        <div className="flex items-start justify-between px-7 py-5 gap-6">
          <span className="text-[13px] text-text-tertiary shrink-0">아이템</span>
          <span className="text-[14px] text-text-primary text-right leading-relaxed">
            {meta.items.slice(0, 3).join(" · ")}
          </span>
        </div>

        {/* 회피 */}
        {(meta.avoidColor || meta.avoidDirection) && (
          <div className="flex items-center justify-between px-7 py-5">
            <span className="text-[13px] text-text-tertiary">피할 것</span>
            <span className="text-[14px] text-text-primary font-medium">
              {meta.avoidColor && <>{meta.avoidColor.korean}</>}
              {meta.avoidColor && meta.avoidDirection && <span className="text-text-tertiary"> · </span>}
              {meta.avoidDirection && <>{meta.avoidDirection.korean}</>}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─────────── 월별 흐름 캘린더 ─────────── */

type MonthlyFlowCardProps = {
  monthly: NonNullable<YearlyResult["monthlyFlow"]>;
  hints: YearlyResult["monthlyHints"];
  bigEvents?: YearlyResult["yearlyBigEvents"];
};

const MOOD_STYLE: Record<string, { dot: string; label: string; score: number }> = {
  강세: { dot: "#22C55E", label: "강세", score: 80 },
  보통: { dot: "#94A3B8", label: "보통", score: 55 },
  주의: { dot: "#F59E0B", label: "주의", score: 35 },
  위기: { dot: "#EF4444", label: "위기", score: 18 },
};

const BIG_EVENT_TONE: Record<string, { label: string; bg: string; border: string; text: string; alertLabel: string }> = {
  위기: { label: "위기", bg: "rgba(239, 68, 68, 0.10)", border: "rgba(239, 68, 68, 0.30)", text: "#FCA5A5", alertLabel: "주의보" },
  기회: { label: "기회", bg: "rgba(34, 197, 94, 0.10)", border: "rgba(34, 197, 94, 0.30)", text: "#86EFAC", alertLabel: "맑음 예보" },
  결정: { label: "결정", bg: "rgba(168, 85, 247, 0.10)", border: "rgba(168, 85, 247, 0.30)", text: "#D8B4FE", alertLabel: "전환점" },
};

// mood → 일기예보 라벨
const MOOD_WEATHER_LABEL: Record<string, string> = {
  강세: "맑음",
  보통: "흐림",
  주의: "비 예보",
  위기: "폭풍 주의",
};

const QUARTERS = [
  { label: "봄", months: [1, 2, 3], color: "rgba(134, 239, 172, 0.65)" },
  { label: "여름", months: [4, 5, 6], color: "rgba(252, 165, 165, 0.65)" },
  { label: "가을", months: [7, 8, 9], color: "rgba(253, 224, 71, 0.65)" },
  { label: "겨울", months: [10, 11, 12], color: "rgba(147, 197, 253, 0.65)" },
] as const;

function MonthlyFlowCard({ monthly, hints, bigEvents }: MonthlyFlowCardProps) {
  // 빅 이벤트 월 → 정보 lookup (badge 표시용)
  const bigEventMap = useMemo(() => {
    const m = new Map<number, NonNullable<YearlyResult["yearlyBigEvents"]>[number]>();
    (bigEvents ?? []).forEach((e) => m.set(e.month, e));
    return m;
  }, [bigEvents]);

  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-title-3 text-text-primary">한 해 예보</h2>
        <span className="text-[12px] text-text-tertiary">월별 흐름 12편</span>
      </div>

      {/* 분기 4그룹 */}
      <div className="space-y-8">
        {QUARTERS.map((q) => (
          <div key={q.label} className="space-y-3">
            {/* 분기 헤더 */}
            <div className="flex items-baseline gap-2 px-1">
              <span
                className="text-[12px] font-bold tracking-[0.12em]"
                style={{ color: q.color }}
              >
                {q.label.toUpperCase()}
              </span>
              <span className="text-[10px] text-text-tertiary tabular-nums">
                {q.months[0]}–{q.months[2]}월
              </span>
            </div>

            {/* 분기 안의 3개월 카드 */}
            <div className="space-y-2.5">
              {q.months.map((monthNum) => {
                const i = monthNum - 1;
                const m = monthly[i];
                if (!m) return null;
                const moodInfo = MOOD_STYLE[m.mood] ?? MOOD_STYLE["보통"];
                const bigEvent = bigEventMap.get(monthNum);
                const rawHint = hints?.[i] ?? `${m.tenStar}운 · ${m.twelveStage}`;
                const hint = rawHint.replace(/^\s*\d+\s*월\s*[:：]\s*/, "").trim();
                return (
                  <ForecastMonthCard
                    key={monthNum}
                    month={monthNum}
                    pillarKorean={m.pillarKorean}
                    tenStar={m.tenStar}
                    twelveStage={m.twelveStage}
                    mood={m.mood}
                    moodColor={moodInfo.dot}
                    hint={hint}
                    bigEvent={bigEvent}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────── 일기예보 풀카드 (한 달) ─────────── */

type ForecastMonthCardProps = {
  month: number;
  pillarKorean: string;
  tenStar: string;
  twelveStage: string;
  mood: string;
  moodColor: string;
  hint: string;
  bigEvent?: NonNullable<YearlyResult["yearlyBigEvents"]>[number];
};

function ForecastMonthCard({
  month,
  pillarKorean,
  tenStar,
  twelveStage,
  mood,
  moodColor,
  hint,
  bigEvent,
}: ForecastMonthCardProps) {
  const weatherLabel = MOOD_WEATHER_LABEL[mood] ?? "보통";
  const Icon =
    mood === "강세" ? Sun :
    mood === "주의" ? CloudRain :
    mood === "위기" ? CloudLightning :
    Cloud;
  const weight = mood === "보통" ? "duotone" : "fill";

  // 빅 이벤트 — tone에 따른 강조 색
  const eventTone = bigEvent ? BIG_EVENT_TONE[bigEvent.tone] : null;
  const isHotspot = !!bigEvent;

  return (
    <article
      className={`relative rounded-3xl overflow-hidden ${
        isHotspot ? "bg-background-secondary" : ""
      }`}
      style={
        isHotspot
          ? { border: `1px solid ${eventTone?.border ?? "rgba(255,255,255,0.08)"}` }
          : { border: "1px solid rgba(255,255,255,0.06)" }
      }
      aria-label={`${month}월 ${weatherLabel} ${tenStar}운${bigEvent ? ` — ${eventTone?.alertLabel}: ${bigEvent.label}` : ""}`}
    >
      <div className="px-6 py-5">
        {/* 상단: 월·아이콘·mood 라벨 */}
        <div className="flex items-start justify-between gap-4 mb-4">
          {/* 좌측: 월 + 천간지지 */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[26px] font-bold font-aggro text-text-primary leading-none tabular-nums">
                {month}월
              </span>
              {bigEvent && eventTone && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: eventTone.bg,
                    color: eventTone.text,
                    border: `1px solid ${eventTone.border}`,
                  }}
                >
                  {eventTone.alertLabel}
                </span>
              )}
            </div>
            <div className="text-[12px] text-text-tertiary mt-1.5">
              {pillarKorean} · {tenStar}운 · {twelveStage}
            </div>
          </div>

          {/* 우측: 큰 weather 아이콘 + mood 라벨 */}
          <div className="flex items-center gap-2 shrink-0">
            <Icon size={32} weight={weight} color={moodColor} aria-hidden />
            <span
              className="text-[13px] font-semibold tabular-nums"
              style={{ color: moodColor }}
            >
              {weatherLabel}
            </span>
          </div>
        </div>

        {/* 한 줄 hint */}
        <p className="text-[15px] text-text-primary leading-relaxed font-medium">
          {hint}
        </p>

        {/* 빅 이벤트 설명 (있을 때만) */}
        {bigEvent && (
          <p className="text-[13px] text-text-secondary leading-relaxed mt-3 pt-3 border-t border-white/[0.06]">
            {bigEvent.description}
          </p>
        )}
      </div>
    </article>
  );
}

/* ─────────── 공유 버튼 ─────────── */

type ShareButtonProps = {
  targetYear: number;
};

function ShareButton({ targetYear }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.origin + "/yearly" : "";
    const text = `${targetYear}년 내 사주 운세 풀이 — 사주보는 두루미`;

    // Web Share API 지원 (모바일 Safari·Chrome) → 시스템 공유 시트 (카카오톡 포함)
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: `사주보는 두루미 — ${targetYear}년 운세`,
          text,
          url,
        });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }

    // Fallback: URL 클립보드 복사
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      window.prompt("URL을 복사해 친구에게 보내줘", url);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold relative"
      aria-label="결과 공유하기"
    >
      {copied ? "링크 복사됨!" : "친구에게 공유하기"}
    </button>
  );
}
