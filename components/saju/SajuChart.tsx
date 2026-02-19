"use client";

import { memo, useMemo } from "react";
import {
  computePillarDisplayData,
  getElementTextClass,
  getElementName,
  type SajuData,
  type ElementType,
} from "@/lib/utils/saju";

type SajuChartProps = {
  sajuData: SajuData;
};

const ELEMENT_HEX: Record<ElementType, string> = {
  wood: "#22C55E",
  fire: "#EF4444",
  earth: "#EAB308",
  metal: "#F5F5F5",
  water: "#3B82F6",
};

function getElementHex(element: ElementType | null): string {
  return element ? ELEMENT_HEX[element] : ELEMENT_HEX.metal;
}

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

/* ── Main SajuChart ── */
function SajuChartInner({ sajuData }: SajuChartProps) {
  const pillars = useMemo(
    () => computePillarDisplayData(sajuData),
    [sajuData]
  );

  return (
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
    </div>
  );
}

export const SajuChart = memo(SajuChartInner);
export default SajuChart;
