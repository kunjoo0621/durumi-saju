import type { DictEntry } from "../../types";

export const inhaeHap: DictEntry = {
  category: "relation",
  slug: "inhae-hap",
  name: "인해합",
  hanja: "寅亥合",
  tagline: "지지 6합 중 두 번째, 인목과 해수가 만나 목(木)으로 변하는 결합",
  meta: {
    title: "인해합(寅亥合) — 지지 6합의 두 번째 결합",
    description:
      "지지 6합의 두 번째 인해합의 의미, 변화 오행 목(木), 사주에서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "양목",
    rightLabel: "음수",
    orderLabel: "지지 6합 · 2번",
    left: { char: "인", hanja: "寅", element: "목", yinYang: "양" },
    right: { char: "해", hanja: "亥", element: "수", yinYang: "음" },
  },
  highlight: [
    { label: "한자", value: "寅亥合 (인과 해의 결합)" },
    { label: "변화 오행", value: "목(木)" },
    { label: "특징", value: "물이 나무를 키우는 생합(生合)" },
    { label: "분류", value: "지지 6합 · 2번" },
  ],
  body: {
    intro:
      "인해합(寅亥合)은 지지 6합 중 두 번째 합입니다. 양목 인(寅)과 음수 해(亥)가 결합하여 그 기운이 목(木)으로 변화합니다.",
    sections: [
      {
        heading: "인해합의 의미",
        paragraphs: [
          "인(寅)은 초봄에 막 자라는 나무, 해(亥)는 초겨울 깊은 물입니다. 해수가 인목을 자라게 하는 수생목(水生木) 관계가 자연스럽게 흘러갑니다.",
          "변화 오행은 목(木)으로, 자라고 뻗어나가는 기운이 강해집니다.",
        ],
      },
      {
        heading: "인해합의 작용",
        paragraphs: [
          "사주에 인해가 들면 목 기운이 강해집니다. 시작·확장·새로운 도전의 흐름이 두드러집니다.",
          "인해합은 6합 중 가장 부드럽고 자연스러운 결합으로 평가됩니다. 수생목의 생조 관계가 합에 그대로 흐르기 때문입니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "인해합이 들면 추진력과 성장 기운이 더해집니다. 다만 인해는 동시에 파(破) 관계로도 보는 학설이 있어, 합 성립이 약하다고 보는 경우도 있습니다.",
          "보편적으로는 길합으로 분류하지만, 사주 전체 균형에 따라 해석을 조정해야 합니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "인해는 합인가요 파인가요?",
      a: "통설은 6합으로 보지만, 일부 학파는 인해파로도 분류합니다. 합이 우세하다는 견해가 다수입니다.",
    },
    {
      q: "변화 오행이 목(木)인 이유는?",
      a: "수(해)가 목(인)을 생조하는 관계라 결합이 목으로 흐르는 자연 비유에 따른 통설입니다.",
    },
  ],
  related: [
    { category: "jiji", slug: "in", label: "인(寅)", hint: "양목" },
    { category: "jiji", slug: "hae", label: "해(亥)", hint: "음수" },
    { category: "ohaeng", slug: "mok", label: "목(木)", hint: "오행" },
    { category: "relation", slug: "jachuk-hap", label: "자축합", hint: "지지 6합 1번" },
  ],
  updatedAt: "2026-04-28",
};
