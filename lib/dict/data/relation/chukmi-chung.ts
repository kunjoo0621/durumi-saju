import type { DictEntry } from "../../types";

export const chukmiChung: DictEntry = {
  category: "relation",
  slug: "chukmi-chung",
  name: "축미충",
  hanja: "丑未沖",
  tagline: "지지 6충의 두 번째, 음토 축과 음토 미가 같은 토끼리 부딪히는 충",
  meta: {
    title: "축미충(丑未沖) — 지지 6충의 두 번째 충돌",
    description:
      "지지 6충의 두 번째 축미충의 의미, 같은 토(土) 끼리의 충, 사주에서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "음토",
    rightLabel: "음토",
    orderLabel: "지지 6충 · 2번",
    left: { char: "축", hanja: "丑", element: "토", yinYang: "음" },
    right: { char: "미", hanja: "未", element: "토", yinYang: "음" },
  },
  highlight: [
    { label: "한자", value: "丑未沖 (축과 미의 충)" },
    { label: "특징", value: "같은 토(土)끼리의 충 — 붕충(朋沖)" },
    { label: "분류", value: "지지 6충 · 화개축선" },
    { label: "성격", value: "토 안의 지장간 충돌" },
  ],
  body: {
    intro:
      "축미충(丑未沖)은 지지 6충 중 두 번째 충입니다. 음토 축(丑)과 음토 미(未)가 같은 토끼리 부딪힙니다. 같은 오행끼리의 충이라 '붕충(朋沖)'이라 부르기도 합니다.",
    sections: [
      {
        heading: "축미충의 의미",
        paragraphs: [
          "축은 한겨울 얼어붙은 흙(수의 고지), 미는 한여름 마른 흙(목의 고지)입니다. 같은 토지만 계절이 정반대라 흙 안의 지장간이 충돌합니다.",
          "축의 지장간(癸辛己)과 미의 지장간(丁乙己)이 서로 충하며 내부 충돌을 일으킵니다.",
        ],
      },
      {
        heading: "축미충의 작용",
        paragraphs: [
          "축미충은 외형적으로 큰 충돌은 없지만 내부의 변동이 일어나는 충입니다. 토끼리라 표면은 안정되어 보여도 안에서 흔들림이 있습니다.",
          "고지(庫支)의 충이라 묻혀 있던 것이 드러나고, 저장된 자원이 풀려 활용된다는 해석도 있습니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "축미충은 6충 중 비교적 약한 충으로 평가됩니다. 단, 화개충에 해당해 정신적·종교적·예술적 변화의 신호로 해석되기도 합니다.",
          "고지의 충은 묻혀 있던 인연·재물·정보가 표면화된다는 양면성을 갖습니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "축미충은 강한 충인가요?",
      a: "6충 중 비교적 약한 편입니다. 같은 토끼리라 표면적 충돌은 적고 내부의 지장간 충돌이 핵심입니다.",
    },
    {
      q: "왜 축미를 화개충이라 부르나요?",
      a: "축미는 화개살에 해당하는 지지로, 두 화개가 충하면 정신·종교·예술적 변동이 따른다고 해석합니다.",
    },
  ],
  related: [
    { category: "jiji", slug: "chuk", label: "축(丑)", hint: "음토" },
    { category: "jiji", slug: "mi", label: "미(未)", hint: "음토" },
    { category: "relation", slug: "jinsul-chung", label: "진술충", hint: "또 다른 토 충" },
    { category: "relation", slug: "jao-chung", label: "자오충", hint: "지지 6충 1번" },
  ],
  updatedAt: "2026-04-28",
};
