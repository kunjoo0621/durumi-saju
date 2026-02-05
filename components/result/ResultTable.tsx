"use client";

import { useMemo } from "react";
import ScoreGrid from "./ScoreGrid";
import SectionList, { type ResultSection } from "./SectionList";
import type { AnalysisResult, TeaserResult } from "@/store/useInputStore";
import { normalizeScores } from "@/lib/resultSchema";

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
    background: "bg-saju-wood/15",
    text: "text-saju-wood",
  },
  C: {
    background: "bg-saju-earth/15",
    text: "text-saju-earth",
  },
  D: {
    background: "bg-background-secondary",
    text: "text-text-secondary",
  },
} as const;

type LegacyGradeKey = keyof typeof LEGACY_GRADE_STYLES;

const LEGACY_GRADE_ORDER = Object.keys(LEGACY_GRADE_STYLES);

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
  언락: "bg-saju-wood/15 text-saju-wood",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeGradeLabels(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const labels = input
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object") return "";
      const raw =
        (item as { label?: unknown }).label ??
        (item as { name?: unknown }).name ??
        (item as { key?: unknown }).key;
      return typeof raw === "string" ? raw.trim() : "";
    })
    .filter(Boolean);
  return [...new Set(labels)];
}

function extractGradeLabelsFromResult(input: AnalysisResult | TeaserResult): string[] | null {
  const payload = input as Record<string, unknown>;
  const tier = (payload.tier as Record<string, unknown> | undefined) || {};
  const tierMeta = (tier.meta as Record<string, unknown> | undefined) || {};
  const meta = (payload.meta as Record<string, unknown> | undefined) || {};
  const gradeMeta = (payload.gradeMeta as Record<string, unknown> | undefined) || {};
  const gradeSystem = (payload.gradeSystem as Record<string, unknown> | undefined) || {};

  const candidates: unknown[] = [
    tier.gradeLabels,
    tier.labels,
    tier.gradeOrder,
    tierMeta.gradeLabels,
    tierMeta.labels,
    tierMeta.gradeOrder,
    payload.gradeLabels,
    payload.gradeOrder,
    meta.gradeLabels,
    meta.labels,
    gradeMeta.labels,
    gradeMeta.gradeLabels,
    gradeSystem.labels,
    gradeSystem.order,
  ];

  for (const candidate of candidates) {
    const labels = normalizeGradeLabels(candidate);
    if (labels.length > 0) {
      return labels;
    }
  }

  return null;
}

function resolveLegacyGradeKey(grade: string): LegacyGradeKey {
  const upperGrade = grade.trim().toUpperCase();
  const key = LEGACY_GRADE_ORDER.find((label) => upperGrade.startsWith(label));
  if (key && key in LEGACY_GRADE_STYLES) {
    return key as LegacyGradeKey;
  }
  return "D";
}

function resolveGradeIndex(grade: string, labels: string[]): number {
  if (!labels.length) return -1;
  const upperGrade = grade.trim().toUpperCase();
  const normalized = labels.map((label) => label.trim().toUpperCase());

  const exact = normalized.findIndex((label) => label === upperGrade);
  if (exact >= 0) return exact;

  const startsWith = normalized.findIndex(
    (label) => upperGrade.startsWith(label) || label.startsWith(upperGrade)
  );
  if (startsWith >= 0) return startsWith;

  return -1;
}

function DistributionGraph({
  markerPercent,
  markerLabel,
  gradeLabels,
}: {
  markerPercent: number;
  markerLabel: string;
  gradeLabels: string[] | null;
}) {
  const normalizedX = clamp(markerPercent / 100, 0, 1);
  const bellHeightFactor = Math.exp(-12 * (normalizedX - 0.5) * (normalizedX - 0.5));
  const markerBottom = 20 + bellHeightFactor * 58;

  return (
    <div className="mt-6">
      <div className="relative h-[150px] rounded-2xl bg-background-primary/40 border border-white/5 overflow-hidden px-3">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 320 150"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M10 112 C 70 112, 96 24, 160 24 C 224 24, 250 112, 310 112"
            fill="none"
            stroke="rgba(255, 109, 166, 0.85)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line x1="10" y1="112" x2="310" y2="112" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
        </svg>
        <div
          className="absolute"
          style={{
            left: `calc(${markerPercent}% - 8px)`,
            bottom: `${markerBottom}px`,
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] leading-none text-primary font-semibold whitespace-nowrap">{markerLabel}</span>
            <span className="h-4 w-4 rounded-full bg-primary border-2 border-background-primary shadow-[0_0_0_3px_rgba(255,255,255,0.09)]" />
          </div>
        </div>
      </div>
      {gradeLabels && gradeLabels.length > 1 && (
        <div
          className="mt-3 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${gradeLabels.length}, minmax(0, 1fr))` }}
        >
          {gradeLabels.map((label) => (
            <span key={label} className="text-center text-[11px] text-text-tertiary">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
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
    return {
      grade: typeof raw?.grade === "string" && raw.grade.trim() ? raw.grade : "C",
      percentile:
        typeof raw?.percentile === "number" && Number.isFinite(raw.percentile) ? raw.percentile : 50,
      title: typeof raw?.title === "string" && raw.title.trim() ? raw.title : "기본 결과 요약",
      description:
        typeof raw?.description === "string" && raw.description.trim()
          ? raw.description
          : "결과를 정리하는 중입니다.",
    };
  }, [result]);

  const safeScores = useMemo(
    () => normalizeScores((result as Partial<AnalysisResult>)?.scores),
    [result]
  );

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

  const gradeLabels = useMemo(() => {
    const fromApi = extractGradeLabelsFromResult(result);
    if (fromApi && fromApi.length > 0) {
      return fromApi;
    }

    const fromExistingCode = [...LEGACY_GRADE_ORDER];
    if (fromExistingCode.length > 0) {
      return fromExistingCode;
    }

    return null;
  }, [result]);

  const markerPercent = useMemo(() => {
    if (Number.isFinite(safeTier.percentile)) {
      return clamp(100 - safeTier.percentile, 0, 100);
    }
    if (gradeLabels && gradeLabels.length > 1) {
      const index = resolveGradeIndex(safeTier.grade, gradeLabels);
      if (index >= 0) {
        return (index / (gradeLabels.length - 1)) * 100;
      }
    }
    return 50;
  }, [safeTier.percentile, safeTier.grade, gradeLabels]);

  const gradeKey = useMemo(() => resolveLegacyGradeKey(safeTier.grade), [safeTier.grade]);
  const gradeStyle = LEGACY_GRADE_STYLES[gradeKey];

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`rounded-3xl p-6 md:p-8 border border-white/5 ${gradeStyle.background}`}>
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold ${badgeStyles[badgeLabel]}`}
            >
              {badgeLabel}
            </span>
            <span className="text-[12px] text-text-secondary">상위 {safeTier.percentile}%</span>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <div className={`text-5xl md:text-6xl font-bold ${gradeStyle.text}`}>{safeTier.grade}</div>
            <div className="text-title-3 text-text-primary">{safeTier.title}</div>
            <p className="text-body-2 text-text-secondary leading-relaxed">{safeTier.description}</p>
          </div>
          <DistributionGraph
            markerPercent={markerPercent}
            markerLabel={`${safeTier.grade} · 현재 위치`}
            gradeLabels={gradeLabels}
          />
        </div>

        <ScoreGrid scores={safeScores} />
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
