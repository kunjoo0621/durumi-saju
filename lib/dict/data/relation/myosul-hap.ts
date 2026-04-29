import type { DictEntry } from "../../types";

export const myosulHap: DictEntry = {
  category: "relation",
  slug: "myosul-hap",
  name: "묘술합",
  hanja: "卯戌合",
  tagline: "지지 6합 중 세 번째, 묘목과 술토가 만나 화(火)로 변하는 결합",
  meta: {
    title: "묘술합(卯戌合) — 지지 6합의 세 번째 결합",
    description:
      "지지 6합의 세 번째 묘술합의 의미, 변화 오행 화(火), 사주에서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "음목",
    rightLabel: "양토",
    orderLabel: "지지 6합 · 3번",
    left: { char: "묘", hanja: "卯", element: "목", yinYang: "음" },
    right: { char: "술", hanja: "戌", element: "토", yinYang: "양" },
  },
  highlight: [
    { label: "한자", value: "卯戌合 (묘와 술의 결합)" },
    { label: "변화 오행", value: "화(火)" },
    { label: "특징", value: "본래 극(剋) 관계지만 합으로 묶임" },
    { label: "분류", value: "지지 6합 · 음양 결합" },
  ],
  body: {
    intro:
      "묘술합(卯戌合)은 지지 6합 중 세 번째 합입니다. 음목 묘(卯)와 양토 술(戌)이 결합하여 그 기운이 화(火)로 변화합니다.",
    sections: [
      {
        heading: "묘술합의 의미",
        paragraphs: [
          "본래 목극토(木剋土) 관계지만, 음양이 다르기에 충돌 대신 합으로 묶입니다. 술토는 화의 고지(庫支)라 불씨를 품고 있어, 묘목이 그 불씨를 살려 화로 변화시킵니다.",
          "변화 오행은 화(火)로, 따뜻하고 외향적인 기운이 살아납니다.",
        ],
      },
      {
        heading: "묘술합의 작용",
        paragraphs: [
          "사주에 묘술이 들면 화의 기운이 강해집니다. 표현·열정·활동성이 늘어나는 흐름으로 봅니다.",
          "본래 극 관계가 합으로 변하기에 결합력이 강하지 않다는 평도 있습니다. 거리와 환경에 따라 합 성립이 달라집니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "묘술합은 정·연애·끌림과 관련이 자주 거론되며, 학설에 따라 도화 성격을 갖는다고 보기도 합니다.",
          "묘목 일간이 술토를 만나면 본래 기운이 화로 흐르며 약해질 수 있고, 술토 일간 입장에서는 자기 안의 화가 살아나는 결과가 됩니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "변화 오행이 화(火)인 이유는?",
      a: "술토에 화의 고지가 들어 있고, 묘목이 그 불씨를 살린다는 자연 비유에 근거합니다.",
    },
    {
      q: "묘술합은 강한 합인가요?",
      a: "6합 중 결합력이 약한 편으로 평가됩니다. 환경에 따라 합이 잘 성립하지 않을 수 있습니다.",
    },
  ],
  related: [
    { category: "jiji", slug: "myo", label: "묘(卯)", hint: "음목" },
    { category: "jiji", slug: "sul", label: "술(戌)", hint: "양토" },
    { category: "ohaeng", slug: "hwa", label: "화(火)", hint: "오행" },
    { category: "relation", slug: "jachuk-hap", label: "자축합", hint: "지지 6합 1번" },
  ],
  updatedAt: "2026-04-28",
};
