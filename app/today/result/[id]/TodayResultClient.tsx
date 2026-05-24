"use client";

// 오늘의 운세 결과 페이지 — yearly Hero 패턴 미러 + 시간대 흐름 제거
// Hero (날짜 + weather + tier + 키워드 + 사주메타) → 6섹션 아코디언 → 푸터

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import SectionList from "@/components/result/SectionList";
import type { TodayResult, TodayMeta } from "@/lib/today-prompt";

interface ApiResponse {
  status: "completed" | "pending" | "failed";
  resultId: string;
  targetDate?: string;
  todayPillar?: string;
  todayMood?: TodayMeta["mood"];
  todayWeatherIcon?: TodayMeta["weatherIcon"];
  branchRelationType?: string;
  stemRelationLabel?: string;
  tenStar?: string;
  result?: TodayResult;
  teaser?: any;
  createdAt?: string;
  message?: string;
}

const WEATHER_LABEL: Record<TodayMeta["weatherIcon"], string> = {
  sun: "맑음",
  cloud: "흐림",
  rain: "비 예보",
  thunder: "폭풍 주의",
};

const WEATHER_COLOR: Record<TodayMeta["weatherIcon"], string> = {
  sun: "text-text-primary",
  cloud: "text-text-secondary",
  rain: "text-saju-earth-muted",
  thunder: "text-saju-fire",
};

function formatDateLabel(targetDate: string): string {
  // "YYYY-MM-DD" → "5월 24일 (토)"
  const [y, m, d] = targetDate.split("-").map(Number);
  if (!y || !m || !d) return targetDate;
  const date = new Date(y, m - 1, d);
  const dayName = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${m}월 ${d}일 (${dayName})`;
}

export default function TodayResultClient({ resultId }: { resultId: string }) {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent(`/today/result/${resultId}`)}`);
      return;
    }
    if (authStatus !== "authenticated") return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/today/results/${resultId}`);
        if (!res.ok && res.status !== 409) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error || "결과를 불러올 수 없어");
        }
        const json: ApiResponse = await res.json();
        if (cancelled) return;

        if (json.status === "pending") {
          // 분석 트리거 (한 번)
          await fetch("/api/today/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resultId }),
          });
          // 3초 후 재조회 (yearly와 동일 패턴)
          timeoutId = setTimeout(fetchResult, 3000);
          return;
        }

        setData(json);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "오류가 발생했어");
        setLoading(false);
      }
    };

    fetchResult();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [authStatus, resultId, router]);

  if (loading) {
    return <FullScreenLoading message="두루미가 오늘을 읽는 중..." />;
  }

  if (error || !data || data.status === "failed" || !data.result) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center px-6">
        <p className="text-body-2 text-text-secondary mb-4">{error || data?.message || "결과가 없어"}</p>
        <button
          type="button"
          onClick={() => router.push("/menu")}
          className="btn-primary px-6 py-3 rounded-xl text-[14px] font-semibold"
        >
          메뉴로
        </button>
      </div>
    );
  }

  const { result, targetDate, todayWeatherIcon } = data;
  const dateLabel = targetDate ? formatDateLabel(targetDate) : "";
  const weatherIcon = (todayWeatherIcon || result.todayMeta.weatherIcon) as TodayMeta["weatherIcon"];
  const weatherLabel = WEATHER_LABEL[weatherIcon];
  const weatherColor = WEATHER_COLOR[weatherIcon];

  const sections = useMemo(
    () => result.sections.map((s) => ({ icon: s.icon, title: s.title, content: s.content })),
    [result.sections],
  );

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/today/result/${resultId}`;
    const shareText = `오늘의 운세 — ${result.tier.title}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "사주보는 두루미 — 오늘의 운세", text: shareText, url: shareUrl });
        return;
      } catch {
        // user cancelled
      }
    }
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).catch(() => {});
    alert("공유 링크가 복사됐어");
  };

  return (
    <div className="min-h-screen bg-background-primary text-text-primary pb-32">
      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="max-w-[640px] mx-auto px-5 pt-6 space-y-4 durumi-stagger">
        {/* Hero — 날짜 + weather + tier + 키워드 + 사주메타 */}
        <section className="rounded-3xl p-6 bg-background-secondary">
          {/* 날짜 + weather chip */}
          <div className="flex items-center justify-between mb-4 gap-3">
            <span className="text-[13px] font-semibold text-text-tertiary tabular-nums">
              {dateLabel} 운세
            </span>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background-tertiary shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/icons/weather/${weatherIcon}.svg`}
                alt=""
                aria-hidden
                style={{ width: "20px", height: "20px" }}
              />
              <span className={`text-[12px] font-semibold ${weatherColor}`}>{weatherLabel}</span>
            </div>
          </div>

          {/* tier.title — hero */}
          <h1 className="text-[24px] font-aggro text-text-primary leading-[1.35] tracking-[-0.01em] mb-4">
            {result.tier.title}
          </h1>

          {/* tier.description */}
          <p className="text-[14.5px] text-text-secondary leading-[1.75] whitespace-pre-line mb-5">
            {result.tier.description}
          </p>

          {/* 키워드 chip */}
          {result.todayKeywords && result.todayKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {result.todayKeywords.map((k, i) => (
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

          {/* 사주 메타 — 오늘의 기운 / 오늘의 별 / 12운성 */}
          <div className="grid grid-cols-3 gap-x-2 pt-4 border-t border-white/5">
            <div>
              <div className="text-[10px] text-text-tertiary tracking-wide">오늘의 기운</div>
              <div className="text-[13px] font-semibold text-text-primary mt-1">
                {result.todayMeta.dayPillar || data.todayPillar || "-"}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-tertiary tracking-wide">오늘의 별</div>
              <div className="text-[13px] font-semibold text-text-primary mt-1 truncate">
                {result.todayMeta.tenStar || data.tenStar || "-"}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-tertiary tracking-wide">12운성</div>
              <div className="text-[13px] font-semibold text-text-primary mt-1">
                {result.todayMeta.twelveStage || "-"}
              </div>
            </div>
          </div>
        </section>

        {/* 6섹션 상세 풀이 */}
        <section className="space-y-3 pt-2">
          <div className="px-1">
            <h2 className="text-[18px] font-bold text-text-primary">오늘의 상세 풀이</h2>
            <p className="text-[12.5px] text-text-tertiary mt-1">두루미가 오늘 너의 하루를 6개 영역으로 풀었어</p>
          </div>
          <SectionList sections={sections} initialExpandedCount={1} />
        </section>

        <div className="text-center text-[11px] text-text-tertiary mt-6">
          {data.createdAt && new Date(data.createdAt).toLocaleString("ko-KR")}
        </div>
      </main>

      {/* 하단 공유 + 메뉴 */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background-primary via-background-primary to-transparent pt-8 pb-5 px-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
      >
        <div className="max-w-[640px] mx-auto flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/menu")}
            className="btn-secondary flex-1 h-[54px] rounded-xl text-[15px] font-semibold"
          >
            메뉴로
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="btn-primary flex-[1.5] h-[54px] rounded-xl text-[15px] font-semibold"
          >
            결과 공유
          </button>
        </div>
      </footer>
    </div>
  );
}
