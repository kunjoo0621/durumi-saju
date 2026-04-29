import type { DictEntry } from "../../types";

export const jinsulChung: DictEntry = {
  category: "relation",
  slug: "jinsul-chung",
  name: "진술충",
  hanja: "辰戌沖",
  tagline: "지지 6충의 다섯 번째, 양토 진과 양토 술이 같은 토끼리 부딪히는 화개충",
  meta: {
    title: "진술충(辰戌沖) — 화개충의 의미와 작용",
    description:
      "지지 6충의 다섯 번째 진술충의 의미, 같은 토(土) 양토끼리의 충, 화개충으로서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "양토",
    rightLabel: "양토",
    orderLabel: "지지 6충 · 5번",
    left: { char: "진", hanja: "辰", element: "토", yinYang: "양" },
    right: { char: "술", hanja: "戌", element: "토", yinYang: "양" },
  },
  highlight: [
    { label: "한자", value: "辰戌沖 (진과 술의 충)" },
    { label: "특징", value: "같은 양토끼리의 충 — 붕충(朋沖)" },
    { label: "분류", value: "지지 6충 · 화개충" },
    { label: "성격", value: "환절기 토끼리, 고지의 충" },
  ],
  body: {
    intro:
      "진술충(辰戌沖)은 지지 6충 중 다섯 번째 충입니다. 양토 진(辰)과 양토 술(戌)이 같은 토끼리 부딪히는 충으로, 둘 다 화개(華蓋)에 해당해 '화개충'이라 불립니다.",
    sections: [
      {
        heading: "진술충의 의미",
        paragraphs: [
          "진은 늦봄 환절기의 흙(수의 고지), 술은 늦가을 환절기의 흙(화의 고지)입니다. 같은 양토지만 계절이 정반대이며 품고 있는 고지가 충돌합니다.",
          "진의 지장간(乙癸戊)과 술의 지장간(辛丁戊)이 서로 충하며 내부 변동을 일으킵니다.",
        ],
      },
      {
        heading: "진술충의 작용",
        paragraphs: [
          "외형적 충돌은 적지만 내부 자원의 변동·전환이 일어나는 충입니다. 토끼리라 안정되어 보이는 가운데 안에서 흔들립니다.",
          "고지의 충이라 묻혀 있던 인연·재물·자원이 표면화되고, 정신적·종교적 변화의 신호로 해석됩니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "진술충은 6충 중 비교적 무거운 변화 — 묻혀 있던 것의 표면화 — 로 봅니다. 화개충이라 정신·종교·학문의 흐름이 강해집니다.",
          "축미충과 함께 토끼리의 충 두 가지를 묶어 '사고지(四庫地)의 충'이라 부르기도 합니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "진술충은 강한 충인가요?",
      a: "표면적 충돌은 적지만, 고지의 변동이라 내부적으로는 깊은 변화로 작용합니다.",
    },
    {
      q: "왜 진술을 화개충이라 부르나요?",
      a: "진과 술이 화개살의 지지에 해당해, 두 화개가 충하면 정신·종교·예술적 변동이 따른다고 해석합니다.",
    },
  ],
  related: [
    { category: "jiji", slug: "jin", label: "진(辰)", hint: "양토" },
    { category: "jiji", slug: "sul", label: "술(戌)", hint: "양토" },
    { category: "relation", slug: "chukmi-chung", label: "축미충", hint: "또 다른 토 충" },
    { category: "relation", slug: "jao-chung", label: "자오충", hint: "지지 6충 1번" },
  ],
  updatedAt: "2026-04-28",
};
