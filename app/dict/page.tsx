import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import BusinessFooter from "@/components/BusinessFooter";
import { getDictEntriesByCategory } from "@/lib/dict/registry";
import {
  DICT_CATEGORY_LABEL,
  type DictCategory,
} from "@/lib/dict/types";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";

const SITE_URL = "https://www.durumisaju.com";

const CATEGORY_ORDER: DictCategory[] = [
  "saju",
  "pillars",
  "cheongan",
  "jiji",
  "gabja",
  "ohaeng",
  "sipsung",
  "unseong12",
  "relation",
  "sinsal",
  "sipisinsal",
];

const CATEGORY_TAGLINE: Record<DictCategory, string> = {
  saju: "사주가 뭔지, 어떻게 보는지 — 입문부터",
  pillars: "년주·월주·일주·시주, 4개의 기둥이 의미하는 것",
  cheongan: "갑·을·병·정… 하늘의 열 글자",
  jiji: "자·축·인·묘… 땅의 열두 글자",
  gabja: "갑자부터 계해까지 60갑자 코드 (= 갑자일주 등)",
  ohaeng: "목·화·토·금·수 — 사주를 이루는 다섯 기운",
  sipsung: "비견·식신·정관… 일간 기준 10가지 별",
  unseong12: "장생부터 양까지 일간이 거치는 12단계 흐름",
  relation: "합·충·형·파·해 — 글자끼리의 작용 관계",
  sinsal: "도화살·역마살·화개살 등 살(殺)의 작용",
  sipisinsal: "년지 기준 12지지에 부여되는 12가지 별",
};

const CATEGORY_TOTAL: Record<DictCategory, number> = {
  saju: 5,
  pillars: 4,
  cheongan: 10,
  jiji: 12,
  gabja: 60,
  ohaeng: 5,
  sipsung: 10,
  unseong12: 12,
  relation: 20,
  sinsal: 20,
  sipisinsal: 12,
};

export const metadata: Metadata = {
  title: "사주 사전 — 60갑자, 천간지지, 십성, 신살 정리 | 사주보는 두루미",
  description:
    "사주에 등장하는 모든 용어를 한 곳에 정리한 사전입니다. 사주 입문부터 4기둥, 천간지지, 60갑자, 오행, 십성, 12운성, 합충형, 신살, 12신살까지 카테고리별로 깊이 있게 풀어드립니다.",
  alternates: { canonical: "/dict" },
  openGraph: {
    title: "사주 사전 — 사주 용어 한 곳에",
    description:
      "사주 입문, 4기둥, 60갑자, 천간지지, 십성, 신살까지 카테고리별 풀이.",
    url: `${SITE_URL}/dict`,
    type: "website",
    locale: "ko_KR",
  },
};

export default function DictHubPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background-primary">
      <Header showBack sticky />

      <main className="flex-1 max-w-[640px] mx-auto w-full px-5 pt-2 pb-10">
        <header className="py-2 mb-8">
          <div className="text-[12px] tracking-[0.18em] text-[#FF6B6B] font-semibold mb-3 uppercase">
            사주 사전
          </div>
          <h1 className="text-display font-aggro text-text-primary leading-[1.15] mb-3">
            사주에 등장하는 <br className="sm:hidden" />모든 용어
          </h1>
          <p className="text-body-2 text-text-secondary leading-[1.7]">
            사주 입문부터 4기둥, 60갑자, 천간지지, 십성, 신살까지 — 분석 결과에
            등장하는 단어들의 의미를 깊이 있게 풀어 모았습니다.
          </p>
        </header>

        <div className="space-y-2">
          {CATEGORY_ORDER.map((cat) => {
            const label = DICT_CATEGORY_LABEL[cat];
            const tagline = CATEGORY_TAGLINE[cat];
            const total = CATEGORY_TOTAL[cat];
            const filled = getDictEntriesByCategory(cat).length;
            const ready = filled > 0;

            return (
              <Link
                key={cat}
                href={`/dict/${cat}`}
                className="block rounded-2xl bg-background-secondary border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[18px] font-aggro text-text-primary">
                        {label}
                      </span>
                      <span
                        className={`text-[10px] tracking-wider px-2 py-0.5 rounded-full ${
                          ready
                            ? "bg-[#FF6B6B]/12 text-[#FF6B6B]"
                            : "bg-white/[0.04] text-text-tertiary"
                        }`}
                      >
                        {filled} / {total}
                      </span>
                    </div>
                    <p className="text-[13px] text-text-secondary leading-[1.5] line-clamp-1">
                      {tagline}
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
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-[13px] text-text-secondary leading-[1.7]">
            사전은 단계적으로 채워가고 있습니다. 카테고리마다 한 항목씩 먼저 만들어
            구조를 잡고, 나머지는 차례로 확장합니다.
          </p>
        </div>
      </main>

      <BusinessFooter />
    </div>
  );
}
