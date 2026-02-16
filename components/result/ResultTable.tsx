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
} from "@/lib/gradeSystem";

const DEFAULT_UNLOCK_LABEL = "1,000원으로 전체 결과 보기";

const LEGACY_GRADE_STYLES = {
  S: {
    background: "bg-primary-rank-s/15",
    text: "text-primary-rank-s",
  },
  A: {
    background: "bg-primary/15",
    text: "text-primary",
  },
  B: {
    background: "bg-saju-wood/10",
    text: "text-saju-wood-muted",
  },
  C: {
    background: "bg-saju-earth/10",
    text: "text-saju-earth-muted",
  },
  D: {
    background: "bg-background-secondary",
    text: "text-text-secondary",
  },
} as const;

type LegacyGradeKey = keyof typeof LEGACY_GRADE_STYLES;

const LEGACY_GRADE_LABELS: LegacyGradeKey[] = ["S", "A", "B", "C", "D"];

const LEGACY_GRADE_ORDER = [...LEGACY_GRADE_LABELS];


type ResultTableProps = {
  result: AnalysisResult | TeaserResult;
  locked?: boolean;
  onUnlock?: () => void;
  unlockLabel?: string;
  statusLabel?: "무료" | "잠금" | "언락";
  initialExpandedCount?: number;
};

const badgeStyles: Record<"무료" | "잠금" | "언락", string> = {
  무료: "bg-background-tertiary text-text-secondary",
  잠금: "bg-primary/15 text-primary",
  언락: "bg-saju-wood/10 text-saju-wood-muted",
};

function resolveLegacyGradeKey(grade: string): LegacyGradeKey {
  const upperGrade = grade.trim().toUpperCase();
  const key = LEGACY_GRADE_ORDER.find((label) => upperGrade.startsWith(label));
  if (key && key in LEGACY_GRADE_STYLES) {
    return key as LegacyGradeKey;
  }
  return "D";
}

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
    return {
      grade,
      composite,
      percentileRank,
      topPercent,
      title: typeof raw?.title === "string" && raw.title.trim() ? raw.title : "기본 결과 요약",
      description:
        typeof raw?.description === "string" && raw.description.trim()
          ? raw.description
          : "결과를 정리하는 중입니다.",
    };
  }, [result]);

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
      });
  }, [result]);

  const gradeKey = useMemo(() => resolveLegacyGradeKey(safeTier.grade), [safeTier.grade]);
  const gradeStyle = LEGACY_GRADE_STYLES[gradeKey];

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
    const riskPattern = /(리스크|위험|경고|누수)/;
    const conclusionPattern = /(현실적인 결론|결론|요약|정리)/;

    const riskSection = safeSections.find((section) => riskPattern.test(section.title));
    const conclusionSection = safeSections.find((section) => conclusionPattern.test(section.title));

    const next = safeSections.filter(
      (section) => section !== riskSection && section !== conclusionSection
    );

    if (riskSection) {
      next.push(riskSection);
    }

    if (conclusionSection) {
      next.push(conclusionSection);
    }

    if (safeCoreFearAxisBlock) {
      next.push({
        icon: "🎯",
        title: "요즘 1등 이슈",
        content: safeCoreFearAxisBlock,
      });
    }
    return next;
  }, [safeSections, safeCoreFearAxisBlock]);

  const badgeLabel: "무료" | "잠금" | "언락" = statusLabel || (locked ? "잠금" : "언락");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <div className={`rounded-3xl p-6 md:p-8 border border-white/5 ${gradeStyle.background}`}>
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold ${badgeStyles[badgeLabel]}`}
            >
              {badgeLabel}
            </span>
          </div>
          <div className="mt-6 flex flex-col items-center text-center gap-3">
            <OverallGradeBadgeSlot
              grade={safeTier.grade as OverallGradeLabel}
              badgeSrc={null}
              // TODO: 배지 이미지 전달받으면 badgeSrc 연결
              size={152}
            />
            <div className={`text-6xl md:text-7xl font-bold leading-none ${gradeStyle.text}`}>
              {safeTier.grade}
            </div>
            <div className="text-[13px] font-semibold text-text-secondary">
              상위 {safeTier.topPercent}%
            </div>
            <div
              className="max-w-[26ch] text-[20px] leading-tight font-semibold text-text-primary"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {safeTier.title}
            </div>
            <p className="max-w-[52ch] text-[16px] text-text-secondary leading-[1.75]">
              {safeTier.description}
            </p>
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
