"use client";

// 펫 궁합 결과 페이지 — 토스 톤 + 두루미 정체성
// emerald 테마, 사용설명서·4지표 게이지·시뮬·종합 한줄

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import type { PetCompatResult, LabelGrade } from "@/lib/pet-compat";

interface ApiResponse {
  result: {
    id: string;
    label_grade: LabelGrade;
    label_text: string;
    composite_score: number;
    sync_score: number;
    ruler_score: number;
    lover_score: number;
    conflict_score: number;
    illustration_key: string | null;
    illustration_url: string | null;
    full_result: PetCompatResult;
    scoring_version: number;
    created_at: string;
    pet: {
      id: string;
      name: string;
      species: "dog" | "cat";
      breed: string | null;
      gender: string | null;
      birth_tier: number;
    };
  };
}

const GRADE_THEME: Record<LabelGrade, { bg: string; text: string; ring: string; label: string }> = {
  S: { bg: "bg-pink-500/12", text: "text-pink-400", ring: "ring-pink-500/30", label: "운명의 짝꿍" },
  A: { bg: "bg-orange-500/12", text: "text-orange-400", ring: "ring-orange-500/30", label: "찰떡 콤비" },
  B: { bg: "bg-emerald-500/12", text: "text-emerald-400", ring: "ring-emerald-500/30", label: "까칠한 룸메" },
  C: { bg: "bg-cyan-500/12", text: "text-cyan-400", ring: "ring-cyan-500/30", label: "집안 실세" },
  D: { bg: "bg-zinc-500/12", text: "text-zinc-400", ring: "ring-zinc-500/30", label: "사용설명서 다시" },
};

export default function PetResultClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const id = searchParams?.get("id");
  const [data, setData] = useState<ApiResponse["result"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("결과 ID가 없어.");
      setLoading(false);
      return;
    }
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=" + encodeURIComponent(`/pet/result?id=${id}`));
      return;
    }
    if (status !== "authenticated") return;

    fetch(`/api/pet-compat/results/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("결과를 불러올 수 없어.");
        return res.json();
      })
      .then((json: ApiResponse) => setData(json.result))
      .catch((e: any) => setError(e?.message || "오류가 발생했어."))
      .finally(() => setLoading(false));
  }, [id, status, router]);

  if (loading) {
    return <FullScreenLoading message="결과 불러오는 중..." />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-6">
        <p className="text-zinc-400 text-[14px] mb-4">{error || "결과가 없어."}</p>
        <button
          type="button"
          onClick={() => router.push("/pet/input")}
          className="bg-emerald-500 text-black px-6 py-3 rounded-xl text-[14px] font-semibold"
        >
          다시 분석하기
        </button>
      </div>
    );
  }

  const result = data.full_result;
  const theme = GRADE_THEME[data.label_grade];

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/pet/result/share/${data.id}`;
    const shareText = `${data.pet.name}와의 궁합: ${data.label_text}\n${result.finalLine}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "두루미가 본 우리 아이 궁합", text: shareText, url: shareUrl });
        return;
      } catch {
        // ignore (user cancelled)
      }
    }
    // fallback: clipboard
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).catch(() => {});
    alert("공유 링크가 복사됐어");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-32">
      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="max-w-[640px] mx-auto px-5 pt-6 space-y-5">
        {/* HERO — 라벨 + 등급 + 헤드라인 + composite */}
        <section
          className={`rounded-[28px] p-7 ${theme.bg} ring-1 ${theme.ring}`}
          style={{ backdropFilter: "blur(20px)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${theme.text} bg-black/30`}>
              {data.label_grade}등급
            </span>
            <span className="text-[11px] text-zinc-500">{data.pet.name} × 너</span>
          </div>
          <h1 className={`text-[26px] leading-[1.3] font-bold tracking-tight ${theme.text} mb-3 font-aggro`}>
            {data.label_text}
          </h1>
          <p className="text-[15px] text-zinc-300 leading-relaxed mb-7">
            {`"${result.label.headline}"`}
          </p>
          <div className="flex items-end gap-3">
            <div className={`text-[56px] leading-none font-bold ${theme.text} font-aggro`}>
              {data.composite_score}
            </div>
            <div className="text-[13px] text-zinc-500 pb-2">/ 100점</div>
          </div>
        </section>

        {/* 4지표 게이지 — 토스 스타일 */}
        <section className="rounded-[24px] bg-[#141414] p-6">
          <h2 className="text-[14px] font-semibold text-zinc-400 mb-5">관계 지표</h2>
          <div className="space-y-5">
            <Gauge icon="🐾" label="호흡 지수" desc="둘이 얼마나 동기화됐는지" value={data.sync_score} />
            <Gauge icon="👑" label="집안 실세 지수" desc={data.ruler_score >= 50 ? `${data.pet.name}가 우위` : "네가 우위"} value={data.ruler_score} />
            <Gauge icon="🐶" label="랜선집사 지수" desc="네가 얘한테 미친 정도" value={data.lover_score} />
            <Gauge icon="⚡" label="사주 어긋남" desc="어디서 부딪히는지" value={data.conflict_score} inverted />
          </div>
        </section>

        {/* 사용설명서 — 펫 사양표 */}
        <section className="rounded-[24px] bg-[#141414] p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[14px] font-semibold text-zinc-400">{data.pet.name} 사용설명서</h2>
            <span className="text-[11px] text-zinc-600">PRODUCT MANUAL</span>
          </div>
          <div className="space-y-4">
            <ManualRow label="제품명" value={result.manual.name} />
            <ManualRow label="사양" value={result.manual.spec} />
            <ManualRow label="권장 환경" value={result.manual.recommendedEnv} />
            <ManualRow label="주의사항" value={result.manual.warnings} />
            <ManualRow label="충전 방법" value={result.manual.chargeMethod} />
            <ManualRow label="오류 신호" value={result.manual.errorSignals} />
            <ManualRow label="권장 보호자 모드" value={result.manual.ownerMode} highlight />
          </div>
        </section>

        {/* 보호자 판정 */}
        <section className="rounded-[24px] bg-[#141414] p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[18px]">📛</span>
            <h2 className="text-[14px] font-semibold text-zinc-400">너에게 솔직히</h2>
          </div>
          <p className="text-[15px] leading-[1.7] text-zinc-200 whitespace-pre-line">
            {result.ownerVerdict}
          </p>
        </section>

        {/* 펫 판정 */}
        <section className="rounded-[24px] bg-[#141414] p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[18px]">🐾</span>
            <h2 className="text-[14px] font-semibold text-zinc-400">{data.pet.name}에 대해</h2>
          </div>
          <p className="text-[15px] leading-[1.7] text-zinc-200 whitespace-pre-line">
            {result.petVerdict}
          </p>
        </section>

        {/* 시뮬레이션 3장면 */}
        <section className="space-y-3">
          <h2 className="text-[14px] font-semibold text-zinc-400 px-1">이런 상황이라면</h2>
          {result.simulations?.map((sim, idx) => (
            <div key={idx} className="rounded-[20px] bg-[#141414] p-6">
              <div className="text-[12px] font-semibold text-emerald-400 mb-2">📍 {sim.scene}</div>
              <p className="text-[14.5px] leading-[1.7] text-zinc-200 whitespace-pre-line">
                {sim.prediction}
              </p>
            </div>
          ))}
        </section>

        {/* 종합 한 줄 — 공유 카드 */}
        <section className="rounded-[28px] bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent ring-1 ring-emerald-500/30 p-7 text-center">
          <div className="text-[11px] text-emerald-400 mb-4 tracking-widest">VERDICT</div>
          <p className="text-[20px] leading-[1.5] font-bold text-white font-aggro">
            {`"${result.finalLine}"`}
          </p>
        </section>

        {/* 면책 (D등급만) */}
        {result.disclaimer && (
          <section className="rounded-2xl bg-zinc-900/60 p-5 ring-1 ring-zinc-800">
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              ※ {result.disclaimer}
            </p>
          </section>
        )}

        <div className="text-center text-[11px] text-zinc-600 mt-6">
          scoring v{data.scoring_version} · {new Date(data.created_at).toLocaleDateString("ko-KR")}
        </div>
      </main>

      {/* 하단 sticky 공유 버튼 */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent pt-8 pb-5 px-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
      >
        <div className="max-w-[640px] mx-auto flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/pet/input")}
            className="flex-1 h-[54px] rounded-xl bg-zinc-900 text-zinc-300 text-[15px] font-semibold border border-zinc-800 hover:bg-zinc-800 transition-colors"
          >
            다른 아이도 보기
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex-[1.5] h-[54px] rounded-xl bg-emerald-500 text-black text-[15px] font-bold hover:bg-emerald-400 transition-colors"
          >
            결과 공유하기
          </button>
        </div>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 게이지 컴포넌트 (토스 스타일)
// ────────────────────────────────────────────────────────

interface GaugeProps {
  icon: string;
  label: string;
  desc: string;
  value: number;
  inverted?: boolean;       // true = 낮을수록 좋음
}

function Gauge({ icon, label, desc, value, inverted = false }: GaugeProps) {
  const displayValue = Math.max(0, Math.min(100, value));
  // inverted = 낮을수록 좋음 → 색을 반대로 결정
  const tone = inverted ? 100 - displayValue : displayValue;
  const color = tone >= 70 ? "bg-emerald-500" : tone >= 45 ? "bg-amber-400" : "bg-rose-400";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">{icon}</span>
          <div>
            <div className="text-[14px] text-zinc-200 font-semibold">{label}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{desc}</div>
          </div>
        </div>
        <div className="text-[24px] font-bold text-white font-aggro tabular-nums">{displayValue}</div>
      </div>
      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-[width] duration-700 ease-out`}
          style={{ width: `${displayValue}%` }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 사용설명서 row
// ────────────────────────────────────────────────────────

interface ManualRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function ManualRow({ label, value, highlight }: ManualRowProps) {
  return (
    <div className={`rounded-2xl p-4 ${highlight ? "bg-emerald-500/8 ring-1 ring-emerald-500/20" : "bg-black/30"}`}>
      <div className={`text-[11px] font-semibold mb-1.5 tracking-wide ${highlight ? "text-emerald-400" : "text-zinc-500"}`}>
        {label}
      </div>
      <div className={`text-[14.5px] leading-[1.6] ${highlight ? "text-zinc-100" : "text-zinc-200"}`}>
        {value}
      </div>
    </div>
  );
}
