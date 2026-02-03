"use client";

import { memo } from "react";

type ScoreGridProps = {
  scores: Record<string, { score: number; grade: string }>;
};

// 개별 스코어 카드 - 메모이즈
const ScoreCard = memo(function ScoreCard({
  category,
  score,
  grade,
}: {
  category: string;
  score: number;
  grade: string;
}) {
  return (
    <div className="rounded-2xl bg-background-primary/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-body-2 text-text-primary font-semibold">{category}</span>
        <span className="text-[13px] font-semibold text-text-tertiary">{score}점</span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[24px] font-bold text-primary">{grade}</span>
        <span className="text-[12px] text-text-secondary">등급</span>
      </div>
      <div
        className="relative w-full overflow-hidden h-[8px] bg-background-tertiary rounded-full"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${category} ${score}점`}
      >
        <div
          className="absolute top-0 left-0 h-full bg-primary transition-all duration-700 ease-out rounded-full"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
});

function ScoreGridInner({ scores }: ScoreGridProps) {
  return (
    <div className="bg-background-secondary rounded-3xl p-6 md:p-8 border-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.entries(scores).map(([category, data]) => (
          <ScoreCard
            key={category}
            category={category}
            score={data.score}
            grade={data.grade}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(ScoreGridInner);
