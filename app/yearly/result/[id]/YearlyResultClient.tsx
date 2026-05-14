"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import { Warning } from "@phosphor-icons/react";
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

/* ─────────── 결과 본문 — 토스 톤 ─────────── */

export function YearlyResultBody({ result, onBack }: { result: YearlyResult; onBack: () => void }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <Header showBack sticky onBack={onBack} />

      <main className="flex-1 px-5 pb-20">
        <div className="max-w-[640px] mx-auto pt-6 space-y-4 durumi-stagger">
          {/* 1. 올해 운세 — Hero (타이틀·한해 weather·키워드·사주메타·행운·전망) */}
          <YearOverviewSection
            targetYear={result.yearlyMeta.targetYear}
            tier={result.tier}
            yearlyMeta={result.yearlyMeta}
            monthly={result.monthlyFlow}
            keywords={result.yearlyKeywords}
            luckyMeta={result.luckyMeta}
          />

          {/* 2. 월별 흐름 */}
          {result.monthlyFlow && result.monthlyFlow.length === 12 && (
            <MonthlyFlowSection
              monthly={result.monthlyFlow}
              hints={result.monthlyHints}
              bigEvents={result.yearlyBigEvents}
              targetYear={result.yearlyMeta.targetYear}
            />
          )}

          {/* 4. 상세 풀이 — 6섹션 아코디언 */}
          <DetailSection sections={result.sections} targetYear={result.yearlyMeta.targetYear} />

          {/* 5. 푸터 — 공유 + 메뉴 */}
          <FooterSection
            targetYear={result.yearlyMeta.targetYear}
            onMenu={() => router.push("/menu")}
          />
        </div>
      </main>
    </div>
  );
}

/* ─────────── 1. 올해 운세 — Hero + 행운 벤토 그리드 ─────────── */

const GRADE_STYLE: Record<string, { bg: string; text: string }> = {
  S: { bg: "bg-primary-rank-s/15",  text: "text-primary-rank-s" },
  A: { bg: "bg-saju-wood/15",       text: "text-saju-wood-muted" },
  B: { bg: "bg-saju-wood/15",       text: "text-saju-wood-muted" },
  C: { bg: "bg-saju-earth/15",      text: "text-saju-earth-muted" },
  D: { bg: "bg-background-tertiary", text: "text-text-secondary" },
};

// 한 해 weather 매핑 — 12개월 dominant mood 기반
const YEAR_WEATHER: Record<string, { icon: string; label: string; color: string }> = {
  강세: { icon: "/icons/weather/sun.svg",    label: "맑은 한 해",   color: "text-text-primary" },
  보통: { icon: "/icons/weather/cloud.svg",  label: "흐림 우세",   color: "text-text-secondary" },
  주의: { icon: "/icons/weather/rain.svg",   label: "비 자주",     color: "text-saju-earth-muted" },
  위기: { icon: "/icons/weather/thunder.svg",label: "변동 큰 한 해", color: "text-saju-fire" },
};

function YearOverviewSection({
  targetYear,
  tier,
  yearlyMeta,
  monthly,
  keywords,
  luckyMeta,
}: {
  targetYear: number;
  tier: YearlyResult["tier"];
  yearlyMeta: YearlyResult["yearlyMeta"];
  monthly: YearlyResult["monthlyFlow"] | null;
  keywords?: string[] | null;
  luckyMeta?: YearlyResult["luckyMeta"] | null;
}) {
  // 한 해 weather — 12개월 mood 분포 기반 임계값 판정
  // 단순 max 카운트는 강세 4 / 보통 4 / 주의 2 / 위기 2 패턴(LLM 자연 분포)이 거의 모두
  // "맑은 한 해"로 떨어지는 문제가 있어, 과반 임계값으로 결정.
  const yearWeather = useMemo(() => {
    if (!monthly || monthly.length === 0) return null;
    const counts: Record<string, number> = { 강세: 0, 보통: 0, 주의: 0, 위기: 0 };
    monthly.forEach((m) => {
      counts[m.mood] = (counts[m.mood] ?? 0) + 1;
    });
    let dominant: string;
    if (counts.강세 >= 6) dominant = "강세";
    else if (counts.위기 >= 4) dominant = "위기";
    else if (counts.주의 >= 4) dominant = "주의";
    else dominant = "보통";
    return YEAR_WEATHER[dominant] ?? YEAR_WEATHER["보통"];
  }, [monthly]);

  return (
    <HeroBlock
      targetYear={targetYear}
      tier={tier}
      pillarKorean={yearlyMeta.pillarKorean}
      tenStar={yearlyMeta.tenStar}
      twelveStage={yearlyMeta.twelveStage}
      keywords={keywords}
      luckyMeta={luckyMeta}
      yearWeather={yearWeather}
    />
  );
}

/* Hero 블록 — 토스 톤
 *
 * 위계:
 *   "2026년 운세"             ← 작은 라벨 + 등급 chip
 *   {tier.title}              ← 진짜 hero (24px font-bold)
 *   {tier.description}        ← 본문 (15px)
 *   [keywords chips]
 *   {사주 메타 한 줄}
 */
function HeroBlock({
  targetYear,
  tier,
  pillarKorean,
  tenStar,
  twelveStage,
  keywords,
  luckyMeta,
  yearWeather,
}: {
  targetYear: number;
  tier: YearlyResult["tier"];
  pillarKorean: string;
  tenStar: string;
  twelveStage: string;
  keywords?: string[] | null;
  luckyMeta?: YearlyResult["luckyMeta"] | null;
  yearWeather: { icon: string; label: string; color: string } | null;
}) {

  // 활동 카테고리 item 동적 추출 (행운 정보용)
  const activityPrimary = luckyMeta
    ? (
        luckyMeta.items.find((item) => /운동|산책|요가|수영|여행|등산|호흡|명상|유산소|이동/.test(item)) ??
        luckyMeta.items[2] ??
        luckyMeta.items[0]
      )?.split("·")[0].trim() ?? ""
    : "";

  // 좌상단 glow — 올해 컬러(luckyMeta.color.primary)를 미세 tint로
  const glowHex = luckyMeta?.color.primary ?? "#FFFFFF";

  return (
    <div className="rounded-3xl p-6 relative overflow-hidden bg-background-secondary">
      {/* 라벨 + 한 해 weather chip (등급 대신 일기예보 컨셉) */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <span className="text-[13px] font-semibold text-text-tertiary tabular-nums">
          {targetYear}년 운세
        </span>
        {yearWeather && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background-tertiary shrink-0">
            <img
              src={yearWeather.icon}
              alt=""
              aria-hidden
              style={{ width: "20px", height: "20px" }}
            />
            <span className={`text-[12px] font-semibold ${yearWeather.color}`}>
              {yearWeather.label}
            </span>
          </div>
        )}
      </div>

      {/* tier.title — 진짜 hero (어그로체 미디움) */}
      <h1 className="text-[24px] font-aggro text-text-primary leading-[1.35] tracking-[-0.01em] mb-4">
        {tier.title}
      </h1>

      {/* tier.description */}
      <p className="text-[14.5px] text-text-secondary leading-[1.75] whitespace-pre-line mb-5">
        {tier.description}
      </p>

      {/* 키워드 chip — 첫 키워드만 weight/contrast 로 강조 (브랜드 컬러 X) */}
      {keywords && keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {keywords.map((k, i) => (
            <span
              key={i}
              className={
                i === 0
                  ? "inline-flex items-center px-3 py-1.5 rounded-full bg-background-tertiary text-[13px] font-semibold text-text-primary"
                  : "inline-flex items-center px-3 py-1.5 rounded-full bg-background-tertiary text-[13px] font-medium text-text-secondary"
              }
            >
              {k}
            </span>
          ))}
        </div>
      )}

      {/* 사주 메타 grid (라벨/값) */}
      <div className="grid grid-cols-3 gap-x-2 pt-4 border-t border-white/5">
        <div>
          <div className="text-[10px] text-text-tertiary tracking-wide">올해의 기운</div>
          <div className="text-[13px] font-semibold text-text-primary mt-1">{pillarKorean}년</div>
        </div>
        <div>
          <div className="text-[10px] text-text-tertiary tracking-wide">올해의 별</div>
          <div className="text-[13px] font-semibold text-text-primary mt-1">{tenStar}운</div>
        </div>
        <div>
          <div className="text-[10px] text-text-tertiary tracking-wide">12운성</div>
          <div className="text-[13px] font-semibold text-text-primary mt-1">{twelveStage}</div>
        </div>
      </div>

      {/* 행운 grid (luckyMeta 있을 때만) — 사주메타와 사이 mt-6 여백 */}
      {luckyMeta && (
        <div className="grid grid-cols-3 gap-x-2 mt-6">
          <div>
            <div className="text-[10px] text-text-tertiary tracking-wide">올해의 컬러</div>
            <div className="text-[13px] font-semibold text-text-primary mt-1 truncate">
              {luckyMeta.color.korean}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-tertiary tracking-wide">올해의 숫자</div>
            <div className="text-[13px] font-semibold text-text-primary mt-1 tabular-nums">
              {luckyMeta.numbers.join(", ")}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-tertiary tracking-wide">올해의 활동</div>
            <div className="text-[13px] font-semibold text-text-primary mt-1 truncate">
              {activityPrimary}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



/* ─────────── 4. 월별 흐름 ─────────── */

const MOOD_STYLE: Record<string, { label: string; color: string; bg: string; bar: string; icon: string }> = {
  강세: { label: "맑음",     color: "text-saju-wood-muted",  bg: "bg-saju-wood/10",  bar: "rgb(110, 185, 130)", icon: "/icons/weather/sun.svg" },
  보통: { label: "흐림",     color: "text-text-secondary",   bg: "bg-white/5",       bar: "rgb(120, 122, 130)", icon: "/icons/weather/cloud.svg" },
  주의: { label: "비 예보",   color: "text-saju-earth-muted", bg: "bg-saju-earth/10", bar: "rgb(195, 170, 90)",  icon: "/icons/weather/rain.svg" },
  위기: { label: "폭풍 주의", color: "text-saju-fire",        bg: "bg-saju-fire/10",  bar: "rgb(239, 68, 68)",   icon: "/icons/weather/thunder.svg" },
};

const BIG_EVENT_STYLE: Record<string, { label: string; ring: string; border: string; chipBg: string; chipText: string }> = {
  위기: { label: "주의", ring: "ring-saju-fire/30",  border: "border-saju-fire/40",  chipBg: "bg-saju-fire/15",  chipText: "text-saju-fire" },
  기회: { label: "기회", ring: "ring-saju-wood/30",  border: "border-saju-wood/40",  chipBg: "bg-saju-wood/15",  chipText: "text-saju-wood-muted" },
  결정: { label: "결정", ring: "ring-saju-wood/30", border: "border-saju-wood/40", chipBg: "bg-saju-wood/15", chipText: "text-saju-wood-muted" },
};

function MonthlyFlowSection({
  monthly,
  hints,
  bigEvents,
  targetYear,
}: {
  monthly: NonNullable<YearlyResult["monthlyFlow"]>;
  hints: YearlyResult["monthlyHints"];
  bigEvents?: YearlyResult["yearlyBigEvents"];
  targetYear: number;
}) {
  const bigEventMap = useMemo(() => {
    const m = new Map<number, NonNullable<YearlyResult["yearlyBigEvents"]>[number]>();
    (bigEvents ?? []).forEach((e) => m.set(e.month, e));
    return m;
  }, [bigEvents]);

  return (
    <section className="rounded-3xl bg-background-secondary p-6">
      {/* 단일 헤더 */}
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-text-primary">{targetYear}년, 한 해 무드</h2>
      </div>

      {/* 12개월 가로 스크롤 — 미리보기 (시간별 row 톤) */}
      <div className="relative -mx-6">
        <div
          className="overflow-x-auto scrollbar-hide px-6"
          style={{ scrollSnapType: "x mandatory" }}
        >
          <div className="flex gap-2" style={{ width: "max-content" }}>
            {monthly.map((m, i) => {
              const monthNum = i + 1;
              const event = bigEventMap.get(monthNum);
              return (
                <MonthQuickCell
                  key={monthNum}
                  month={monthNum}
                  mood={m.mood}
                  bigEventTone={event?.tone}
                />
              );
            })}
          </div>
        </div>
        {/* 우측 fade — 카드 우측 가장자리 (스크롤 affordance) */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 right-0 w-14"
          style={{
            background:
              "linear-gradient(to left, rgb(var(--bg-secondary)) 0%, rgba(20, 20, 20, 0) 100%)",
          }}
          aria-hidden
        />
      </div>

      {/* 12개월 디테일 — 같은 카드 안 풀이 (10일간 row 톤) */}
      <div className="mt-6 pt-5 border-t border-white/5">
        <div className="divide-y divide-white/5">
          {monthly.map((m, i) => {
            const monthNum = i + 1;
            const bigEvent = bigEventMap.get(monthNum);
            const rawHint = hints?.[i] ?? `${m.tenStar}운 · ${m.twelveStage}`;
            const hint = rawHint.replace(/^\s*\d+\s*월\s*[:：]\s*/, "").trim();
            return (
              <MonthRow
                key={monthNum}
                month={monthNum}
                pillarKorean={m.pillarKorean}
                tenStar={m.tenStar}
                twelveStage={m.twelveStage}
                mood={m.mood}
                hint={hint}
                bigEvent={bigEvent}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* 시간별 셀 — 빅이벤트는 tone 컬러 카드로 시그니처 강화
 * 월 번호는 font-aggro로 Hero 타이포 패밀리 통일
 */
function MonthQuickCell({
  month,
  mood,
  bigEventTone,
}: {
  month: number;
  mood: string;
  bigEventTone?: "위기" | "기회" | "결정";
}) {
  const moodInfo = MOOD_STYLE[mood] ?? MOOD_STYLE["보통"];
  const eventStyle = bigEventTone ? BIG_EVENT_STYLE[bigEventTone] : null;

  return (
    <div
      className={`shrink-0 rounded-xl py-3 flex flex-col items-center justify-center gap-1.5 ${
        eventStyle
          ? `${eventStyle.chipBg} ring-1 ${eventStyle.ring}`
          : ""
      }`}
      style={{ width: "72px", scrollSnapAlign: "start" }}
    >
      <span
        className={`font-aggro tabular-nums whitespace-nowrap ${
          eventStyle ? eventStyle.chipText : "text-text-secondary"
        }`}
        style={{ fontSize: "14px" }}
      >
        {month}월
      </span>
      <img
        src={moodInfo.icon}
        alt=""
        aria-hidden
        style={{ width: "52px", height: "52px" }}
      />
      <span className={`text-[11px] font-semibold ${moodInfo.color} whitespace-nowrap`}>
        {moodInfo.label}
      </span>
    </div>
  );
}

/* 월 상세 row — iOS Weather 10일간 row 톤
 *
 * 레이아웃: [월] [아이콘] [사주메타 ............] [mood 라벨] [특보 chip]
 *           ↑ 하단: hint (full width)
 *           ↑ 빅 이벤트면 추가 블록 (라벨 + 설명, 색상 좌측 바)
 */
function MonthRow({
  month,
  pillarKorean,
  tenStar,
  twelveStage,
  mood,
  hint,
  bigEvent,
}: {
  month: number;
  pillarKorean: string;
  tenStar: string;
  twelveStage: string;
  mood: string;
  hint: string;
  bigEvent?: NonNullable<YearlyResult["yearlyBigEvents"]>[number];
}) {
  const moodInfo = MOOD_STYLE[mood] ?? MOOD_STYLE["보통"];
  const eventStyle = bigEvent ? BIG_EVENT_STYLE[bigEvent.tone] : null;

  return (
    <article className="relative py-3.5 first:pt-3 last:pb-2">
      {/* 빅 이벤트 좌측 컬러 바 — 카드 박스 없이 막대만 */}
      {bigEvent && eventStyle && (
        <div
          className={`absolute top-3.5 bottom-3.5 -left-3 w-1 rounded-full ${eventStyle.chipBg.replace(
            "/15",
            "/60",
          )}`}
          aria-hidden
        />
      )}

      {/* 상단: 좌측 (월 + 아이콘 가로) / 우측 (chip + mood) — 모두 vertical center */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="font-aggro text-text-primary tabular-nums whitespace-nowrap leading-none"
            style={{ fontSize: "18px", letterSpacing: "-0.01em" }}
          >
            {month}월
          </span>
          <img
            src={moodInfo.icon}
            alt=""
            aria-hidden
            className="block"
            style={{ width: "44px", height: "44px" }}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {bigEvent && eventStyle && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${eventStyle.chipBg} ${eventStyle.chipText}`}
            >
              {eventStyle.label}
            </span>
          )}
          <span className={`text-[13px] font-semibold ${moodInfo.color}`}>
            {moodInfo.label}
          </span>
        </div>
      </div>

      {/* hint — 본문 (흰색, 큰 사이즈) */}
      <p className="text-[15.5px] text-text-primary leading-relaxed font-medium">
        {hint}
      </p>

      {/* 사주 메타 — 본문 아래 (작은 캡션) */}
      <p className="text-[12px] text-text-tertiary mt-1.5">
        {pillarKorean} · {tenStar}운 · {twelveStage}
      </p>

      {/* 빅 이벤트 — tone 컬러 박스로 묶음 (라벨 + 설명) */}
      {bigEvent && eventStyle && (
        <div className={`mt-3 rounded-xl px-4 py-3 ${eventStyle.chipBg}`}>
          <div className={`text-[13px] font-bold ${eventStyle.chipText} mb-1.5`}>
            {bigEvent.label}
          </div>
          <p className="text-[14px] text-text-primary leading-relaxed">
            {bigEvent.description}
          </p>
        </div>
      )}
    </article>
  );
}


/* ─────────── 5. 상세 풀이 — 6섹션 아코디언 ─────────── */

function DetailSection({ sections, targetYear }: { sections: YearlyResult["sections"]; targetYear: number }) {
  return (
    <section className="space-y-3 pt-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[18px] font-bold text-text-primary">{targetYear}년 상세 풀이</h2>
        <span className="text-[12px] text-text-tertiary">6편</span>
      </div>
      <SectionList sections={sections} initialExpandedCount={1} />
    </section>
  );
}

/* ─────────── 6. 푸터 ─────────── */

function FooterSection({
  targetYear,
  onMenu,
}: {
  targetYear: number;
  onMenu: () => void;
}) {
  return (
    <section className="space-y-3 pt-6">
      <ShareButton targetYear={targetYear} />
      <button
        onClick={onMenu}
        className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
      >
        메뉴로 가기
      </button>
    </section>
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


