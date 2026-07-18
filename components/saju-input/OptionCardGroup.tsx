"use client";

/* 선택형 질문 옵션 카드 그룹 (SajuInputFlow에서 순수 추출)
 * 개인사주 입력의 select 스텝(연애·현재상태·핵심이슈)과
 * 결혼운/재물운/펫의 서비스 고유질문을 픽셀 단위로 동일하게 렌더하기 위한 공유 자산.
 *
 * ⚠️ 마크업/클래스는 SajuInputFlow의 기존 select case와 100% 동일해야 함(회귀 금지).
 *  - wrapper: <div className="space-y-3" role="radiogroup" aria-label={name}>
 *  - card:    btn-option ... 선택 시 btn-option--selected shadow-[...] + ✓ prefix
 *  - hint(선택): label 아래 부가설명. 없으면 미표시(기존 3개 select와 DOM 동일).
 */
type Option = {
  value: string;
  label: string;
  hint?: string;
};

type OptionCardGroupProps = {
  options: Option[];
  selected: string | null;
  onSelect: (value: string) => void;
  name?: string;
};

export default function OptionCardGroup({
  options,
  selected,
  onSelect,
  name,
}: OptionCardGroupProps) {
  return (
    <div className="space-y-3" role="radiogroup" aria-label={name}>
      {options.map((option) => {
        const isSelected = selected === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={`btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
              isSelected
                ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]"
                : ""
            }`}
            role="radio"
            aria-checked={isSelected}
          >
            {isSelected && <span className="mr-2" aria-hidden="true">✓</span>}
            {option.label}
            {option.hint && (
              <span className="block mt-1 text-[12px] font-normal text-text-secondary">
                {option.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
