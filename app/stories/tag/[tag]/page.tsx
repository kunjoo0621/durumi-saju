import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import BusinessFooter from "@/components/BusinessFooter";
import StoryCard from "@/components/stories/StoryCard";
import {
  getAllStories,
  getAllTags,
  getStoriesByTag,
  getTagMeta,
} from "@/lib/stories/registry";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";

const SITE_URL = "https://www.durumisaju.com";

type Props = { params: Promise<{ tag: string }> };

export async function generateStaticParams() {
  return getAllTags().map((t) => ({ tag: t.tag }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const meta = getTagMeta(decoded);
  if (!meta) return { title: "두루미 매거진 | 사주보는 두루미" };
  const count = getStoriesByTag(decoded).length;
  const title = `${meta.label} — 두루미 매거진 (${count}편) | 사주보는 두루미`;
  return {
    title,
    description: meta.desc,
    alternates: { canonical: `/stories/tag/${encodeURIComponent(decoded)}` },
    openGraph: {
      title: `${meta.label} — 두루미 매거진`,
      description: meta.desc,
      url: `${SITE_URL}/stories/tag/${encodeURIComponent(decoded)}`,
      type: "website",
      locale: "ko_KR",
      siteName: "사주보는 두루미",
    },
  };
}

export default async function StoryTagPage({ params }: Props) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const meta = getTagMeta(decoded);
  if (!meta) notFound();

  const stories = getStoriesByTag(decoded);
  if (stories.length === 0) notFound();

  const allCount = getAllStories().length;
  // 같은 그룹의 다른 태그 (사이드 탐색용)
  const siblings = getAllTags().filter(
    (t) => t.group === meta.group && t.tag !== decoded,
  );

  const canonical = `${SITE_URL}/stories/tag/${encodeURIComponent(decoded)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#collection`,
        url: canonical,
        name: `${meta.label} — 두루미 매거진`,
        description: meta.desc,
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
            name: meta.label,
            item: canonical,
          },
        ],
      },
      {
        "@type": "ItemList",
        name: `${meta.label} 글`,
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
        id="jsonld-stories-tag"
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
            {meta.label}
          </span>
        </nav>

        <header className="mb-9">
          <div className="text-[11px] tracking-[0.22em] text-[#FF6B6B] font-semibold uppercase mb-4">
            태그
          </div>
          <h1
            className="text-[28px] sm:text-[36px] font-aggro text-text-primary leading-[1.15] tracking-[-0.015em] mb-3"
            style={{ textWrap: "balance" as React.CSSProperties["textWrap"] }}
          >
            {meta.label}
          </h1>
          <p className="text-[15px] text-text-secondary leading-[1.6]">
            {meta.desc}
          </p>
          <div className="mt-5 text-[12px] text-text-tertiary">
            이 태그 {stories.length}편 · 매거진 통합 {allCount}편
          </div>
        </header>

        <div className="h-px bg-white/10" aria-hidden="true" />

        <div className="divide-y divide-white/[0.07]">
          {stories.map((s) => (
            <StoryCard key={s.slug} story={s} />
          ))}
        </div>

        {siblings.length > 0 && (
          <div className="mt-12 pt-6 border-t border-white/10">
            <div className="text-[11px] tracking-[0.22em] text-text-tertiary font-semibold uppercase mb-4">
              비슷한 태그
            </div>
            <div className="flex flex-wrap gap-2">
              {siblings.map((t) => (
                <Link
                  key={t.tag}
                  href={`/stories/tag/${encodeURIComponent(t.tag)}`}
                  className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.1] px-3 py-1.5 rounded-full transition-colors"
                >
                  {t.label}
                  <span className="text-text-tertiary text-[11px]">{t.count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-white/10">
          <Link
            href="/stories"
            className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary transition-colors"
          >
            <CaretRight size={11} weight="bold" className="rotate-180" aria-hidden="true" />
            매거진 전체 보기
          </Link>
        </div>
      </main>

      <BusinessFooter />
    </div>
  );
}
