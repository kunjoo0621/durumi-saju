"use client";

const VALUE_PROPS = [
  "전체 등급 + 재물/연애/직장/건강/대인 5개 따로",
  "8개 섹션으로 길게 풀어줌",
  "로그인하면 저장돼. 언제든 다시 볼 수 있음",
];

export default function LandingHero() {
  return (
    <section className="max-w-[640px] mx-auto pt-12 space-y-6 relative z-10">
      <p className="text-[14px] text-white/75">3분 질문으로</p>

      <div className="space-y-4">
        <h2 className="text-[46px] leading-[1.06] font-aggro text-white tracking-[-0.02em]">
          좋은 말만 안 해.
        </h2>
        <p className="text-[16px] leading-relaxed text-white/80">
          등급부터 보여주고, 근거→해석→2주 행동팁까지 한 번에 정리해줌.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[14px] text-white/90">
          달달한 위로 대신, 구조부터 보여줌.
        </p>
        <p className="text-[14px] text-white/75">
          결론만 던지고 안 도망감. 근거까지 같이 보여줌.
        </p>
      </div>

      <div className="space-y-2">
        {VALUE_PROPS.map((item) => (
          <div
            key={item}
            className="rounded-full border border-white/18 bg-white/10 px-4 py-2 text-[12px] text-white/90 backdrop-blur-sm"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
