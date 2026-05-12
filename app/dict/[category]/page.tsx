import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import BusinessFooter from "@/components/BusinessFooter";
import Breadcrumb from "@/components/dict/Breadcrumb";
import GabjaHubGrid from "@/components/dict/GabjaHubGrid";
import { getDictEntriesByCategory } from "@/lib/dict/registry";
import {
  DICT_CATEGORY_LABEL,
  type DictCategory,
} from "@/lib/dict/types";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";

const SITE_URL = "https://www.durumisaju.com";

const VALID_CATEGORIES = new Set<DictCategory>([
  "saju",
  "pillars",
  "cheongan",
  "jiji",
  "gabja",
  "ohaeng",
  "sipsung",
  "unseong12",
  "gangyak",
  "yongshin",
  "gyeokguk",
  "relation",
  "sinsal",
  "sipisinsal",
]);

const CATEGORY_DESCRIPTION: Record<DictCategory, string> = {
  saju: "사주(四柱)가 무엇인지, 4기둥이 어떻게 만들어지는지, 무엇을 알 수 있는지 — 사주 입문 가이드를 모았습니다.",
  pillars: "년주(年柱)·월주(月柱)·일주(日柱)·시주(時柱) — 사주의 골격이 되는 4개 기둥의 의미와 위치별 작용을 정리합니다.",
  cheongan: "갑·을·병·정·무·기·경·신·임·계 — 하늘의 열 글자, 사주 천간 10개를 한 곳에 정리합니다.",
  jiji: "자·축·인·묘·진·사·오·미·신·유·술·해 — 땅의 열두 글자, 사주 지지 12개의 의미와 작용을 정리합니다.",
  gabja: "갑자(甲子)부터 계해(癸亥)까지 — 60갑자 코드 60개의 성격, 직업, 궁합을 한 항목씩 정리합니다. 일주 자리에 들면 갑자일주 등으로 분석됩니다.",
  ohaeng: "목·화·토·금·수 — 사주를 이루는 다섯 가지 기운, 오행의 상생·상극과 의미를 정리합니다.",
  sipsung: "비견·겁재·식신·상관·편재·정재·편관·정관·편인·정인 — 일간 기준 10가지 별의 성질과 해석.",
  unseong12: "장생·목욕·관대·임관·제왕·쇠·병·사·묘·절·태·양 — 일간이 각 지지에서 거치는 12단계 흐름.",
  gangyak: "신강·신약 8단계와 득령·득지·득시·득세 — 사주의 강약을 가르는 12가지 판정 용어를 정리합니다.",
  yongshin: "용신·희신·기신·억부용신·조후용신 — 사주의 균형을 잡아주는 핵심 오행을 풀어드립니다.",
  gyeokguk: "정관격·편관격·식신격·상관격·정재격·편재격·정인격·편인격·건록격·양인격 — 자평 명리의 정격 8격 + 록인 2격을 한 곳에 정리합니다.",
  relation: "삼합·육합·방합·육충·삼형·육해 등 — 사주 천간·지지 사이의 작용 관계를 정리합니다.",
  sinsal: "도화·역마·화개·천을귀인 등 — 사주에 작용하는 신살의 의미와 위치별 해석.",
  sipisinsal: "년지 기준 12지지에 부여되는 12가지 신살 체계 — 일반 신살과 다른 산출 방식과 작용을 정리합니다.",
};

type Props = {
  params: Promise<{ category: string }>;
};

export async function generateStaticParams() {
  return Array.from(VALID_CATEGORIES).map((c) => ({ category: c }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!VALID_CATEGORIES.has(category as DictCategory)) {
    return { title: "사주 사전 | 사주보는 두루미" };
  }
  const cat = category as DictCategory;
  const label = DICT_CATEGORY_LABEL[cat];
  const desc = CATEGORY_DESCRIPTION[cat];
  return {
    title: `${label} — 사주 사전 | 사주보는 두루미`,
    description: desc,
    alternates: {
      canonical: `/dict/${cat}`,
    },
    openGraph: {
      title: `${label} — 사주 사전`,
      description: desc,
      url: `${SITE_URL}/dict/${cat}`,
      type: "website",
      locale: "ko_KR",
    },
  };
}

export default async function DictCategoryPage({ params }: Props) {
  const { category } = await params;
  if (!VALID_CATEGORIES.has(category as DictCategory)) notFound();

  const cat = category as DictCategory;
  const label = DICT_CATEGORY_LABEL[cat];
  const desc = CATEGORY_DESCRIPTION[cat];
  const entries = getDictEntriesByCategory(cat);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["CollectionPage", "DefinedTermSet"],
        "@id": `${SITE_URL}/dict/${cat}#termset`,
        url: `${SITE_URL}/dict/${cat}`,
        name: `${label} — 사주 사전`,
        description: desc,
        inLanguage: "ko-KR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        hasDefinedTerm: entries.map((e) => ({
          "@type": "DefinedTerm",
          name: e.name,
          alternateName: e.hanja,
          description: e.tagline,
          termCode: e.slug,
          url: `${SITE_URL}/dict/${e.category}/${e.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "사주 사전", item: `${SITE_URL}/dict` },
          { "@type": "ListItem", position: 3, name: label, item: `${SITE_URL}/dict/${cat}` },
        ],
      },
      ...(entries.length > 0
        ? [
            {
              "@type": "ItemList",
              name: `${label} 항목 목록`,
              numberOfItems: entries.length,
              itemListElement: entries.map((e, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: e.name,
                url: `${SITE_URL}/dict/${e.category}/${e.slug}`,
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-background-primary">
      <script
        id={`jsonld-dict-${cat}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header showBack sticky />

      <main className="flex-1 max-w-[640px] mx-auto w-full px-5 pt-2 pb-10">
        <div className="mb-6">
          <Breadcrumb
            items={[
              { label: "사전", href: "/dict" },
              { label },
            ]}
          />
        </div>

        <header className="pb-2 mb-2">
          <div className="text-[12px] tracking-[0.18em] text-[#FF6B6B] font-semibold mb-3 uppercase">
            사주 사전
          </div>
          <h1 className="text-display font-aggro text-text-primary leading-[1.15] mb-3">
            {label}
          </h1>
          <p className="text-body-2 text-text-secondary leading-[1.7]">{desc}</p>
        </header>

        <section className="mt-10">
          {entries.length === 0 ? (
            <div className="rounded-2xl bg-background-secondary border border-white/[0.06] p-6 text-center">
              <p className="text-[14px] text-text-secondary leading-[1.7]">
                {label} 항목은 곧 공개됩니다.
              </p>
              <p className="text-[12px] text-text-tertiary mt-2">
                지금은 카테고리별로 한 항목씩 먼저 만들어 구조를 잡는 단계입니다.
              </p>
              <Link
                href="/dict"
                className="inline-block mt-5 text-[13px] text-text-primary border border-white/10 rounded-full px-4 py-2 hover:bg-white/[0.04] transition-colors"
              >
                다른 카테고리 보러가기
              </Link>
            </div>
          ) : cat === "gabja" ? (
            <GabjaHubGrid entries={entries} />
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <Link
                  key={e.slug}
                  href={`/dict/${e.category}/${e.slug}`}
                  className="block rounded-2xl bg-background-secondary border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors px-5 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[19px] font-aggro text-text-primary">
                          {e.name}
                        </span>
                        <span className="text-[13px] text-text-tertiary">
                          {e.hanja}
                        </span>
                      </div>
                      <p className="text-[13px] text-text-secondary leading-[1.5] line-clamp-2">
                        {e.tagline}
                      </p>
                    </div>
                    <CaretRight
                      size={16}
                      weight="bold"
                      className="text-text-tertiary shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <BusinessFooter />
    </div>
  );
}
