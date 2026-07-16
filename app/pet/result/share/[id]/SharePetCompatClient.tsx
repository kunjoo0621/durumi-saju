"use client";

// 펫 궁합 share 페이지 — 사주/배틀 share와 동일 토큰 + 표준 등급 색
// 비로그인도 접근 가능

import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { getGradeColor, getGradeBadge } from "@/lib/utils/grade-colors";
import { safeDisplayGrade } from "@/lib/gradeSystem";
import OverallGradeBadgeSlot, { GRADE_GLOWS } from "@/components/result/OverallGradeBadgeSlot";
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
  loyaltyScore: number;
  conflictScore: number;
  illustrationUrl: string | null;
}

export default function SharePetCompatClient({
  result, petName, petSpecies, compositeScore, labelGrade, labelText,
  syncScore, rulerScore, loverScore, loyaltyScore, conflictScore, illustrationUrl,
}: Props) {
  const router = useRouter();
  const grade = getGradeColor(labelGrade);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary pb-32">
      <Header />

      <main className="max-w-[640px] mx-auto px-5 pt-6 space-y-5">
        {/* HERO — 일러스트(블록 없이 이미지만) + 궁합 등급 */}
        {illustrationUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={illustrationUrl} alt={`${petName} 일러스트`} className="w-full aspect-square object-cover rounded-3xl" />
        )}
        <section className="flex flex-col items-center text-center pt-2 pb-1">
          <span className="text-caption text-text-tertiary mb-3">
            {petName} × 너 궁합
          </span>
          <OverallGradeBadgeSlot grade={labelGrade} badgeSrc={getGradeBadge(labelGrade)} size={84} />
          <div className="mt-2 text-body-2 font-bold tracking-wide" style={{ color: grade.text }}>
            궁합 {safeDisplayGrade(labelGrade)}등급 · {compositeScore}점
          </div>
          <h1 className="mt-3 font-aggro text-[24px] leading-[1.3] tracking-tight text-text-primary">
            {labelText}
          </h1>
          <p className="mt-2 text-[14.5px] text-text-secondary leading-[1.75]">
            {`"${result.label.headline}"`}
          </p>
        </section>

        {/* 5지표 — 압축 표시 */}
        <section className="rounded-3xl bg-background-secondary border border-white/[0.08] p-6">
          <h2 className="text-title-3 text-text-primary mb-5">관계 지표</h2>
          <div className="grid grid-cols-3 gap-3">
            <Mini icon="🐾" label="호흡" value={syncScore} />
            <Mini icon="👑" label="실세" value={rulerScore} />
            <Mini icon="⚡" label="어긋남" value={conflictScore} inverted />
            <Mini icon="🐶" label="너의 사랑" value={loverScore} highlight={loverScore > loyaltyScore + 5} />
            <Mini icon="🐾" label={`${petName} 충성`} value={loyaltyScore} highlight={loyaltyScore > loverScore + 5} />
          </div>
        </section>

        {/* 관계 시간성 (v0.8) */}
        {result.futureLine && (
          <section className="rounded-[24px] bg-background-tertiary p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-body-2 font-semibold text-text-secondary">📍 앞으로의 너희</h2>
              <span className="text-caption text-text-tertiary">RELATIONSHIP TIMELINE</span>
            </div>
            <p className="text-body-1 leading-[1.7] text-text-primary whitespace-pre-line">
              {result.futureLine}
            </p>
          </section>
        )}

        {/* 종합 한 줄 */}
        <section className="relative overflow-hidden rounded-3xl bg-background-secondary border border-white/[0.08] p-7 text-center">
          <div className="absolute inset-0 pointer-events-none opacity-70" style={{ background: GRADE_GLOWS[labelGrade] }} aria-hidden="true" />
          <div className="relative">
            <div className="text-caption text-text-tertiary mb-4 tracking-wide">두루미의 한 줄</div>
            <p className="text-[20px] leading-[1.5] font-bold text-text-primary font-aggro">
              {`"${result.finalLine}"`}
            </p>
          </div>
        </section>

        {/* 펫 판정 */}
        <section className="rounded-3xl bg-background-secondary border border-white/[0.08] p-6">
          <h2 className="text-title-3 text-text-primary mb-4">{petName}에 대해</h2>
          <p className="text-body-1 leading-[1.7] text-text-primary whitespace-pre-line">
            {result.petVerdict}
          </p>
        </section>

        {/* 보호자 판정 */}
        <section className="rounded-3xl bg-background-secondary border border-white/[0.08] p-6">
          <h2 className="text-title-3 text-text-primary mb-4">보호자에게</h2>
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

function Mini({ icon, label, value, inverted: _inverted = false, highlight = false }: { icon: string; label: string; value: number; inverted?: boolean; highlight?: boolean }) {
  return (
    <div className={`bg-background-tertiary rounded-2xl p-4 ${highlight ? "ring-1 ring-white/15" : ""}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[14px]">{icon}</span>
        <span className="text-caption text-text-tertiary truncate">{label}</span>
      </div>
      <div className={`text-[24px] font-bold tabular-nums font-aggro ${highlight ? "text-text-primary" : "text-text-secondary"}`}>{value}</div>
    </div>
  );
}
