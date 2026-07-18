// ③ 연예인 사주 — 3:4 인물 카드 가로 캐러셀. items는 page에서 getStoryBySlug로 주입.
import Image from "next/image";
import Link from "next/link";
import HubSectionHeader from "./HubSectionHeader";
import Reveal from "./Reveal";
import { HUB_PRESS } from "./services";

export interface HubCelebrity {
  slug: string;
  name: string;
  occupation: string;
  src: string;
  alt: string;
}

export default function CelebrityRail({ items }: { items: HubCelebrity[] }) {
  if (items.length === 0) return null;
  return (
    <section className="pt-10">
      <Reveal>
        <HubSectionHeader
          eyebrow="이 사람은 어떤 사주일까?"
          title="연예인 사주"
          moreHref="/stories/tag/연예인"
        />
      </Reveal>
      <div
        className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2"
        style={{ scrollPaddingLeft: 20 }}
      >
        {items.map((c) => (
          <Link
            key={c.slug}
            href={`/stories/${c.slug}`}
            className={`${HUB_PRESS} snap-start w-[150px] shrink-0 text-left`}
          >
            <div
              className="relative w-full overflow-hidden rounded-2xl border border-white/[0.04] bg-background-secondary"
              style={{ aspectRatio: "3 / 4" }}
            >
              <Image src={c.src} alt={c.alt} fill sizes="150px" className="object-cover" />
            </div>
            <h3 className="mt-2 text-[15px] font-bold leading-tight">{c.name}</h3>
            <p className="mt-0.5 text-[12px] text-text-tertiary">{c.occupation}</p>
          </Link>
        ))}
        <div className="w-1 shrink-0" />
      </div>
    </section>
  );
}
