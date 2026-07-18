"use client";

// 결혼운/애정운 심층 검사 결과 — 스크롤 내러티브.
// app/pet/result/PetResultClient.tsx(durumi-saju-pet 워크트리) 골격 재사용:
//   OpeningScene(풀블리드 등급 히어로) → <section className="px-6 pt-16"> 스택 → sticky 하단 CTA.
// 공유 컴포넌트(components/result/*, components/loading/*) 무수정 — 이 파일에서만 쓰는
// 신규 프레젠테이션(SpecGauge·ReportCard·Reveal 등)은 pet 워크트리 파일을 그대로 옮겨올 수
// 없어(별도 레포/워크트리) 이 파일 안에 인라인으로 이식한다(task-12-brief 범위: 이 두 파일만 생성).
//
// 렌더 키는 lib/marriage-prompt.ts의 OUTPUT_SCHEMA 그대로다(app/api/marriage/analyze/route.ts:
// `full_json: blocks` — applyMarriageGuards가 돌려주는 blocks를 그대로 저장하므로 nested "blocks"
// 키가 아니라 최상위에 gradeHeadline/spousePalace/spouseStar/... 가 바로 있다).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import { getGradeColor } from "@/lib/utils/grade-colors";
import OverallGradeBadgeSlot, { GRADE_GLOWS, type OverallGradeLabel } from "@/components/result/OverallGradeBadgeSlot";
import { MARRIAGE_COST } from "@/lib/constants/coins";
import type { MarriageGrade } from "@/lib/marriage-grade";
import type { MaritalStatus } from "@/lib/marriage-facts";

// ────────────────────────────────────────────────────────
// 타입 — lib/marriage-prompt.ts OUTPUT_SCHEMA와 1:1
// ────────────────────────────────────────────────────────

interface AdviceItem {
  text: string;
  tag: string; // "[근거:...]" — postprocess에서 이 형식이 아니면 이미 컷됨
}

interface MarriageBlocks {
  teaserSummary?: string;
  gradeHeadline: string;
  spousePalace: string;
  spouseStar: string;
  partnerProfile: string;
  relationshipPattern: string;
  timingFlow: string;
  advice: AdviceItem[];
  gunghapCta: string;
}

interface TeaserFacts {
  grade?: MarriageGrade;
  spouseStarType?: "관성" | "재성";
  spouseStarAbsent?: boolean;
  gwansalHonjap?: boolean;
  maritalStatus?: MaritalStatus;
}

interface ApiResponse {
  status: "teaser" | "completed";
  resultId: string;
  maritalStatus: MaritalStatus;
  marriageGrade: MarriageGrade;
  spouseStarType?: "관성" | "재성";
  gwansalHonjap?: boolean;
  spouseStarAbsent?: boolean;
  spousePalaceStability?: "안정" | "보통" | "불안정";
  result?: MarriageBlocks;
  teaser?: TeaserFacts | null;
  createdAt: string;
  error?: string;
}

// display 등급(SS/S/A/B/C, marriage_grade)을 OverallGradeBadgeSlot/getGradeColor가 기대하는
// 내부 등급(S/A/B/C/D)으로 역매핑한다. lib/gradeSystem.ts DISPLAY_GRADE_MAP의 역함수
// (S→SS, A→S, B→A, C→B, D→C) — 그대로 넘기면 "S"가 다시 "SS"로 뻥튀기되는 등 한 단씩 밀린다.
const MARRIAGE_TO_INTERNAL_GRADE: Record<MarriageGrade, OverallGradeLabel> = {
  SS: "S",
  S: "A",
  A: "B",
  B: "C",
  C: "D",
};

// ────────────────────────────────────────────────────────
// 스크롤 등장(fade + up) — app/pet/result 워크트리의 components/hub/Reveal.tsx 이식.
// 이 파일 전용 프레젠테이션이라 인라인(공유 컴포넌트 신설 금지 원칙).
// ────────────────────────────────────────────────────────

function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(22px)",
        transition: "opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {children}
    </div>
  );
}

const EYEBROW = "text-[13px] font-semibold tracking-wide text-primary";
const BODY = "text-[16px] leading-[1.85] text-text-secondary break-keep whitespace-pre-line";

// ────────────────────────────────────────────────────────
// 진입점 — 인증/로딩/에러/teaser·completed 분기 (app/pet/result/PetResultClient.tsx 패턴 미러)
// ────────────────────────────────────────────────────────

export default function MarriageResultClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: authStatus } = useSession();

  const id = searchParams?.get("id") || null;
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      const callback = id ? `/marriage/result?id=${id}` : "/marriage/result";
      router.replace(`/login?callbackUrl=${encodeURIComponent(callback)}`);
      return;
    }
    if (authStatus !== "authenticated") return;

    let cancelled = false;
    const url = id ? `/api/marriage/results?id=${encodeURIComponent(id)}` : "/api/marriage/results";
    fetch(url)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "결과를 불러올 수 없어요.");
        return json as ApiResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || "오류가 발생했어요.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, authStatus, router]);

  if (loading) {
    return <FullScreenLoading message="결과 불러오는 중..." />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center px-6 text-center">
        <p className="text-body-2 text-text-secondary mb-4">{error || "결과가 없어요."}</p>
        <button
          type="button"
          onClick={() => router.push("/marriage")}
          className="btn-primary px-6 py-3 rounded-xl text-[14px] font-semibold"
        >
          결혼운 검사 다시 시작하기
        </button>
      </div>
    );
  }

  if (data.status === "teaser" || !data.result) {
    return <TeaserLockedView data={data} router={router} />;
  }

  return <MarriageResultBody data={data} result={data.result} router={router} />;
}

// ────────────────────────────────────────────────────────
// 결제 전(teaser) 상태 — full_json이 null. 구조 값(등급·배우자성 유형/유무·관살혼잡)만 있는
// teaser_json으로 잠금 화면을 그린다. 크래시 없이 안내 + 결제 재진입 CTA만 제공.
// ────────────────────────────────────────────────────────

function TeaserLockedView({ data, router }: { data: ApiResponse; router: ReturnType<typeof useRouter> }) {
  const grade = data.marriageGrade ?? data.teaser?.grade;
  const internalGrade = grade ? MARRIAGE_TO_INTERNAL_GRADE[grade] : "D";
  const gc = getGradeColor(internalGrade);
  const teaser = data.teaser ?? {};
  const maritalStatus = data.maritalStatus ?? teaser.maritalStatus;

  const starChip = teaser.spouseStarAbsent
    ? "배우자성 없음"
    : teaser.gwansalHonjap
      ? `${teaser.spouseStarType ?? "배우자성"} 혼재`
      : teaser.spouseStarType
        ? `${teaser.spouseStarType} 뚜렷`
        : null;

  return (
    <div className="min-h-screen bg-background-primary text-text-primary">
      <Header showBack sticky onBack={() => router.push("/marriage")} />
      <main className="max-w-[640px] mx-auto animate-fadeIn">
        <section className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
          <div
            className="pointer-events-none absolute left-1/2 top-[42%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px]"
            style={{ background: GRADE_GLOWS[internalGrade] }}
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-center">
            {maritalStatus && <span className="mb-5 text-[13px] text-text-secondary">{maritalStatus} · 결혼운 심층 검사</span>}
            <OverallGradeBadgeSlot grade={internalGrade} size={108} />
            {grade && (
              <div className="mt-4 text-[14px] font-bold tracking-wide" style={{ color: gc.text }}>
                결혼운 {grade}등급
              </div>
            )}
            <h1 className="mt-4 font-aggro text-[28px] leading-[1.3] tracking-tight text-text-primary break-keep max-w-[380px]">
              등급은 나왔어요. 전체 리포트를 열어보세요.
            </h1>
            <p className="mt-4 max-w-[380px] text-[15.5px] leading-[1.7] text-text-secondary break-keep">
              배우자궁 진단, 배우자성 분석, 인연이 열리는 시기까지 — 지금은 등급만 공개돼 있어요.
            </p>
            {(maritalStatus || starChip) && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {maritalStatus && (
                  <span className="rounded-full border border-white/10 bg-background-secondary px-3 py-1.5 text-[13px] text-text-secondary">
                    {maritalStatus}
                  </span>
                )}
                {starChip && (
                  <span className="rounded-full border border-white/10 bg-background-secondary px-3 py-1.5 text-[13px] text-text-secondary">
                    {starChip}
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => router.push("/marriage/input")}
              className="btn-primary mt-8 h-[56px] w-full max-w-[320px] rounded-xl text-[16px] font-bold active:scale-[0.98] transition-transform"
            >
              전체 리포트 보기 · {MARRIAGE_COST}알
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 결제 완료(completed) 상태별 카드 라벨 — 관계 상태(§4) 분기 헤더
// ────────────────────────────────────────────────────────

const STATUS_CARD_LABELS: Record<
  MaritalStatus,
  { eyebrow: string; heading: string; partner: string; pattern: string; timing: string }
> = {
  솔로: {
    eyebrow: "지금 솔로라면",
    heading: "다가올 인연",
    partner: "끌리는 배우자상",
    pattern: "나의 연애 패턴과 맹점",
    timing: "결혼 타이밍",
  },
  연애중: {
    eyebrow: "지금 연애중이라면",
    heading: "이 관계의 결",
    partner: "지금 관계에서 반복되는 패턴",
    pattern: "나의 관계 맹점",
    timing: "결혼 결정 타이밍",
  },
  기혼: {
    eyebrow: "지금 기혼이라면",
    heading: "부부관계의 결",
    partner: "내가 관계에 가져오는 것",
    pattern: "화합의 열쇠와 갈등 지점",
    timing: "부부운 흐름",
  },
  "다시 혼자": {
    eyebrow: "지금 다시 혼자라면",
    heading: "다음 인연을 위한 정비",
    partner: "다시 관계를 맺을 때 보면 좋을 나의 모습",
    pattern: "반복하지 않으면 좋을 패턴",
    timing: "앞으로 열리는 인연 창",
  },
};

// ────────────────────────────────────────────────────────
// 본문 (completed)
// ────────────────────────────────────────────────────────

function MarriageResultBody({
  data,
  result,
  router,
}: {
  data: ApiResponse;
  result: MarriageBlocks;
  router: ReturnType<typeof useRouter>;
}) {
  const marriageGrade = data.marriageGrade;
  const internalGrade = MARRIAGE_TO_INTERNAL_GRADE[marriageGrade] ?? "D";
  const spouseStarAbsent = data.spouseStarAbsent ?? data.teaser?.spouseStarAbsent ?? false;
  const gwansalHonjap = data.gwansalHonjap ?? data.teaser?.gwansalHonjap ?? false;
  const spouseStarType = data.spouseStarType ?? data.teaser?.spouseStarType ?? "관성";
  const cardLabels = STATUS_CARD_LABELS[data.maritalStatus] ?? STATUS_CARD_LABELS["솔로"];

  const starGauge = deriveStarGauge(spouseStarAbsent, gwansalHonjap, spouseStarType);
  const palaceGauge = derivePalaceGauge(data.spousePalaceStability);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary pb-32">
      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="max-w-[640px] mx-auto animate-fadeIn">
        {/* ① 오프닝 — 등급 공개 (풀블리드) */}
        <OpeningScene
          marriageGrade={marriageGrade}
          internalGrade={internalGrade}
          maritalStatus={data.maritalStatus}
          gradeHeadline={result.gradeHeadline}
        />

        {/* ② 배우자궁 진단 + 배우자성 분석 (공통 코어) */}
        <Reveal>
          <section className="px-6 pt-16">
            <p className={EYEBROW}>배우자궁 · 배우자성</p>
            <h2 className="mt-3 font-aggro text-[26px] leading-[1.32] break-keep text-text-primary">
              당신의 결혼운 원국
            </h2>

            <div className="mt-8 space-y-7 rounded-3xl bg-background-secondary px-6 py-7">
              <SpecGauge
                label="배우자성 강약"
                value={starGauge.value}
                leftLabel="없음"
                rightLabel="뚜렷"
                verdict={starGauge.verdict}
              />
              <SpecGauge
                label="배우자궁 안정도"
                value={palaceGauge.value}
                leftLabel="불안정"
                rightLabel="안정"
                verdict={palaceGauge.verdict}
              />
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <h3 className="text-[15.5px] font-bold text-text-primary mb-2">배우자궁(일지)</h3>
                <p className={BODY}>{result.spousePalace}</p>
              </div>
              <div>
                <h3 className="text-[15.5px] font-bold text-text-primary mb-2">배우자성</h3>
                <p className={BODY}>{result.spouseStar}</p>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ③ 관계 상태별 강조 — 카드 3장 (partnerProfile / relationshipPattern / timingFlow) */}
        <Reveal>
          <section className="px-6 pt-16">
            <p className={EYEBROW}>{cardLabels.eyebrow}</p>
            <h2 className="mt-3 font-aggro text-[26px] leading-[1.3] break-keep text-text-primary">
              {cardLabels.heading}
            </h2>
          </section>
        </Reveal>
        <div className="px-6 pt-6 space-y-4">
          <Reveal>
            <ReportCard index={0} eyebrow="배우자상" title={cardLabels.partner} text={result.partnerProfile} />
          </Reveal>
          <Reveal>
            <ReportCard index={1} eyebrow="관계 패턴" title={cardLabels.pattern} text={result.relationshipPattern} />
          </Reveal>
          <Reveal>
            <ReportCard index={2} eyebrow="타이밍" title={cardLabels.timing} text={result.timingFlow} />
          </Reveal>
        </div>

        {/* ④ 실천 조언 */}
        {result.advice?.length > 0 && (
          <Reveal>
            <section className="px-6 pt-16">
              <p className={EYEBROW}>실천 조언</p>
              <h2 className="mt-3 font-aggro text-[26px] leading-[1.3] break-keep text-text-primary">
                이렇게 해보면 좋아요
              </h2>
              <ul className="mt-8 space-y-5">
                {result.advice.map((item, i) => {
                  const reason = parseAdviceTag(item.tag);
                  return (
                    <li key={i} className="flex gap-3">
                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15.5px] leading-[1.75] text-text-secondary break-keep">{item.text}</p>
                        {reason && (
                          <span className="mt-2 inline-block rounded-full bg-white/[0.05] px-2.5 py-1 text-[11.5px] text-text-tertiary">
                            {reason}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </Reveal>
        )}

        {/* ⑤ 궁합 상품 CTA */}
        <Reveal>
          <section className="px-6 pt-16">
            <div className="relative overflow-hidden rounded-3xl bg-background-secondary px-7 py-10 text-center">
              <div
                className="absolute inset-0 pointer-events-none opacity-70"
                style={{ background: GRADE_GLOWS[internalGrade] }}
                aria-hidden="true"
              />
              <div className="relative flex flex-col items-center">
                <p className="text-[15.5px] leading-[1.8] text-text-secondary break-keep max-w-[420px]">
                  {result.gunghapCta}
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/battle")}
                  className="btn-primary mt-6 h-[52px] w-full max-w-[320px] rounded-xl text-[15px] font-semibold active:scale-[0.98] transition-transform"
                >
                  궁합 보기
                </button>
              </div>
            </div>
          </section>
        </Reveal>

        <div className="px-6 pt-8 text-center text-[12px] text-text-tertiary">
          결혼운 {marriageGrade}등급 · {data.maritalStatus} ·{" "}
          {new Date(data.createdAt).toLocaleDateString("ko-KR")}
        </div>
      </main>

      {/* 하단 sticky 액션 바 */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background-primary via-background-primary to-transparent pt-8 pb-5 px-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
      >
        <div className="max-w-[640px] mx-auto flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/marriage/input")}
            className="btn-secondary flex-1 h-[54px] rounded-xl text-[15px] font-semibold"
          >
            다른 상태로 다시 보기
          </button>
          <button
            type="button"
            onClick={() => router.push("/battle")}
            className="btn-primary flex-[1.5] h-[54px] rounded-xl text-[15px] font-semibold"
          >
            궁합 보기
          </button>
        </div>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// ① 오프닝 — 등급 히어로 (일러스트 없음, 글로우 + 큰 타이포)
// ────────────────────────────────────────────────────────

function OpeningScene({
  marriageGrade,
  internalGrade,
  maritalStatus,
  gradeHeadline,
}: {
  marriageGrade: MarriageGrade;
  internalGrade: OverallGradeLabel;
  maritalStatus: MaritalStatus;
  gradeHeadline: string;
}) {
  const gc = getGradeColor(internalGrade);
  return (
    <section className="relative flex min-h-[82vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* 애정운 전용 배경 — 두루미 없이 검사(애정/재물/커리어)를 구분하는 톤 맞춘 추상 이미지. 고정 자산 1장. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/marriage/bg-love.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top opacity-[0.65]"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background-primary/30 via-background-primary/20 to-background-primary"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[42%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px] opacity-70"
        style={{ background: GRADE_GLOWS[internalGrade] }}
        aria-hidden="true"
      />
      <div className="relative flex flex-col items-center">
        <span className="mb-5 text-[13px] text-text-secondary">{maritalStatus} · 결혼운 심층 검사</span>
        <OverallGradeBadgeSlot grade={internalGrade} size={108} />
        <div className="mt-4 text-[14px] font-bold tracking-wide" style={{ color: gc.text }}>
          결혼운 {marriageGrade}등급
        </div>
        <h1 className="mt-4 font-aggro text-[30px] leading-[1.3] tracking-tight text-text-primary break-keep max-w-[420px]">
          {gradeHeadline}
        </h1>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────
// 게이지 — app/pet/result/PetResultClient.tsx RelationAxis 결 재사용(양자 비교축 →
// 단일 축 강약/안정도 표현으로 라벨만 교체).
// ────────────────────────────────────────────────────────

function SpecGauge({
  label,
  value,
  leftLabel,
  rightLabel,
  verdict,
}: {
  label: string;
  value: number; // 0~100 (연속 점수가 아니라 3단계 고정 포지션 — deriveStarGauge/derivePalaceGauge 참고)
  leftLabel: string;
  rightLabel: string;
  verdict: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[13.5px] font-semibold text-text-secondary">{label}</span>
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

// 배우자성 강약 — 엔진 확정값(spouseStarAbsent·gwansalHonjap)만으로 결정론 산출. 3단계 고정
// 포지션(없음/혼재/뚜렷)이지 연속 퍼센트가 아니다 — fabrication 방지(값이 없는데 79% 같은 정밀
// 숫자를 지어내지 않는다).
function deriveStarGauge(
  absent: boolean,
  honjap: boolean,
  starType: "관성" | "재성",
): { value: number; verdict: string } {
  if (absent) return { value: 10, verdict: "배우자성 없음 — 배우자궁으로 봐요" };
  if (honjap) return { value: 50, verdict: `${starType} 두 종류가 섞여 있어요` };
  return { value: 88, verdict: `${starType}이 또렷하게 있어요` };
}

// 배우자궁 안정도 — 엔진 확정값(spousePalaceStability, lib/marriage-facts.ts 일지 6합/6충
// 실측 기반)만으로 결정론 산출. deriveStarGauge와 동일하게 3단계 고정 포지션이지 연속
// 퍼센트가 아니다(fabrication 방지). 이전에는 LLM 산문에서 "흔들리"/"안정적" 등 키워드를
// 정규식으로 긁어와 판정했으나, "크게 흔들릴 걱정은 없어요" 같은 부정문에서 "흔들리"만
// 매치돼 안정 서술을 불안정으로 오분류하는 버그가 있었다 — 실데이터로 교체.
// spousePalaceStability가 없는(마이그레이션 이전) row는 판별 불가이므로 중립 "보통"으로
// 폴백한다 — 절대 옛 정규식 휴리스틱으로 되돌아가지 않는다.
function derivePalaceGauge(
  stability: "안정" | "보통" | "불안정" | undefined,
): { value: number; verdict: string } {
  if (stability === "불안정") return { value: 25, verdict: "흔들리는 결이 보여요" };
  if (stability === "안정") return { value: 80, verdict: "안정적인 결이에요" };
  return { value: 50, verdict: "결이 섞여 있어요" };
}

// ────────────────────────────────────────────────────────
// 카드형 블록 — app/pet/result/PetResultClient.tsx SimCard 결 재사용.
// ────────────────────────────────────────────────────────

function ReportCard({ index, eyebrow, title, text }: { index: number; eyebrow: string; title: string; text: string }) {
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
          <span className="font-aggro text-[14px] tracking-wide text-primary">{eyebrow}</span>
          <span className="h-px flex-1 bg-white/[0.08]" aria-hidden="true" />
        </div>
        <h3 className="mb-4 text-[20px] font-bold leading-[1.4] text-text-primary break-keep">{title}</h3>
        <p className="text-[16px] leading-[1.85] text-text-secondary break-keep whitespace-pre-line">{text}</p>
      </div>
    </article>
  );
}

// ────────────────────────────────────────────────────────
// advice.tag "[근거:일지충]" → "일지충" 칩 텍스트만 추출. 형식이 깨졌으면(이미 postprocess가
// 걸러내지만 방어적으로) 칩 자체를 숨기고 조언 문장만 깔끔하게 보여준다 — 사용자에게
// "[근거:...]" 원문을 그대로 노출하지 않는다.
// ────────────────────────────────────────────────────────

function parseAdviceTag(tag: string | undefined | null): string | null {
  if (!tag) return null;
  const m = /\[근거:([^\]]+)\]/.exec(tag);
  return m ? m[1] : null;
}
