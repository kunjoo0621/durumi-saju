"use client";

export default function LandingObjectPlaceholder() {
  return (
    <section className="relative z-10 mt-8 pb-6">
      <div className="mx-auto w-full aspect-[9/10] relative">
        <div className="absolute inset-[-8%] rounded-[52%_48%_58%_42%/44%_40%_60%_56%] bg-gradient-to-b from-fuchsia-200/35 via-violet-200/22 to-cyan-200/15 blur-3xl" />

        <div className="absolute inset-[6%] rounded-[2.2rem] border border-white/20 bg-white/[0.09] backdrop-blur-sm shadow-[0_20px_70px_rgba(0,0,0,0.45)] overflow-hidden">
          {/* 여기에 이미지 삽입 */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.25),transparent_48%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_84%,rgba(125,211,252,0.2),transparent_42%)]" />

          <div className="absolute left-[16%] top-[18%] h-16 w-16 rounded-full border border-white/30" />
          <div className="absolute right-[18%] top-[30%] h-3 w-3 rounded-full bg-white/80" />
          <div className="absolute left-[24%] bottom-[23%] h-2.5 w-2.5 rounded-full bg-cyan-200/90" />
          <div className="absolute right-[24%] bottom-[17%] h-12 w-12 rounded-full border border-white/25" />

          <div className="absolute inset-x-5 bottom-6 rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-center text-[13px] text-white/85">
            메인 오브젝트 이미지 자리
          </div>
        </div>
      </div>
    </section>
  );
}
