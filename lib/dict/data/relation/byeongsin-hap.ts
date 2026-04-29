import type { DictEntry } from "../../types";

export const byeongsinHap: DictEntry = {
  category: "relation",
  slug: "byeongsin-hap",
  name: "병신합",
  hanja: "丙辛合",
  tagline: "천간 5합 중 세 번째, 양화 병과 음금 신이 만나 수(水)로 변하는 결합",
  meta: {
    title: "병신합(丙辛合) — 위엄지합의 의미와 작용",
    description:
      "천간 5합의 세 번째 병신합의 의미, 변화 오행 수(水), 위엄지합이라 불리는 배경과 사주에서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "양화",
    rightLabel: "음금",
    orderLabel: "천간 5합 · 3번",
    left: { char: "병", hanja: "丙", element: "화", yinYang: "양" },
    right: { char: "신", hanja: "辛", element: "금", yinYang: "음" },
  },
  highlight: [
    { label: "한자", value: "丙辛合 (병과 신의 결합)" },
    { label: "변화 오행", value: "수(水)" },
    { label: "별칭", value: "위엄지합(威嚴之合)" },
    { label: "분류", value: "천간 5합 · 음양 결합" },
  ],
  body: {
    intro:
      "병신합(丙辛合)은 천간 5합 중 세 번째 합입니다. 양화 병(丙)과 음금 신(辛)이 만나 결합하면서 기운이 수(水)로 변합니다. 별칭으로 '위엄지합(威嚴之合)'이라 불리며, 권위·위엄의 합으로 평가됩니다.",
    sections: [
      {
        heading: "병신합의 의미",
        paragraphs: [
          "본래 화극금(火剋金) 관계로 병화가 신금을 극하지만, 음양이 다르므로 합으로 묶입니다.",
          "화는 빛과 권위, 금은 결단과 의지를 상징합니다. 그 결합이 위엄을 자아낸다 하여 '위엄지합'이라 합니다.",
        ],
      },
      {
        heading: "병신합의 작용",
        paragraphs: [
          "병신합이 사주에 들면 두 글자의 본래 작용이 약해지고 수(水)의 기운으로 흘러갑니다. 화가 금을 극해 만들어진 변화가 수로 응축되는 그림으로 이해합니다.",
          "위엄과 권위를 가진 듯 보이지만, 학파에 따라 두려움·냉정·은밀함의 뉘앙스로도 해석합니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "병화 일간이 신금을 만나면 자기 빛이 수로 흘러가 약해질 수 있고, 신금 일간 입장에서는 기운이 강한 화기를 흡수해 새로운 결과를 만들어냅니다.",
          "관계에서는 권위와 카리스마가 어우러지는 조합으로 보지만, 사주 전체 균형 — 신강·신약, 용신 — 을 함께 봐야 정확합니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "병신합은 왜 위엄지합인가요?",
      a: "병화의 빛(권위)과 신금의 결단이 합쳐져 위엄 있는 분위기를 만든다고 하여 위엄지합이라 부릅니다.",
    },
    {
      q: "변화 오행이 왜 수(水)인가요?",
      a: "명리 통설로 병신은 결합 시 수로 화한다고 봅니다. 화-금의 충돌이 수로 응축된다는 비유적 해석입니다.",
    },
  ],
  related: [
    { category: "cheongan", slug: "byeong", label: "병(丙)", hint: "양화" },
    { category: "cheongan", slug: "sin", label: "신(辛)", hint: "음금" },
    { category: "ohaeng", slug: "su", label: "수(水)", hint: "오행" },
    { category: "relation", slug: "gapgi-hap", label: "갑기합", hint: "천간 5합 1번" },
  ],
  updatedAt: "2026-04-28",
};
