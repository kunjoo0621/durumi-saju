import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import BusinessFooter from "@/components/BusinessFooter";
import StoryCard from "@/components/stories/StoryCard";
import {
  getAllStories,
  getStoriesByCategory,
} from "@/lib/stories/registry";
import {
  STORY_CATEGORY_HANDLE,
  STORY_CATEGORY_LABEL,
  STORY_CATEGORY_TAGLINE,
  type StoryCategory,
} from "@/lib/stories/types";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";

const SITE_URL = "https://www.durumisaju.com";

const VALID_CATEGORIES = new Set<StoryCategory>(["saju", "dream", "love"]);

const CATEGORY_DESCRIPTION: Record<StoryCategory, string> = {
  saju:
    "사주가 가지고 있는 의미, 분석 결과 뒤에 숨은 패턴, 자주 묻는 질문들을 한 곳에 모았습니다. 명리학 용어는 본문에서 풀어드려요.",
  dream:
    "꿈에서 본 장면이 어떤 의미인지 — 색·상황·반복 여부에 따라 다르게 풀어드립니다. 검색해서 들어와도 한 글에 답이 모이도록.",
  love:
    "왜 매번 비슷한 사람을 만날까, 돈복은 어떻게 보일까, 일운이 약한 사주는 어디서 막힐까 — 인생 운에 대한 이야기.",
};

type Props = { params: Promise<{ category: string }> };

export async function generateStaticParams() {
  return Array.from(VALID_CATEGORIES).map((c) => ({ category: c }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!VALID_CATEGORIES.has(category as StoryCategory)) {
    return { title: "두루미 매거진 | 사주보는 두루미" };
  }
  const cat = category as StoryCategory;
  const label = STORY_CATEGORY_LABEL[cat];
  const desc = CATEGORY_DESCRIPTION[cat];
  return {
    title: `${label} — 두루미 매거진 | 사주보는 두루미`,
    description: desc,
    alternates: { canonical: `/stories/series/${cat}` },
    openGraph: {
      title: `${label} — 두루미 매거진`,
      description: desc,
      url: `${SITE_URL}/stories/series/${cat}`,
      type: "website",
      locale: "ko_KR",
      siteName: "사주보는 두루미",
    },
  };
}

export default async function StoryCategoryPage({ params }: Props) {
  const { category } = await params;
  if (!VALID_CATEGORIES.has(category as StoryCategory)) notFound();

  const cat = category as StoryCategory;
  const label = STORY_CATEGORY_LABEL[cat];
  const tagline = STORY_CATEGORY_TAGLINE[cat];
  const description = CATEGORY_DESCRIPTION[cat];
  const stories = getStoriesByCategory(cat);
  const allCount = getAllStories().length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/stories/series/${cat}#collection`,
        url: `${SITE_URL}/stories/series/${cat}`,
        name: `${label} — 두루미 매거진`,
        description,
        inLanguage: "ko-KR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
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
            name: label,
            item: `${SITE_URL}/stories/series/${cat}`,
          },
        ],
      },
      {
        "@type": "ItemList",
        name: `${label} 시리즈`,
        numberOfItems: stories.length,
        itemListElement: stories.map((s, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: s.title,
          url: `${SITE_URL}/stories/${s.slug}`,
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-background-primary [&_*]:[word-break:keep-all]">
      <script
        id="jsonld-stories-category"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header showBack sticky />

      <main className="flex-1 max-w-[640px] mx-auto w-full px-5 pt-2 pb-16">
        <nav
          className="flex items-center gap-1.5 text-[11.5px] tracking-[0.04em] text-text-tertiary mb-6 uppercase"
          aria-label="브레드크럼"
        >
          <Link href="/stories" className="hover:text-text-secondary">
            두루미 매거진
          </Link>
          <CaretRight size={10} weight="bold" aria-hidden="true" />
          <span className="text-text-secondary truncate normal-case tracking-normal">
            {label}
          </span>
        </nav>

        <header className="mb-9">
          <div className="text-[11px] tracking-[0.22em] text-[#FF6B6B] font-semibold uppercase mb-4">
            시리즈
          </div>
          <h1
            className="text-[28px] sm:text-[36px] font-aggro text-text-primary leading-[1.15] tracking-[-0.015em] mb-3"
            style={{ textWrap: "balance" as React.CSSProperties["textWrap"] }}
          >
            {label}
          </h1>
          <p className="text-[15px] text-text-secondary leading-[1.6] mb-1">
            {tagline}
          </p>
          <p className="text-[14px] text-text-tertiary leading-[1.6]">
            {description}
          </p>
          <div className="mt-5 text-[12px] text-text-tertiary">
            전체 {stories.length}편 · 매거진 통합 {allCount}편
          </div>
        </header>

        <div className="h-px bg-white/10" aria-hidden="true" />

        {stories.length > 0 ? (
          <div className="divide-y divide-white/[0.07]">
            {stories.map((s) => (
              <StoryCard key={s.slug} story={s} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-[14px] text-text-tertiary leading-[1.7]">
              이 시리즈는 곧 새 글이 올라옵니다.
            </p>
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-white/10">
          <div className="text-[11px] tracking-[0.22em] text-text-tertiary font-semibold uppercase mb-4">
            다른 시리즈
          </div>
          <div className="flex flex-wrap gap-2">
            {(["saju", "dream", "love"] as StoryCategory[])
              .filter((c) => c !== cat)
              .map((c) => (
                <Link
                  key={c}
                  href={`/stories/series/${c}`}
                  className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.1] px-3 py-1.5 rounded-full transition-colors"
                >
                  {STORY_CATEGORY_HANDLE[c]}
                  <CaretRight size={11} weight="bold" aria-hidden="true" />
                </Link>
              ))}
          </div>
        </div>
      </main>

      <BusinessFooter />
    </div>
  );
}
