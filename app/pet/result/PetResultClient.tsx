"use client";

// 펫 궁합 결과 페이지 — 두루미 본 서비스(사주·배틀) 결로 통일 (Phase 2 리디자인)
// 공유 컴포넌트 재사용: OverallGradeBadgeSlot · CategoryRadarChart(axes) · SectionList(meta)

import { useEffect, useState, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import { getGradeColor, getGradeBadge } from "@/lib/utils/grade-colors";
import { safeDisplayGrade } from "@/lib/gradeSystem";
import OverallGradeBadgeSlot, { GRADE_GLOWS } from "@/components/result/OverallGradeBadgeSlot";
import CategoryRadarChart from "@/components/result/CategoryRadarChart";
import SectionList, { type ResultSection, type SectionMeta } from "@/components/result/SectionList";
import { Megaphone, PawPrint, GameController, MapPin, ClipboardText, Crown, Heart } from "@phosphor-icons/react";
import type { PetCompatResult, LabelGrade } from "@/lib/pet-compat";
import type { PetResultData } from "@/lib/mockPetResult";

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

  return <PetResultBody data={data} />;
}

// ────────────────────────────────────────────────────────
// 프레젠테이션 본체 (mock 데모·리디자인 타깃)
// ────────────────────────────────────────────────────────

function metaOf(Icon: ComponentType<Record<string, unknown>>, label: string, color: string): SectionMeta {
  return { Icon, label, color, bg: `${color}1F`, accent: color };
}

export function PetResultBody({ data }: { data: PetResultData }) {
  const router = useRouter();
  const result = data.full_result;
  const gc = getGradeColor(data.label_grade);
  const wash = `linear-gradient(180deg, ${gc.main}24 0%, ${gc.main}10 42%, transparent 72%)`;

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

  // ② 궁합 레이더 — 전부 "높을수록 좋음"으로 정규화 (실세는 방향값이라 ③으로)
  const radarAxes = [
    { key: "호흡", score: data.sync_score, subLabel: `${data.sync_score}점` },
    { key: "사랑", score: data.lover_score, subLabel: `${data.lover_score}점` },
    { key: "충성", score: data.loyalty_score, subLabel: `${data.loyalty_score}점` },
    { key: "조화", score: 100 - data.conflict_score, subLabel: `어긋남 ${data.conflict_score}` },
  ];

  // ⑤ 판정·시뮬·타임라인 — SectionList meta 오버라이드
  const sections: ResultSection[] = [
    { icon: "pet-owner", title: "너에게 솔직히", content: result.ownerVerdict, meta: metaOf(Megaphone, "보호자", "#F87171") },
    { icon: "pet-pet", title: `${data.pet.name}에 대해`, content: result.petVerdict, meta: metaOf(PawPrint, "이 아이", "#4ADE80") },
    ...(result.simulations ?? []).map((s, i) => ({
      icon: `pet-sim-${i}`,
      title: s.scene,
      content: s.prediction,
      meta: metaOf(GameController, "이런 상황", "#F59E0B"),
    })),
    ...(result.futureLine
      ? [{ icon: "pet-future", title: "앞으로의 너희", content: result.futureLine, meta: metaOf(MapPin, "타임라인", "#A855F7") }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background-primary text-text-primary pb-32">
      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="max-w-[640px] mx-auto px-5 pt-6 space-y-4 animate-fadeIn durumi-stagger">
        {/* ① HERO */}
        <section className="relative overflow-hidden rounded-3xl p-6" style={{ backgroundColor: "#141414" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: wash }} aria-hidden="true" />
          <div className="relative flex flex-col items-center text-center">
            <span className="text-caption text-text-tertiary mb-4">{data.pet.name} × 너</span>

            {data.illustration_url && (
              <div className="w-full mb-5 rounded-2xl overflow-hidden bg-background-tertiary/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.illustration_url} alt={`${data.pet.name} 일러스트`} className="w-full aspect-square object-cover" />
              </div>
            )}

            <OverallGradeBadgeSlot grade={data.label_grade} badgeSrc={getGradeBadge(data.label_grade)} size={88} />
            <div className="mt-2 text-caption font-semibold tracking-wide" style={{ color: gc.text }}>
              {safeDisplayGrade(data.label_grade)}등급 · {data.composite_score}점
            </div>

            <h1 className="mt-3 font-aggro text-[24px] leading-[1.3] tracking-tight text-text-primary">
              {data.label_text}
            </h1>
            <p className="mt-2 text-[14.5px] text-text-secondary leading-[1.75]">
              {result.label.headline}
            </p>
          </div>
        </section>

        {/* ② 궁합 레이더 */}
        <section className="space-y-3">
          <h2 className="px-1 text-title-3 text-text-primary">궁합 리포트</h2>
          <CategoryRadarChart axes={radarAxes} />
        </section>

        {/* ③ 관계 역학 — 실세 tug-bar */}
        <section className="rounded-3xl bg-background-secondary border border-white/[0.08] p-6">
          <div className="flex items-center gap-2 mb-5">
            <Crown weight="duotone" size={24} color="#F5C451" aria-hidden="true" />
            <h2 className="text-title-3 text-text-primary">집안 실세</h2>
          </div>
          <TugBar ruler={data.ruler_score} petName={data.pet.name} />
        </section>

        {/* ③ 관계 역학 — 양방향 정 */}
        <AffectionFlow lover={data.lover_score} loyalty={data.loyalty_score} petName={data.pet.name} accent={gc.main} />

        {/* ④ 사용설명서 */}
        <ManualSpecSheet manual={result.manual} petName={data.pet.name} />

        {/* ⑤ 판정 · 시뮬 · 타임라인 */}
        <section className="pt-1">
          <SectionList sections={sections} initialExpandedCount={sections.length} />
        </section>

        {/* ⑥ VERDICT */}
        <section className="relative overflow-hidden rounded-3xl bg-background-secondary border border-white/[0.08] p-7 text-center">
          <div className="absolute inset-0 pointer-events-none opacity-70" style={{ background: GRADE_GLOWS[data.label_grade] }} aria-hidden="true" />
          <div className="relative">
            <div className="text-caption text-text-tertiary mb-4 tracking-wide">두루미의 한 줄</div>
            <p className="text-[20px] leading-[1.5] font-bold text-text-primary font-aggro">
              {`"${result.finalLine}"`}
            </p>
          </div>
        </section>

        {/* ⑦ 면책(D등급) + 메타 */}
        {result.disclaimer && (
          <section className="rounded-2xl bg-background-secondary border border-white/[0.06] p-5">
            <p className="text-body-2 text-text-secondary leading-relaxed">※ {result.disclaimer}</p>
          </section>
        )}

        <div className="text-center text-caption text-text-tertiary pt-2">
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
// ③ 집안 실세 tug-bar (너 ↔ 펫, ruler_score 위치)
// ────────────────────────────────────────────────────────

function TugBar({ ruler, petName }: { ruler: number; petName: string }) {
  const v = Math.max(0, Math.min(100, ruler));
  const petSide = v >= 55;
  const ownerSide = v <= 45;
  const verdict = petSide ? `${petName}가 우위` : ownerSide ? "네가 우위" : "팽팽한 균형";

  return (
    <div>
      <div className="flex items-center justify-between text-body-2 mb-3">
        <span className={ownerSide ? "text-text-primary font-semibold" : "text-text-tertiary"}>너</span>
        <span className="text-caption text-text-tertiary">{verdict}</span>
        <span className={petSide ? "text-text-primary font-semibold" : "text-text-tertiary"}>{petName}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-background-tertiary overflow-hidden">
        {/* 중앙 50 눈금 */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15 -translate-x-1/2" />
        {/* 채움: 우위 쪽으로 */}
        <div
          className="absolute top-0 bottom-0 bg-white/25 transition-[left,right] duration-700 ease-out"
          style={v >= 50 ? { left: "50%", right: `${100 - v}%` } : { left: `${v}%`, right: "50%" }}
        />
      </div>
      {/* 마커 */}
      <div className="relative h-0">
        <div
          className="absolute -top-[13px] h-3 w-3 rounded-full bg-white ring-2 ring-background-secondary transition-[left] duration-700 ease-out"
          style={{ left: `calc(${v}% - 6px)` }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// ③ 양방향 정 — 사랑(보호자) vs 충성(펫)
// ────────────────────────────────────────────────────────

function AffectionFlow({ lover, loyalty, petName, accent }: { lover: number; loyalty: number; petName: string; accent: string }) {
  const gap = lover - loyalty;
  const absGap = Math.abs(gap);

  let verdict: string;
  if (absGap <= 12) verdict = "양쪽이 비슷하게 빠져있어";
  else if (gap > 0 && absGap < 30) verdict = "네가 조금 더 매달리는 중";
  else if (gap > 0) verdict = "네가 일방적으로 매달리는 중";
  else if (absGap < 30) verdict = `${petName}가 조금 더 의지하는 중`;
  else verdict = `${petName}가 너 없으면 안 되는 중`;

  return (
    <section className="rounded-3xl bg-background-secondary border border-white/[0.08] p-6">
      <div className="flex items-center gap-2 mb-5">
        <Heart weight="duotone" size={24} color={accent} aria-hidden="true" />
        <h2 className="text-title-3 text-text-primary">사랑의 방향</h2>
      </div>

      <div className="space-y-4">
        <FlowBar label="너의 사랑" desc={`${petName}한테 쏟는 정도`} value={lover} accent={accent} highlight={gap > 5} />
        <FlowBar label={`${petName}의 충성`} desc="너에게 의지하는 정도" value={loyalty} accent={accent} highlight={gap < -5} />
      </div>

      <div className="mt-5 pt-4 border-t border-white/[0.08]">
        <p className="text-body-1 text-text-primary text-center font-semibold">{verdict}</p>
      </div>
    </section>
  );
}

function FlowBar({ label, desc, value, accent, highlight }: { label: string; desc: string; value: number; accent: string; highlight: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-body-1 text-text-primary font-semibold">{label}</div>
          <div className="text-caption text-text-tertiary mt-0.5">{desc}</div>
        </div>
        <div className={`text-[22px] font-bold tabular-nums font-aggro ${highlight ? "text-text-primary" : "text-text-secondary"}`}>{v}</div>
      </div>
      <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${v}%`, backgroundColor: highlight ? accent : "rgba(255,255,255,0.22)" }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// ④ 사용설명서 — 스펙시트 (7행 컨셉 유지)
// ────────────────────────────────────────────────────────

function ManualSpecSheet({ manual, petName }: { manual: PetCompatResult["manual"]; petName: string }) {
  const rows: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: "사양", value: manual.spec },
    { label: "권장 환경", value: manual.recommendedEnv },
    { label: "주의사항", value: manual.warnings },
    { label: "충전 방법", value: manual.chargeMethod },
    { label: "오류 신호", value: manual.errorSignals },
    { label: "권장 보호자 모드", value: manual.ownerMode, highlight: true },
  ];

  return (
    <section className="rounded-3xl bg-background-secondary border border-white/[0.08] p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <ClipboardText weight="duotone" size={24} color="#8FB8FF" aria-hidden="true" />
          <h2 className="text-title-3 text-text-primary">{petName} 사용설명서</h2>
        </div>
        <span className="text-caption text-text-tertiary">제품 사양</span>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`flex gap-4 py-3.5 ${r.highlight ? "bg-white/[0.03] -mx-3 px-3 rounded-xl relative" : ""}`}
          >
            {r.highlight && <div className="absolute left-0 top-3.5 bottom-3.5 w-1 rounded-full bg-[#F59E0B]" />}
            <div className={`w-[92px] shrink-0 text-[12px] leading-[1.6] ${r.highlight ? "text-[#F5B45C] font-semibold" : "text-text-tertiary"}`}>
              {r.label}
            </div>
            <div className="flex-1 text-[15px] leading-[1.6] text-text-primary whitespace-pre-line">{r.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
