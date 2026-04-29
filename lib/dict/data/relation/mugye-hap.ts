import type { DictEntry } from "../../types";

export const mugyeHap: DictEntry = {
  category: "relation",
  slug: "mugye-hap",
  name: "무계합",
  hanja: "戊癸合",
  tagline: "천간 5합 중 다섯 번째, 양토 무와 음수 계가 만나 화(火)로 변하는 결합",
  meta: {
    title: "무계합(戊癸合) — 무정지합의 의미와 작용",
    description:
      "천간 5합의 다섯 번째 무계합의 의미, 변화 오행 화(火), 무정지합이라 불리는 이유와 사주에서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "양토",
    rightLabel: "음수",
    orderLabel: "천간 5합 · 5번",
    left: { char: "무", hanja: "戊", element: "토", yinYang: "양" },
    right: { char: "계", hanja: "癸", element: "수", yinYang: "음" },
  },
  highlight: [
    { label: "한자", value: "戊癸合 (무와 계의 결합)" },
    { label: "변화 오행", value: "화(火)" },
    { label: "별칭", value: "무정지합(無情之合)" },
    { label: "분류", value: "천간 5합 · 음양 결합" },
  ],
  body: {
    intro:
      "무계합(戊癸合)은 천간 5합 중 마지막 다섯 번째 합입니다. 양토 무(戊)와 음수 계(癸)가 결합하여 그 기운이 화(火)로 변화합니다. 별칭으로 '무정지합(無情之合)' — 정 없는 합 — 이라 불립니다.",
    sections: [
      {
        heading: "무계합의 의미",
        paragraphs: [
          "본래 토극수(土剋水) 관계지만, 음양이 다르기에 합으로 묶입니다. 두 글자의 나이 차·격차가 크다고 보아 정이 깊지 않다고 하여 '무정지합'이라 부릅니다.",
          '"무정"은 단순히 차갑다는 뜻이 아니라, 깊은 인연의 정 없이 형식적으로 묶이는 결합이라는 뉘앙스입니다.',
        ],
      },
      {
        heading: "무계합의 작용",
        paragraphs: [
          "결합하면 화(火)의 기운으로 변합니다. 토와 수가 만나 화가 된다는 흐름은 명리 통설의 변화 오행 규칙입니다.",
          "사주에 들면 두 글자 본래 작용이 약해지고 외향성·표현·열정이 강해지는 흐름으로 봅니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "무계합은 5합 중 가장 결합력이 약하다는 평이 있습니다. 사주 환경에 따라 합이 잘 성립하지 않거나, 성립해도 약하게 작용합니다.",
          "관계 궁합에서 무정지합이라 무조건 나쁘다고 보지 않습니다. 형식적·실리적 결합이지만 안정적일 수 있다는 양면성을 가집니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "무계합은 왜 무정지합이라 부르나요?",
      a: "무토와 계수의 격차가 커서 깊은 정 없이 결합한다는 뜻에서 무정지합이라 부릅니다.",
    },
    {
      q: "변화 오행이 화(火)인 이유는?",
      a: "토(무)와 수(계)의 만남이 결국 화로 화한다는 명리 통설의 천간합 규칙에 따른 것입니다.",
    },
  ],
  related: [
    { category: "cheongan", slug: "mu", label: "무(戊)", hint: "양토" },
    { category: "cheongan", slug: "gye", label: "계(癸)", hint: "음수" },
    { category: "ohaeng", slug: "hwa", label: "화(火)", hint: "오행" },
    { category: "relation", slug: "gapgi-hap", label: "갑기합", hint: "천간 5합 1번" },
  ],
  updatedAt: "2026-04-28",
};
