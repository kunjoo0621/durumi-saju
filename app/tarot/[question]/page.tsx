// 질문별 진입 라우트 골격.
//
// Phase 1은 슬러그 검증과 메타데이터까지다. 실제 흐름(생년월일 → 뽑기 → 뒤집기 → 페이월)은
// Phase 2에서 이 자리를 채운다. 그때까지는 무엇이 들어올 자리인지 화면에 그대로 적어둔다.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Egg } from "@phosphor-icons/react/dist/ssr";
import Header from "@/components/layout/Header";
import { TAROT_COST } from "@/lib/constants/coins";
import { TAROT_QUESTIONS, TAROT_TOPIC_LABEL, getTarotQuestion } from "@/lib/tarot/questions";

// 14문항 고정이라 전부 정적 생성한다.
export function generateStaticParams() {
  return TAROT_QUESTIONS.map((q) => ({ question: q.slug }));
}

export const dynamicParams = false;

// 3장 스프레드 — 과거/현재/미래가 아니라 결정형에 맞춘 배치(§3.3).
const SPREAD = [
  "지금 이 상황의 진짜 얼굴",
  "그 선택을 했을 때 열리는 길",
  "두루미의 조언 — 무엇을 붙잡고 무엇을 놓을지",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ question: string }>;
}): Promise<Metadata> {
  const { question } = await params;
  const q = getTarotQuestion(question);
  if (!q) return {};

  const title = `${q.question} | 타로보는 두루미`;
  const description = `${q.desc}. 78장에서 직접 고른 세 장을 내 사주 원국으로 풀어 읽는다.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://www.durumisaju.com/tarot/${q.slug}`,
      siteName: "타로보는 두루미",
      locale: "ko_KR",
      type: "website",
    },
  };
}

export default async function TarotQuestionPage({
  params,
}: {
  params: Promise<{ question: string }>;
}) {
  const { question } = await params;
  const q = getTarotQuestion(question);
  if (!q) notFound();

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-background-primary text-text-primary">
      <Header showBack sticky />

      <main className="flex-1 px-5 pb-12 pt-4">
        <p className="text-[13px] font-semibold text-text-secondary">
          {TAROT_TOPIC_LABEL[q.topic]}
        </p>
        <h1 className="mt-1 break-keep font-aggro text-[28px] leading-tight">{q.question}</h1>
        <p className="mt-2 break-keep text-[15px] leading-relaxed text-text-secondary">{q.desc}</p>

        <div className="mt-8 rounded-2xl bg-white/[0.04] p-5">
          <h2 className="text-[15px] font-bold">세 자리로 봐요</h2>
          <ol className="mt-3 space-y-3">
            {SPREAD.map((label, i) => (
              <li key={label} className="flex gap-3">
                <span className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/20 text-[11px] font-bold text-text-primary">
                  {i + 1}
                </span>
                <span className="break-keep text-[14px] leading-relaxed text-text-secondary">
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-5 flex items-center gap-1.5 break-keep text-[13px] leading-relaxed text-text-tertiary">
          <Egg size={14} weight="fill" className="shrink-0" />
          카드를 뽑고 뒤집어 보는 데까지는 알이 들지 않아요. 해석 전문이 {TAROT_COST}알이에요.
        </p>

        <div className="mt-10 rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
          <p className="text-[14px] font-semibold text-text-secondary">카드 뽑기는 준비 중이에요</p>
          <p className="mt-1.5 text-[13px] text-text-tertiary">조금만 기다려 주세요</p>
        </div>
      </main>
    </div>
  );
}
