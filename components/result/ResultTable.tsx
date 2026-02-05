"use client";

import { memo, useMemo } from "react";
import ScoreGrid from "./ScoreGrid";
import SectionList, { type ResultSection } from "./SectionList";
import type { AnalysisResult, TeaserResult } from "@/store/useInputStore";
import { normalizeScores } from "@/lib/resultSchema";

const DEFAULT_UNLOCK_LABEL = "1,000원으로 전체 결과 보기";

// 핵심 공포 축 블록 컴포넌트
const CoreFearAxisBlock = memo(function CoreFearAxisBlock({
  content,
}: {
  content: string;
}) {
  const paragraphs = content.split("\n\n").filter(Boolean);

  return (
    <div className="bg-background-secondary rounded-3xl p-6 md:p-8 border-0">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🎯</span>
        <h3 className="text-title-3 text-text-primary font-semibold">요즘 1등 이슈</h3>
      </div>
      <div className="space-y-3">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className={`text-body-2 ${index === 0 ? "text-primary font-semibold" : "text-text-secondary"}`}
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
});

type ResultTableProps = {
  result: AnalysisResult | TeaserResult;
  locked?: boolean;
  onUnlock?: () => void;
  unlockLabel?: string;
  statusLabel?: "무료" | "잠금" | "언락";
  initialExpandedCount?: number;
};

export default function ResultTable({
  result,
  locked = false,
  onUnlock,
  unlockLabel = DEFAULT_UNLOCK_LABEL,
  statusLabel,
  initialExpandedCount = 0,
}: ResultTableProps) {
  const safeTier = useMemo(() => {
    const raw = (result as Partial<AnalysisResult>)?.tier;
    return {
      grade:
        typeof raw?.grade === "string" && raw.grade.trim()
          ? raw.grade
          : "C",
      percentile:
        typeof raw?.percentile === "number" && Number.isFinite(raw.percentile)
          ? raw.percentile
          : 50,
      title:
        typeof raw?.title === "string" && raw.title.trim()
          ? raw.title
          : "기본 결과 요약",
      description:
        typeof raw?.description === "string" && raw.description.trim()
          ? raw.description
          : "결과를 정리하는 중입니다.",
    };
  }, [result]);

  const safeScores = useMemo(() => normalizeScores((result as Partial<AnalysisResult>)?.scores), [result]);

  const safeCoreFearAxisBlock = useMemo(() => {
    const raw = (result as Partial<AnalysisResult>)?.coreFearAxisBlock;
    return typeof raw === "string" && raw.trim() ? raw : "";
  }, [result]);

  const safeSections = useMemo(() => {
    const raw = (result as Partial<AnalysisResult>)?.sections;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((section, index) => {
        const icon = typeof section?.icon === "string" && section.icon.trim() ? section.icon : "🧩";
        const title =
          typeof section?.title === "string" && section.title.trim()
            ? section.title
            : `분석 섹션 ${index + 1}`;
        const content =
          typeof section?.content === "string" && section.content.trim()
            ? section.content
            : undefined;
        return { icon, title, content };
      })
      .slice(0, 8);
  }, [result]);

  const gradeKey = useMemo(() => {
    const grade = safeTier.grade.trim().toUpperCase();
    if (grade.startsWith("S")) return "S";
    if (grade.startsWith("A")) return "A";
    if (grade.startsWith("B")) return "B";
    if (grade.startsWith("C")) return "C";
    return "D";
  }, [safeTier.grade]);

  const gradeBackgrounds: Record<string, string> = {
    S: "bg-primary-rank-s/15",
    A: "bg-primary/15",
    B: "bg-saju-wood/15",
    C: "bg-saju-earth/15",
    D: "bg-background-secondary",
  };
  const gradeTextColors: Record<string, string> = {
    S: "text-primary-rank-s",
    A: "text-primary",
    B: "text-saju-wood",
    C: "text-saju-earth",
    D: "text-text-secondary",
  };

  const badgeStyles: Record<"무료" | "잠금" | "언락", string> = {
    무료: "bg-background-tertiary text-text-secondary",
    잠금: "bg-primary/15 text-primary",
    언락: "bg-saju-wood/15 text-saju-wood",
  };

  const badgeLabel: "무료" | "잠금" | "언락" = statusLabel || (locked ? "잠금" : "언락");

  return (
    <div className="space-y-6">
      <div className={`rounded-3xl p-6 md:p-8 ${gradeBackgrounds[gradeKey]}`}>
        <div className="flex items-center justify-between mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold ${badgeStyles[badgeLabel]}`}>
            {badgeLabel}
          </span>
          <span className="text-[12px] text-text-secondary">상위 {safeTier.percentile}%</span>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className={`text-5xl md:text-6xl font-bold ${gradeTextColors[gradeKey]}`}>{safeTier.grade}</div>
          <div className="text-title-3 text-text-primary">{safeTier.title}</div>
          <p className="text-body-2 text-text-secondary max-w-md">{safeTier.description}</p>
        </div>
      </div>

      {/* 핵심 공포 축 블록 - 등급/상위 n% 아래에 표시 */}
      {safeCoreFearAxisBlock && (
        <CoreFearAxisBlock content={safeCoreFearAxisBlock} />
      )}

      <ScoreGrid scores={safeScores} />

      <SectionList
        sections={safeSections as ResultSection[]}
        locked={locked}
        onUnlock={onUnlock}
        unlockLabel={unlockLabel}
        initialExpandedCount={initialExpandedCount}
      />
    </div>
  );
}
