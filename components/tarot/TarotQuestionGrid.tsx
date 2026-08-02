// 타로 홈 메뉴 — 14문항 2열 세로 그리드. 서버 컴포넌트(JS 0).
//
// 카드 구성은 허브 ServiceRail을 그대로 따른다 — 2:3 포스터 → 칩 → 제목 → 설명 → 알 가격.
// 다른 건 배치뿐이다: 가로 캐러셀이 아니라 2열 그리드, 가로 여백 8px / 세로 16px.
import Image from "next/image";
import Link from "next/link";
import { Egg } from "@phosphor-icons/react/dist/ssr";
import { HUB_PRESS } from "@/components/hub/services";
import {
  TAROT_POSTER_READY,
  TAROT_QUESTIONS,
  TAROT_TOPIC_LABEL,
  tarotPosterSrc,
} from "@/lib/tarot/questions";
import { TAROT_COST } from "@/lib/constants/coins";

// 포스터가 아직 없는 질문의 자리표시자 — 겹쳐 놓인 카드 두 장 실루엣.
// 깨진 이미지 대신 "그림이 들어올 자리"로 읽히게 한다. Phase 0이 끝나면 사라진다.
function PosterPlaceholder() {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden bg-background-secondary">
      {/* 14칸이 전부 자리표시자인 동안이라 물이 세면 홈 전체가 보라로 덮인다. 옅게 */}
      <div
        className="absolute h-[110%] w-[110%] rounded-full opacity-[0.08] blur-[40px]"
        style={{ background: "rgb(var(--primary))" }}
      />
      <div className="relative h-[46%] w-[34%]">
        <span className="absolute inset-0 -rotate-[9deg] rounded-[6px] border border-white/[0.14] bg-white/[0.03]" />
        <span className="absolute inset-0 rotate-[7deg] rounded-[6px] border border-white/[0.18] bg-white/[0.05]" />
      </div>
    </div>
  );
}

export default function TarotQuestionGrid() {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-4 px-5">
      {TAROT_QUESTIONS.map((q) => (
        <Link
          key={q.slug}
          href={`/tarot/${q.slug}`}
          aria-label={q.question}
          className={`${HUB_PRESS} block text-left`}
        >
          <div className="relative mb-2 aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/[0.04] bg-background-secondary">
            {TAROT_POSTER_READY.has(q.slug) ? (
              <Image
                src={tarotPosterSrc(q.slug)}
                alt=""
                fill
                sizes="(max-width: 440px) 45vw, 200px"
                className="object-cover"
              />
            ) : (
              <PosterPlaceholder />
            )}
          </div>
          <span className="text-[11px] font-semibold text-text-secondary">
            {TAROT_TOPIC_LABEL[q.topic]}
          </span>
          <h3 className="break-keep text-[16px] font-bold leading-tight">{q.question}</h3>
          <p className="mt-1 line-clamp-1 break-keep text-[12px] leading-snug text-text-tertiary">
            {q.desc}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[14px] font-bold">
            <Egg size={14} weight="fill" className="shrink-0" />
            {TAROT_COST}알
          </p>
        </Link>
      ))}
    </div>
  );
}
