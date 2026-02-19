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

// 개별 셀 컴포넌트 - 메모이즈
const LabelCell = memo(function LabelCell({ label }: { label: string }) {
  return (
    <div className="px-4 py-3 text-center text-[14px] text-text-tertiary bg-[#1A1A1A] rounded-xl">
      {label}
    </div>
  );
});

const StemCell = memo(function StemCell({
  stemLabel,
  element,
}: {
  stemLabel: string;
  element: ElementType | null;
}) {
  const textClass = getElementTextClass(element);
  const elementName = element ? getElementName(element) : null;

  return (
    <div className="px-2 py-3 text-center rounded-xl bg-[#1A1A1A]">
      <div className={`text-[28px] font-semibold ${textClass}`}>{stemLabel}</div>
      {elementName && (
        <div className="text-[12px] text-text-tertiary mt-1">{elementName}</div>
      )}
    </div>
  );
});

const TenGodCell = memo(function TenGodCell({ tenGod }: { tenGod: string | null }) {
  return (
    <div className="px-4 py-3 text-center text-[14px] text-text-secondary bg-[#1A1A1A] rounded-xl">
      {tenGod || "-"}
    </div>
  );
});

const BranchCell = memo(function BranchCell({
  branchLabel,
  element,
}: {
  branchLabel: string;
  element: ElementType | null;
}) {
  const textClass = getElementTextClass(element);
  const elementName = element ? getElementName(element) : null;

  return (
    <div className="px-2 py-3 text-center rounded-xl bg-[#1A1A1A]">
      <div className={`text-[28px] font-semibold ${textClass}`}>{branchLabel}</div>
      {elementName && (
        <div className="text-[12px] text-text-tertiary mt-1">{elementName}</div>
      )}
    </div>
  );
});

// 메인 SajuChart 컴포넌트 - 메모이즈
function SajuChartInner({ sajuData }: SajuChartProps) {
  // 모든 표시 데이터를 한번에 계산
  const pillars = useMemo(
    () => computePillarDisplayData(sajuData),
    [sajuData]
  );

  return (
    <div className="grid grid-cols-4 gap-1">
      {/* 라벨 행 */}
      {pillars.map((p) => (
        <LabelCell key={`label-${p.key}`} label={p.label} />
      ))}

      {/* 천간 행 */}
      {pillars.map((p) => (
        <StemCell
          key={`stem-${p.key}`}
          stemLabel={p.stemLabel}
          element={p.stemElement}
        />
      ))}

      {/* 천간 십성 행 */}
      {pillars.map((p) => (
        <TenGodCell key={`stem-ten-${p.key}`} tenGod={p.stemTenGod} />
      ))}

      {/* 지지 행 */}
      {pillars.map((p) => (
        <BranchCell
          key={`branch-${p.key}`}
          branchLabel={p.branchLabel}
          element={p.branchElement}
        />
      ))}

      {/* 지지 십성 행 */}
      {pillars.map((p) => (
        <TenGodCell key={`branch-ten-${p.key}`} tenGod={p.branchTenGod} />
      ))}
    </div>
  );
}

export const SajuChart = memo(SajuChartInner);
export default SajuChart;
