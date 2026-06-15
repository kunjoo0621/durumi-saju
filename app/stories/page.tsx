import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import BusinessFooter from "@/components/BusinessFooter";
import StoryCard from "@/components/stories/StoryCard";
import TagBrowse from "@/components/stories/TagBrowse";
import StorySearch, { type SearchItem } from "@/components/stories/StorySearch";
import {
  getAllStories,
  getStoriesByCategory,
  getReadingMinutes,
  getStoryTags,
} from "@/lib/stories/registry";
import {
  STORY_CATEGORY_LABEL,
  STORY_CATEGORY_TAGLINE,
  type StoryCategory,
} from "@/lib/stories/types";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";

const CATEGORY_ORDER: StoryCategory[] = ["celebrity", "saju", "dream", "love"];

const SITE_URL = "https://www.durumisaju.com";

export const metadata: Metadata = {
  title: "두루미 매거진 — 몰랐던 사주·꿈해몽·궁합 이야기 | 사주보는 두루미",
  description:
    "사주에 대해 몰랐던 이야기, 꿈해몽, 연애·궁합·재물·일운 이야기를 한 곳에 모았습니다. 매주 한두 편씩 새로 올라옵니다.",
  alternates: { canonical: "/stories" },
  openGraph: {
    title: "두루미 매거진 — 사주보는 두루미",
    description:
      "몰랐던 사주 이야기, 꿈해몽, 연애·궁합·재물·일운 이야기.",
    url: `${SITE_URL}/stories`,
    type: "website",
    locale: "ko_KR",
  },
};

function formatIssueDate() {
  // 가장 최신 글의 발행일 또는 오늘 날짜를 기준으로 issue 표기
  const stories = getAllStories();
  const latest = stories[0]?.publishedAt ?? new Date().toISOString().slice(0, 10);
  const [y, m, d] = latest.split("-");
  return `${y}.${m}.${d}`;
}

export default function StoriesHubPage() {
  const all = getAllStories();
  const hero = all[0];
  const rest = all.slice(1);
  const issueDate = formatIssueDate();

  // 클라이언트 검색 인덱스 — registry를 클라 번들에 끌어오지 않도록 서버에서 평탄화.
  const searchItems: SearchItem[] = all.map((s) => ({
    slug: s.slug,
    title: s.title,
    excerpt: s.excerpt,
    category: s.category,
    tagLabels: getStoryTags(s).map((t) => t.label),
    keywords: s.keywords ?? [],
    readingMin: getReadingMinutes(s),
    hero: s.heroImage ? { src: s.heroImage.src, alt: s.heroImage.alt } : null,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/stories#collection`,
        url: `${SITE_URL}/stories`,
        name: "두루미 매거진",
        description: "사주·꿈해몽·궁합 이야기를 모은 두루미 매거진.",
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
        ],
      },
      {
        "@type": "ItemList",
        name: "최신 매거진 글",
        itemListElement: all.map((s, i) => ({
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
        id="jsonld-stories-hub"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header showBack sticky />

      <main className="flex-1 max-w-[640px] mx-auto w-full px-5 pt-2 pb-16">
        {/* MASTHEAD */}
        <header className="pt-3 pb-10">
          <div className="text-[11px] tracking-[0.22em] text-text-tertiary mb-5 uppercase">
            Issue · {issueDate}
          </div>
          <h1
            className="font-aggro text-text-primary text-[28px] sm:text-[36px] leading-[1.15] tracking-[-0.015em] mb-4"
            style={{ textWrap: "balance" as React.CSSProperties["textWrap"] }}
          >
            두루미 매거진
          </h1>
          <p className="text-[15px] text-text-secondary leading-[1.6] max-w-[420px]">
            몰랐던 사주 이야기, 꿈해몽, 연애·돈·일운에 대한 이야기를 매주
            풀어드립니다.
          </p>
        </header>

        {/* 검색 — 발견 동선 최상단 */}
        <section className="pb-2">
          <StorySearch items={searchItems} />
        </section>

        {/* 태그로 찾기 */}
        <section className="mt-9 pt-6 border-t border-white/10">
          <div className="text-[11px] tracking-[0.22em] text-text-tertiary font-semibold uppercase mb-5">
            태그로 찾기
          </div>
          <TagBrowse />
        </section>

        {/* FEATURED */}
        {hero && (
          <section className="mt-12 pt-6 border-t border-white/10">
            <div className="pb-1">
              <div className="text-[11px] tracking-[0.22em] text-[#FF6B6B] font-semibold uppercase">
                이 주의 글
              </div>
            </div>
            <StoryCard story={hero} variant="featured" />
          </section>
        )}

        {/* 최신 이야기 */}
        {rest.length > 0 && (
          <section>
            <div className="pt-3 pb-1 border-t border-white/10">
              <div className="text-[11px] tracking-[0.22em] text-text-tertiary font-semibold uppercase mt-6 mb-1">
                최신 이야기
              </div>
            </div>
            <div className="divide-y divide-white/[0.07]">
              {rest.map((s) => (
                <StoryCard key={s.slug} story={s} />
              ))}
            </div>
          </section>
        )}

        {/* 시리즈로 보기 */}
        <section className="mt-12 pt-6 border-t border-white/10">
          <div className="text-[11px] tracking-[0.22em] text-text-tertiary font-semibold uppercase mb-4">
            시리즈로 보기
          </div>
          <div className="space-y-1">
            {CATEGORY_ORDER.map((cat) => {
              const count = getStoriesByCategory(cat).length;
              return (
                <Link
                  key={cat}
                  href={`/stories/series/${cat}`}
                  className="group flex items-center justify-between gap-3 py-3 hover:opacity-80 active:opacity-60 transition-opacity"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-aggro text-text-primary leading-[1.3]">
                      {STORY_CATEGORY_LABEL[cat]}
                      <span className="ml-2 text-[12px] text-text-tertiary font-normal">
                        {count}편
                      </span>
                    </div>
                    <p className="text-[12.5px] text-text-tertiary mt-0.5 leading-[1.5] line-clamp-1">
                      {STORY_CATEGORY_TAGLINE[cat]}
                    </p>
                  </div>
                  <CaretRight
                    size={14}
                    weight="bold"
                    className="text-text-tertiary shrink-0 group-hover:text-text-secondary"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        </section>

        <div className="mt-10 pt-6 border-t border-white/10">
          <p className="text-[13px] text-text-tertiary leading-[1.7]">
            매주 한두 편씩 새 글이 올라옵니다. 두루미가 직접 분석하면서 발견한
            패턴과, 사람들이 자주 묻는 질문을 같이 풉니다.
          </p>
        </div>
      </main>

      <BusinessFooter />
    </div>
  );
}
