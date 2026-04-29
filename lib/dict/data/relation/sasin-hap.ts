import type { DictEntry } from "../../types";

export const sasinHap: DictEntry = {
  category: "relation",
  slug: "sasin-hap",
  name: "사신합",
  hanja: "巳申合",
  tagline: "지지 6합 중 다섯 번째, 사화와 신금이 만나 수(水)로 변하는 결합",
  meta: {
    title: "사신합(巳申合) — 지지 6합의 다섯 번째 결합",
    description:
      "지지 6합의 다섯 번째 사신합의 의미, 변화 오행 수(水), 합·형·파가 동시에 일어나는 복잡한 작용을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "음화",
    rightLabel: "양금",
    orderLabel: "지지 6합 · 5번",
    left: { char: "사", hanja: "巳", element: "화", yinYang: "음" },
    right: { char: "신", hanja: "申", element: "금", yinYang: "양" },
  },
  highlight: [
    { label: "한자", value: "巳申合 (사와 신의 결합)" },
    { label: "변화 오행", value: "수(水)" },
    { label: "특징", value: "합이면서 형(刑)·파(破)이기도 함" },
    { label: "분류", value: "지지 6합 · 음양 결합" },
  ],
  body: {
    intro:
      "사신합(巳申合)은 지지 6합 중 다섯 번째 합입니다. 음화 사(巳)와 양금 신(申)이 결합하여 그 기운이 수(水)로 변화합니다. 단, 사신은 동시에 형(刑)과 파(破) 관계이기도 한 복잡한 결합입니다.",
    sections: [
      {
        heading: "사신합의 의미",
        paragraphs: [
          "본래 화극금(火剋金) 관계지만 음양이 다르기에 합으로 묶입니다. 화-금의 충돌이 결국 수(水)로 응축된다는 비유적 해석입니다.",
          "동시에 사신은 형(寅巳申 삼형의 일부)과 파 관계이기도 합니다. 따라서 합 작용과 형·파 작용이 같이 일어나는 양면성을 갖습니다.",
        ],
      },
      {
        heading: "사신합의 작용",
        paragraphs: [
          "합으로 보면 수의 기운이 살아나며 응축·내면화·차분함이 강해집니다.",
          "형·파로 보면 충돌·갈등·구조의 흔들림이 함께 일어납니다. 그래서 사신합은 좋은 합이라기보다 변화가 큰 합으로 평가됩니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "사신합이 들면 큰 변화·전환이 따른다고 봅니다. 단순히 길합으로만 보지 않고, 형·파 작용이 함께 작동하는지 살펴야 합니다.",
          "사주 전체에 인(寅)이 함께 있다면 인사신 삼형으로 더 강하게 작용합니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "사신합은 합인가요 형인가요?",
      a: "둘 다입니다. 6합이면서 형·파 관계도 동시에 작용합니다. 사주 환경에 따라 어느 쪽이 강한지 달라집니다.",
    },
    {
      q: "변화 오행이 수(水)인 이유는?",
      a: "화와 금의 충돌이 응축되어 수로 화한다는 명리 통설의 합화 규칙입니다.",
    },
  ],
  related: [
    { category: "jiji", slug: "sa", label: "사(巳)", hint: "음화" },
    { category: "jiji", slug: "sin", label: "신(申)", hint: "양금" },
    { category: "ohaeng", slug: "su", label: "수(水)", hint: "오행" },
    { category: "relation", slug: "jachuk-hap", label: "자축합", hint: "지지 6합 1번" },
  ],
  updatedAt: "2026-04-28",
};
