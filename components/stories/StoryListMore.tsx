"use client";

import { Children, useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

const STEP = 10;

/**
 * 서버에서 렌더한 StoryCard들을 children으로 받아, 처음 10개만 보여주고
 * "더보기"로 10개씩 펼친다. StoryCard를 클라 번들로 끌어오지 않으려고
 * 카드 자체는 부모(서버 컴포넌트)에서 렌더해 children으로 주입.
 */
export default function StoryListMore({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const [count, setCount] = useState(STEP);
  const remaining = items.length - count;

  return (
    <div>
      <div className="divide-y divide-white/[0.07]">{items.slice(0, count)}</div>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setCount((c) => c + STEP)}
          className="mt-4 w-full inline-flex items-center justify-center gap-1.5 py-3.5 min-h-[44px] text-[14px] text-text-secondary bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.1] rounded-2xl transition-colors"
        >
          더보기
          <span className="text-text-tertiary text-[12.5px]">
            남은 {remaining}편
          </span>
          <CaretDown size={13} weight="bold" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
