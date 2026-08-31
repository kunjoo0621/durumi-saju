import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import BusinessFooter from "@/components/BusinessFooter";
import Breadcrumb from "@/components/dict/Breadcrumb";
import CombinationHero from "@/components/dict/CombinationHero";
import SingleCharHero from "@/components/dict/SingleCharHero";
import ConceptHero from "@/components/dict/ConceptHero";
import QuickFacts from "@/components/dict/QuickFacts";
import DictBodyView from "@/components/dict/DictBody";
import CopyWithSource from "@/components/CopyWithSource";
import FAQList from "@/components/dict/FAQList";
import RelatedChips from "@/components/dict/RelatedChips";
import CTABlock from "@/components/dict/CTABlock";
import {
  getDictEntry,
  getAllDictEntries,
} from "@/lib/dict/registry";
import {
  DICT_CATEGORY_LABEL,
  type DictCategory,
} from "@/lib/dict/types";

const SITE_URL = "https://www.durumisaju.com";

type Props = {
  params: Promise<{ category: string; slug: string }>;
};

export async function generateStaticParams() {
  return getAllDictEntries().map((e) => ({
    category: e.category,
    slug: e.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const entry = getDictEntry(category as DictCategory, slug);
  if (!entry) return { title: "사주 사전 | 사주보는 두루미" };

  const path = `/dict/${entry.category}/${entry.slug}`;
  return {
    title: `${entry.meta.title} | 사주보는 두루미`,
    description: entry.meta.description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: entry.meta.title,
      description: entry.meta.description,
      type: "article",
      url: `${SITE_URL}${path}`,
      siteName: "사주보는 두루미",
      locale: "ko_KR",
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: entry.name }],
      publishedTime: entry.updatedAt,
      modifiedTime: entry.updatedAt,
    },
    twitter: {
      card: "summary_large_image",
      title: entry.meta.title,
      description: entry.meta.description,
      images: [`${SITE_URL}/og-image.png`],
    },
  };
}

function SectionGroupHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <div className="text-[11px] tracking-[0.18em] text-[#FF6B6B] uppercase font-semibold mb-2">
        {eyebrow}
      </div>
      <h2 className="text-title-3 text-text-primary font-aggro">{title}</h2>
    </div>
  );
}

export default async function DictDetailPage({ params }: Props) {
  const { category, slug } = await params;
  const entry = getDictEntry(category as DictCategory, slug);
  if (!entry) notFound();

  const categoryLabel = DICT_CATEGORY_LABEL[entry.category];
  const path = `/dict/${entry.category}/${entry.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        "@id": `${SITE_URL}${path}#term`,
        name: entry.name,
        alternateName: entry.hanja,
        description: entry.meta.description,
        termCode: entry.slug,
        url: `${SITE_URL}${path}`,
        inDefinedTermSet: {
          "@type": "DefinedTermSet",
          "@id": `${SITE_URL}/dict#termset`,
          name: "사주 사전",
          url: `${SITE_URL}/dict`,
        },
      },
      {
        "@type": "Article",
        headline: entry.meta.title,
        description: entry.meta.description,
        image: `${SITE_URL}/og-image.png`,
        datePublished: entry.updatedAt,
        dateModified: entry.updatedAt,
        inLanguage: "ko-KR",
        author: {
          "@type": "Organization",
          name: "사주보는 두루미",
          url: SITE_URL,
        },
        publisher: {
          "@type": "Organization",
          name: "사주보는 두루미",
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/og-image.png`,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${SITE_URL}${path}`,
        },
        about: { "@id": `${SITE_URL}${path}#term` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "사전",
            item: `${SITE_URL}/dict`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: categoryLabel,
            item: `${SITE_URL}/dict/${entry.category}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: entry.name,
            item: `${SITE_URL}${path}`,
          },
        ],
      },
      ...(entry.faq.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: entry.faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: f.a,
                },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-background-primary">
      <script
        id={`jsonld-${entry.category}-${entry.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header showBack sticky />

        <main className="flex-1 max-w-[640px] mx-auto w-full px-5 pt-2 pb-10">
          <div className="mb-6">
            <Breadcrumb
              items={[
                { label: "사전", href: "/dict" },
                { label: categoryLabel, href: `/dict/${entry.category}` },
                { label: entry.name },
              ]}
            />
          </div>

          {entry.hero.variant === "combination" && (
            <CombinationHero entry={entry} />
          )}
          {entry.hero.variant === "single-char" && (
            <SingleCharHero entry={entry} />
          )}
          {entry.hero.variant === "concept" && <ConceptHero entry={entry} />}

          {entry.highlight.length > 0 && (
            <div className="mt-6">
              <QuickFacts items={entry.highlight} />
            </div>
          )}

          <div className="mt-12">
            <CopyWithSource>
              <DictBodyView body={entry.body} />
            </CopyWithSource>
          </div>

          {entry.faq.length > 0 && (
            <section className="mt-14">
              <SectionGroupHeading
                eyebrow="자주 묻는 질문"
                title={`${entry.name}, 더 궁금한 점`}
              />
              <div className="mt-5">
                <FAQList items={entry.faq} />
              </div>
            </section>
          )}

          {entry.related.length > 0 && (
            <section className="mt-14">
              <SectionGroupHeading eyebrow="관련 용어" title="더 알아보기" />
              <div className="mt-5">
                <RelatedChips items={entry.related} />
              </div>
            </section>
          )}

          <div className="mt-14">
            <CTABlock name={entry.name} category={categoryLabel} />
          </div>

          <p className="text-[11px] text-text-tertiary mt-10 text-right tracking-wider">
            업데이트 {entry.updatedAt}
          </p>
        </main>

      <BusinessFooter />
    </div>
  );
}
