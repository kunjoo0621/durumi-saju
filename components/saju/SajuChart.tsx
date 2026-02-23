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
  getStrengthFeedback,
  getYongshinFeedback,
  getOhaengFeedback,
} from "@/lib/utils/saju-enrichment";
import { CheckCircle, XCircle, ChatCircleDots } from "@phosphor-icons/react";

type SajuChartProps = {
  sajuData: SajuData;
  enriched?: EnrichedSajuData | null;
  hideStrengthPanel?: boolean;
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
const SECTION_TITLE = "text-base font-semibold text-gray-300";
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

const PILLAR_KEY_TO_POS: Record<string, "year" | "month" | "day" | "hour"> = {
  hour: "hour", day: "day", month: "month", year: "year",
};

/* ── 한줄평 컴포넌트 ── */
function SajuFeedback({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="bg-[rgba(255,107,107,0.08)] rounded-xl px-4 py-3 mt-6 flex items-start gap-2">
      <ChatCircleDots weight="fill" size={16} color="#FF6B6B" className="mt-0.5 shrink-0" />
      <p className="text-sm text-gray-300">{text}</p>
    </div>
  );
}

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

  return (
    <div>
      {/* divider: 원국 테이블 ↔ 오행 */}
      <div className="h-px bg-[#222222] my-8" />

      {/* 오행 분포 */}
      <p className={`${SECTION_TITLE} mb-6`}>오행 분포</p>
      {(() => {
        const BAR_HEX: Record<KoreanElement, string> = { 목: "#22C55E", 화: "#EF4444", 토: "#EAB308", 금: "#A0A0A0", 수: "#3B82F6" };

        const sorted = [...elements]
          .map((el) => ({ el, count: elementDist[el] }))
          .sort((a, b) => b.count - a.count);
        const maxCount = Math.max(...sorted.map((s) => s.count), 1);

        const getTag = (el: KoreanElement) => {
          if (elementDist[el] === 0) return { label: "결핍", cls: "bg-red-500/20 text-red-400" };
          if (el === yongshin.eokbu) return { label: "용신", cls: "bg-amber-500/20 text-amber-400" };
          if (el === yongshin.gisin) return { label: "기신", cls: "bg-gray-500/20 text-gray-400" };
          return null;
        };

        return (
          <div className="flex items-end justify-center gap-4 sm:gap-6">
            {sorted.map((s) => {
              const isDeficient = s.count === 0;
              const barHeight = isDeficient ? 0 : Math.max(Math.round((s.count / maxCount) * 100), 24);
              const tag = getTag(s.el);
              return (
                <div key={s.el} className="flex flex-col items-center" style={{ width: 48 }}>
                  {/* 바 컨테이너 — 고정 높이, 아래 정렬 */}
                  <div className="h-[100px] flex items-end mb-2">
                    {isDeficient ? (
                      <div className="w-12 h-6 border border-dashed border-gray-600 rounded-md" />
                    ) : (
                      <div
                        className={`w-12 rounded-md${s.el === yongshin.eokbu ? " border-2 border-amber-400" : ""}`}
                        style={{
                          height: `${barHeight}px`,
                          backgroundColor: BAR_HEX[s.el],
                          opacity: s.el === yongshin.gisin ? 0.5 : 1,
                        }}
                      />
                    )}
                  </div>
                  {/* 오행명 */}
                  <span className="text-xs font-medium" style={{ color: BAR_HEX[s.el] }}>
                    {s.el}
                  </span>
                  {/* 개수 */}
                  <span className="text-base font-bold text-white mt-0.5">{s.count}</span>
                  {/* 태그 — 고정 높이로 정렬 유지 */}
                  <div className="h-6 flex items-center mt-1">
                    {tag && (
                      <span className={`text-[11px] ${tag.cls} px-1.5 py-0.5 rounded`}>
                        {tag.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <SajuFeedback text={getOhaengFeedback(elementDist)} />

      {/* divider: 오행 ↔ 신강 */}
      <div className="h-px bg-[#222222] my-8" />

      {/* 신강/신약 분석 */}
      <p className={`${SECTION_TITLE} mb-6`}>신강/신약 분석</p>

      {/* Desktop: 8단계 라벨 + 바 */}
      <div className="hidden sm:block">
        <div className="flex justify-between mb-1.5">
          {STRENGTH_LEVELS.map((level) => {
            const isCurrent = level === strength.result;
            return (
              <span
                key={level}
                className={isCurrent ? "text-xs font-bold whitespace-nowrap" : "text-[11px] text-gray-600 whitespace-nowrap"}
                style={isCurrent ? { color: spectrumColor } : undefined}
              >
                {level}
              </span>
            );
          })}
        </div>
        <div className="relative h-1.5 rounded-full" style={{ background: SPECTRUM_GRADIENT }}>
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white"
            style={{ left: `${spectrumPos}%`, backgroundColor: spectrumColor }}
          />
        </div>
      </div>

      {/* Mobile: 극약 [바] 극왕 */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-600 shrink-0">극약</span>
          <div className="relative flex-1 h-1.5 rounded-full" style={{ background: SPECTRUM_GRADIENT }}>
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white"
              style={{ left: `${spectrumPos}%`, backgroundColor: spectrumColor }}
            />
          </div>
          <span className="text-[11px] text-gray-600 shrink-0">극왕</span>
        </div>
      </div>

      {/* 결과 + 설명 */}
      <p className="text-center mt-2.5">
        <span className="text-sm font-bold" style={{ color: spectrumColor }}>{strength.result}</span>
        {strengthDesc && <span className="text-sm text-gray-400"> · {strengthDesc}</span>}
      </p>

      {/* 득령/득지/득시/득세 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        {deukItems.map((item) => (
          <div key={item.key} className="flex items-center gap-1 whitespace-nowrap">
            {item.value ? (
              <CheckCircle weight="fill" size={14} color="#FF6B6B" />
            ) : (
              <XCircle weight="fill" size={14} color="#4B5563" />
            )}
            <span className={SUB_TEXT}>{DEUK_LABELS[item.key]}</span>
            <span className={`${SUB_TEXT} opacity-60`}>{DEUK_HINTS[item.key]}</span>
          </div>
        ))}
      </div>

      <SajuFeedback text={getStrengthFeedback(strength.result, d.deukse)} />

      {/* divider: 신강 ↔ 용신 */}
      <div className="h-px bg-[#222222] my-8" />

      {/* 용신 / 기신 2열 카드 */}
      <p className={`${SECTION_TITLE} mb-6`}>용신 분석</p>
      <div className="grid grid-cols-2 gap-3">
        {/* 용신 카드 */}
        <div className="bg-[#1A1A1A] rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-3">나에게 필요한 기운</p>
          <p className="text-2xl font-bold text-center my-2" style={{ color: KR_ELEMENT_HEX[yongshin.eokbu] }}>
            {yongshin.eokbu}({eokbuHanja})
          </p>
          <p className={`${SUB_TEXT} mt-3`}>
            희신:{" "}
            <span style={{ color: KR_ELEMENT_HEX[yongshin.heesin] }}>
              {yongshin.heesin}({heesinHanja})
            </span>
            {" "}&mdash; 용신을 돕는 기운
          </p>
        </div>
        {/* 기신 카드 */}
        <div className="bg-[#1A1A1A] rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-3">피해야 할 기운</p>
          <p className="text-2xl font-bold text-center my-2" style={{ color: KR_ELEMENT_HEX[yongshin.gisin], opacity: 0.6 }}>
            {yongshin.gisin}({gisinHanja})
          </p>
          <p className="text-sm text-gray-500 mt-3">이 기운이 강한 시기 주의</p>
        </div>
      </div>

      <SajuFeedback text={getYongshinFeedback(yongshin.eokbu)} />
    </div>
  );
});

/* ── Main SajuChart ── */
function SajuChartInner({ sajuData, enriched, hideStrengthPanel }: SajuChartProps) {
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
              <span className="ml-0.5 text-[11px] text-gray-600">(나)</span>
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
      {!hideStrengthPanel && enriched && <StrengthPanel enriched={enriched} />}
    </div>
  );
}

export { StrengthPanel };
export const SajuChart = memo(SajuChartInner);
export default SajuChart;
