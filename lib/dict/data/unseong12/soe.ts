import type { DictEntry } from "../../types";

export const soe: DictEntry = {
  category: "unseong12",
  slug: "soe",
  name: "쇠",
  hanja: "衰",
  tagline: "12운성 여섯 번째, 정점에서 내려오는 쇠퇴 시작",
  meta: {
    title: "쇠(衰) — 12운성 여섯 번째, 쇠퇴 시작의 자리",
    description:
      "12운성 쇠의 의미와 작용, 사주에서 어떻게 해석하는지를 정리합니다.",
  },
  hero: {
    variant: "concept",
    accentColor: "#6B7280",
    orderLabel: "12운성 · 6단계",
  },
  highlight: [
    { label: "한자", value: "衰 (쇠퇴)" },
    { label: "단계", value: "12운성 6단계" },
    { label: "기운", value: "약(弱) — 쇠퇴 시작" },
    { label: "비유", value: "은퇴 직전 · 정점 후" },
  ],
  body: {
    intro:
      "쇠(衰)는 12운성의 여섯 번째 단계입니다. 정점인 제왕에서 한 걸음 내려와 기운이 점점 쇠퇴하기 시작하는 자리, 은퇴를 준비하는 시기에 비유됩니다.",
    sections: [
      {
        heading: "쇠의 의미",
        paragraphs: [
          "쇠는 정점을 지나 기운이 가라앉기 시작하는 자리입니다. 절정의 활기는 줄어들지만, 경험과 성숙이 쌓여 차분한 흐름이 됩니다.",
          "12운성 강약 분류에서 쇠는 '약함' 그룹의 시작입니다. 다만 직후의 병·사·묘만큼 약하진 않고, 노련한 기운으로 보는 시각이 우세합니다.",
        ],
      },
      {
        heading: "사주에 쇠가 들면",
        paragraphs: [
          "일주에 쇠가 들면 차분하고 노련한 기질, 성급하지 않은 판단력이 부여됩니다. 큰 야망보다 안정과 깊이를 추구합니다.",
          "월주에 쇠가 들면 사회 활동에서 점진적이고 신중한 행보를, 시주에 들면 노년이 차분하고 침착한 흐름이 됩니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "쇠가 일주에 들면 안 좋은가요?",
      a: "고전에서는 쇠퇴의 자리로 봤지만, 현대에서는 노련함·신중함의 자질로도 해석됩니다. 사주 균형에 따라 강점이 됩니다.",
    },
    {
      q: "제왕과 쇠의 차이는?",
      a: "제왕이 정점의 화려함이라면 쇠는 정점을 지난 차분함입니다. 같은 강함이라도 표현 방식이 다릅니다.",
    },
  ],
  related: [
    { category: "unseong12", slug: "jewang", label: "제왕", hint: "12운성" },
    { category: "unseong12", slug: "byeong", label: "병", hint: "12운성" },
  ],
  updatedAt: "2026-04-28",
};
