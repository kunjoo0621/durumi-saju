import type { DictEntry } from "../../types";

export const jachukHap: DictEntry = {
  category: "relation",
  slug: "jachuk-hap",
  name: "자축합",
  hanja: "子丑合",
  tagline: "지지 6합의 첫 번째, 자수와 축토가 만나 토(土)로 변하는 결합",
  meta: {
    title: "자축합(子丑合) — 지지 6합의 첫 결합과 작용",
    description:
      "지지 6합의 첫 번째 자축합의 의미, 변화 오행 토(土), 사주에서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "양수",
    rightLabel: "음토",
    orderLabel: "지지 6합 · 1번",
    left: { char: "자", hanja: "子", element: "수", yinYang: "양" },
    right: { char: "축", hanja: "丑", element: "토", yinYang: "음" },
  },
  highlight: [
    { label: "한자", value: "子丑合 (자와 축의 결합)" },
    { label: "변화 오행", value: "토(土)" },
    { label: "특징", value: "한겨울의 두 지지가 만나는 결합" },
    { label: "분류", value: "지지 6합 · 음양 결합" },
  ],
  body: {
    intro:
      "자축합(子丑合)은 지지 6합 — 자축·인해·묘술·진유·사신·오미 — 중 첫 번째 합입니다. 양수 자(子)와 음토 축(丑)이 결합하여 그 기운이 토(土)로 변화합니다.",
    sections: [
      {
        heading: "자축합의 의미",
        paragraphs: [
          "자(子)는 한겨울 한가운데 차가운 물, 축(丑)은 늦겨울 얼어붙은 흙입니다. 두 글자가 만나면 물이 흙에 갇혀 토의 기운으로 응축됩니다.",
          "변화 오행은 토(土)이며, 단단하고 무겁게 가라앉는 결합으로 봅니다.",
        ],
      },
      {
        heading: "자축합의 작용",
        paragraphs: [
          "사주에 자축이 함께 들면 본래 작용이 약해지고 토 기운이 강해집니다. 추진력·활동성보다는 안정·축적의 흐름이 두드러집니다.",
          "자수의 활발한 흐름이 축토에 묶여 정체될 수 있습니다. 일간이 자수일 경우 기운이 약해지는 결과가 나옵니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "지지합은 천간합보다 작용이 강합니다. 거리·끼는 글자·충(沖)이 합 성립에 영향을 줍니다.",
          "자축합이 들면 차분하고 끈기 있는 기운이 더해진다고 봅니다. 다만 활동력이 막히는 측면이 있어, 사주 전체 균형에 따라 길흉이 갈립니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "지지 6합은 어떤 것들이 있나요?",
      a: "자축(토), 인해(목), 묘술(화), 진유(금), 사신(수), 오미(화) — 6쌍입니다.",
    },
    {
      q: "변화 오행이 토(土)인 이유는?",
      a: "자수와 축토가 만나 물이 흙에 갇히는 자연 비유에 따른 명리 통설입니다.",
    },
  ],
  related: [
    { category: "jiji", slug: "ja", label: "자(子)", hint: "양수" },
    { category: "jiji", slug: "chuk", label: "축(丑)", hint: "음토" },
    { category: "ohaeng", slug: "to", label: "토(土)", hint: "오행" },
    { category: "relation", slug: "gapgi-hap", label: "갑기합", hint: "천간 5합" },
  ],
  updatedAt: "2026-04-28",
};
