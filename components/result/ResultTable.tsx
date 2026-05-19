"use client";

import { useMemo } from "react";
import CategoryRadarChart, { type CategoryItem, type CategoryKey } from "./CategoryRadarChart";
import OverallGradeBadgeSlot, { type OverallGradeLabel } from "./OverallGradeBadgeSlot";
import SectionList from "./SectionList";
import type { AnalysisResult, TeaserResult } from "@/store/useInputStore";
import {
  clampValue,
  COMPOSITE_GRADE_CUTOFFS,
  gradeFromComposite,
  normalizeComposite,
  percentileRankFromComposite,
  topPercentFromPercentileRank,
  safeDisplayGrade,
  transformGradeText,
} from "@/lib/gradeSystem";
import { getGradeBadge, getGradeColor } from "@/lib/utils/grade-colors";
import { SECTION_ORDER, resolveKey } from "@/lib/constants/section-icons";

const DEFAULT_UNLOCK_LABEL = "전체 결과 보기";

type ResultTableProps = {
  result: AnalysisResult | TeaserResult;
  locked?: boolean;
  onUnlock?: () => void;
  unlockLabel?: string;
  initialExpandedCount?: number;
};

export default function ResultTable({
  result,
  locked = false,
  onUnlock,
  unlockLabel = DEFAULT_UNLOCK_LABEL,
  initialExpandedCount = 0,
}: ResultTableProps) {
  const safeTier = useMemo(() => {
    const raw = (result as Partial<AnalysisResult>)?.tier;
    const compositeBase =
      typeof raw?.composite === "number" && Number.isFinite(raw.composite)
        ? raw.composite
        : typeof (raw as { percentile?: unknown })?.percentile === "number" &&
            Number.isFinite((raw as { percentile?: number }).percentile)
          ? (raw as { percentile?: number }).percentile ?? 0
          : 0;
    const composite = normalizeComposite(compositeBase);
    const gradeCandidate = typeof raw?.grade === "string" ? raw.grade.trim().toUpperCase() : "";
    const grade = ["S", "A", "B", "C", "D"].includes(gradeCandidate[0])
      ? gradeCandidate[0]
      : gradeFromComposite(composite, COMPOSITE_GRADE_CUTOFFS);
    const percentileRank =
      typeof raw?.percentileRank === "number" && Number.isFinite(raw.percentileRank)
        ? clampValue(Math.round(raw.percentileRank), 1, 99)
        : percentileRankFromComposite(composite);
    const topPercent = topPercentFromPercentileRank(percentileRank);
    const confidence =
      typeof (raw as any)?.confidence === "string" &&
      ["high", "medium", "low"].includes((raw as any).confidence)
        ? ((raw as any).confidence as "high" | "medium" | "low")
        : "high";
    return {
      grade,
      composite,
      percentileRank,
      topPercent,
      confidence,
      title: typeof raw?.title === "string" && raw.title.trim() ? raw.title : "기본 결과 요약",
      description:
        typeof raw?.description === "string" && raw.description.trim()
          ? raw.description
          : "결과를 정리하는 중입니다.",
    };
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
      });
  }, [result]);

  const gradeColor = useMemo(() => getGradeColor(safeTier.grade), [safeTier.grade]);

  const categories = useMemo<CategoryItem[]>(() => {
    const rawScores = (result as Partial<AnalysisResult>)?.scores as Record<string, unknown> | undefined;
    const resolveScore = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) return { score: value };
      if (value && typeof value === "object") {
        const rawScore = (value as { score?: unknown }).score;
        const rawGrade = (value as { grade?: unknown }).grade;
        return {
          score: typeof rawScore === "number" && Number.isFinite(rawScore) ? rawScore : 0,
          grade: typeof rawGrade === "string" && rawGrade.trim() ? rawGrade.trim() : undefined,
        };
      }
      return { score: 0 };
    };

    const orderedKeys: CategoryKey[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];
    return orderedKeys.map((key) => {
      const value = resolveScore(rawScores?.[key]);
      const score = typeof value.score === "number" ? value.score : 0;
      const grade = value.grade || gradeFromComposite(score, COMPOSITE_GRADE_CUTOFFS);
      return { key, score, grade };
    });
  }, [result]);

  const composedSections = useMemo(() => {
    const orderMap = new Map(SECTION_ORDER.map((key, i) => [key, i]));

    const sorted = [...safeSections].sort((a, b) => {
      const BEFORE_RISK = 6.5; // 미지 아이콘은 health(6)과 warning(7) 사이에 배치
      const ai = orderMap.get(resolveKey(a.icon)) ?? BEFORE_RISK;
      const bi = orderMap.get(resolveKey(b.icon)) ?? BEFORE_RISK;
      return ai - bi;
    });

    return sorted;
  }, [safeSections]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <div
          className="rounded-3xl p-6 md:p-8"
          style={{ backgroundColor: '#141414' }}
        >
          <div className="mt-6 flex flex-col items-center text-center">
            <div className="mb-5">
              <OverallGradeBadgeSlot
                grade={safeTier.grade as OverallGradeLabel}
                badgeSrc={getGradeBadge(safeTier.grade)}
                size={120}
              />
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-lg font-bold" style={{ color: gradeColor.main }}>
                {safeDisplayGrade(safeTier.grade)}등급
              </span>
              <span className="text-lg font-bold text-gray-400">
                · 상위 {safeTier.topPercent}%
              </span>
            </div>
            <div className="mt-10 text-2xl font-bold font-aggro text-white line-clamp-2">
              {transformGradeText(safeTier.title)}
            </div>
            <p className="mt-3 max-w-lg text-[16px] text-gray-400 text-center leading-7">
              {transformGradeText(safeTier.description)}
            </p>
            {safeTier.confidence === "low" && (
              <p className="mt-2 text-[13px] text-text-tertiary">
                일부 계산에 오차가 있을 수 있어
              </p>
            )}
            {safeTier.confidence === "medium" && (
              <p className="mt-2 text-[13px] text-text-tertiary">
                출생 시간을 몰라서 정확도가 좀 낮을 수 있어
              </p>
            )}
          </div>
        </div>

        <CategoryRadarChart categories={categories} />
      </div>

      <SectionList
        sections={composedSections}
        locked={locked}
        onUnlock={onUnlock}
        unlockLabel={unlockLabel}
        initialExpandedCount={initialExpandedCount}
      />
    </div>
  );
}
