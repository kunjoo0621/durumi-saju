"use client";

import { memo, useMemo } from "react";
import {
  computePillarDisplayData,
  getElementName,
  type SajuData,
  type ElementType,
} from "@/lib/utils/saju";
import type {
  EnrichedSajuData,
  KoreanElement,
  ShinsalType,
} from "@/lib/utils/saju-enrichment";
import {
  ELEMENT_TO_HANJA,
  GENERATES,
  CONTROLS,
  STRENGTH_DESCRIPTIONS,
} from "@/lib/utils/saju-enrichment";
import {
  IconCircleCheckFilled,
  IconCircleXFilled,
} from "@tabler/icons-react";

type SajuChartProps = {
  sajuData: SajuData;
  enriched?: EnrichedSajuData | null;
};

/* ── 오행색 매핑 ── */

const ELEMENT_HEX: Record<ElementType, string> = {
  wood: "#22C55E",
  fire: "#EF4444",
  earth: "#EAB308",
  metal: "#D1D5DB",
  water: "#3B82F6",
};

const KR_ELEMENT_HEX: Record<KoreanElement, string> = {
  목: "#22C55E",
  화: "#EF4444",
  토: "#EAB308",
  금: "#D1D5DB",
  수: "#3B82F6",
};

function getElementHex(element: ElementType | null): string {
  return element ? ELEMENT_HEX[element] : ELEMENT_HEX.metal;
}

/* ── 십성 → 오행 매핑 (일간 기준) ── */

const CONTROLLED_BY: Record<KoreanElement, KoreanElement> = {
  목: "금", 화: "수", 토: "목", 금: "화", 수: "토",
};
const GENERATED_BY: Record<KoreanElement, KoreanElement> = {
  목: "수", 화: "목", 토: "화", 금: "토", 수: "금",
};

function getTenGodElement(tenGod: string, dayEl: KoreanElement): KoreanElement {
  switch (tenGod) {
    case "비견": case "겁재": return dayEl;
    case "식신": case "상관": return GENERATES[dayEl];
    case "편재": case "정재": return CONTROLS[dayEl];
    case "편관": case "정관": return CONTROLLED_BY[dayEl];
    case "편인": case "정인": return GENERATED_BY[dayEl];
    default: return dayEl;
  }
}

function getTenGodHex(tenGod: string | null, dayEl: KoreanElement): string {
  if (!tenGod) return "#6B7280";
  return KR_ELEMENT_HEX[getTenGodElement(tenGod, dayEl)];
}

/* ── 공통 스타일 ── */

const SHINSAL_TYPE_COLOR: Record<ShinsalType, string> = {
  good: "#22C55E",
  bad: "#EF4444",
  neutral: "#6B7280",
};

const SECTION_LABEL = "text-xs text-gray-500 tracking-wider";
const SECTION_TITLE = "text-sm font-medium text-gray-400";
const SUB_TEXT = "text-sm text-gray-400";
const ROW_LABEL = "hidden sm:block text-xs text-[#9CA3AF] self-center";

const DEUK_HINTS: Record<string, string> = {
  deukryeong: "(계절)",
  deukji: "(자리)",
  deuksi: "(시간)",
  deukse: "(주변)",
};
const DEUK_LABELS: Record<string, string> = {
  deukryeong: "득령",
  deukji: "득지",
  deuksi: "득시",
  deukse: "득세",
};
const JOHU_DESCRIPTIONS: Record<string, string> = {
  "하절(여름) → 수(水)로 열기 조절": "여름생, 차가운 기운 보정",
  "동절(겨울) → 화(火)로 한기 보충": "겨울생, 따뜻한 기운 보정",
};

const PILLAR_KEY_TO_POS: Record<string, "year" | "month" | "day" | "hour"> = {
  hour: "hour", day: "day", month: "month", year: "year",
};

/* ── 신강/신약 스펙트럼 ── */

const STRENGTH_LEVELS = ["극약", "태약", "신약", "중화신약", "중화신강", "신강", "태강", "극왕"];
const STRENGTH_POS: Record<string, number> = {
  "극약": 0, "태약": 14.3, "신약": 28.6, "중화신약": 42.9,
  "중화신강": 57.1, "신강": 71.4, "태강": 85.7, "극왕": 100,
};
const STRENGTH_HEX: Record<string, string> = {
  "극약": "#3B82F6", "태약": "#4A7DD3", "신약": "#5878B2", "중화신약": "#647491",
  "중화신강": "#80717D", "신강": "#AA6F77", "태강": "#D56D71", "극왕": "#FF6B6B",
};
const SPECTRUM_GRADIENT = "linear-gradient(to right, #3B82F6, #6B7280 50%, #FF6B6B)";

/* ── 신강/신약 + 용신 + 오행 패널 ── */
const StrengthPanel = memo(function StrengthPanel({
  enriched,
}: {
  enriched: EnrichedSajuData;
}) {
  const { strength, yongshin, elementDist } = enriched;
  const d = strength.details;
  const strengthDesc = STRENGTH_DESCRIPTIONS[strength.result] ?? "";
  const spectrumPos = STRENGTH_POS[strength.result] ?? 50;
  const spectrumColor = STRENGTH_HEX[strength.result] ?? "#6B7280";
  const totalElement = Object.values(elementDist).reduce((a, b) => a + b, 0);
  const elements: KoreanElement[] = ["목", "화", "토", "금", "수"];

  const deukItems: { key: string; value: boolean }[] = [
    { key: "deukryeong", value: d.deukryeong },
    { key: "deukji", value: d.deukji },
    { key: "deuksi", value: d.deuksi },
    { key: "deukse", value: d.deukse },
  ];

  const eokbuHanja = ELEMENT_TO_HANJA[yongshin.eokbu];
  const gisinHanja = ELEMENT_TO_HANJA[yongshin.gisin];
  const heesinHanja = ELEMENT_TO_HANJA[yongshin.heesin];
  const johuDesc = yongshin.johuReason
    ? JOHU_DESCRIPTIONS[yongshin.johuReason] ?? yongshin.johuReason
    : null;

  return (
    <div>
      {/* divider: 원국 테이블 ↔ 신강 */}
      <div className="h-px bg-[#222222] my-5" />

      {/* 신강/신약 분석 */}
      <p className={SECTION_TITLE}>신강/신약 분석</p>

      {/* Desktop: 8단계 라벨 */}
      <div className="hidden sm:flex justify-between mt-3 mb-1.5">
        {STRENGTH_LEVELS.map((level) => {
          const isCurrent = level === strength.result;
          return (
            <span
              key={level}
              className={isCurrent ? "text-xs font-bold text-center" : "text-[10px] text-gray-600 text-center"}
              style={isCurrent ? { color: spectrumColor } : undefined}
            >
              {level.length > 3 ? (
                <>
                  <span className="block leading-tight">{level.slice(0, 2)}</span>
                  <span className="block leading-tight">{level.slice(2)}</span>
                </>
              ) : level}
            </span>
          );
        })}
      </div>

      {/* Desktop: 스펙트럼 바 */}
      <div className="hidden sm:block relative h-1.5 rounded-full" style={{ background: SPECTRUM_GRADIENT }}>
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white"
          style={{ left: `${spectrumPos}%`, backgroundColor: spectrumColor }}
        />
      </div>

      {/* Mobile: 극약 [바] 극왕 */}
      <div className="sm:hidden mt-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600 shrink-0">극약</span>
          <div className="relative flex-1 h-1.5 rounded-full" style={{ background: SPECTRUM_GRADIENT }}>
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white"
              style={{ left: `${spectrumPos}%`, backgroundColor: spectrumColor }}
            />
          </div>
          <span className="text-[10px] text-gray-600 shrink-0">극왕</span>
        </div>
      </div>

      {/* 결과 + 설명 */}
      <p className="text-center mt-2.5">
        <span className="text-sm font-bold" style={{ color: spectrumColor }}>{strength.result}</span>
        {strengthDesc && <span className="text-sm text-gray-400"> · {strengthDesc}</span>}
      </p>

      {/* 득령/득지/득시/득세 */}
      <div className="flex justify-between mt-3">
        {deukItems.map((item) => (
          <div key={item.key} className="flex items-center gap-1">
            {item.value ? (
              <IconCircleCheckFilled size={14} style={{ color: "#FF6B6B" }} />
            ) : (
              <IconCircleXFilled size={14} style={{ color: "#4B5563" }} />
            )}
            <span className={SUB_TEXT}>{DEUK_LABELS[item.key]}</span>
            <span className={`${SUB_TEXT} opacity-60`}>{DEUK_HINTS[item.key]}</span>
          </div>
        ))}
      </div>

      {/* divider: 신강 ↔ 용신 */}
      <div className="h-px bg-[#222222] my-5" />

      {/* 용신 / 기신 */}
      <div className="flex justify-between mb-0.5">
        <span className={SECTION_TITLE}>용신</span>
        <span className={SECTION_TITLE}>기신</span>
      </div>
      <div className="flex justify-between mb-1">
        <span className={SUB_TEXT}>나에게 필요한 기운</span>
        <span className={SUB_TEXT}>피해야 할 기운</span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-lg font-bold" style={{ color: KR_ELEMENT_HEX[yongshin.eokbu] }}>
          {yongshin.eokbu}({eokbuHanja})
        </span>
        <span className="text-lg font-bold" style={{ color: KR_ELEMENT_HEX[yongshin.gisin], opacity: 0.6 }}>
          {yongshin.gisin}({gisinHanja})
        </span>
      </div>
      <div className="mt-2 space-y-0.5">
        <p className={SUB_TEXT}>
          희신:{" "}
          <span style={{ color: KR_ELEMENT_HEX[yongshin.heesin] }}>
            {yongshin.heesin}({heesinHanja})
          </span>
          {" "}&mdash; 용신을 돕는 기운
        </p>
        {yongshin.johu && johuDesc && (
          <p className={SUB_TEXT}>
            조후:{" "}
            <span style={{ color: KR_ELEMENT_HEX[yongshin.johu] }}>
              {yongshin.johu}({ELEMENT_TO_HANJA[yongshin.johu]})
            </span>
            {" "}&mdash; {johuDesc}
          </p>
        )}
      </div>

      {/* divider: 용신 ↔ 오행 */}
      <div className="h-px bg-[#222222] my-5" />

      {/* 오행 분포 */}
      <p className={`${SECTION_TITLE} mb-2`}>오행 분포</p>
      <div className="flex rounded-lg overflow-hidden h-4">
        {elements.map((el) => {
          const ratio = totalElement > 0 ? (elementDist[el] / totalElement) * 100 : 0;
          if (ratio === 0) return null;
          return (
            <div
              key={el}
              style={{ width: `${ratio}%`, backgroundColor: KR_ELEMENT_HEX[el], opacity: 0.8 }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        {elements.map((el) => {
          const count = elementDist[el];
          const isYongshin = el === yongshin.eokbu;
          const isGisin = el === yongshin.gisin;
          const isDeficient = count === 0;
          return (
            <div key={el} className="flex items-center gap-1">
              <span className="text-xs font-medium" style={{ color: KR_ELEMENT_HEX[el] }}>
                {el}
              </span>
              <span className="text-[10px] text-gray-500">
                {count} ({totalElement > 0 ? Math.round((count / totalElement) * 100) : 0}%)
              </span>
              {isYongshin && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 rounded px-1.5 py-0.5 leading-none">용신</span>
              )}
              {isDeficient && (
                <span className="text-[10px] bg-red-500/20 text-red-400 rounded px-1.5 py-0.5 leading-none">결핍</span>
              )}
              {isGisin && !isDeficient && (
                <span className="text-[10px] bg-gray-500/20 text-gray-400 rounded px-1.5 py-0.5 leading-none">기신</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ── Main SajuChart ── */
function SajuChartInner({ sajuData, enriched }: SajuChartProps) {
  const pillars = useMemo(() => computePillarDisplayData(sajuData), [sajuData]);
  const dayEl = enriched?.dayMaster.element ?? "목";

  return (
    <div>
      {/* 그리드: 모바일 4열 / sm+ 5열(라벨포함) */}
      <div
        className="grid gap-x-2 gap-y-0 grid-cols-4 sm:grid-cols-[2.5rem_1fr_1fr_1fr_1fr]"
      >
        {/* ── Row: Header ── */}
        <div className="hidden sm:block" />
        {pillars.map((p) => (
          <div key={`h-${p.key}`} className="py-2 text-center">
            <span className={SECTION_LABEL}>
              {p.key === "day" ? "일주" : p.label}
            </span>
            {p.key === "day" && (
              <span className="ml-0.5 text-[10px] text-gray-600">(나)</span>
            )}
          </div>
        ))}

        {/* ── Row: 천간 (label + cards) ── */}
        <div className={ROW_LABEL}>천간</div>
        {pillars.map((p) => {
          const hex = getElementHex(p.stemElement);
          const isDayCol = p.key === "day";
          return (
            <div
              key={`s-${p.key}`}
              className={`py-2.5 text-center rounded-xl ${isDayCol ? "bg-[#222222]" : "bg-[#1A1A1A]"}`}
              style={isDayCol ? { border: `1px solid ${hex}33` } : undefined}
            >
              <div
                className="text-xl font-bold text-[#E5E5E5]"
                style={isDayCol ? { textShadow: `0 0 12px ${hex}4D` } : undefined}
              >
                {p.stemLabel}
              </div>
              <div className="text-xs mt-0.5" style={{ color: getElementHex(p.stemElement) }}>
                {p.stemElement ? getElementName(p.stemElement) : ""}
              </div>
            </div>
          );
        })}

        {/* ── Row: 천간 십성 ── */}
        <div className="hidden sm:block" />
        {pillars.map((p) => (
          <div key={`st-${p.key}`} className="py-1 text-center">
            <span className="text-xs" style={{ color: getTenGodHex(p.stemTenGod, dayEl) }}>
              {p.stemTenGod || "-"}
            </span>
          </div>
        ))}

        {/* ── Row: 지지 (label + cards) ── */}
        <div className={ROW_LABEL}>지지</div>
        {pillars.map((p) => (
          <div key={`b-${p.key}`} className="py-2.5 text-center rounded-xl bg-[#1A1A1A]">
            <div className="text-xl font-bold text-[#E5E5E5]">
              {p.branchLabel}
            </div>
            <div className="text-xs mt-0.5" style={{ color: getElementHex(p.branchElement) }}>
              {p.branchElement ? getElementName(p.branchElement) : ""}
            </div>
          </div>
        ))}

        {/* ── Row: 지지 십성 ── */}
        <div className="hidden sm:block" />
        {pillars.map((p) => (
          <div key={`bt-${p.key}`} className="py-1 text-center">
            <span className="text-xs" style={{ color: getTenGodHex(p.branchTenGod, dayEl) }}>
              {p.branchTenGod || "-"}
            </span>
          </div>
        ))}

        {/* ── Row: 12운성 ── */}
        {enriched?.twelveStages && (
          <>
            <div className={ROW_LABEL}>12운성</div>
            {pillars.map((p) => {
              const pos = PILLAR_KEY_TO_POS[p.key];
              const stage = enriched.twelveStages[pos];
              const color =
                stage?.strength === "strong"
                  ? "text-green-400"
                  : stage?.strength === "weak"
                    ? "text-red-400"
                    : "text-gray-400";
              return (
                <div key={`ts-${p.key}`} className="py-1 text-center">
                  <span className={`text-xs ${color}`}>{stage?.korean ?? "-"}</span>
                </div>
              );
            })}
          </>
        )}

        {/* ── Row: 12신살 ── */}
        {enriched?.pillar12Shinsal && (
          <>
            <div className={ROW_LABEL}>12신살</div>
            {pillars.map((p) => {
              const pos = PILLAR_KEY_TO_POS[p.key];
              const entry = enriched.pillar12Shinsal[pos];
              if (!entry) {
                return (
                  <div key={`ss-${p.key}`} className="py-1 text-center">
                    <span className="text-xs text-gray-600">-</span>
                  </div>
                );
              }
              const dotColor = SHINSAL_TYPE_COLOR[entry.type];
              return (
                <div key={`ss-${p.key}`} className="py-1 text-center flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                  <span className="text-xs text-gray-400">{entry.name}</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* 신강/용신/오행밸런스 패널 */}
      {enriched && <StrengthPanel enriched={enriched} />}
    </div>
  );
}

export const SajuChart = memo(SajuChartInner);
export default SajuChart;
