"use client";

// 펫 궁합 share 페이지 (비로그인도 접근 가능)
// 결과 페이지의 핵심 시각화 + "나도 분석하기" CTA

import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import type { PetCompatResult, LabelGrade } from "@/lib/pet-compat";

const GRADE_THEME: Record<LabelGrade, { bg: string; text: string; ring: string }> = {
  S: { bg: "bg-pink-500/12", text: "text-pink-400", ring: "ring-pink-500/30" },
  A: { bg: "bg-orange-500/12", text: "text-orange-400", ring: "ring-orange-500/30" },
  B: { bg: "bg-emerald-500/12", text: "text-emerald-400", ring: "ring-emerald-500/30" },
  C: { bg: "bg-cyan-500/12", text: "text-cyan-400", ring: "ring-cyan-500/30" },
  D: { bg: "bg-zinc-500/12", text: "text-zinc-400", ring: "ring-zinc-500/30" },
};

interface Props {
  result: PetCompatResult;
  petName: string;
  petSpecies: "dog" | "cat";
  compositeScore: number;
  labelGrade: LabelGrade;
  labelText: string;
  syncScore: number;
  rulerScore: number;
  loverScore: number;
  conflictScore: number;
}

export default function SharePetCompatClient({
  result, petName, petSpecies, compositeScore, labelGrade, labelText,
  syncScore, rulerScore, loverScore, conflictScore,
}: Props) {
  const router = useRouter();
  const theme = GRADE_THEME[labelGrade];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-32">
      <Header />

      <main className="max-w-[640px] mx-auto px-5 pt-6 space-y-5">
        {/* HERO */}
        <section className={`rounded-[28px] p-7 ${theme.bg} ring-1 ${theme.ring}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${theme.text} bg-black/30`}>
              {labelGrade}등급
            </span>
            <span className="text-[11px] text-zinc-500">
              {petName} × {petSpecies === "dog" ? "강아지" : "고양이"}
            </span>
          </div>
          <h1 className={`text-[26px] leading-[1.3] font-bold tracking-tight ${theme.text} mb-3 font-aggro`}>
            {labelText}
          </h1>
          <p className="text-[15px] text-zinc-300 leading-relaxed mb-7">
            {`"${result.label.headline}"`}
          </p>
          <div className="flex items-end gap-3">
            <div className={`text-[56px] leading-none font-bold ${theme.text} font-aggro`}>
              {compositeScore}
            </div>
            <div className="text-[13px] text-zinc-500 pb-2">/ 100점</div>
          </div>
        </section>

        {/* 4지표 — 압축 표시 */}
        <section className="rounded-[24px] bg-[#141414] p-6">
          <h2 className="text-[14px] font-semibold text-zinc-400 mb-5">관계 지표</h2>
          <div className="grid grid-cols-2 gap-4">
            <Mini icon="🐾" label="호흡" value={syncScore} />
            <Mini icon="👑" label="실세" value={rulerScore} />
            <Mini icon="🐶" label="집사" value={loverScore} />
            <Mini icon="⚡" label="어긋남" value={conflictScore} inverted />
          </div>
        </section>

        {/* 종합 한 줄 */}
        <section className="rounded-[28px] bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent ring-1 ring-emerald-500/30 p-7 text-center">
          <div className="text-[11px] text-emerald-400 mb-4 tracking-widest">VERDICT</div>
          <p className="text-[20px] leading-[1.5] font-bold text-white font-aggro">
            {`"${result.finalLine}"`}
          </p>
        </section>

        {/* 펫 판정 — 핵심 본문만 */}
        <section className="rounded-[24px] bg-[#141414] p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[18px]">🐾</span>
            <h2 className="text-[14px] font-semibold text-zinc-400">{petName}에 대해</h2>
          </div>
          <p className="text-[15px] leading-[1.7] text-zinc-200 whitespace-pre-line">
            {result.petVerdict}
          </p>
        </section>

        {/* 보호자 판정 */}
        <section className="rounded-[24px] bg-[#141414] p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[18px]">📛</span>
            <h2 className="text-[14px] font-semibold text-zinc-400">보호자에게</h2>
          </div>
          <p className="text-[15px] leading-[1.7] text-zinc-200 whitespace-pre-line">
            {result.ownerVerdict}
          </p>
        </section>

        <div className="text-center text-[12px] text-zinc-500 pt-4">
          🥚 사주보는 두루미
        </div>
      </main>

      {/* 하단 CTA */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent pt-8 pb-5 px-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
      >
        <div className="max-w-[640px] mx-auto">
          <button
            type="button"
            onClick={() => router.push("/pet/input")}
            className="w-full h-[54px] rounded-xl bg-emerald-500 text-black text-[15px] font-bold hover:bg-emerald-400 transition-colors"
          >
            나도 우리 아이 궁합 보기
          </button>
        </div>
      </footer>
    </div>
  );
}

function Mini({ icon, label, value, inverted = false }: { icon: string; label: string; value: number; inverted?: boolean }) {
  const tone = inverted ? 100 - value : value;
  const color = tone >= 70 ? "text-emerald-400" : tone >= 45 ? "text-amber-400" : "text-rose-400";
  return (
    <div className="bg-black/30 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[14px]">{icon}</span>
        <span className="text-[12px] text-zinc-400">{label}</span>
      </div>
      <div className={`text-[28px] font-bold tabular-nums ${color} font-aggro`}>{value}</div>
    </div>
  );
}
