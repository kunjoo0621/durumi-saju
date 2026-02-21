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
      <span className="text-xs font-medium text-gray-500">
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
  const { strength, yongshin, elementDist, dayMaster } = enriched;
  const d = strength.details;
  const isStrong = ["극왕", "태강", "신강", "중화신강"].includes(strength.result);

  const totalElement = Object.values(elementDist).reduce((a, b) => a + b, 0);
  const elements: KoreanElement[] = ["목", "화", "토", "금", "수"];

  return (
    <div className="mt-4 space-y-3">
      {/* 신강/신약 */}
      <div className="bg-[#1A1A1A] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">신강/신약</span>
          <span
            className={`text-sm font-bold ${isStrong ? "text-blue-400" : "text-orange-400"}`}
          >
            {strength.result}
          </span>
        </div>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>
            득령{d.deukryeong ? "✅" : "❌"}
          </span>
          <span>
            득지{d.deukji ? "✅" : "❌"}
          </span>
          <span>
            득시{d.deuksi ? "✅" : "❌"}
          </span>
          <span>
            득세{d.deukse ? "✅" : "❌"}
          </span>
        </div>
        <div className="text-xs text-gray-600 mt-1">
          도움 {strength.helpCount} vs 억제 {strength.resistCount}
        </div>
      </div>

      {/* 용신 */}
      <div className="bg-[#1A1A1A] rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-400">용신</span>
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-bold"
              style={{ color: KR_ELEMENT_HEX[yongshin.eokbu] }}
            >
              {yongshin.eokbu}({yongshin.eokbu === dayMaster.element ? "비겁" : "억부"})
            </span>
            {yongshin.johu && (
              <>
                <span className="text-gray-600">/</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: KR_ELEMENT_HEX[yongshin.johu] }}
                >
                  {yongshin.johu}(조후)
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs mt-1">
          <span className="text-gray-500">
            기신:{" "}
            <span style={{ color: KR_ELEMENT_HEX[yongshin.gisin] }}>
              {yongshin.gisin}
            </span>
          </span>
          <span className="text-gray-500">
            희신:{" "}
            <span style={{ color: KR_ELEMENT_HEX[yongshin.heesin] }}>
              {yongshin.heesin}
            </span>
          </span>
        </div>
      </div>

      {/* 오행 밸런스 바 */}
      <div className="bg-[#1A1A1A] rounded-xl p-4">
        <p className="text-sm text-gray-400 mb-2">오행 분포</p>
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
          {elements.map((el) => (
            <div key={el} className="text-center">
              <span
                className="text-xs font-medium"
                style={{ color: KR_ELEMENT_HEX[el] }}
              >
                {el}
              </span>
              <span className="text-[10px] text-gray-500 ml-0.5">
                {elementDist[el]}
              </span>
            </div>
          ))}
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
              <span className="text-[10px] text-gray-600 pl-1">12운성</span>
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
              <span className="text-[10px] text-gray-600 pl-1">12신살</span>
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
