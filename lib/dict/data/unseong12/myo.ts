import type { DictEntry } from "../../types";

export const myoUnseong: DictEntry = {
  category: "unseong12",
  slug: "myo",
  name: "묘",
  hanja: "墓",
  tagline: "12운성 아홉 번째, 응축과 보관의 자리",
  meta: {
    title: "묘(墓) — 12운성 아홉 번째, 응축과 보관의 자리",
    description:
      "12운성 묘의 의미와 작용, 약한 기운이지만 보관·응축의 자리로 평가되는 이유를 정리합니다.",
  },
  hero: {
    variant: "concept",
    accentColor: "#6B7280",
    orderLabel: "12운성 · 9단계",
  },
  highlight: [
    { label: "한자", value: "墓 (무덤)" },
    { label: "단계", value: "12운성 9단계" },
    { label: "기운", value: "약(弱) — 응축" },
    { label: "비유", value: "창고 · 보관 · 무덤" },
  ],
  body: {
    intro:
      "묘(墓)는 12운성의 아홉 번째 단계입니다. 활동을 마치고 응축되어 보관되는 자리, 무덤이자 창고에 비유됩니다. 12지지 '묘(卯)'와는 한자가 다른 별개의 개념입니다.",
    sections: [
      {
        heading: "묘의 의미",
        paragraphs: [
          "묘는 모든 결과물이 응축되어 저장되는 자리입니다. 활동의 표면은 끝났지만 그동안 쌓인 것이 보관되는 곳입니다.",
          "12운성 강약 분류에서 묘는 '약함'에 들지만, 응축의 자리이기에 단순한 약함과는 다릅니다. 자료에 따라 '고지(庫地)' — 창고의 자리 — 로도 불립니다.",
        ],
      },
      {
        heading: "사주에 묘가 들면",
        paragraphs: [
          "일주에 묘가 들면 안으로 응축하는 자질, 깊이 있는 사색과 보관·정리에 강한 기질이 부여됩니다.",
          "월주에 묘가 들면 사회 활동에서 누적·축적이 강점이 되고, 시주에 들면 노년에 자산이나 지식이 잘 정리되는 흐름이 됩니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "묘가 일주에 있으면 어떤 의미인가요?",
      a: "응축과 보관의 자질을 갖춘 자기를 의미합니다. 외향적 활동보다 정리·연구·축적에 강합니다.",
    },
    {
      q: "12운성 묘와 12지지 묘(卯)는 같은가요?",
      a: "다릅니다. 12운성 묘(墓)는 단계 이름이고, 12지지 묘(卯)는 토끼띠에 해당하는 음목 지지 글자입니다.",
    },
  ],
  related: [
    { category: "unseong12", slug: "sa", label: "사", hint: "12운성" },
    { category: "unseong12", slug: "jeol", label: "절", hint: "12운성" },
    { category: "jiji", slug: "myo", label: "묘(卯)", hint: "지지" },
  ],
  updatedAt: "2026-04-28",
};
