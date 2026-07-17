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
import SectionList, { type ResultSection, type SectionMeta } from "@/components/result/SectionList";
import { Megaphone, PawPrint, GameController, MapPin, ClipboardText, Heart, Lightning } from "@phosphor-icons/react";
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

  // ⑤ 판정·시뮬·타임라인 — SectionList meta 오버라이드
  const sections: ResultSection[] = [
    { icon: "pet-owner", title: result.ownerVerdictTitle || "너에게 솔직히", content: result.ownerVerdict, meta: metaOf(Megaphone, "보호자", "#F87171") },
    { icon: "pet-pet", title: result.petVerdictTitle || `${data.pet.name}에 대해`, content: result.petVerdict, meta: metaOf(PawPrint, "이 아이", "#4ADE80") },
    ...(result.simulations ?? []).map((s, i) => ({
      icon: `pet-sim-${i}`,
      title: s.scene,
      content: s.prediction,
      meta: metaOf(GameController, "이런 상황", "#F59E0B"),
    })),
    ...(result.futureLine
      ? [{ icon: "pet-future", title: result.futureLineTitle || "앞으로의 너희", content: result.futureLine, meta: metaOf(MapPin, "타임라인", "#A855F7") }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background-primary text-text-primary pb-32">
      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="max-w-[640px] mx-auto px-5 pt-6 space-y-4 animate-fadeIn durumi-stagger">
        {/* ① HERO — 일러스트(블록 없이 이미지만) + 궁합 등급 */}
        {data.illustration_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.illustration_url}
            alt={`${data.pet.name} 일러스트`}
            className="w-full aspect-square object-cover rounded-3xl"
          />
        )}
        <section className="flex flex-col items-center text-center pt-2 pb-1">
          <span className="text-caption text-text-tertiary mb-3">{data.pet.name} × 너 궁합</span>
          <OverallGradeBadgeSlot grade={data.label_grade} badgeSrc={getGradeBadge(data.label_grade)} size={84} />
          <div className="mt-2 text-body-2 font-bold tracking-wide" style={{ color: gc.text }}>
            궁합 {safeDisplayGrade(data.label_grade)}등급 · {data.composite_score}점
          </div>
          <h1 className="mt-3 font-aggro text-[24px] leading-[1.3] tracking-tight text-text-primary">
            {data.label_text}
          </h1>
          <p className="mt-2 text-[14.5px] text-text-secondary leading-[1.75]">
            {result.label.headline}
          </p>
        </section>

        {/* ②③ 관계 역학 — 권력축 · 애정축을 하나의 '우리 사이' 카드로 통합 */}
        <RelationshipCard
          ruler={data.ruler_score}
          lover={data.lover_score}
          loyalty={data.loyalty_score}
          sync={data.sync_score}
          conflict={data.conflict_score}
          petName={data.pet.name}
        />

        {/* ④ 사용설명서 */}
        <ManualSpecSheet manual={result.manual} petName={data.pet.name} />

        {/* ⑤ 판정 · 시뮬 · 타임라인 */}
        <section className="pt-1">
          <SectionList sections={sections} initialExpandedCount={sections.length} showAccentBar={false} />
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
// ②③ 관계 지도 — 권력축(누가 대장) × 애정축(누가 더 좋아해) 사분면
// ────────────────────────────────────────────────────────

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// 두 축의 조합 → 관계 유형(아키타입) 카피
function relationshipArchetype(ruler: number, gap: number, p: string): { label: string; desc: string } {
  const power = ruler <= 42 ? "owner" : ruler >= 58 ? "pet" : "even";
  const love = gap >= 8 ? "owner" : gap <= -8 ? "pet" : "both";
  const M: Record<string, { label: string; desc: string }> = {
    "owner-owner": { label: "다 퍼주는 대장", desc: `네가 관계를 이끌면서 애정도 네가 더 쏟아. ${p}는 그 사랑을 편히 누리는 중이야.` },
    "owner-pet": { label: "든든한 보호자", desc: `네가 중심을 딱 잡아주고, ${p}는 너한테 폭 안겨 의지해. 안정적인 그림이야.` },
    "owner-both": { label: "믿음직한 리더", desc: `주도권은 네 쪽이지만, 정은 서로 비슷하게 주고받는 사이야.` },
    "even-owner": { label: "살짝 기우는 짝꿍", desc: `힘은 팽팽한데 마음은 네가 조금 더 기울어 있어.` },
    "even-pet": { label: "너를 따르는 짝꿍", desc: `힘은 대등하지만 ${p}가 너를 한 뼘 더 따르는 사이야.` },
    "even-both": { label: "찰떡 단짝", desc: `힘도 정도 딱 균형. 서로에게 제일 편한 짝꿍이야.` },
    "pet-owner": { label: "상전 모시는 집사", desc: `${p}가 대장이고, 너는 기꺼이 다 맞춰주는 집사 포지션이야.` },
    "pet-pet": { label: "츤데레 왕", desc: `${p}가 대장인 척하지만, 사실은 너 없으면 못 사는 타입이야.` },
    "pet-both": { label: "귀여운 폭군", desc: `${p}가 주도권을 쥐었지만, 정은 서로 비슷하게 오가.` },
  };
  return M[`${power}-${love}`];
}

// 양방향 관계 축 — 앱 공용 '마커-축' 언어(OverallDistributionChart·TugBar 계열)
function RelationAxis({
  question,
  leftLabel,
  rightLabel,
  value,
  verdict,
}: {
  question: string;
  leftLabel: string;
  rightLabel: string;
  value: number; // 0=완전 왼쪽, 50=중앙, 100=완전 오른쪽
  verdict: string;
}) {
  const v = clamp(value, 0, 100);
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-text-secondary">{question}</span>
        <span className="text-caption text-text-tertiary">{verdict}</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-background-tertiary">
        <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-white/15" />
        <div
          className="absolute top-0 bottom-0 bg-primary/30 transition-[left,right] duration-700 ease-out"
          style={v >= 50 ? { left: "50%", right: `${100 - v}%` } : { left: `${v}%`, right: "50%" }}
        />
      </div>
      <div className="relative h-0">
        <div
          className="absolute -top-[13px] h-3 w-3 rounded-full bg-primary ring-2 ring-background-secondary transition-[left] duration-700 ease-out"
          style={{ left: `calc(${v}% - 6px)` }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[12.5px] text-text-tertiary">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function RelationshipCard({
  ruler,
  lover,
  loyalty,
  sync,
  conflict,
  petName,
}: {
  ruler: number;
  lover: number;
  loyalty: number;
  sync: number;
  conflict: number;
  petName: string;
}) {
  const gap = lover - loyalty; // >0 = 네가 더, <0 = 펫이 더
  const arche = relationshipArchetype(ruler, gap, petName);

  // 대장 축: 0=너, 100=펫
  const powerVerdict = ruler >= 58 ? `${petName} 우위` : ruler <= 42 ? "네가 우위" : "팽팽한 균형";
  // 애정 축: 0=너가 더, 100=펫이 더
  const loveValue = clamp(50 + (loyalty - lover) * 0.6, 0, 100);
  const loveVerdict = gap >= 8 ? "네가 더 좋아해" : gap <= -8 ? `${petName}가 더 좋아해` : "비슷하게 좋아해";

  return (
    <section className="rounded-3xl bg-background-secondary border border-white/[0.08] p-6">
      <div className="mb-5 flex items-center gap-2">
        <Heart weight="duotone" size={24} className="text-primary" aria-hidden="true" />
        <h2 className="font-aggro text-title-3 text-text-primary">우리 사이</h2>
      </div>

      {/* 관계 유형 — 두 축의 조합에서 나온 히어로 콘텐츠 */}
      <div className="mb-7">
        <div className="text-caption text-text-tertiary mb-1.5">우리 관계 유형</div>
        <div className="font-aggro text-[24px] leading-tight text-text-primary">{arche.label}</div>
        <p className="mt-2.5 text-[15px] text-text-secondary leading-[1.7]">{arche.desc}</p>
      </div>

      {/* 두 축 — 유형의 근거 */}
      <div className="space-y-6">
        <RelationAxis question="누가 대장?" leftLabel="너" rightLabel={petName} value={clamp(ruler, 0, 100)} verdict={powerVerdict} />
        <RelationAxis question="누가 더 좋아해?" leftLabel="너" rightLabel={petName} value={loveValue} verdict={loveVerdict} />
      </div>

      {/* 신호: 호흡 · 어긋남 */}
      <div className="mt-7 pt-5 border-t border-white/[0.08] grid grid-cols-2 gap-4">
        <MiniStat Icon={PawPrint} label="호흡 지수" desc="둘이 얼마나 잘 맞는지" value={sync} />
        <MiniStat Icon={Lightning} label="사주 어긋남" desc="낮을수록 잘 맞음" value={conflict} />
      </div>
    </section>
  );
}

function MiniStat({ Icon, label, desc, value }: { Icon: ComponentType<Record<string, unknown>>; label: string; desc: string; value: number }) {
  return (
    <div className="rounded-2xl bg-background-tertiary p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={15} weight="duotone" className="text-text-secondary" aria-hidden="true" />
        <span className="text-caption text-text-secondary font-medium">{label}</span>
      </div>
      <div className="text-[26px] font-bold font-aggro tabular-nums text-text-primary leading-none">{value}</div>
      <div className="text-caption text-text-tertiary mt-1.5">{desc}</div>
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
          <h2 className="font-aggro text-title-3 text-text-primary">{petName} 사용설명서</h2>
        </div>
        <span className="text-caption text-text-tertiary">제품 사양</span>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`flex gap-4 py-3.5 ${r.highlight ? "bg-white/[0.03] -mx-3 px-3 rounded-xl" : ""}`}
          >
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
