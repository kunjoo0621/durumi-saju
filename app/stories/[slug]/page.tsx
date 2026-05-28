import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import BusinessFooter from "@/components/BusinessFooter";
import StoryBody from "@/components/stories/StoryBody";
import StoryCTA from "@/components/stories/StoryCTA";
import StoryCard from "@/components/stories/StoryCard";
import StoryViewCounter from "@/components/stories/StoryViewCounter";
import CelebritySajuCard from "@/components/stories/CelebritySajuCard";
import {
  getAllStories,
  getReadingMinutes,
  getRelatedStories,
  getStoryBySlug,
} from "@/lib/stories/registry";
import { computeCelebritySaju } from "@/lib/stories/celebrity";
import {
  STORY_CATEGORY_LABEL,
  type StoryCategory,
} from "@/lib/stories/types";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";

const SITE_URL = "https://www.durumisaju.com";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllStories().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = getStoryBySlug(slug);
  if (!story) return { title: "사주 이야기 | 사주보는 두루미" };

  const desc = story.excerpt;
  return {
    title: `${story.title} | 사주보는 두루미`,
    description: desc,
    keywords: story.keywords,
    alternates: { canonical: `/stories/${story.slug}` },
    openGraph: {
      title: story.title,
      description: desc,
      url: `${SITE_URL}/stories/${story.slug}`,
      type: "article",
      locale: "ko_KR",
      siteName: "사주보는 두루미",
      publishedTime: story.publishedAt,
      modifiedTime: story.updatedAt,
      ...(story.heroImage
        ? {
            images: [
              {
                url: `${SITE_URL}${story.heroImage.src}`,
                alt: story.heroImage.alt,
                width: 1376,
                height: 768,
              },
            ],
          }
        : {}),
    },
  };
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${y}.${m}.${d}`;
}

export default async function StoryDetailPage({ params }: Props) {
  const { slug } = await params;
  const story = getStoryBySlug(slug);
  if (!story) notFound();

  const readingMin = getReadingMinutes(story);
  const related = getRelatedStories(story, 3);
  const categoryLabel = STORY_CATEGORY_LABEL[story.category];

  // 연예인 카테고리 — birth info → SajuData + enriched (십성·신살) 빌드 시 계산.
  // hourUnknown=true면 클라이언트 카드에서 시주 컬럼 마스킹.
  const celebritySajuResult = story.celebrity
    ? await computeCelebritySaju(story.celebrity)
    : null;
  const celebritySaju = celebritySajuResult?.data ?? null;
  const celebrityEnriched = celebritySajuResult?.enriched ?? null;
  const celebrityHourUnknown = celebritySajuResult?.hourUnknown ?? false;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${SITE_URL}/stories/${story.slug}#article`,
        headline: story.title,
        description: story.excerpt,
        articleSection: categoryLabel,
        keywords: story.keywords?.join(", "),
        url: `${SITE_URL}/stories/${story.slug}`,
        inLanguage: "ko-KR",
        datePublished: story.publishedAt,
        dateModified: story.updatedAt,
        ...(story.heroImage
          ? {
              image: {
                "@type": "ImageObject",
                url: `${SITE_URL}${story.heroImage.src}`,
                width: 1376,
                height: 768,
              },
            }
          : {}),
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        author: {
          "@type": "Organization",
          name: "사주보는 두루미",
          url: SITE_URL,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "두루미 매거진",
            item: `${SITE_URL}/stories`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: categoryLabel,
            item: `${SITE_URL}/stories/series/${story.category}`,
          },
          {
            "@type": "ListItem",
            position: 4,
            name: story.title,
            item: `${SITE_URL}/stories/${story.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-background-primary [&_h1]:[word-break:keep-all] [&_h2]:[word-break:keep-all] [&_h3]:[word-break:keep-all] [&_p]:[word-break:keep-all] [&_li]:[word-break:keep-all] [&_td]:[word-break:keep-all] [&_th]:[word-break:keep-all]">
      <script
        id="jsonld-story-detail"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header showBack sticky />

      <main className="flex-1 max-w-[640px] mx-auto w-full px-5 pt-2 pb-16">
        <nav
          className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[11.5px] tracking-[0.04em] text-text-tertiary mb-6 uppercase"
          aria-label="브레드크럼"
        >
          <Link href="/stories" className="hover:text-text-secondary">
            두루미 매거진
          </Link>
          <CaretRight size={10} weight="bold" aria-hidden="true" />
          <Link
            href={`/stories/series/${story.category}`}
            className="text-text-secondary hover:text-text-primary normal-case tracking-normal"
          >
            {categoryLabel}
          </Link>
        </nav>

        {story.heroImage ? (
          <div className="mb-7 sm:mb-8 -mx-5 sm:mx-0 sm:rounded-2xl overflow-hidden bg-white/[0.04]">
            {/* 연예인 카테고리는 인물 캐리커처라 세로 4:5 비율로 머리 안 잘리게.
                일반 글은 16:9 와이드 hero. */}
            <div
              className={`relative w-full ${
                story.category === "celebrity"
                  ? "aspect-[4/5] max-w-[420px] mx-auto"
                  : "aspect-[16/9]"
              }`}
            >
              <Image
                src={story.heroImage.src}
                alt={story.heroImage.alt}
                fill
                sizes={
                  story.category === "celebrity"
                    ? "(min-width: 768px) 420px, 100vw"
                    : "(min-width: 768px) 720px, 100vw"
                }
                className="object-cover"
                priority
              />
            </div>
          </div>
        ) : null}

        <header className="mb-8 sm:mb-7">
          <h1
            className="text-[26px] sm:text-[32px] font-aggro text-text-primary leading-[1.25] tracking-[-0.012em] mb-4"
            style={{ textWrap: "balance" as React.CSSProperties["textWrap"], wordBreak: "keep-all" }}
          >
            {story.title}
          </h1>
          <p
            className="text-[16px] sm:text-[16px] text-text-secondary leading-[1.7]"
            style={{ wordBreak: "keep-all" }}
          >
            {story.excerpt}
          </p>
          <div className="mt-6 flex items-center flex-wrap gap-x-2.5 gap-y-1.5 text-[13px] sm:text-[12.5px] text-text-tertiary">
            <span>{formatDate(story.publishedAt)}</span>
            <span className="text-white/20" aria-hidden="true">·</span>
            <span>읽는 데 {readingMin}분</span>
            <span className="text-white/20" aria-hidden="true">·</span>
            <StoryViewCounter slug={story.slug} />
            <span className="text-white/20" aria-hidden="true">·</span>
            <span>사주보는 두루미</span>
          </div>

          {/* Above-the-fold soft CTA — 스크롤 0%에서 전환 진입점. */}
          <Link
            href={story.cta.href}
            className="inline-flex items-center gap-1 mt-6 text-[14px] sm:text-[13px] font-medium text-[#FF6B6B] hover:text-white transition-colors group min-h-[44px]"
          >
            <span className="border-b border-[#FF6B6B]/40 group-hover:border-white/60 transition-colors pb-px">
              내 사주는 어떻게 나오는지 미리 보기
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </header>

        <div className="h-px bg-white/10 mb-10" aria-hidden="true" />

        {/* 연예인 카테고리 — 사주 원국 차트 카드 (dynamic import로 청크 분리). */}
        {story.celebrity && celebritySaju ? (
          <CelebritySajuCard
            celebrity={story.celebrity}
            sajuData={celebritySaju}
            enriched={celebrityEnriched}
            hourUnknown={celebrityHourUnknown}
          />
        ) : null}

        <StoryBody story={story} />

        <div className="mt-12">
          <StoryCTA
            cta={story.cta}
            variant="block"
            caption="이야기는 여기서 끝, 다음은 내 사주 차례예요"
          />
        </div>

        {story.keywords?.length ? (
          <div className="mt-10 flex flex-wrap gap-2">
            {story.keywords.map((k) => (
              <span
                key={k}
                className="text-[12px] text-text-tertiary bg-white/[0.04] px-2.5 py-1 rounded-full"
              >
                #{k}
              </span>
            ))}
          </div>
        ) : null}

        {related.length > 0 && (
          <section className="mt-16 pt-8 border-t border-white/10">
            <div className="text-[11px] tracking-[0.22em] text-text-tertiary font-semibold uppercase mb-1">
              다음 이야기
            </div>
            <div className="divide-y divide-white/[0.07]">
              {related.map((s) => (
                <StoryCard key={s.slug} story={s} />
              ))}
            </div>
          </section>
        )}
      </main>

      <BusinessFooter />
    </div>
  );
}

export { type StoryCategory };
