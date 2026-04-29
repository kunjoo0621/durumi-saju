import type { DictEntry } from "../../types";

export const insinChung: DictEntry = {
  category: "relation",
  slug: "insin-chung",
  name: "인신충",
  hanja: "寅申沖",
  tagline: "지지 6충의 세 번째, 봄의 시작 인목과 가을의 시작 신금이 부딪히는 역마충",
  meta: {
    title: "인신충(寅申沖) — 역마충의 의미와 작용",
    description:
      "지지 6충의 세 번째 인신충의 의미, 양목 인과 양금 신의 충, 역마충으로서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "양목",
    rightLabel: "양금",
    orderLabel: "지지 6충 · 3번",
    left: { char: "인", hanja: "寅", element: "목", yinYang: "양" },
    right: { char: "신", hanja: "申", element: "금", yinYang: "양" },
  },
  highlight: [
    { label: "한자", value: "寅申沖 (인과 신의 충)" },
    { label: "특징", value: "역마축선의 충 — 이동·변동" },
    { label: "분류", value: "지지 6충 · 역마충" },
    { label: "성격", value: "양목 vs 양금, 금극목" },
  ],
  body: {
    intro:
      "인신충(寅申沖)은 지지 6충 중 세 번째 충입니다. 봄의 시작 양목 인(寅)과 가을의 시작 양금 신(申)이 부딪히며, 둘 다 역마(驛馬)에 해당해 '역마충'이라 불립니다.",
    sections: [
      {
        heading: "인신충의 의미",
        paragraphs: [
          "인은 봄의 시작, 신은 가을의 시작으로 계절이 정반대입니다. 금극목(金剋木) 관계에서 양금이 양목을 강하게 칩니다.",
          "인신은 모두 역마살에 해당해 두 글자가 충하면 이동·여행·변동의 흐름이 강해집니다.",
        ],
      },
      {
        heading: "인신충의 작용",
        paragraphs: [
          "사주에 인신이 들면 이동수·변동수가 두드러집니다. 거주지·직장 이동, 해외 출입 등 외적 변화로 자주 나타납니다.",
          "양 vs 양의 강한 충이라 결단력 있는 변화로 작용하지만, 갑작스러운 사고·교통 사고의 신호로도 해석됩니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "역마충은 활동적인 사람에게는 기회·성장의 동력이 되고, 안정형에게는 불안·동요로 작용합니다.",
          "사주에 사(巳)가 함께 있으면 인사신 삼형(三刑)이 되어 갈등·송사·구조 변동이 더 크게 일어납니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "인신충은 왜 역마충인가요?",
      a: "인과 신 모두 역마살에 해당하는 지지라, 두 글자의 충은 이동·변동의 신호로 해석됩니다.",
    },
    {
      q: "인신충은 무조건 흉인가요?",
      a: "아닙니다. 활동적인 환경에서는 변화의 동력이 됩니다. 일간 강약과 용신 위치에 따라 길흉이 달라집니다.",
    },
  ],
  related: [
    { category: "jiji", slug: "in", label: "인(寅)", hint: "양목" },
    { category: "jiji", slug: "sin", label: "신(申)", hint: "양금" },
    { category: "relation", slug: "sahae-chung", label: "사해충", hint: "또 다른 역마충" },
    { category: "relation", slug: "jao-chung", label: "자오충", hint: "지지 6충 1번" },
  ],
  updatedAt: "2026-04-28",
};
