import type { DictEntry } from "../../types";

export const hakdangGwiin: DictEntry = {
  category: "sinsal",
  slug: "hakdang-gwiin",
  name: "학당귀인",
  hanja: "學堂貴人",
  tagline: "배움과 가르침의 별, 학자·교육자의 길성",
  meta: {
    title: "학당귀인(學堂貴人) — 배움의 별, 사주 신살 풀이",
    description:
      "학당귀인의 정의, 일간별 해당 지지(12운성 장생 자리), 배움과 가르침의 작용을 정리합니다.",
  },
  hero: {
    variant: "concept",
    accentColor: "#22C55E",
    orderLabel: "신살 · 학당귀인",
  },
  highlight: [
    { label: "한자", value: "學堂貴人 (배움의 집 귀인)" },
    { label: "기준", value: "일간(日干)의 12운성 장생(長生)" },
    { label: "성질", value: "배움 · 가르침 · 지혜" },
    { label: "분류", value: "길성(吉星)" },
  ],
  body: {
    intro:
      "학당귀인(學堂貴人)은 배움과 가르침에 좋은 길성입니다. 일간 기준 12운성의 장생(長生) 자리에 해당하며, 학자·교육자·연구자에게 자질이 발현되는 별입니다.",
    sections: [
      {
        heading: "학당귀인이란",
        paragraphs: [
          "학당(學堂)은 '배움의 집'을 뜻하며, 일간 기준 12운성의 장생(長生) 위치 지지가 학당귀인이 됩니다.",
          "갑(甲)→해, 을(乙)→오, 병·무(丙·戊)→인, 정·기(丁·己)→유, 경(庚)→사, 신(辛)→자, 임(壬)→신, 계(癸)→묘 가 학당입니다.",
          "사주에 학당귀인이 있으면 어린 시절부터 학구열이 강하고, 가르치는 일에도 재능을 보인다고 봅니다.",
        ],
      },
      {
        heading: "어디에 들면 어떻게 작용하는가",
        paragraphs: [
          "월지·일지에 들면 직업으로 학문·교육·연구에 끌리는 경향이 강해지고, 본인이 평생 배움을 이어가는 사람이 됩니다.",
          "시주에 들면 노년에 학문에 정진하거나 자식이 학자·교육자가 되는 경우가 많습니다.",
        ],
      },
      {
        heading: "현대 명리의 해석",
        paragraphs: [
          "학당귀인은 '평생 학습자'의 자질을 뜻합니다. 빠르게 배우고 그것을 다시 가르치는 능력이 강합니다.",
          "교사·교수·강사·연구원·교육 콘텐츠 제작자·코치 등 가르침을 직업으로 하는 영역에서 강점이 두드러집니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "학당귀인과 문창귀인 둘 다 있으면 어떤가요?",
      a: "학문 자질이 매우 강한 사주로 봅니다. 문창은 글·시험, 학당은 배움·가르침에 강하므로 학자·작가형 사주가 됩니다.",
    },
    {
      q: "학당귀인이 있어도 공부를 못하는 경우는 왜 그런가요?",
      a: "흉살이나 형충에 의해 깨지거나, 환경·운의 흐름이 학문에 맞지 않으면 자질이 발현되지 않을 수 있습니다.",
    },
  ],
  related: [
    { category: "sinsal", slug: "munchang-gwiin", label: "문창귀인", hint: "신살" },
    { category: "sinsal", slug: "cheonyl-gwiin", label: "천을귀인", hint: "신살" },
    { category: "unseong12", slug: "jangsaeng", label: "장생", hint: "12운성" },
    { category: "sinsal", slug: "hwagae", label: "화개살", hint: "신살" },
  ],
  updatedAt: "2026-04-28",
};
