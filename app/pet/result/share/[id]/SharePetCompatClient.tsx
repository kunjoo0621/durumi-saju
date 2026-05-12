"use client";

// 펫 궁합 share 페이지 — 사주/배틀 share와 동일 토큰 + 표준 등급 색
// 비로그인도 접근 가능

import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { getGradeColor } from "@/lib/utils/grade-colors";
import type { PetCompatResult, LabelGrade } from "@/lib/pet-compat";

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
  illustrationUrl: string | null;
}

export default function SharePetCompatClient({
  result, petName, petSpecies, compositeScore, labelGrade, labelText,
  syncScore, rulerScore, loverScore, conflictScore, illustrationUrl,
}: Props) {
  const router = useRouter();
  const grade = getGradeColor(labelGrade);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary pb-32">
      <Header />

      <main className="max-w-[640px] mx-auto px-5 pt-6 space-y-5">
        {/* HERO */}
        <section
          className="rounded-[28px] p-7"
          style={{ background: grade.bg, boxShadow: `0 0 0 1px ${grade.glow}` }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
              style={{ color: grade.text, background: "rgba(0,0,0,0.3)" }}
            >
              {labelGrade}등급
            </span>
            <span className="text-caption text-text-tertiary">
              {petName} × {petSpecies === "dog" ? "강아지" : "고양이"}
            </span>
          </div>

          {illustrationUrl && (
            <div className="mb-5 rounded-2xl overflow-hidden bg-background-tertiary/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={illustrationUrl}
                alt={`${petName} 일러스트`}
                className="w-full aspect-square object-cover"
              />
            </div>
          )}

          <h1
            className="text-[26px] leading-[1.3] font-bold tracking-tight mb-3 font-aggro"
            style={{ color: grade.text }}
          >
            {labelText}
          </h1>
          <p className="text-body-1 text-text-secondary leading-relaxed mb-7">
            {`"${result.label.headline}"`}
          </p>
          <div className="flex items-end gap-3">
            <div className="text-[56px] leading-none font-bold font-aggro" style={{ color: grade.text }}>
              {compositeScore}
            </div>
            <div className="text-caption text-text-tertiary pb-2">/ 100점</div>
          </div>
        </section>

        {/* 4지표 — 압축 표시 */}
        <section className="rounded-[24px] bg-background-tertiary p-6">
          <h2 className="text-body-2 font-semibold text-text-secondary mb-5">관계 지표</h2>
          <div className="grid grid-cols-2 gap-4">
            <Mini icon="🐾" label="호흡" value={syncScore} />
            <Mini icon="👑" label="실세" value={rulerScore} />
            <Mini icon="🐶" label="집사" value={loverScore} />
            <Mini icon="⚡" label="어긋남" value={conflictScore} inverted />
          </div>
        </section>

        {/* 종합 한 줄 — 펫 정체성 emerald */}
        <section className="rounded-[28px] bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent ring-1 ring-emerald-500/30 p-7 text-center">
          <div className="text-caption text-emerald-400 mb-4 tracking-widest">VERDICT</div>
          <p className="text-[20px] leading-[1.5] font-bold text-text-primary font-aggro">
            {`"${result.finalLine}"`}
          </p>
        </section>

        {/* 펫 판정 */}
        <section className="rounded-[24px] bg-background-tertiary p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[18px]">🐾</span>
            <h2 className="text-body-2 font-semibold text-text-secondary">{petName}에 대해</h2>
          </div>
          <p className="text-body-1 leading-[1.7] text-text-primary whitespace-pre-line">
            {result.petVerdict}
          </p>
        </section>

        {/* 보호자 판정 */}
        <section className="rounded-[24px] bg-background-tertiary p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[18px]">📛</span>
            <h2 className="text-body-2 font-semibold text-text-secondary">보호자에게</h2>
          </div>
          <p className="text-body-1 leading-[1.7] text-text-primary whitespace-pre-line">
            {result.ownerVerdict}
          </p>
        </section>

        <div className="text-center text-caption text-text-tertiary pt-4">
          🥚 사주보는 두루미
        </div>
      </main>

      {/* 하단 CTA */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background-primary via-background-primary to-transparent pt-8 pb-5 px-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
      >
        <div className="max-w-[640px] mx-auto">
          <button
            type="button"
            onClick={() => router.push("/pet/input")}
            className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
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
    <div className="bg-background-secondary rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[14px]">{icon}</span>
        <span className="text-caption text-text-tertiary">{label}</span>
      </div>
      <div className={`text-[28px] font-bold tabular-nums ${color} font-aggro`}>{value}</div>
    </div>
  );
}
