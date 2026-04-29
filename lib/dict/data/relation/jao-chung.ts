import type { DictEntry } from "../../types";

export const jaoChung: DictEntry = {
  category: "relation",
  slug: "jao-chung",
  name: "자오충",
  hanja: "子午沖",
  tagline: "지지 6충의 첫 번째, 한겨울 자수와 한여름 오화가 정면으로 부딪히는 충",
  meta: {
    title: "자오충(子午沖) — 지지 6충의 첫 충돌",
    description:
      "지지 6충의 첫 번째 자오충의 의미, 정북-정남의 정면 충돌, 사주에서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "양수",
    rightLabel: "양화",
    orderLabel: "지지 6충 · 1번",
    left: { char: "자", hanja: "子", element: "수", yinYang: "양" },
    right: { char: "오", hanja: "午", element: "화", yinYang: "양" },
  },
  highlight: [
    { label: "한자", value: "子午沖 (자와 오의 충)" },
    { label: "방향", value: "정북(자) ↔ 정남(오)" },
    { label: "특징", value: "12지지 충 중 가장 격렬한 충" },
    { label: "분류", value: "지지 6충 · 도화축선" },
  ],
  body: {
    intro:
      "자오충(子午沖)은 지지 6충 — 자오·축미·인신·묘유·진술·사해 — 중 첫 번째 충입니다. 한겨울 정점의 자수(子)와 한여름 정점의 오화(午)가 정면으로 부딪히는 가장 격렬한 충입니다.",
    sections: [
      {
        heading: "자오충의 의미",
        paragraphs: [
          "자(子)는 정북, 오(午)는 정남으로 12지지에서 정반대 위치에 있습니다. 한겨울 깊은 물과 한여름 정점의 불이 만나면 수화상극(水火相剋)의 가장 강한 충돌이 일어납니다.",
          "두 글자 모두 왕지(자오묘유)에 속해 기운이 강해, 충의 강도가 6충 중 가장 큽니다.",
        ],
      },
      {
        heading: "자오충의 작용",
        paragraphs: [
          "사주에 자오가 들면 큰 변동·이동·심리 변화가 일어난다고 봅니다. 정북-정남의 축이 흔들리며 균형이 무너집니다.",
          "긍정적으로는 변화의 동력이 되지만, 부정적으로는 사고·이별·갑작스러운 변동의 흐름이 됩니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "자오충은 일지·월지에 들면 가족·배우자·직장 변동의 신호가 됩니다.",
          "충이 들었다고 무조건 흉으로 보지 않습니다. 일간이 강하고 용신을 충하지 않으면 오히려 변화의 동력으로 작용합니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "자오충은 왜 가장 강한 충인가요?",
      a: "정북-정남의 정반대 방향이고, 자와 오 모두 왕지로 기운이 가장 강하기 때문입니다.",
    },
    {
      q: "자오충은 무조건 나쁜가요?",
      a: "아닙니다. 사주 환경에 따라 변화의 동력이 되기도 합니다. 일간 강약과 용신 위치를 함께 봐야 합니다.",
    },
  ],
  related: [
    { category: "jiji", slug: "ja", label: "자(子)", hint: "양수" },
    { category: "jiji", slug: "o", label: "오(午)", hint: "양화" },
    { category: "relation", slug: "myoyu-chung", label: "묘유충", hint: "지지 6충 4번" },
    { category: "relation", slug: "jachuk-hap", label: "자축합", hint: "지지 6합" },
  ],
  updatedAt: "2026-04-28",
};
