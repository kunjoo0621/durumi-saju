import type { DictEntry } from "../../types";

export const jeongimHap: DictEntry = {
  category: "relation",
  slug: "jeongim-hap",
  name: "정임합",
  hanja: "丁壬合",
  tagline: "천간 5합 중 네 번째, 음화 정과 양수 임이 만나 목(木)으로 변하는 결합",
  meta: {
    title: "정임합(丁壬合) — 인수지합 / 음란지합의 의미",
    description:
      "천간 5합의 네 번째 정임합의 의미, 변화 오행 목(木), 인수지합·음란지합으로 갈리는 별칭과 사주에서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "음화",
    rightLabel: "양수",
    orderLabel: "천간 5합 · 4번",
    left: { char: "정", hanja: "丁", element: "화", yinYang: "음" },
    right: { char: "임", hanja: "壬", element: "수", yinYang: "양" },
  },
  highlight: [
    { label: "한자", value: "丁壬合 (정과 임의 결합)" },
    { label: "변화 오행", value: "목(木)" },
    { label: "별칭", value: "인수지합(仁壽之合) / 음란지합(淫亂之合)" },
    { label: "분류", value: "천간 5합 · 음양 결합" },
  ],
  body: {
    intro:
      "정임합(丁壬合)은 천간 5합 중 네 번째 합입니다. 음화 정(丁)과 양수 임(壬)이 결합하여 그 기운이 목(木)으로 변화합니다. 별칭은 학파에 따라 '인수지합(仁壽之合)' 또는 '음란지합(淫亂之合)'으로 갈립니다.",
    sections: [
      {
        heading: "정임합의 의미",
        paragraphs: [
          "본래 수극화(水剋火) 관계지만, 음양이 다르기에 합으로 묶이고 그 결과 목(木)이 자라난다고 봅니다. 물(임)이 불(정) 곁의 나무(목)를 자라게 하는 이치입니다.",
          "별칭이 두 갈래입니다. 좋게 보면 어질고 장수하는 합 — 인수지합 — 이고, 부정적으로 보면 정과 임이 서로 끌리는 본능적 결합이라 음란지합이라 부릅니다.",
        ],
      },
      {
        heading: "정임합의 작용",
        paragraphs: [
          "사주에 들면 두 글자의 본래 작용이 약해지고 목의 기운이 살아납니다. 부드럽고 자라는 기운으로 해석합니다.",
          "감정·정서·끌림을 자극하는 합으로, 인연·연애 관련 해석에서 자주 거론됩니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "정임합이 사주에 들면 정서적 감수성과 인연의 흐름이 강해진다고 봅니다. 다만 음란지합이라는 별칭은 무조건 부정으로 단정할 게 아니라, 사주 전체 환경에 따라 강도가 달라집니다.",
          "학파별 해석 차이가 큰 합이므로, 별칭만으로 길흉을 단정하기보다 신강·신약과 다른 합충 작용을 종합해 봐야 합니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "정임합은 왜 별칭이 두 가지인가요?",
      a: "긍정적으로 보면 어짊과 장수의 합(인수지합), 부정적으로 보면 본능적 끌림이 강하다는 의미의 음란지합으로 학파에 따라 다르게 부릅니다.",
    },
    {
      q: "변화 오행이 목(木)인 이유는?",
      a: "정(불)과 임(물)이 만나면 그 사이에서 나무가 자란다는 자연 비유에 근거합니다. 명리 통설입니다.",
    },
  ],
  related: [
    { category: "cheongan", slug: "jeong", label: "정(丁)", hint: "음화" },
    { category: "cheongan", slug: "im", label: "임(壬)", hint: "양수" },
    { category: "ohaeng", slug: "mok", label: "목(木)", hint: "오행" },
    { category: "relation", slug: "gapgi-hap", label: "갑기합", hint: "천간 5합 1번" },
  ],
  updatedAt: "2026-04-28",
};
