"use client";

// 펫 궁합 결과 페이지 — 몰입형 '스토리 스크롤' (에디토리얼 재설계)
// 데이터패치 wrapper·Header·footer 공유버튼은 유지, 프레젠테이션만 전면 교체.
// 공유 컴포넌트(components/result/*) 무수정 — 펫 전용 신규 컴포넌트만 추가.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import { getGradeColor, getGradeBadge } from "@/lib/utils/grade-colors";
import { safeDisplayGrade } from "@/lib/gradeSystem";
import OverallGradeBadgeSlot, { GRADE_GLOWS } from "@/components/result/OverallGradeBadgeSlot";
import Reveal from "@/components/hub/Reveal";
import { House, BatteryCharging, Warning, Bell, Compass, Quotes, type Icon } from "@phosphor-icons/react";
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

// ════════════════════════════════════════════════════════
// 스토리 스크롤 본체 (mock 데모·리디자인 타깃)
// ════════════════════════════════════════════════════════

const EYEBROW = "text-[13px] font-semibold tracking-wide text-primary";
const BODY = "text-[16px] leading-[1.85] text-text-secondary break-keep";

export function PetResultBody({ data }: { data: PetResultData }) {
  const router = useRouter();
  const result = data.full_result;
  const gc = getGradeColor(data.label_grade);
  const petName = data.pet.name;

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/pet/result/share/${data.id}`;
    const shareText = `${petName}와의 궁합: ${data.label_text}\n${result.finalLine}`;
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

  // 관계 유형 + 축 값 (구 PetManualCard 로직 이식·재사용)
  const gap = data.lover_score - data.loyalty_score; // >0 = 네가 더, <0 = 펫이 더
  const arche = relationshipArchetype(data.ruler_score, gap, petName);
  const powerVerdict = data.ruler_score >= 58 ? `${petName} 우위` : data.ruler_score <= 42 ? "네가 우위" : "팽팽한 균형";
  const loveValue = clamp(50 + (data.loyalty_score - data.lover_score) * 0.6, 0, 100);
  const loveVerdict = gap >= 8 ? "네가 더 좋아해" : gap <= -8 ? `${petName}가 더 좋아해` : "비슷하게 좋아해";

  const chips = parseSpec(result.manual.spec);

  const careItems: Array<{ Icon: Icon; label: string; value: string; highlight?: boolean }> = [
    { Icon: House, label: "이런 환경을 좋아해요", value: result.manual.recommendedEnv },
    { Icon: BatteryCharging, label: "이렇게 충전돼요", value: result.manual.chargeMethod },
    { Icon: Warning, label: "이건 살짝 조심해요", value: result.manual.warnings },
    { Icon: Bell, label: "이런 신호를 보내요", value: result.manual.errorSignals },
    { Icon: Compass, label: "너는 이렇게 대해줘", value: result.manual.ownerMode, highlight: true },
  ];

  return (
    <div className="min-h-screen bg-background-primary text-text-primary pb-32">
      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="max-w-[640px] mx-auto animate-fadeIn">
        {/* ① 오프닝 — 등급 공개 (풀블리드) */}
        <OpeningScene data={data} gc={gc} petName={petName} />

        {/* ② 이 아이는 */}
        <Reveal>
          <section className="px-6 pt-16">
            <p className={EYEBROW}>이 아이는</p>
            <h2 className="mt-3 font-aggro text-[26px] leading-[1.32] break-keep text-text-primary">
              {result.petVerdictTitle || `${petName}라는 아이`}
            </h2>
            {chips.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <span
                    key={c.text}
                    className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3.5 py-1.5 text-[13.5px] font-medium text-text-secondary"
                  >
                    {c.dot && <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden="true" />}
                    {c.text}
                  </span>
                ))}
              </div>
            )}
            <p className={`mt-6 ${BODY}`}>{result.petVerdict}</p>
          </section>
        </Reveal>

        {/* ③ 너희 관계는 */}
        <Reveal>
          <section className="px-6 pt-16">
            <p className={EYEBROW}>너희 관계는</p>
            <h2 className="mt-3 font-aggro text-[26px] leading-[1.3] break-keep text-text-primary">{arche.label}</h2>
            <p className={`mt-4 ${BODY}`}>{arche.desc}</p>

            <div className="mt-8 space-y-7 rounded-3xl bg-background-secondary px-6 py-7">
              <RelationAxis
                question="누가 대장?"
                leftLabel="너"
                rightLabel={petName}
                value={clamp(data.ruler_score, 0, 100)}
                verdict={powerVerdict}
              />
              <RelationAxis
                question="누가 더 좋아해?"
                leftLabel="너"
                rightLabel={petName}
                value={loveValue}
                verdict={loveVerdict}
              />
            </div>

            <p className={`mt-7 ${BODY}`}>{result.ownerVerdict}</p>
          </section>
        </Reveal>

        {/* ④ 이런 순간들이 펼쳐져요 — 시뮬레이션 (핵심) */}
        <Reveal>
          <section className="px-6 pt-16">
            <p className={EYEBROW}>이런 순간들이 펼쳐져요</p>
            <h2 className="mt-3 font-aggro text-[26px] leading-[1.3] break-keep text-text-primary">
              {petName}와 보낼 하루
            </h2>
          </section>
        </Reveal>
        <div className="px-6 pt-6 space-y-4">
          {(result.simulations ?? []).map((s, i) => (
            <Reveal key={`sim-${i}`}>
              <SimCard index={i} scene={s.scene} prediction={s.prediction} />
            </Reveal>
          ))}
        </div>

        {/* ⑤ 이렇게 지내면 좋아요 — 취급법 */}
        <Reveal>
          <section className="px-6 pt-16">
            <p className={EYEBROW}>이렇게 지내면 좋아요</p>
            <h2 className="mt-3 font-aggro text-[26px] leading-[1.3] break-keep text-text-primary">
              {petName} 다루는 법
            </h2>
            <div className="mt-8 space-y-7">
              {careItems.map((item) => (
                <div key={item.label} className="flex gap-4">
                  <div className="shrink-0 flex items-center justify-center h-11 w-11 rounded-2xl bg-white/[0.05]">
                    <item.Icon
                      size={22}
                      weight="duotone"
                      className={item.highlight ? "text-primary" : "text-text-secondary"}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className={`text-[15.5px] font-bold mb-1.5 break-keep ${item.highlight ? "text-primary" : "text-text-primary"}`}>
                      {item.label}
                    </div>
                    <p className="text-[15.5px] leading-[1.75] text-text-secondary break-keep whitespace-pre-line">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ⑥ 앞으로 */}
        {result.futureLine && (
          <Reveal>
            <section className="px-6 pt-16">
              <p className={EYEBROW}>앞으로</p>
              <h2 className="mt-3 font-aggro text-[23px] leading-[1.35] break-keep text-text-primary">
                {result.futureLineTitle || "앞으로의 너희"}
              </h2>
              <p className={`mt-4 ${BODY}`}>{result.futureLine}</p>
            </section>
          </Reveal>
        )}

        {/* ⑦ 두루미의 한 줄 */}
        <Reveal>
          <section className="px-6 pt-16">
            <div className="relative overflow-hidden rounded-3xl bg-background-secondary px-7 py-12 text-center">
              <div
                className="absolute inset-0 pointer-events-none opacity-70"
                style={{ background: GRADE_GLOWS[data.label_grade] }}
                aria-hidden="true"
              />
              <div className="relative flex flex-col items-center">
                <Quotes size={30} weight="fill" className="text-primary mb-4" aria-hidden="true" />
                <p className="font-aggro text-[22px] leading-[1.5] break-keep text-text-primary">{result.finalLine}</p>
                <span className="mt-6 text-[13px] font-medium text-text-tertiary">두루미의 한 줄</span>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ⑧ 면책(D등급) + 메타 */}
        {result.disclaimer && (
          <section className="px-6 pt-8">
            <p className="text-[14px] text-text-secondary leading-relaxed break-keep">※ {result.disclaimer}</p>
          </section>
        )}

        <div className="px-6 pt-8 text-center text-[12px] text-text-tertiary">
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
// ① 오프닝 — 일러스트 풀블리드(영화 포스터) / 무일러스트=글로우+타이포
// ────────────────────────────────────────────────────────

function OpeningScene({
  data,
  gc,
  petName,
}: {
  data: PetResultData;
  gc: { text: string };
  petName: string;
}) {
  const grade = data.label_grade;
  const gradeLine = (
    <div className="text-[14px] font-bold tracking-wide" style={{ color: gc.text }}>
      궁합 {safeDisplayGrade(grade)}등급 · {data.composite_score}점
    </div>
  );

  if (data.illustration_url) {
    return (
      <section className="relative flex min-h-[86vh] flex-col justify-end overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.illustration_url}
          alt={`${petName} 일러스트`}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-background-primary via-background-primary/55 to-background-primary/5"
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-center px-6 pb-6 text-center">
          <span className="mb-3 text-[13px] text-text-secondary">{petName} × 너 궁합</span>
          <OverallGradeBadgeSlot grade={grade} badgeSrc={getGradeBadge(grade)} size={76} />
          <div className="mt-2">{gradeLine}</div>
          <h1 className="mt-3 font-aggro text-[30px] leading-[1.26] tracking-tight text-text-primary break-keep">
            {data.label_text}
          </h1>
          <p className="mt-3 max-w-[400px] text-[15px] leading-[1.7] text-text-secondary break-keep">
            {data.full_result.label.headline}
          </p>
        </div>
      </section>
    );
  }

  // 무일러스트 — 등급 글로우 + 큰 타이포
  return (
    <section className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        className="pointer-events-none absolute left-1/2 top-[42%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px]"
        style={{ background: GRADE_GLOWS[grade] }}
        aria-hidden="true"
      />
      <div className="relative flex flex-col items-center">
        <span className="mb-5 text-[13px] text-text-secondary">{petName} × 너 궁합</span>
        <OverallGradeBadgeSlot grade={grade} badgeSrc={getGradeBadge(grade)} size={108} />
        <div className="mt-4">{gradeLine}</div>
        <h1 className="mt-4 font-aggro text-[34px] leading-[1.24] tracking-tight text-text-primary break-keep">
          {data.label_text}
        </h1>
        <p className="mt-4 max-w-[400px] text-[15.5px] leading-[1.7] text-text-secondary break-keep">
          {data.full_result.label.headline}
        </p>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────
// ④ 시뮬레이션 스토리 카드 (capture-worthy)
// ────────────────────────────────────────────────────────

function SimCard({ index, scene, prediction }: { index: number; scene: string; prediction: string }) {
  const no = String(index + 1).padStart(2, "0");
  return (
    <article className="relative overflow-hidden rounded-3xl bg-background-secondary px-6 py-7">
      <span
        className="pointer-events-none absolute -top-3 right-3 font-aggro text-[68px] leading-none text-white/[0.045]"
        aria-hidden="true"
      >
        {no}
      </span>
      <div className="relative">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="font-aggro text-[14px] tracking-wide text-primary">순간 {no}</span>
          <span className="h-px flex-1 bg-white/[0.08]" aria-hidden="true" />
        </div>
        <h3 className="mb-4 text-[20px] font-bold leading-[1.4] text-text-primary break-keep">{scene}</h3>
        <p className="text-[16px] leading-[1.85] text-text-secondary break-keep">{prediction}</p>
      </div>
    </article>
  );
}

// ────────────────────────────────────────────────────────
// manual.spec → 프로필 칩 파싱 ("6세, 시츄, 子(쥐)띠 水 기운" → 한자 제거)
// ────────────────────────────────────────────────────────

const ELEMENT_MAP: Record<string, { label: string; dot: string }> = {
  水: { label: "물의 기운", dot: "bg-saju-water" },
  火: { label: "불의 기운", dot: "bg-saju-fire" },
  木: { label: "나무의 기운", dot: "bg-saju-wood" },
  金: { label: "쇠의 기운", dot: "bg-saju-metal" },
  土: { label: "흙의 기운", dot: "bg-saju-earth" },
};

function parseSpec(spec: string): Array<{ text: string; dot?: string }> {
  const chips: Array<{ text: string; dot?: string }> = [];
  spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((part) => {
      const zodiac = part.match(/\(([^)]+)\)띠/); // "子(쥐)띠" → "쥐"
      const elChar = part.match(/[水火木金土]/);
      if (zodiac) chips.push({ text: `${zodiac[1]}띠` });
      if (elChar && ELEMENT_MAP[elChar[0]]) {
        chips.push({ text: ELEMENT_MAP[elChar[0]].label, dot: ELEMENT_MAP[elChar[0]].dot });
      }
      if (!zodiac && !elChar) chips.push({ text: part });
    });
  return chips;
}

// ────────────────────────────────────────────────────────
// 관계 유형(아키타입) + 양방향 관계 축 — 구 구현 이식·재사용
// ────────────────────────────────────────────────────────

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

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
        <span className="text-[13.5px] font-semibold text-text-secondary">{question}</span>
        <span className="text-[12.5px] text-text-tertiary">{verdict}</span>
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
