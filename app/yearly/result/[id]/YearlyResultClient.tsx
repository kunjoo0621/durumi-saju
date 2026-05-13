"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import ScoreGrid from "@/components/result/ScoreGrid";
import { FullScreenLoading } from "@/components/loading";
import { Warning } from "@phosphor-icons/react";
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
  { message: "올해 세운 흐름을 분석하고 있어", delay: 20_000 },
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
            올해의 운세로 가기
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
            올해의 운세로 돌아가기
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
            올해의 운세로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return <YearlyResultBody result={result} onBack={() => router.push("/menu")} />;
}

/* ─────────── 결과 본문 ─────────── */

function YearlyResultBody({ result, onBack }: { result: YearlyResult; onBack: () => void }) {
  const router = useRouter();
  const totalChars = useMemo(
    () => result.sections.reduce((s, sec) => s + sec.content.length, 0),
    [result.sections],
  );

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <Header showBack sticky onBack={onBack} />

      <main className="flex-1 px-5 pb-12">
        <div className="max-w-[640px] mx-auto pt-8 space-y-8">
          {/* 헤더 — 연도 + 등급 배지(메인) + 세운 메타 */}
          <div className="text-center space-y-4">
            <div className="text-[12px] font-bold tracking-[0.08em] text-text-tertiary">
              {result.yearlyMeta.targetYear}년 운세
            </div>

            {/* 등급 배지 — 메인 강조 */}
            <div className="flex items-center justify-center gap-3">
              <GradeBadge grade={result.tier.grade} />
              <div className="text-left">
                <div className="text-[11px] text-text-tertiary tracking-wide">원국 등급</div>
                <div className="text-[14px] font-semibold text-text-primary">
                  상위 {result.tier.topPercent}%
                </div>
              </div>
            </div>

            <h1 className="text-[26px] font-bold font-aggro text-text-primary leading-tight">
              {result.tier.title}
            </h1>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <YearlyMetaPill
                label={`${result.yearlyMeta.pillarKorean}(${result.yearlyMeta.pillar})`}
              />
              <YearlyMetaPill label={`${result.yearlyMeta.tenStar}운`} />
              <YearlyMetaPill label={`12운성 ${result.yearlyMeta.twelveStage}`} />
              {result.yearlyMeta.napumKorean && (
                <YearlyMetaPill
                  label={`납음 ${result.yearlyMeta.napumKorean}`}
                  subtle
                />
              )}
            </div>
          </div>

          {/* tier description */}
          <div className="rounded-2xl bg-background-secondary border border-white/5 p-6">
            <p className="text-body-1 text-text-primary leading-relaxed whitespace-pre-line">
              {result.tier.description}
            </p>
          </div>

          {/* 행운 메타 — 색/방위/숫자/아이템 */}
          {result.luckyMeta && <LuckyMetaCard meta={result.luckyMeta} />}

          {/* 월별 흐름 캘린더 */}
          {result.monthlyFlow && result.monthlyFlow.length === 12 && (
            <MonthlyFlowCard monthly={result.monthlyFlow} />
          )}

          {/* 5분야 점수 (원국 기준) */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-title-3 text-text-primary">원국 5분야</h2>
              <span className="text-[12px] text-text-tertiary">
                올해 한정 보정 없음 (원국 그대로)
              </span>
            </div>
            <ScoreGrid scores={result.scores} />
          </section>

          {/* 섹션 6개 */}
          <section className="space-y-6">
            {result.sections.map((sec, i) => (
              <article
                key={i}
                className="rounded-2xl bg-background-secondary border border-white/5 p-6 space-y-4"
              >
                <header className="flex items-center gap-3">
                  <span className="text-[24px]" aria-hidden>
                    {sec.icon}
                  </span>
                  <h3 className="text-[18px] font-bold font-aggro text-text-primary">
                    {sec.title}
                  </h3>
                </header>
                <div className="text-body-1 text-text-primary leading-relaxed whitespace-pre-line">
                  {sec.content}
                </div>
              </article>
            ))}
          </section>

          {/* 푸터 */}
          <div className="space-y-3 pt-4">
            <ShareButton targetYear={result.yearlyMeta.targetYear} />
            <button
              onClick={() => router.push("/menu")}
              className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
            >
              메뉴로 가기
            </button>
            <p className="text-caption text-text-tertiary text-center pt-4">
              이 분석은 AI를 활용한 참고 자료입니다.
              <br />
              실제 운명은 당신의 선택과 노력에 달려있습니다.
            </p>
            <p className="text-[11px] text-text-tertiary text-center opacity-50">
              총 {totalChars.toLocaleString()}자
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function YearlyMetaPill({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span
      className={
        subtle
          ? "inline-flex items-center px-3 py-1 rounded-full text-[12px] text-text-tertiary border border-white/5"
          : "inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold text-text-primary bg-background-secondary border border-white/10"
      }
    >
      {label}
    </span>
  );
}

/* ─────────── 등급 배지 ─────────── */

const GRADE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  S: { bg: "rgba(245,158,11,0.18)", border: "rgba(245,158,11,0.55)", text: "#F59E0B" },
  A: { bg: "rgba(168,85,247,0.18)", border: "rgba(168,85,247,0.55)", text: "#A855F7" },
  B: { bg: "rgba(59,130,246,0.18)", border: "rgba(59,130,246,0.55)", text: "#3B82F6" },
  C: { bg: "rgba(148,163,184,0.18)", border: "rgba(148,163,184,0.55)", text: "#94A3B8" },
  D: { bg: "rgba(120,113,108,0.18)", border: "rgba(120,113,108,0.55)", text: "#A8A29E" },
};

function GradeBadge({ grade }: { grade: string }) {
  const key = (grade || "C").toUpperCase()[0];
  const c = GRADE_COLORS[key] ?? GRADE_COLORS.C;
  return (
    <div
      className="w-16 h-16 rounded-2xl flex items-center justify-center font-aggro text-[34px] font-bold leading-none"
      style={{
        background: c.bg,
        border: `2px solid ${c.border}`,
        color: c.text,
      }}
    >
      {key}
    </div>
  );
}

/* ─────────── 행운 메타 카드 ─────────── */

type LuckyMetaCardProps = {
  meta: NonNullable<YearlyResult["luckyMeta"]>;
};

function LuckyMetaCard({ meta }: LuckyMetaCardProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-title-3 text-text-primary">올해의 행운 메타</h2>
        <span className="text-[12px] text-text-tertiary">
          용신 {meta.yongshin} 기반
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 색 */}
        <div className="rounded-2xl bg-background-secondary border border-white/5 p-5 space-y-2">
          <div className="text-[11px] text-text-tertiary tracking-wide">행운의 색</div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              {meta.color.palette.map((hex, i) => (
                <span
                  key={i}
                  className="w-7 h-7 rounded-full border-2"
                  style={{ background: hex, borderColor: "rgba(255,255,255,0.1)" }}
                  aria-hidden
                />
              ))}
            </div>
          </div>
          <div className="text-[15px] font-bold text-text-primary">{meta.color.korean}</div>
        </div>

        {/* 방위 */}
        <div className="rounded-2xl bg-background-secondary border border-white/5 p-5 space-y-2">
          <div className="text-[11px] text-text-tertiary tracking-wide">행운의 방위</div>
          <div className="text-[28px] font-bold font-aggro text-text-primary leading-none">
            {meta.direction.hanja}
          </div>
          <div className="text-[15px] font-bold text-text-primary">{meta.direction.korean}</div>
        </div>

        {/* 숫자 */}
        <div className="rounded-2xl bg-background-secondary border border-white/5 p-5 space-y-2">
          <div className="text-[11px] text-text-tertiary tracking-wide">행운의 숫자</div>
          <div className="flex items-baseline gap-2 flex-wrap">
            {meta.numbers.map((n, i) => (
              <span
                key={i}
                className="text-[28px] font-bold font-aggro text-text-primary leading-none"
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* 아이템 */}
        <div className="rounded-2xl bg-background-secondary border border-white/5 p-5 space-y-2">
          <div className="text-[11px] text-text-tertiary tracking-wide">올해의 아이템</div>
          <ul className="space-y-1">
            {meta.items.slice(0, 3).map((item, i) => (
              <li key={i} className="text-[13px] text-text-primary leading-snug">
                · {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 회피 메타 */}
      {(meta.avoidColor || meta.avoidDirection) && (
        <div className="rounded-2xl bg-background-secondary border border-white/5 px-5 py-4">
          <div className="text-[11px] text-text-tertiary tracking-wide mb-2">
            올해 피하면 좋은 것 — 기신 {meta.gisin} 기반
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {meta.avoidColor && (
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full border"
                  style={{
                    background: meta.avoidColor.primary,
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                  aria-hidden
                />
                <span className="text-[13px] text-text-primary">
                  색: {meta.avoidColor.korean}
                </span>
              </div>
            )}
            {meta.avoidDirection && (
              <div className="text-[13px] text-text-primary">
                방위: {meta.avoidDirection.korean}({meta.avoidDirection.hanja})
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─────────── 월별 흐름 캘린더 ─────────── */

type MonthlyFlowCardProps = {
  monthly: NonNullable<YearlyResult["monthlyFlow"]>;
};

const MOOD_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  강세: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.40)", text: "#22C55E", label: "강세" },
  보통: { bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.30)", text: "#94A3B8", label: "보통" },
  주의: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.40)", text: "#F59E0B", label: "주의" },
  위기: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.45)", text: "#EF4444", label: "위기" },
};

function MonthlyFlowCard({ monthly }: MonthlyFlowCardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const detail = selected !== null ? monthly.find((m) => m.month === selected) ?? null : null;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-title-3 text-text-primary">월별 흐름</h2>
        <span className="text-[12px] text-text-tertiary">
          탭하면 자세히 보여줘
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {monthly.map((m) => {
          const mood = MOOD_STYLE[m.mood] ?? MOOD_STYLE["보통"];
          const isSelected = selected === m.month;
          return (
            <button
              key={m.month}
              type="button"
              onClick={() => setSelected((cur) => (cur === m.month ? null : m.month))}
              className="rounded-xl p-3 text-left transition-all active:scale-[0.97]"
              style={{
                background: mood.bg,
                border: `1.5px solid ${isSelected ? mood.text : mood.border}`,
                boxShadow: isSelected ? `0 0 0 3px ${mood.bg}` : undefined,
              }}
              aria-label={`${m.month}월 ${m.pillarKorean} ${m.tenStar} ${m.mood}`}
            >
              <div className="text-[11px] font-bold tracking-wide" style={{ color: mood.text }}>
                {m.month}월
              </div>
              <div className="text-[15px] font-bold font-aggro text-text-primary mt-1 leading-tight">
                {m.pillarKorean}
              </div>
              <div className="text-[10px] mt-1.5" style={{ color: mood.text }}>
                {mood.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* 선택된 월 상세 */}
      {detail && (
        <div
          className="rounded-2xl bg-background-secondary border p-5 space-y-3"
          style={{ borderColor: MOOD_STYLE[detail.mood].border }}
        >
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] font-bold font-aggro text-text-primary">
                {detail.month}월
              </span>
              <span className="text-[14px] text-text-secondary">
                {detail.pillarKorean}({detail.pillar})
              </span>
            </div>
            <span
              className="px-2.5 py-1 rounded-full text-[11px] font-bold"
              style={{
                background: MOOD_STYLE[detail.mood].bg,
                color: MOOD_STYLE[detail.mood].text,
              }}
            >
              {detail.mood}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <div className="text-text-tertiary text-[11px]">십성</div>
              <div className="text-text-primary font-semibold mt-0.5">{detail.tenStar}운</div>
            </div>
            <div>
              <div className="text-text-tertiary text-[11px]">12운성</div>
              <div className="text-text-primary font-semibold mt-0.5">{detail.twelveStage}</div>
            </div>
          </div>
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center gap-3 flex-wrap pt-1">
        {(["강세", "보통", "주의", "위기"] as const).map((mood) => {
          const s = MOOD_STYLE[mood];
          return (
            <div key={mood} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: s.text }}
                aria-hidden
              />
              <span className="text-[11px] text-text-tertiary">{s.label}</span>
            </div>
          );
        })}
      </div>
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
          title: "사주보는 두루미 — 올해의 운세",
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
