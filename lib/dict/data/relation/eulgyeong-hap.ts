import type { DictEntry } from "../../types";

export const eulgyeongHap: DictEntry = {
  category: "relation",
  slug: "eulgyeong-hap",
  name: "을경합",
  hanja: "乙庚合",
  tagline: "천간 5합 중 두 번째, 음목 을과 양금 경이 만나 금(金)으로 변하는 결합",
  meta: {
    title: "을경합(乙庚合) — 인의지합의 의미와 작용",
    description:
      "천간 5합의 두 번째 을경합의 의미, 변화 오행 금(金), 인의지합이라 불리는 이유와 사주 해석에서의 활용을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "음목",
    rightLabel: "양금",
    orderLabel: "천간 5합 · 2번",
    left: { char: "을", hanja: "乙", element: "목", yinYang: "음" },
    right: { char: "경", hanja: "庚", element: "금", yinYang: "양" },
  },
  highlight: [
    { label: "한자", value: "乙庚合 (을과 경의 결합)" },
    { label: "변화 오행", value: "금(金)" },
    { label: "별칭", value: "인의지합(仁義之合)" },
    { label: "분류", value: "천간 5합 · 음양 결합" },
  ],
  body: {
    intro:
      "을경합(乙庚合)은 천간 5합 중 두 번째 합입니다. 음목 을(乙)과 양금 경(庚)이 만나 결합하면서 그 기운이 금(金)으로 변화합니다. 별칭으로 '인의지합(仁義之合)' — 어짊(仁)과 의로움(義)의 결합 — 이라 불립니다.",
    sections: [
      {
        heading: "을경합의 의미",
        paragraphs: [
          "본래 금극목(金剋木) 관계로 경금이 을목을 극하지만, 음양이 다르기에 충돌 대신 합으로 묶입니다.",
          "목(을)은 어짊(仁)을, 금(경)은 의로움(義)을 상징합니다. 두 덕이 결합한다고 하여 '인의지합'이라 합니다.",
        ],
      },
      {
        heading: "을경합의 작용",
        paragraphs: [
          "두 글자가 사주에 나란히 들면 금(金)의 기운으로 변화합니다. 단단함·결단·과단성이 강해지는 작용으로 봅니다.",
          "을목 일간 입장에서는 본래 기운이 금으로 흐르며 약해질 수 있고, 경금 일간 입장에서는 기운이 한층 단단해지는 결과가 됩니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "합은 거리·끼는 글자·충(沖) 여부에 따라 성립이 달라집니다. 두 글자 사이가 멀거나 충이 끼면 합이 약해지거나 깨집니다.",
          "관계 궁합에서는 부드러우면서도 의리 있는 결합으로 평가됩니다. 다만 일주 한 가지로 단정할 수 없고, 사주 전체 균형을 봐야 정확합니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "을경합은 왜 인의지합이라 부르나요?",
      a: "을목은 어짊(仁), 경금은 의로움(義)을 상징해 두 덕이 만나는 합이라 하여 인의지합이라 부릅니다.",
    },
    {
      q: "을경합은 항상 금으로 변하나요?",
      a: "원칙은 금으로 변하지만, 사주의 다른 글자와 계절·간섭에 따라 변화가 약하거나 일어나지 않을 수도 있습니다.",
    },
  ],
  related: [
    { category: "cheongan", slug: "eul", label: "을(乙)", hint: "음목" },
    { category: "cheongan", slug: "gyeong", label: "경(庚)", hint: "양금" },
    { category: "ohaeng", slug: "geum", label: "금(金)", hint: "오행" },
    { category: "relation", slug: "gapgi-hap", label: "갑기합", hint: "천간 5합 1번" },
  ],
  updatedAt: "2026-04-28",
};
