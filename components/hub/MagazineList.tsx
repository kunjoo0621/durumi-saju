// ⑤ 두루미 매거진 — 사전과 동일 리스트 행(숫자 없음). getAllStories 상위 N 주입.
import Image from "next/image";
import Link from "next/link";
import Reveal from "./Reveal";
import HubViewBadge from "./HubViewBadge";
import StoryArt from "@/components/stories/StoryArt";
import { getReadingMinutes } from "@/lib/stories/registry";
import { STORY_CATEGORY_HANDLE } from "@/lib/stories/types";
import type { Story } from "@/lib/stories/types";
import { HUB_PRESS } from "./services";

export default function MagazineList({ stories }: { stories: Story[] }) {
  if (stories.length === 0) return null;
  return (
    <Reveal className="px-5 pt-10">
      <p className="text-[12px] font-medium text-text-tertiary">로그인 없이 읽을 수 있어요</p>
      <h2 className="mb-2 font-aggro text-[22px]">두루미가 들려주는 사주 이야기</h2>
      <div className="-mx-1">
        {stories.map((s) => (
          <Link
            key={s.slug}
            href={`/stories/${s.slug}`}
            className={`${HUB_PRESS} flex items-center gap-3.5 rounded-2xl px-1 py-2.5`}
          >
            <div className="relative aspect-[4/3] w-[112px] shrink-0 overflow-hidden rounded-2xl bg-background-secondary">
              {s.heroImage ? (
                <Image
                  src={s.heroImage.src}
                  alt={s.heroImage.alt}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              ) : (
                <StoryArt category={s.category} size="card" className="h-full w-full" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 break-keep text-[16px] font-bold leading-[1.35]">
                {s.title}
              </h3>
              <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-text-tertiary">
                {STORY_CATEGORY_HANDLE[s.category]} · {getReadingMinutes(s)}분
                <HubViewBadge slug={s.slug} />
              </p>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/stories"
        className="mt-3 block w-full rounded-2xl bg-white/[0.04] py-3 text-center text-[14px] text-text-secondary"
      >
        매거진 더 보기 →
      </Link>
    </Reveal>
  );
}
