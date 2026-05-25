// 내 사주 5분야 강도 — 사주 마스터 점수 (재물·연애·직장·건강·대인) 가로 막대.
// today에서는 일생 단위 사주 정보를 풀이 컨텍스트로 함께 노출.

const CATEGORY_LABELS: Record<string, string> = {
  재물운: "재물",
  연애운: "연애",
  직장운: "직장",
  건강운: "건강",
  대인운: "대인",
};

const CATEGORY_ORDER = ["재물운", "연애운", "직장운", "건강운", "대인운"] as const;

export default function ScoresBar({ scores }: { scores: Record<string, number> }) {
  return (
    <section className="rounded-2xl bg-background-secondary border border-white/5 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-[11px] font-semibold tracking-[0.05em] text-text-tertiary">
          내 사주 5분야 강도
        </div>
        <div className="text-[12px] text-text-tertiary">
          일생 단위 (오늘과 무관)
        </div>
      </div>
      <div className="space-y-3">
        {CATEGORY_ORDER.map((key) => {
          const score = scores[key] ?? 0;
          const pct = Math.max(0, Math.min(100, score));
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-9 text-[12px] text-text-secondary shrink-0">
                {CATEGORY_LABELS[key]}
              </div>
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/70 rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="w-8 text-right text-[11px] font-semibold text-text-primary tabular-nums">
                {score}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
