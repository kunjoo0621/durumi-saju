// 오늘 강도 게이지 — weather/mood 4단계 시각화 (위기·주의·보통·강세).
// 데이터: result.todayMeta.mood (서버 확정값).

type Mood = "강세" | "보통" | "주의" | "위기";

const MOOD_ORDER: Mood[] = ["위기", "주의", "보통", "강세"];

const MOOD_STYLE: Record<Mood, { activeColor: string; activeBg: string }> = {
  위기: { activeColor: "text-saju-fire-muted", activeBg: "bg-saju-fire/15" },
  주의: { activeColor: "text-saju-earth-muted", activeBg: "bg-saju-earth/15" },
  보통: { activeColor: "text-text-secondary", activeBg: "bg-white/8" },
  강세: { activeColor: "text-saju-wood-muted", activeBg: "bg-saju-wood/15" },
};

export default function MoodGauge({ mood }: { mood: Mood }) {
  // mood가 expected union 밖 값일 때 (server decideMood 변경 사고 등) "보통" fallback — 빈 UI 방지.
  const safeMood: Mood = MOOD_ORDER.includes(mood) ? mood : "보통";
  const activeIndex = MOOD_ORDER.indexOf(safeMood);

  return (
    <section className="rounded-2xl bg-background-secondary border border-white/5 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[11px] font-semibold tracking-[0.05em] text-text-tertiary">
          오늘 강도
        </div>
        <div className="text-[12px] text-text-tertiary">
          일진 × 너의 사주 매칭
        </div>
      </div>
      <div className="flex gap-1.5">
        {MOOD_ORDER.map((m, i) => {
          const isActive = i === activeIndex;
          const style = MOOD_STYLE[m];
          return (
            <div
              key={m}
              className={`flex-1 rounded-lg h-14 flex items-center justify-center transition-colors ${
                isActive
                  ? `${style.activeBg} ring-1 ring-inset ring-white/10`
                  : "bg-background-tertiary"
              }`}
            >
              <span
                className={`text-[13px] font-semibold ${
                  isActive ? style.activeColor : "text-text-tertiary"
                }`}
              >
                {m}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
