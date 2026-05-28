import StoryCTA from "./StoryCTA";
import type { Story, StoryBlock } from "@/lib/stories/types";

interface Props {
  story: Story;
}

/**
 * 토스피드·카카오앤써 본문 디테일 + 블록 기반 콘텐츠 모델:
 * - 단락(p), 표(table), 체크리스트(checklist), 콜아웃(callout)
 * - H2 좌측 컬러바, 본문 행간 1.85
 * - **bold** 인라인 강조
 * - section ctaAfter 인덱스 다음에 카드형 CTA
 */
export default function StoryBody({ story }: Props) {
  const ctaAfter = story.ctaAfter;
  const showMidCta = typeof ctaAfter === "number" && ctaAfter >= 0;

  return (
    <article className="story-body">
      <p
        className="text-[16.5px] sm:text-[16px] text-text-primary leading-[1.85] tracking-tight"
        style={{ wordBreak: "keep-all" }}
      >
        {renderInline(story.intro)}
      </p>

      <div className="mt-10 sm:mt-10 space-y-12 sm:space-y-12">
        {story.sections.map((section, i) => (
          <div key={i}>
            <section>
              <h2
                className="text-[21px] sm:text-[20px] font-aggro text-text-primary mb-5 flex items-center gap-3 leading-[1.35]"
                style={{ wordBreak: "keep-all" }}
              >
                <span
                  className="w-1 h-5 rounded-full bg-[#FF6B6B]"
                  aria-hidden="true"
                />
                {section.heading}
              </h2>
              <div
                className="space-y-5 text-text-secondary leading-[1.85] text-[16px] sm:text-[15.5px]"
                style={{ wordBreak: "keep-all" }}
              >
                {section.blocks.map((block, idx) => (
                  <BlockView key={idx} block={block} />
                ))}
              </div>
            </section>

            {showMidCta && i === ctaAfter && i < story.sections.length - 1 && (
              <div className="mt-10">
                <StoryCTA
                  cta={story.cta}
                  variant="block"
                  caption="이야기를 읽다 보면 자연스럽게 궁금해질 거예요"
                />
              </div>
            )}

            {i < story.sections.length - 1 && (
              <div
                className="h-px bg-white/[0.06] mt-12"
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

function BlockView({ block }: { block: StoryBlock }) {
  switch (block.kind) {
    case "p":
      return <p>{renderInline(block.text)}</p>;

    case "table": {
      // 컬럼 수가 3 이상이거나 모바일에서 좁아질 가능성이 있으면 가로 스크롤.
      // 매거진 결: border 최소, 가로 디바이더만, 라벨 컬럼 muted.
      const isWide = block.headers.length >= 3;
      return (
        <div className="not-prose my-2">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table
              className={`text-[14.5px] ${isWide ? "min-w-[480px]" : "w-full"} ${isWide ? "" : "w-full"}`}
            >
              <thead>
                <tr>
                  {block.headers.map((h, i) => (
                    <th
                      key={i}
                      className={`px-3 sm:px-4 pb-3 pt-2 text-left font-aggro text-[14px] sm:text-[15px] whitespace-nowrap border-b border-white/[0.18] ${
                        i === 0 && !h
                          ? "text-text-tertiary font-normal"
                          : "text-text-primary"
                      }`}
                      style={{ wordBreak: "keep-all" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={
                      ri < block.rows.length - 1
                        ? "border-b border-white/[0.05]"
                        : ""
                    }
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`px-3 sm:px-4 py-4 align-top leading-[1.55] ${
                          ci === 0
                            ? "text-text-tertiary text-[13px] sm:text-[13.5px] font-medium whitespace-nowrap pr-5"
                            : "text-text-primary text-[14.5px] sm:text-[15px]"
                        }`}
                        style={{ wordBreak: "keep-all" }}
                      >
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && (
            <p className="text-[12.5px] text-text-tertiary mt-3 px-1 italic">
              {block.caption}
            </p>
          )}
        </div>
      );
    }

    case "checklist": {
      // 매거진 결 — 번호 (01·02·03) + 가는 가로 디바이더. 배경·아이콘 없음.
      // 핵심 자기진단 결로 시각 위계 박힘.
      const accent = block.tone === "warn" ? "#E8A53D" : "#7FB99D";
      return (
        <div className="not-prose my-2 py-2">
          {block.title && (
            <div
              className="text-[12.5px] uppercase tracking-[0.08em] mb-5 font-aggro flex items-center gap-2.5"
              style={{ color: accent }}
            >
              <span
                className="inline-block w-6 h-px"
                style={{ background: accent }}
                aria-hidden="true"
              />
              {block.title}
            </div>
          )}
          <ul className="divide-y divide-white/[0.07]">
            {block.items.map((it, i) => (
              <li
                key={i}
                className="flex items-baseline gap-4 sm:gap-5 py-3.5 text-[15.5px] sm:text-[15px] leading-[1.65] text-text-primary"
                style={{ wordBreak: "keep-all" }}
              >
                <span
                  className="font-aggro text-[12.5px] tabular-nums shrink-0 pt-[2px] tracking-[0.04em]"
                  style={{ color: accent, minWidth: "1.6rem" }}
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1">{renderInline(it)}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case "callout": {
      // 매거진 인용 결 — 큰 따옴표·들여쓰기·명조 결. 박스·아이콘 없음.
      // 토스피드·NYT magazine 결.
      const accentColor = block.tone === "warn" ? "#E8A53D" : "#A8C4FF";
      return (
        <figure className="not-prose my-6 sm:my-7 pl-5 sm:pl-6 relative">
          <span
            className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
            style={{ background: accentColor, opacity: 0.5 }}
            aria-hidden="true"
          />
          <blockquote
            className="text-[16.5px] sm:text-[17px] leading-[1.7] text-text-primary tracking-tight"
            style={{ wordBreak: "keep-all" }}
          >
            <span
              className="font-aggro text-[22px] sm:text-[24px] leading-none mr-1 align-[-2px]"
              style={{ color: accentColor, opacity: 0.7 }}
              aria-hidden="true"
            >
              “
            </span>
            {renderInline(block.text)}
          </blockquote>
        </figure>
      );
    }

    case "faq": {
      // 자주 묻는 질문 — h3 질문 + 단락 답변. FAQPage schema는 [slug]/page.tsx에서 자동 생성.
      return (
        <div className="not-prose my-2">
          {block.title && (
            <div
              className="text-[12.5px] uppercase tracking-[0.08em] mb-5 font-aggro flex items-center gap-2.5 text-[#A8C4FF]"
            >
              <span
                className="inline-block w-6 h-px bg-[#A8C4FF]"
                aria-hidden="true"
              />
              {block.title}
            </div>
          )}
          <dl className="divide-y divide-white/[0.07]">
            {block.items.map((item, i) => (
              <div key={i} className="py-4">
                <dt
                  className="font-aggro text-[15.5px] sm:text-[16px] text-text-primary mb-2 leading-[1.45]"
                  style={{ wordBreak: "keep-all" }}
                >
                  Q. {item.q}
                </dt>
                <dd
                  className="text-[15px] sm:text-[15.5px] text-text-secondary leading-[1.7]"
                  style={{ wordBreak: "keep-all" }}
                >
                  {renderInline(item.a)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );
    }
  }
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*(.+)\*\*$/);
    if (m) {
      return (
        <strong key={i} className="text-text-primary font-semibold">
          {m[1]}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
