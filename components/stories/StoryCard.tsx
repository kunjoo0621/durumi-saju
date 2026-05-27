import Link from "next/link";
import Image from "next/image";
import { Hourglass } from "@phosphor-icons/react/dist/ssr";
import type { Story } from "@/lib/stories/types";
import { STORY_CATEGORY_HANDLE } from "@/lib/stories/types";
import { getReadingMinutes } from "@/lib/stories/registry";
import StoryArt from "./StoryArt";
import StoryCardViewBadge from "./StoryCardViewBadge";

interface Props {
  story: Story;
  /** Featured = hero 자리. 일반 카드보다 일러스트와 제목이 큼. */
  variant?: "default" | "featured";
}

/**
 * 토스피드풍 가로 카드: 텍스트 왼쪽 + 일러스트 오른쪽.
 * 카드 박스(border/background) 없음 — 세로 여백으로만 구분.
 * 부모가 1px 디바이더(border-t)를 깔아준다.
 */
export default function StoryCard({ story, variant = "default" }: Props) {
  const featured = variant === "featured";
  const readingMin = getReadingMinutes(story);

  return (
    <Link
      href={`/stories/${story.slug}`}
      className="group block py-6 sm:py-6 transition-opacity hover:opacity-90 active:opacity-80"
    >
      <div className="flex gap-4 sm:gap-5 items-start">
        <div className="flex-1 min-w-0">
          <h3
            className={`font-aggro text-text-primary leading-[1.3] tracking-tight line-clamp-2 ${
              featured
                ? "text-[19px] sm:text-[20px] mb-3"
                : "text-[17px] sm:text-[18px] mb-3"
            }`}
            style={{ wordBreak: "keep-all" }}
          >
            {story.title}
          </h3>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[12.5px] text-text-tertiary">
            <span>{STORY_CATEGORY_HANDLE[story.category]}</span>
            <span className="text-white/20" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Hourglass size={12} weight="regular" aria-hidden="true" />
              {readingMin}분
            </span>
            <StoryCardViewBadge slug={story.slug} withSeparator />
          </div>
        </div>

        {story.heroImage ? (
          <div
            className={`shrink-0 aspect-square relative overflow-hidden rounded-2xl bg-white/[0.04] ${
              featured
                ? "w-[112px] sm:w-[140px]"
                : "w-[96px] sm:w-[120px]"
            }`}
          >
            <Image
              src={story.heroImage.src}
              alt={story.heroImage.alt}
              fill
              sizes={featured ? "(min-width: 640px) 140px, 112px" : "(min-width: 640px) 120px, 96px"}
              className="object-cover"
            />
          </div>
        ) : (
          <StoryArt
            category={story.category}
            size={featured ? "feature" : "card"}
            className={`shrink-0 aspect-square ${
              featured
                ? "w-[112px] sm:w-[140px]"
                : "w-[96px] sm:w-[120px]"
            }`}
          />
        )}
      </div>
    </Link>
  );
}

