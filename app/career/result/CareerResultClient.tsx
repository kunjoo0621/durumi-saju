"use client";

// 커리어운 심층 검사 결과 — 스크롤 내러티브. app/wealth/result/WealthResultClient.tsx 골격 미러
// (OpeningScene 등급 히어로 → <section className="px-6 pt-16"> 스택 → sticky 하단 CTA).
// SpecGauge·Reveal·ReportCard·FortuneWeatherTimeline 등 프레젠테이션은 wealth 파일과 마찬가지로
// 이 파일 안에 인라인으로 둔다(공유 컴포넌트 신설 금지 원칙, wealth 파일 상단 주석과 동일 근거).
//
// 렌더 키는 lib/career-prompt.ts의 OUTPUT_SCHEMA 그대로다(app/api/career/analyze/route.ts:
// `full_json: blocks` — applyCareerGuards가 돌려주는 blocks를 그대로 저장하므로 nested "blocks"
// 키가 아니라 최상위에 gradeHeadline/gwanseongDiagnosis/careerGripDiagnosis/... 가 바로 있다):
//   teaserSummary, gradeHeadline, gwanseongDiagnosis, careerGripDiagnosis,
//   workStyle, riskAndPace, timingFlow, advice[{text,tag}], yearlyCta.
//
// 게이지 데이터 출처(fabrication 0 — wealth의 deriveJaeseongStrengthGauge/deriveJaeGripGauge와 동일 원칙):
// GET /api/career/results는 gwanseong_strength/bigeop_strength 같은 원시 가중치 숫자를 저장·반환하지
// 않는다(컬럼 자체가 없다). 대신 gwanseongType(정관우세/편관우세/관살혼잡/무관)과 careerGrip
// (신왕관왕/신왕관쇠/관다신약/신약관소, lib/career-facts.ts deriveCareerFacts의 gwanStrongThreshold
// 판정 결과가 그대로 인코딩된 값)이 응답에 있다 — careerGrip의 뒷 두 글자("관왕"=관성 강 /
// "관쇠"·"관소"=관성 약)가 이미 "관성이 강한지"의 결정론 결과이므로, 원시 점수 없이도 이 두
// 필드만으로 두 게이지 모두 근거 있게 그린다(새 숫자를 지어내지 않음).
//   게이지1(관성 강약) = gwanseongType(무관 여부) + careerGrip(관왕/관쇠 성분)
//   게이지2(관을 담는 그릇) = careerGrip 4상한을 그대로 스펙트럼 포지션에 매핑

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import { getGradeColor } from "@/lib/utils/grade-colors";
import OverallGradeBadgeSlot, { GRADE_GLOWS, type OverallGradeLabel } from "@/components/result/OverallGradeBadgeSlot";
import { CAREER_COST } from "@/lib/constants/coins";
import { SHARE_PATH_BY_KIND } from "@/lib/constants/share-reward";
import type { CareerGrade } from "@/lib/career-grade";
import type { CareerSituation, CareerGrip } from "@/lib/career-facts";
import KakaoShareButton from "@/components/share/KakaoShareButton";

// ────────────────────────────────────────────────────────
// 타입 — lib/career-prompt.ts OUTPUT_SCHEMA와 1:1
// ────────────────────────────────────────────────────────

interface AdviceItem {
  text: string;
  tag: string; // "[근거:...]" — postprocess에서 이 형식이 아니면 이미 컷됨
}

interface TimelineEntryView {
  year: number;
  age: number;
  pillarKorean: string;
  tenStar: string;
  twelveStage: string;
  mood: "강세" | "보통" | "주의";
  triggers: string[];
  hint: string;
  isPast: boolean;
  isCurrent: boolean;
}
interface ServerTimelineView {
  version: 1;
  entries: TimelineEntryView[];
  daeun: Array<{ startAge: number; endAge: number; star: string }>;
}

export interface CareerBlocks {
  teaserSummary?: string;
  gradeHeadline: string;
  gwanseongDiagnosis: string;
  careerGripDiagnosis: string;
  workStyle: string;
  riskAndPace: string;
  timingFlow: string;
  advice: AdviceItem[];
  yearlyCta: string;
  serverTimeline?: ServerTimelineView;
}

type GwanseongType = "정관우세" | "편관우세" | "관살혼잡" | "무관";

interface TeaserFacts {
  grade?: CareerGrade;
  gwanseongType?: GwanseongType;
  situation?: CareerSituation;
}

export interface ApiResponse {
  status: "teaser" | "completed";
  resultId: string;
  situation: CareerSituation;
  careerGrade: CareerGrade;
  gwanseongType?: GwanseongType;
  gwandaSinyak?: boolean;
  gwaninSangsaeng?: boolean;
  sanggwanGyeongwan?: boolean;
  careerGrip?: CareerGrip;
  result?: CareerBlocks;
  teaser?: TeaserFacts | null;
  createdAt: string;
  error?: string;
}

// display 등급(SS/S/A/B/C, career_grade)을 OverallGradeBadgeSlot/getGradeColor가 기대하는
// 내부 등급(S/A/B/C/D)으로 역매핑한다. lib/gradeSystem.ts DISPLAY_GRADE_MAP의 역함수
// (S→SS, A→S, B→A, C→B, D→C) — wealth-grade와 컷 라인이 동일하므로 매핑도 그대로 재사용.
const CAREER_TO_INTERNAL_GRADE: Record<CareerGrade, OverallGradeLabel> = {
  SS: "S",
  S: "A",
  A: "B",
  B: "C",
  C: "D",
};

// ────────────────────────────────────────────────────────
// 스크롤 등장(fade + up) — WealthResultClient.tsx Reveal 그대로 이식.
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
// 진입점 — 인증/로딩/에러/teaser·completed 분기 (WealthResultClient.tsx 패턴 미러)
// ────────────────────────────────────────────────────────

export default function CareerResultClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: authStatus } = useSession();

  const id = searchParams?.get("id") || null;
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      const callback = id ? `/career/result?id=${id}` : "/career/result";
      router.replace(`/login?callbackUrl=${encodeURIComponent(callback)}`);
      return;
    }
    if (authStatus !== "authenticated") return;

    let cancelled = false;
    const url = id ? `/api/career/results?id=${encodeURIComponent(id)}` : "/api/career/results";
    fetch(url)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "결과를 못 불러왔어.");
        return json as ApiResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || "오류가 났어.");
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
        <p className="text-body-2 text-text-secondary mb-4">{error || "결과가 없어."}</p>
        <button
          type="button"
          onClick={() => router.push("/career")}
          className="btn-primary px-6 py-3 rounded-xl text-[14px] font-semibold"
        >
          커리어운 검사 다시 시작하기
        </button>
      </div>
    );
  }

  if (data.status === "teaser" || !data.result) {
    return <TeaserLockedView data={data} router={router} />;
  }

  return <CareerResultBody data={data} result={data.result} router={router} />;
}

// ────────────────────────────────────────────────────────
// 결제 전(teaser) 상태 — full_json이 null. 구조 값(등급·관성 유형)만 있는 teaser_json으로
// 잠금 화면을 그린다. 크래시 없이 안내 + 결제 재진입 CTA만 제공.
// ────────────────────────────────────────────────────────

function TeaserLockedView({ data, router }: { data: ApiResponse; router: ReturnType<typeof useRouter> }) {
  const grade = data.careerGrade ?? data.teaser?.grade;
  const internalGrade = grade ? CAREER_TO_INTERNAL_GRADE[grade] : "D";
  const gc = getGradeColor(internalGrade);
  const teaser = data.teaser ?? {};
  const situation = data.situation ?? teaser.situation;
  const gwanseongType = data.gwanseongType ?? teaser.gwanseongType;

  return (
    <div className="min-h-screen bg-background-primary text-text-primary">
      <Header showBack sticky onBack={() => router.push("/career")} />
      <main className="max-w-[640px] mx-auto animate-fadeIn">
        <section className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
          <div
            className="pointer-events-none absolute left-1/2 top-[42%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px]"
            style={{ background: GRADE_GLOWS[internalGrade] }}
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-center">
            {situation && <span className="mb-5 text-[13px] text-text-secondary">{situation} · 커리어운 심층 검사</span>}
            <OverallGradeBadgeSlot grade={internalGrade} size={108} />
            {grade && (
              <div className="mt-4 text-[14px] font-bold tracking-wide" style={{ color: gc.text }}>
                커리어운 {grade}등급
              </div>
            )}
            <h1 className="mt-4 font-aggro text-[28px] leading-[1.3] tracking-tight text-text-primary break-keep max-w-[380px]">
              등급은 나왔어. 전체 리포트를 열어봐.
            </h1>
            <p className="mt-4 max-w-[380px] text-[15.5px] leading-[1.7] text-text-secondary break-keep">
              관성 진단, 자리를 담는 그릇, 일의 흐름이 강해지는 시기까지 — 지금은 등급만 공개돼 있어.
            </p>
            {(situation || gwanseongType) && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {situation && (
                  <span className="rounded-full border border-white/10 bg-background-secondary px-3 py-1.5 text-[13px] text-text-secondary">
                    {situation}
                  </span>
                )}
                {gwanseongType && (
                  <span className="rounded-full border border-white/10 bg-background-secondary px-3 py-1.5 text-[13px] text-text-secondary">
                    {gwanseongType}
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => router.push("/career/input")}
              className="btn-primary mt-8 h-[56px] w-full max-w-[320px] rounded-xl text-[16px] font-bold active:scale-[0.98] transition-transform"
            >
              전체 리포트 보기 · {CAREER_COST}알
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 결제 완료(completed) 상태별 카드 라벨 — 상황(§4) 분기 헤더
// ────────────────────────────────────────────────────────

const SITUATION_CARD_LABELS: Record<
  CareerSituation,
  { eyebrow: string; heading: string; workStyle: string; riskAndPace: string; timingFlow: string }
> = {
  "진로 탐색": {
    eyebrow: "진로가 고민이라면",
    heading: "나한테 맞는 길",
    workStyle: "나한테 맞는 일의 결",
    riskAndPace: "무리 없는 선택 기준",
    timingFlow: "방향이 열리는 시기",
  },
  "현직 성장": {
    eyebrow: "지금 자리에서 크고 싶다면",
    heading: "이 조직에서 크는 결",
    workStyle: "이 조직에서 내 무기",
    riskAndPace: "승진·평가 리스크 관리",
    timingFlow: "힘 실리는 시기",
  },
  "이직 고민": {
    eyebrow: "옮길지 고민이라면",
    heading: "옮김을 푸는 결",
    workStyle: "옮김의 결",
    riskAndPace: "옮김의 타이밍 리스크",
    timingFlow: "움직일 때 vs 다질 때",
  },
  "독립·사업": {
    eyebrow: "내 판을 짜고 싶다면",
    heading: "자기 판을 짜는 결",
    workStyle: "자기 판을 짜는 힘",
    riskAndPace: "감당 가능한 속도",
    timingFlow: "판 벌이기 좋은 시기",
  },
};

// ────────────────────────────────────────────────────────
// 본문 (completed)
// ────────────────────────────────────────────────────────

export function CareerResultBody({
  data,
  result,
  router,
  shareMode,
}: {
  data: ApiResponse;
  result: CareerBlocks;
  router: ReturnType<typeof useRouter>;
  /** 공개 share 페이지에서 렌더할 때 — 로그인 전용 동선과 공유 버튼을 감춘다 */
  shareMode?: boolean;
}) {
  const careerGrade = data.careerGrade;
  const internalGrade = CAREER_TO_INTERNAL_GRADE[careerGrade] ?? "D";
  const gwanseongType = data.gwanseongType ?? data.teaser?.gwanseongType ?? "무관";
  const careerGrip = data.careerGrip;
  const cardLabels = SITUATION_CARD_LABELS[data.situation] ?? SITUATION_CARD_LABELS["진로 탐색"];

  const gwanseongGauge = deriveGwanseongStrengthGauge(gwanseongType, careerGrip);
  const gripGauge = deriveCareerGripGauge(careerGrip);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary pb-32">
      <Header showBack={!shareMode} sticky onBack={() => router.push("/menu")} />

      <main className="max-w-[640px] mx-auto animate-fadeIn">
        {/* ① 오프닝 — 등급 공개 (풀블리드) */}
        <OpeningScene
          careerGrade={careerGrade}
          internalGrade={internalGrade}
          situation={data.situation}
          gradeHeadline={result.gradeHeadline}
        />

        {/* ② 관성 진단 + 자리를 담는 그릇 (공통 코어) */}
        <Reveal>
          <section className="px-6 pt-16">
            <p className={EYEBROW}>관성 · 자리를 담는 그릇</p>
            <h2 className="mt-3 font-aggro text-[26px] leading-[1.32] break-keep text-text-primary">
              당신의 커리어운 원국
            </h2>

            <div className="mt-8 space-y-7 rounded-3xl bg-background-secondary px-6 py-7">
              <SpecGauge
                label="관성 강약"
                value={gwanseongGauge.value}
                leftLabel="없음"
                rightLabel="강함"
                verdict={gwanseongGauge.verdict}
              />
              <SpecGauge
                label="관을 담는 그릇"
                value={gripGauge.value}
                leftLabel="작음"
                rightLabel="넉넉함"
                verdict={gripGauge.verdict}
              />
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <h3 className="text-[15.5px] font-bold text-text-primary mb-2">관성 진단</h3>
                <p className={BODY}>{result.gwanseongDiagnosis}</p>
              </div>
              <div>
                <h3 className="text-[15.5px] font-bold text-text-primary mb-2">자리를 담는 그릇</h3>
                <p className={BODY}>{result.careerGripDiagnosis}</p>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ②.5 커리어 날씨 타임라인 — 서버 결정론(serverTimeline). 과거 결제분엔 키 없음 → 스킵 */}
        {result.serverTimeline && result.serverTimeline.entries.length > 0 && (
          <Reveal>
            <section className="px-6 pt-16">
              <p className={EYEBROW}>앞으로 5년</p>
              <h2 className="mt-3 font-aggro text-[26px] leading-[1.3] break-keep text-text-primary">
                커리어 날씨 타임라인
              </h2>
              <div className="mt-8">
                <FortuneWeatherTimeline
                  title="해마다 달라지는 일의 기류"
                  daeunLabel={(d) => `${d.startAge}~${d.endAge}세 · ${d.star} 대운`}
                  timeline={result.serverTimeline}
                />
              </div>
            </section>
          </Reveal>
        )}

        {/* ③ 상황별 강조 — 카드 3장 (workStyle / riskAndPace / timingFlow) */}
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
            <ReportCard index={0} eyebrow="방식" title={cardLabels.workStyle} text={result.workStyle} />
          </Reveal>
          <Reveal>
            <ReportCard index={1} eyebrow="속도·리스크" title={cardLabels.riskAndPace} text={result.riskAndPace} />
          </Reveal>
          <Reveal>
            <ReportCard index={2} eyebrow="타이밍" title={cardLabels.timingFlow} text={result.timingFlow} />
          </Reveal>
        </div>

        {/* ④ 실천 조언 */}
        {result.advice?.length > 0 && (
          <Reveal>
            <section className="px-6 pt-16">
              <p className={EYEBROW}>실천 조언</p>
              <h2 className="mt-3 font-aggro text-[26px] leading-[1.3] break-keep text-text-primary">
                이렇게 해봐
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

        {/* ⑤ 올해의 운세(yearly) CTA — share 페이지에서는 감춘다(유입 CTA는 하단 하나만) */}
        {!shareMode && (
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
                    {result.yearlyCta}
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/yearly")}
                    className="btn-primary mt-6 h-[52px] w-full max-w-[320px] rounded-xl text-[15px] font-semibold active:scale-[0.98] transition-transform"
                  >
                    올해 일의 흐름 보기
                  </button>
                </div>
              </div>
            </section>
          </Reveal>
        )}

        <div className="px-6 pt-8 text-center text-[12px] text-text-tertiary">
          커리어운 {careerGrade}등급 · {data.situation} ·{" "}
          {new Date(data.createdAt).toLocaleDateString("ko-KR")}
        </div>

        {/* ★ 결정론 면책 문구(LLM 출력 아님, 항상 렌더). lib/career-prompt.ts 절대 규칙으로 LLM
            산문에서도 전문 상담을 막지만, 그건 확률적 가드일 뿐이라 경계선은 서버 텍스트가 아니라
            이렇게 하드코딩된 UI 문구로 별도 고정한다(wealth 투자 자문 면책의 커리어판). */}
        <p className="px-6 pt-8 text-center text-[12px] text-text-tertiary">
          본 리포트는 명리 해석 콘텐츠이며 직업·진로에 대한 전문 상담이 아닙니다.
        </p>

        {/* 공유 — 보상 지급은 카카오 전송 성공 웹훅 기준(Phase 2b) */}
        {!shareMode && <CareerShareAction resultId={data.resultId} careerGrade={careerGrade} />}

        {/* 재열람 안내 — 결과는 "내 결과"에 저장돼 언제든 다시 볼 수 있다 */}
        {!shareMode && (
          <div className="px-6 pt-5 text-center">
            <p className="text-[13px] text-text-tertiary">이 결과는 내 결과에서 다시 볼 수 있어</p>
            <button
              type="button"
              onClick={() => router.push("/my/results")}
              className="mt-2 text-[14px] font-semibold text-primary underline underline-offset-4 active:opacity-80"
            >
              내 결과 보러가기
            </button>
          </div>
        )}
      </main>

      {/* 하단 sticky 액션 바 — share 페이지에서는 로그인 동선 대신 유입 CTA 하나로
          (yearly share의 FooterSection shareMode 분기와 동일 결) */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background-primary via-background-primary to-transparent pt-8 pb-5 px-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
      >
        <div className="max-w-[640px] mx-auto flex gap-3">
          {shareMode ? (
            <a
              href="/career"
              className="btn-primary flex-1 h-[54px] rounded-xl text-[15px] font-semibold flex items-center justify-center"
            >
              나도 커리어운 보기
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push("/career/input")}
                className="btn-secondary flex-1 h-[54px] rounded-xl text-[15px] font-semibold"
              >
                다른 고민으로 다시 보기
              </button>
              <button
                type="button"
                onClick={() => router.push("/yearly")}
                className="btn-primary flex-[1.5] h-[54px] rounded-xl text-[15px] font-semibold"
              >
                올해 일의 흐름 보기
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// ① 오프닝 — 등급 히어로. ★배경 이미지 없이 그라디언트만(에셋 미생성 — bg-career 참조 금지).
// wealth OpeningScene은 bg-wealth.webp를 깔지만, 커리어는 골드 톤 고착을 막으려 중립 그라디언트 +
// 등급 글로우만으로 히어로를 채운다.
// ────────────────────────────────────────────────────────

function OpeningScene({
  careerGrade,
  internalGrade,
  situation,
  gradeHeadline,
}: {
  careerGrade: CareerGrade;
  internalGrade: OverallGradeLabel;
  situation: CareerSituation;
  gradeHeadline: string;
}) {
  const gc = getGradeColor(internalGrade);
  return (
    <section className="relative flex min-h-[82vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* 배경 = 중립 그라디언트 베일(이미지 없음). 위→아래로 은은히 어두워지는 톤만 깐다. */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background-secondary/60 via-background-primary/40 to-background-primary"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[42%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px] opacity-70"
        style={{ background: GRADE_GLOWS[internalGrade] }}
        aria-hidden="true"
      />
      <div className="relative flex flex-col items-center">
        <span className="mb-5 text-[13px] text-text-secondary">{situation} · 커리어운 심층 검사</span>
        <OverallGradeBadgeSlot grade={internalGrade} size={108} />
        <div className="mt-4 text-[14px] font-bold tracking-wide" style={{ color: gc.text }}>
          커리어운 {careerGrade}등급
        </div>
        <h1 className="mt-4 font-aggro text-[30px] leading-[1.3] tracking-tight text-text-primary break-keep max-w-[420px]">
          {gradeHeadline}
        </h1>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────
// 게이지 — WealthResultClient.tsx SpecGauge 그대로 이식(라벨만 커리어 도메인으로 교체).
// ────────────────────────────────────────────────────────

function SpecGauge({
  label,
  value,
  leftLabel,
  rightLabel,
  verdict,
}: {
  label: string;
  value: number; // 0~100 (연속 점수가 아니라 고정 포지션 — deriveGwanseongStrengthGauge/deriveCareerGripGauge 참고)
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

// 관성 강약 — 엔진 확정값(gwanseongType·careerGrip)만으로 결정론 산출. GET /api/career/results는
// gwanseongStrength(원시 가중 점수)를 반환하지 않는다(파일 상단 주석 참고) — 대신 careerGrip
// 자체가 "isStrong ? (gwanStrong?신왕관왕:신왕관쇠) : (gwanStrong?관다신약:신약관소)"로
// 파생됐으므로(lib/career-facts.ts deriveCareerFacts) 뒷 두 글자("관왕"류 vs "관쇠"/"관소"류)가
// 이미 관성 강/약 판정 그 자체다. 무관(gwanseongType==="무관")이면 관성 자체가 없는 것이므로
// careerGrip 값과 무관하게 최하 포지션으로 고정 — 새 숫자를 지어내지 않는다(fabrication 방지).
function deriveGwanseongStrengthGauge(
  gwanseongType: "정관우세" | "편관우세" | "관살혼잡" | "무관",
  careerGrip: CareerGrip | undefined,
): { value: number; verdict: string } {
  if (gwanseongType === "무관") return { value: 10, verdict: "자리 기운이 옅어 — 그릇으로 보자" };
  if (careerGrip === "신왕관왕" || careerGrip === "관다신약") {
    return { value: 85, verdict: "자리 기운이 뚜렷해" };
  }
  if (careerGrip === "신왕관쇠" || careerGrip === "신약관소") {
    return { value: 35, verdict: "자리 기운이 차분한 편이야" };
  }
  return { value: 50, verdict: "결이 섞여 있어" };
}

// 관을 담는 그릇 — careerGrip(신강신약×관성 2차원 4상한)을 그대로 스펙트럼 포지션에 매핑한다.
// 순서는 "그릇 여유" 축: 관다신약(그릇보다 맡은 게 많아 조율이 관건, 가장 낮음)
// < 신약관소(둘 다 소박하지만 무리 없음) < 신왕관쇠(그릇에 비해 관은 적어 여유 있음)
// < 신왕관왕(그릇도 크고 담을 자리도 넉넉, 가장 높음).
// 연속 퍼센트가 아니라 4개 고정 포지션 — 원시 점수가 없는데 정밀 숫자를 지어내지 않는다.
function deriveCareerGripGauge(careerGrip: CareerGrip | undefined): { value: number; verdict: string } {
  switch (careerGrip) {
    case "관다신약":
      return { value: 15, verdict: "그릇보다 맡은 게 많아 조율이 관건이야" };
    case "신약관소":
      return { value: 40, verdict: "무리 없는 균형이야" };
    case "신왕관쇠":
      return { value: 65, verdict: "그릇에 비해 여유가 있어" };
    case "신왕관왕":
      return { value: 90, verdict: "그릇도 크고 담을 자리도 넉넉해" };
    default:
      return { value: 50, verdict: "결이 섞여 있어" };
  }
}

// ────────────────────────────────────────────────────────
// 카드형 블록 — WealthResultClient.tsx ReportCard 그대로 이식.
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
// 5년 날씨 타임라인 — 전부 서버 결정론 값(full_json.serverTimeline) 렌더.
// WealthResultClient.tsx FortuneWeatherTimeline 그대로 이식(무드 3단, 유료 리포트 공포 프레임 금지).
// ────────────────────────────────────────────────────────
const TIMELINE_MOOD_STYLE: Record<string, { label: string; color: string; icon: string }> = {
  강세: { label: "맑음", color: "text-saju-wood-muted", icon: "/icons/weather/sun.svg" },
  보통: { label: "흐림", color: "text-text-secondary", icon: "/icons/weather/cloud.svg" },
  주의: { label: "비 예보", color: "text-saju-earth-muted", icon: "/icons/weather/rain.svg" },
};

function FortuneWeatherTimeline({
  title,
  daeunLabel,
  timeline,
}: {
  title: string;
  daeunLabel: (d: { startAge: number; endAge: number; star: string }) => string;
  timeline: ServerTimelineView;
}) {
  return (
    <section className="rounded-3xl bg-background-secondary p-6">
      <h3 className="text-[18px] font-bold text-text-primary mb-5">{title}</h3>

      {/* 연 셀 가로 스크롤 — 지나간 해는 회색 맥락 */}
      <div className="relative -mx-6">
        <div className="overflow-x-auto scrollbar-hide px-6" style={{ scrollSnapType: "x mandatory" }}>
          <div className="flex gap-2" style={{ width: "max-content" }}>
            {timeline.entries.map((e) => {
              const mood = TIMELINE_MOOD_STYLE[e.mood] ?? TIMELINE_MOOD_STYLE["보통"];
              return (
                <div
                  key={e.year}
                  className={`shrink-0 rounded-xl py-3 flex flex-col items-center justify-center gap-1.5 ${
                    e.isCurrent ? "bg-background-tertiary ring-1 ring-white/15" : ""
                  } ${e.isPast ? "opacity-40" : ""}`}
                  style={{ width: "76px", scrollSnapAlign: "start" }}
                >
                  <span className="font-aggro tabular-nums text-text-secondary" style={{ fontSize: "14px" }}>
                    {e.year}
                  </span>
                  <img src={mood.icon} alt="" aria-hidden style={{ width: "44px", height: "44px" }} />
                  <span className={`text-[11px] font-semibold ${mood.color} whitespace-nowrap`}>
                    {e.isPast ? "지남" : mood.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div
          className="pointer-events-none absolute top-0 bottom-0 right-0 w-14"
          style={{ background: "linear-gradient(to left, rgb(var(--bg-secondary)) 0%, rgba(20,20,20,0) 100%)" }}
          aria-hidden
        />
      </div>

      {/* 연 상세 row — 미래 해만(과거는 맥락 셀로 충분) */}
      <div className="mt-6 pt-5 border-t border-white/5 divide-y divide-white/5">
        {timeline.entries
          .filter((e) => !e.isPast)
          .map((e) => {
            const mood = TIMELINE_MOOD_STYLE[e.mood] ?? TIMELINE_MOOD_STYLE["보통"];
            return (
              <article key={e.year} className="py-3.5 first:pt-3 last:pb-2">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="font-aggro text-text-primary tabular-nums leading-none"
                      style={{ fontSize: "17px" }}
                    >
                      {e.year}
                    </span>
                    <img src={mood.icon} alt="" aria-hidden style={{ width: "36px", height: "36px" }} />
                  </div>
                  <span className={`text-[13px] font-semibold ${mood.color}`}>{mood.label}</span>
                </div>
                <p className="text-[15.5px] text-text-primary leading-relaxed font-medium break-keep">{e.hint}</p>
                <p className="text-[12px] text-text-tertiary mt-1.5">
                  {e.age}세 · {e.pillarKorean}년 · {e.tenStar}운 · {e.twelveStage}
                </p>
              </article>
            );
          })}
      </div>

      {/* 대운 — 띠에 섞지 않는 별도 굵은 요소 */}
      {timeline.daeun.length > 0 && (
        <div className="mt-5 rounded-2xl bg-background-tertiary px-5 py-4">
          <div className="text-[12px] font-semibold text-text-tertiary mb-2">10년 단위 큰 흐름</div>
          <div className="flex flex-wrap gap-2">
            {timeline.daeun.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] font-semibold text-text-primary"
              >
                {daeunLabel(d)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────
// advice.tag "[근거:편관]" → "편관" 칩 텍스트만 추출. 형식이 깨졌으면(이미 postprocess가
// 걸러내지만 방어적으로) 칩 자체를 숨기고 조언 문장만 깔끔하게 보여준다 — 사용자에게
// "[근거:...]" 원문을 그대로 노출하지 않는다.
// ────────────────────────────────────────────────────────

function parseAdviceTag(tag: string | undefined | null): string | null {
  if (!tag) return null;
  const m = /\[근거:([^\]]+)\]/.exec(tag);
  return m ? m[1] : null;
}

// ────────────────────────────────────────────────────────
// 카카오톡 공유 + 5알 보상. 지급 근거는 "버튼 클릭"이 아니라 카카오 전송 성공 웹훅이라,
// 문구는 KakaoShareButton이 폴링 결과로 넘겨준다 — 여기서는 띄우기만 한다
// (app/result/ResultClient.tsx의 notify 패턴 동일). 공유 컴포넌트 신설 금지 원칙에 따라
// 파일 인라인으로 둔다.
// ────────────────────────────────────────────────────────

// 공유 링크는 프리뷰 origin이 아니라 항상 프로덕션 도메인을 가리킨다 — 카카오 SDK는
// 플랫폼에 등록된 도메인이 아니면 링크를 거부한다. 그래서 window.location.origin을 쓰지 않는다.
// (프리뷰에서 QA할 때는 카톡 링크 대신 <preview-url>/…/result/share/<id> 를 직접 열 것.)
const SHARE_ORIGIN = "https://www.durumisaju.com";

function CareerShareAction({
  resultId,
  careerGrade,
}: {
  resultId: string;
  careerGrade: CareerGrade;
}) {
  const { status } = useSession();
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2600);
  }, []);

  return (
    <div className="px-6 pt-12">
      <KakaoShareButton
        kind="career"
        resultId={resultId}
        shareUrl={`${SHARE_ORIGIN}${SHARE_PATH_BY_KIND.career(resultId)}`}
        title={`내 커리어운은 ${careerGrade}등급`}
        description="두루미가 본 커리어운 심층 검사 결과."
        imageUrl={`${SHARE_ORIGIN}/og-image.png`}
        isAuthenticated={status === "authenticated"}
        onNotice={notify}
      />
      {showToast && (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/85 px-5 py-3 text-[13.5px] font-medium text-white shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
