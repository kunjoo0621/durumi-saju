import type { DictEntry } from "../../types";

export const omiHap: DictEntry = {
  category: "relation",
  slug: "omi-hap",
  name: "오미합",
  hanja: "午未合",
  tagline: "지지 6합 중 여섯 번째, 오화와 미토가 만나 화(火)로 변하는 결합",
  meta: {
    title: "오미합(午未合) — 일월합의 의미와 작용",
    description:
      "지지 6합의 여섯 번째 오미합의 의미, 변화 오행 화(火), 일월합으로 불리는 배경과 사주 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "양화",
    rightLabel: "음토",
    orderLabel: "지지 6합 · 6번",
    left: { char: "오", hanja: "午", element: "화", yinYang: "양" },
    right: { char: "미", hanja: "未", element: "토", yinYang: "음" },
  },
  highlight: [
    { label: "한자", value: "午未合 (오와 미의 결합)" },
    { label: "변화 오행", value: "화(火)" },
    { label: "별칭", value: "일월합(日月合)" },
    { label: "분류", value: "지지 6합 · 음양 결합" },
  ],
  body: {
    intro:
      "오미합(午未合)은 지지 6합 중 마지막 여섯 번째 합입니다. 양화 오(午)와 음토 미(未)가 결합하여 그 기운이 화(火)로 변화합니다. 별칭으로 '일월합(日月合)' — 해와 달의 합 — 이라 불립니다.",
    sections: [
      {
        heading: "오미합의 의미",
        paragraphs: [
          "오(午)는 한낮 정점의 불, 미(未)는 한여름 늦여름의 흙입니다. 화생토(火生土)의 자연 흐름에 음양이 다른 결합이 더해져 합으로 묶입니다.",
          "오는 해, 미는 달에 비유되어 일월합이라 부르며, 두 천체의 만남처럼 자연스러운 결합으로 평가됩니다.",
        ],
      },
      {
        heading: "오미합의 작용",
        paragraphs: [
          "사주에 오미가 들면 화 기운이 강해집니다. 미토가 오화의 열기를 머금어 화로 화하는 흐름입니다.",
          "외향성·표현·열정이 강해지며 더운 기운이 두드러집니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "오미합은 결합력이 안정적인 편입니다. 일월합이라는 별칭처럼 자연스럽고 따뜻한 흐름으로 봅니다.",
          "단, 사주에 화가 이미 강하면 합으로 화가 더해지며 과열될 수 있어 균형을 살펴야 합니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "오미합은 왜 일월합이라 부르나요?",
      a: "오를 해, 미를 달로 보아 두 천체의 만남에 비유한 별칭입니다.",
    },
    {
      q: "변화 오행이 화(火)인 이유는?",
      a: "오화의 강한 열기와 미토의 늦여름 기운이 결합해 화로 화한다는 통설입니다.",
    },
  ],
  related: [
    { category: "jiji", slug: "o", label: "오(午)", hint: "양화" },
    { category: "jiji", slug: "mi", label: "미(未)", hint: "음토" },
    { category: "ohaeng", slug: "hwa", label: "화(火)", hint: "오행" },
    { category: "relation", slug: "jachuk-hap", label: "자축합", hint: "지지 6합 1번" },
  ],
  updatedAt: "2026-04-28",
};
