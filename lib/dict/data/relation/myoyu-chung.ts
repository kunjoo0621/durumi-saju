import type { DictEntry } from "../../types";

export const myoyuChung: DictEntry = {
  category: "relation",
  slug: "myoyu-chung",
  name: "묘유충",
  hanja: "卯酉沖",
  tagline: "지지 6충의 네 번째, 봄의 절정 묘목과 가을의 절정 유금이 부딪히는 도화충",
  meta: {
    title: "묘유충(卯酉沖) — 도화충의 의미와 작용",
    description:
      "지지 6충의 네 번째 묘유충의 의미, 음목 묘와 음금 유의 충, 도화충으로서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "음목",
    rightLabel: "음금",
    orderLabel: "지지 6충 · 4번",
    left: { char: "묘", hanja: "卯", element: "목", yinYang: "음" },
    right: { char: "유", hanja: "酉", element: "금", yinYang: "음" },
  },
  highlight: [
    { label: "한자", value: "卯酉沖 (묘와 유의 충)" },
    { label: "특징", value: "도화축선의 충 — 인연·이성" },
    { label: "분류", value: "지지 6충 · 도화충" },
    { label: "성격", value: "음목 vs 음금, 금극목" },
  ],
  body: {
    intro:
      "묘유충(卯酉沖)은 지지 6충 중 네 번째 충입니다. 봄의 절정 음목 묘(卯)와 가을의 절정 음금 유(酉)가 부딪히며, 둘 다 도화(桃花)에 해당해 '도화충'이라 불립니다.",
    sections: [
      {
        heading: "묘유충의 의미",
        paragraphs: [
          "묘는 봄의 정점, 유는 가을의 정점으로 정반대 계절입니다. 음금이 음목을 정밀하게 자르는 그림으로 비유됩니다.",
          "묘유는 모두 자오묘유 — 도화살의 지지 — 라 두 글자의 충은 인연·이성·정서의 변동으로 자주 해석됩니다.",
        ],
      },
      {
        heading: "묘유충의 작용",
        paragraphs: [
          "사주에 묘유가 들면 인간관계·연애·이성 문제의 변동이 두드러집니다. 만남과 이별, 정서적 동요가 잦은 흐름이 됩니다.",
          "정밀한 충돌이라 표면적 변화보다 내면의 흔들림이 강한 편입니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "도화충은 매력·끌림이 강한 사주에서는 인기와 인연의 동력이 되지만, 갈등·삼각관계로 작용하기도 합니다.",
          "일지·월지에 들면 배우자·가족 관계의 동요로 나타납니다. 사주 전체 균형을 봐야 정확한 해석이 가능합니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "묘유충은 왜 도화충인가요?",
      a: "묘와 유 모두 도화살의 지지(자오묘유)에 해당해, 두 글자의 충은 인연·이성·정서 변동으로 해석됩니다.",
    },
    {
      q: "묘유충이 들면 연애운이 나쁜가요?",
      a: "꼭 그렇지 않습니다. 인연의 변동이 잦다는 의미이며, 사주 환경에 따라 좋은 인연·기회로도 작용합니다.",
    },
  ],
  related: [
    { category: "jiji", slug: "myo", label: "묘(卯)", hint: "음목" },
    { category: "jiji", slug: "yu", label: "유(酉)", hint: "음금" },
    { category: "relation", slug: "jao-chung", label: "자오충", hint: "또 다른 도화충" },
    { category: "relation", slug: "myosul-hap", label: "묘술합", hint: "묘의 합" },
  ],
  updatedAt: "2026-04-28",
};
