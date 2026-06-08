"use client";

// 펫 궁합 결과 페이지 — 사주/배틀과 동일 디자인 토큰 사용
// 등급 색은 GRADE_COLORS 표준 사용 (사주와 동일)
// 톤 통일: emerald/rose 사용 금지. 게이지·강조는 단색(white opacity)으로 표현.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import { getGradeColor } from "@/lib/utils/grade-colors";
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
    loyalty_score: number;
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
      <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center px-6">
        <p className="text-body-2 text-text-secondary mb-4">{error || "결과가 없어."}</p>
        <button
          type="button"
          onClick={() => router.push("/pet/input")}
          className="btn-primary px-6 py-3 rounded-xl text-[14px] font-semibold"
        >
          다시 분석하기
        </button>
      </div>
    );
  }

  const result = data.full_result;
  const grade = getGradeColor(data.label_grade);

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
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).catch(() => {});
    alert("공유 링크가 복사됐어");
  };

  return (
    <div className="min-h-screen bg-background-primary text-text-primary pb-32">
      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="max-w-[640px] mx-auto px-5 pt-6 space-y-5">
        {/* HERO — 라벨 + 등급 + 헤드라인 + composite */}
        <section
          className="rounded-[28px] p-7"
          style={{ background: grade.bg, boxShadow: `0 0 0 1px ${grade.glow}` }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
              style={{ color: grade.text, background: "rgba(0,0,0,0.3)" }}
            >
              {data.label_grade}등급
            </span>
            <span className="text-caption text-text-tertiary">{data.pet.name} × 너</span>
          </div>

          {/* 일러스트 (있을 때만) */}
          {data.illustration_url && (
            <div className="mb-5 rounded-2xl overflow-hidden bg-background-tertiary/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.illustration_url}
                alt={`${data.pet.name} 일러스트`}
                className="w-full aspect-square object-cover"
              />
            </div>
          )}

          <h1
            className="text-[26px] leading-[1.3] font-bold tracking-tight mb-3 font-aggro"
            style={{ color: grade.text }}
          >
            {data.label_text}
          </h1>
          <p className="text-body-1 text-text-secondary leading-relaxed mb-7">
            {`"${result.label.headline}"`}
          </p>
          <div className="flex items-end gap-3">
            <div className="text-[56px] leading-none font-bold font-aggro" style={{ color: grade.text }}>
              {data.composite_score}
            </div>
            <div className="text-caption text-text-tertiary pb-2">/ 100점</div>
          </div>
        </section>

        {/* 4지표 게이지 */}
        <section className="rounded-[24px] bg-background-tertiary p-6">
          <h2 className="text-body-2 font-semibold text-text-secondary mb-5">관계 지표</h2>
          <div className="space-y-5">
            <Gauge icon="🐾" label="호흡 지수" desc="둘이 얼마나 동기화됐는지" value={data.sync_score} />
            <Gauge icon="👑" label="집안 실세 지수" desc={data.ruler_score >= 50 ? `${data.pet.name}가 우위` : "네가 우위"} value={data.ruler_score} />
            <Gauge icon="⚡" label="사주 어긋남" desc="어디서 부딪히는지" value={data.conflict_score} inverted />
          </div>
        </section>

        {/* 양방향 정 흐름 — 사랑 vs 충성 (v0.8) */}
        <AffectionFlow
          lover={data.lover_score}
          loyalty={data.loyalty_score}
          petName={data.pet.name}
        />

        {/* 사용설명서 — 펫 사양표 */}
        <section className="rounded-[24px] bg-background-tertiary p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-body-2 font-semibold text-text-secondary">{data.pet.name} 사용설명서</h2>
            <span className="text-caption text-text-tertiary">PRODUCT MANUAL</span>
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
        <section className="rounded-[24px] bg-background-tertiary p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[18px]">📛</span>
            <h2 className="text-body-2 font-semibold text-text-secondary">너에게 솔직히</h2>
          </div>
          <p className="text-body-1 leading-[1.7] text-text-primary whitespace-pre-line">
            {result.ownerVerdict}
          </p>
        </section>

        {/* 펫 판정 */}
        <section className="rounded-[24px] bg-background-tertiary p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[18px]">🐾</span>
            <h2 className="text-body-2 font-semibold text-text-secondary">{data.pet.name}에 대해</h2>
          </div>
          <p className="text-body-1 leading-[1.7] text-text-primary whitespace-pre-line">
            {result.petVerdict}
          </p>
        </section>

        {/* 시뮬레이션 3장면 */}
        <section className="space-y-3">
          <h2 className="text-body-2 font-semibold text-text-secondary px-1">이런 상황이라면</h2>
          {result.simulations?.map((sim, idx) => (
            <div key={idx} className="rounded-[20px] bg-background-tertiary p-6">
              <div className="text-caption font-semibold text-text-tertiary mb-2 tracking-wide">📍 {sim.scene}</div>
              <p className="text-body-1 leading-[1.7] text-text-primary whitespace-pre-line">
                {sim.prediction}
              </p>
            </div>
          ))}
        </section>

        {/* 관계 시간성 — 펫 12운성 + 보호자 대운 (v0.8) */}
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
        <section className="rounded-[28px] bg-background-tertiary p-7 text-center">
          <div className="text-caption text-text-tertiary mb-4 tracking-widest">VERDICT</div>
          <p className="text-[20px] leading-[1.5] font-bold text-text-primary font-aggro">
            {`"${result.finalLine}"`}
          </p>
        </section>

        {/* 면책 (D등급만) */}
        {result.disclaimer && (
          <section className="rounded-2xl bg-background-tertiary p-5">
            <p className="text-body-2 text-text-secondary leading-relaxed">
              ※ {result.disclaimer}
            </p>
          </section>
        )}

        <div className="text-center text-caption text-text-tertiary mt-6">
          scoring v{data.scoring_version} · {new Date(data.created_at).toLocaleDateString("ko-KR")}
        </div>
      </main>

      {/* 하단 sticky 공유 버튼 */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background-primary via-background-primary to-transparent pt-8 pb-5 px-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
      >
        <div className="max-w-[640px] mx-auto flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/pet/input")}
            className="btn-secondary flex-1 h-[54px] rounded-xl text-[15px] font-semibold"
          >
            다른 아이도 보기
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="btn-primary flex-[1.5] h-[54px] rounded-xl text-[15px] font-semibold"
          >
            결과 공유하기
          </button>
        </div>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 게이지 컴포넌트 (4지표)
// ────────────────────────────────────────────────────────

interface GaugeProps {
  icon: string;
  label: string;
  desc: string;
  value: number;
  inverted?: boolean;
}

function Gauge({ icon, label, desc, value, inverted: _inverted = false }: GaugeProps) {
  const displayValue = Math.max(0, Math.min(100, value));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">{icon}</span>
          <div>
            <div className="text-body-1 text-text-primary font-semibold">{label}</div>
            <div className="text-caption text-text-tertiary mt-0.5">{desc}</div>
          </div>
        </div>
        <div className="text-[24px] font-bold text-text-primary font-aggro tabular-nums">{displayValue}</div>
      </div>
      <div className="h-2 bg-background-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-white/80 rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${displayValue}%` }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 양방향 정 흐름 — 사랑(보호자) vs 충성(펫) 대비 (v0.8)
// ────────────────────────────────────────────────────────

function AffectionFlow({ lover, loyalty, petName }: { lover: number; loyalty: number; petName: string }) {
  const gap = lover - loyalty;
  const absGap = Math.abs(gap);

  let verdict: string;
  if (absGap <= 12) verdict = "양쪽이 비슷하게 빠져있어";
  else if (gap > 0 && absGap < 30) verdict = `네가 조금 더 매달리는 중`;
  else if (gap > 0) verdict = `네가 일방적으로 매달리는 중`;
  else if (absGap < 30) verdict = `${petName}가 조금 더 의지하는 중`;
  else verdict = `${petName}가 너 없으면 안 되는 중`;

  return (
    <section className="rounded-[24px] bg-background-tertiary p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-body-2 font-semibold text-text-secondary">사랑의 방향</h2>
        <span className="text-caption text-text-tertiary">AFFECTION FLOW</span>
      </div>

      <div className="space-y-4">
        <FlowBar
          icon="🐶"
          label="너의 사랑"
          desc={`${petName}한테 매달리는 정도`}
          value={lover}
          align="left"
          highlight={gap > 5}
        />
        <FlowBar
          icon="🐾"
          label={`${petName}의 충성`}
          desc={`너에게 의지하는 정도`}
          value={loyalty}
          align="right"
          highlight={gap < -5}
        />
      </div>

      <div className="mt-5 pt-4 border-t border-zinc-800/60">
        <p className="text-body-1 text-text-primary text-center font-semibold">
          {verdict}
        </p>
      </div>
    </section>
  );
}

function FlowBar({
  icon, label, desc, value, align, highlight,
}: {
  icon: string; label: string; desc: string; value: number; align: "left" | "right"; highlight: boolean;
}) {
  const v = Math.max(0, Math.min(100, value));
  const barColor = highlight ? "bg-white/85" : "bg-white/35";
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">{icon}</span>
          <div>
            <div className="text-body-1 text-text-primary font-semibold">{label}</div>
            <div className="text-caption text-text-tertiary mt-0.5">{desc}</div>
          </div>
        </div>
        <div className={`text-[22px] font-bold tabular-nums font-aggro ${highlight ? "text-text-primary" : "text-text-secondary"}`}>{v}</div>
      </div>
      <div className={`h-2 bg-background-secondary rounded-full overflow-hidden ${align === "right" ? "flex flex-row-reverse" : ""}`}>
        <div
          className={`h-full ${barColor} rounded-full transition-[width] duration-700 ease-out`}
          style={{ width: `${v}%` }}
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
    <div className={`rounded-2xl p-4 ${highlight ? "bg-background-secondary ring-1 ring-white/15" : "bg-background-secondary"}`}>
      <div className={`text-caption font-semibold mb-1.5 tracking-wide ${highlight ? "text-text-primary" : "text-text-tertiary"}`}>
        {label}
      </div>
      <div className="text-body-1 leading-[1.6] text-text-primary">
        {value}
      </div>
    </div>
  );
}
