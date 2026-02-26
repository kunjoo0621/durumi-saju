"use client";

/**
 * Placeholder: enriched saju data is not yet included in full_result.
 * Will be replaced with full SajuChart once analyze API stores enriched data.
 */
export default function BattleSajuCompare({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <div className="rounded-2xl bg-background-secondary p-5">
      <h3 className="text-[15px] font-semibold text-text-primary mb-3">사주 원국 비교</h3>
      <div className="space-y-2">
        <div className="rounded-xl bg-background-primary px-4 py-3 text-[14px] text-text-secondary">
          {nameA}의 사주 원국
          <span className="text-text-tertiary ml-2 text-[12px]">준비 중</span>
        </div>
        <div className="rounded-xl bg-background-primary px-4 py-3 text-[14px] text-text-secondary">
          {nameB}의 사주 원국
          <span className="text-text-tertiary ml-2 text-[12px]">준비 중</span>
        </div>
      </div>
    </div>
  );
}
