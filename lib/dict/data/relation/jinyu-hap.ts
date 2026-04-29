import type { DictEntry } from "../../types";

export const jinyuHap: DictEntry = {
  category: "relation",
  slug: "jinyu-hap",
  name: "진유합",
  hanja: "辰酉合",
  tagline: "지지 6합 중 네 번째, 진토와 유금이 만나 금(金)으로 변하는 결합",
  meta: {
    title: "진유합(辰酉合) — 지지 6합의 네 번째 결합",
    description:
      "지지 6합의 네 번째 진유합의 의미, 변화 오행 금(金), 사주에서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "양토",
    rightLabel: "음금",
    orderLabel: "지지 6합 · 4번",
    left: { char: "진", hanja: "辰", element: "토", yinYang: "양" },
    right: { char: "유", hanja: "酉", element: "금", yinYang: "음" },
  },
  highlight: [
    { label: "한자", value: "辰酉合 (진과 유의 결합)" },
    { label: "변화 오행", value: "금(金)" },
    { label: "특징", value: "토생금(土生金) 자연 흐름의 합" },
    { label: "분류", value: "지지 6합 · 음양 결합" },
  ],
  body: {
    intro:
      "진유합(辰酉合)은 지지 6합 중 네 번째 합입니다. 양토 진(辰)과 음금 유(酉)가 결합하여 그 기운이 금(金)으로 변화합니다.",
    sections: [
      {
        heading: "진유합의 의미",
        paragraphs: [
          "진(辰)은 늦봄 환절기의 흙, 유(酉)는 한가을 절정의 금입니다. 토생금(土生金)의 자연스러운 흐름에 음양이 다른 결합이 더해져 합으로 묶입니다.",
          "변화 오행은 금(金)으로, 단단함과 결단의 기운이 강해집니다.",
        ],
      },
      {
        heading: "진유합의 작용",
        paragraphs: [
          "사주에 진유가 들면 금 기운이 강해집니다. 결단력·정리·체계의 흐름이 두드러집니다.",
          "진토는 본래 수의 고지를 품고 있어 다양한 작용을 하지만, 유금과 합하면 그 기운이 금 쪽으로 정렬됩니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "토와 금의 자연스러운 생조 관계라 결합력이 비교적 안정적이라 평가됩니다.",
          "진토 일간이 유금을 만나면 본래 기운이 금으로 흘러 약해질 수 있고, 유금 일간 입장에서는 든든한 토대 위에 단단함이 더해집니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "변화 오행이 금(金)인 이유는?",
      a: "토(진)가 금(유)을 생조하는 관계가 합으로 흐르며 금이 강해진다는 자연 비유의 통설입니다.",
    },
    {
      q: "진유합은 안정적인 합인가요?",
      a: "토생금의 자연 흐름이라 결합력이 안정적인 편으로 평가됩니다.",
    },
  ],
  related: [
    { category: "jiji", slug: "jin", label: "진(辰)", hint: "양토" },
    { category: "jiji", slug: "yu", label: "유(酉)", hint: "음금" },
    { category: "ohaeng", slug: "geum", label: "금(金)", hint: "오행" },
    { category: "relation", slug: "jachuk-hap", label: "자축합", hint: "지지 6합 1번" },
  ],
  updatedAt: "2026-04-28",
};
