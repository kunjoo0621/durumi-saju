"use client";

import { memo, useMemo } from "react";
import {
  computePillarDisplayData,
  getElementTextClass,
  getElementName,
  type SajuData,
  type ElementType,
} from "@/lib/utils/saju";
import type {
  EnrichedSajuData,
  KoreanElement,
  ShinsalType,
  Pillar12ShinsalEntry,
} from "@/lib/utils/saju-enrichment";
import {
  ELEMENT_TO_HANJA,
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

const ELEMENT_HEX: Record<ElementType, string> = {
  wood: "#22C55E",
  fire: "#EF4444",
  earth: "#EAB308",
  metal: "#F5F5F5",
  water: "#3B82F6",
};

const KR_ELEMENT_HEX: Record<KoreanElement, string> = {
  목: "#22C55E",
  화: "#EF4444",
  토: "#EAB308",
  금: "#F5F5F5",
  수: "#3B82F6",
};

function getElementHex(element: ElementType | null): string {
  return element ? ELEMENT_HEX[element] : ELEMENT_HEX.metal;
}

const SHINSAL_TYPE_COLOR: Record<ShinsalType, string> = {
  good: "#22C55E",
  bad: "#EF4444",
  neutral: "#6B7280",
};

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

/* ── 섹션 라벨 스타일: text-xs text-gray-500 tracking-wider ── */
const SECTION_LABEL = "text-xs text-gray-500 tracking-wider";
/* ── 설명/보조 텍스트: text-sm text-gray-400 ── */
const SUB_TEXT = "text-sm text-gray-400";

/* ── Header Cell (생시/생일/생월/생년) ── */
const HeaderCell = memo(function HeaderCell({
  label,
  isDayStem,
}: {
  label: string;
  isDayStem: boolean;
}) {
  return (
    <div className="py-2 text-center">
      <span className={SECTION_LABEL}>
        {label}
      </span>
      {isDayStem && (
        <span className="ml-1 text-[10px] text-gray-600">(일간)</span>
      )}
    </div>
  );
});

/* ── Stem / Branch Cell (한자 + 오행 라벨) ── */
const CharCell = memo(function CharCell({
  label,
  element,
  isDayHighlight,
}: {
  label: string;
  element: ElementType | null;
  isDayHighlight: boolean;
}) {
  const textClass = getElementTextClass(element);
  const elementName = element ? getElementName(element) : null;
  const hex = getElementHex(element);

  return (
    <div
      className={`py-3 text-center rounded-xl ${
        isDayHighlight ? "bg-[#222222]" : "bg-[#1A1A1A]"
      }`}
      style={
        isDayHighlight
          ? { border: `1px solid ${hex}33` }
          : undefined
      }
    >
      <div
        className={`text-2xl font-bold ${textClass}`}
        style={
          isDayHighlight
            ? { textShadow: `0 0 12px ${hex}4D` }
            : undefined
        }
      >
        {label}
      </div>
      {elementName && (
        <div
          className={`text-xs mt-1 ${textClass}`}
          style={{ opacity: 0.75 }}
        >
          {elementName}
        </div>
      )}
    </div>
  );
});

/* ── TenGod Cell (십성) ── */
const TenGodCell = memo(function TenGodCell({ tenGod }: { tenGod: string | null }) {
  return (
    <div className="py-1.5 text-center">
      <span className="text-xs text-gray-500">
        {tenGod || "-"}
      </span>
    </div>
  );
});

/* ── 12운성 Cell ── */
const TwelveStageCell = memo(function TwelveStageCell({
  korean,
  strength,
}: {
  korean: string | null;
  strength?: "strong" | "neutral" | "weak";
}) {
  const color =
    strength === "strong"
      ? "text-green-400"
      : strength === "weak"
        ? "text-red-400"
        : "text-gray-400";
  return (
    <div className="py-1.5 text-center">
      <span className={`text-xs ${color}`}>{korean || "-"}</span>
    </div>
  );
});

/* ── 12신살 Cell ── */
const TwelveShinsalCell = memo(function TwelveShinsalCell({
  entry,
}: {
  entry: Pillar12ShinsalEntry | null;
}) {
  if (!entry) {
    return (
      <div className="py-1.5 text-center">
        <span className="text-xs text-gray-600">-</span>
      </div>
    );
  }
  const dotColor = SHINSAL_TYPE_COLOR[entry.type];
  return (
    <div className="py-1.5 text-center flex items-center justify-center gap-1">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      <span className="text-xs text-gray-400">{entry.name}</span>
    </div>
  );
});

/* ── 신강/신약 + 용신 + 오행밸런스 패널 ── */
const StrengthPanel = memo(function StrengthPanel({
  enriched,
}: {
  enriched: EnrichedSajuData;
}) {
  const { strength, yongshin, elementDist } = enriched;
  const d = strength.details;
  const isStrong = ["극왕", "태강", "신강", "중화신강"].includes(strength.result);
  const strengthDesc = STRENGTH_DESCRIPTIONS[strength.result] ?? "";

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
    <div className="mt-4 space-y-3">
      {/* 신강/신약 카드 */}
      <div className="bg-[#1A1A1A] rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className={SECTION_LABEL}>신강/신약</span>
          <div className="text-right">
            <span
              className={`text-lg font-bold ${isStrong ? "text-blue-400" : "text-orange-400"}`}
            >
              {strength.result}
            </span>
            {strengthDesc && (
              <p className={SUB_TEXT}>{strengthDesc}</p>
            )}
          </div>
        </div>
        <div className="flex justify-between mt-3">
          {deukItems.map((item) => (
            <div key={item.key} className="flex items-center gap-1">
              {item.value ? (
                <IconCircleCheckFilled size={14} style={{ color: "#FF6B6B" }} />
              ) : (
                <IconCircleXFilled size={14} style={{ color: "#4B5563" }} />
              )}
              <span className={SUB_TEXT}>
                {DEUK_LABELS[item.key]}
              </span>
              <span className={`${SUB_TEXT} opacity-60`}>
                {DEUK_HINTS[item.key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 용신 / 기신 카드 */}
      <div className="bg-[#1A1A1A] rounded-xl p-4">
        <div className="flex justify-between mb-0.5">
          <span className={SECTION_LABEL}>용신</span>
          <span className={SECTION_LABEL}>기신</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className={SUB_TEXT}>나에게 필요한 기운</span>
          <span className={SUB_TEXT}>피해야 할 기운</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span
            className="text-lg font-bold"
            style={{ color: KR_ELEMENT_HEX[yongshin.eokbu] }}
          >
            {yongshin.eokbu}({eokbuHanja})
          </span>
          <span
            className="text-lg font-bold"
            style={{ color: KR_ELEMENT_HEX[yongshin.gisin], opacity: 0.6 }}
          >
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
      </div>

      {/* 오행 분포 카드 */}
      <div className="bg-[#1A1A1A] rounded-xl p-4">
        <p className={`${SECTION_LABEL} mb-2`}>오행 분포</p>
        <div className="flex rounded-lg overflow-hidden h-4">
          {elements.map((el) => {
            const ratio = totalElement > 0 ? (elementDist[el] / totalElement) * 100 : 0;
            if (ratio === 0) return null;
            return (
              <div
                key={el}
                style={{
                  width: `${ratio}%`,
                  backgroundColor: KR_ELEMENT_HEX[el],
                  opacity: 0.8,
                }}
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
                <span
                  className="text-xs font-medium"
                  style={{ color: KR_ELEMENT_HEX[el] }}
                >
                  {el}
                </span>
                <span className="text-[10px] text-gray-500">
                  {count} ({totalElement > 0 ? Math.round((count / totalElement) * 100) : 0}%)
                </span>
                {isYongshin && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 rounded px-1.5 py-0.5 leading-none">
                    용신
                  </span>
                )}
                {isDeficient && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 rounded px-1.5 py-0.5 leading-none">
                    결핍
                  </span>
                )}
                {isGisin && !isDeficient && (
                  <span className="text-[10px] bg-gray-500/20 text-gray-400 rounded px-1.5 py-0.5 leading-none">
                    기신
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

/* ── pillar key → enriched data position 매핑 ── */
const PILLAR_KEY_TO_POS: Record<string, "year" | "month" | "day" | "hour"> = {
  hour: "hour",
  day: "day",
  month: "month",
  year: "year",
};

/* ── Main SajuChart ── */
function SajuChartInner({ sajuData, enriched }: SajuChartProps) {
  const pillars = useMemo(
    () => computePillarDisplayData(sajuData),
    [sajuData]
  );

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {/* Header row */}
        {pillars.map((p) => (
          <HeaderCell
            key={`h-${p.key}`}
            label={p.label}
            isDayStem={p.key === "day"}
          />
        ))}

        {/* Stem row */}
        {pillars.map((p) => (
          <CharCell
            key={`s-${p.key}`}
            label={p.stemLabel}
            element={p.stemElement}
            isDayHighlight={p.key === "day"}
          />
        ))}

        {/* Stem TenGod row */}
        {pillars.map((p) => (
          <TenGodCell key={`st-${p.key}`} tenGod={p.stemTenGod} />
        ))}

        {/* Branch row */}
        {pillars.map((p) => (
          <CharCell
            key={`b-${p.key}`}
            label={p.branchLabel}
            element={p.branchElement}
            isDayHighlight={false}
          />
        ))}

        {/* Branch TenGod row */}
        {pillars.map((p) => (
          <TenGodCell key={`bt-${p.key}`} tenGod={p.branchTenGod} />
        ))}

        {/* 12운성 row */}
        {enriched?.twelveStages && (
          <>
            <div className="col-span-4 mt-1">
              <span className={`${SECTION_LABEL} pl-1`}>12운성</span>
            </div>
            {pillars.map((p) => {
              const pos = PILLAR_KEY_TO_POS[p.key];
              const stage = enriched.twelveStages[pos];
              return (
                <TwelveStageCell
                  key={`ts-${p.key}`}
                  korean={stage?.korean ?? null}
                  strength={stage?.strength}
                />
              );
            })}
          </>
        )}

        {/* 12신살 row */}
        {enriched?.pillar12Shinsal && (
          <>
            <div className="col-span-4 mt-1">
              <span className={`${SECTION_LABEL} pl-1`}>12신살</span>
            </div>
            {pillars.map((p) => {
              const pos = PILLAR_KEY_TO_POS[p.key];
              const entry = enriched.pillar12Shinsal[pos];
              return (
                <TwelveShinsalCell
                  key={`ss-${p.key}`}
                  entry={entry}
                />
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
