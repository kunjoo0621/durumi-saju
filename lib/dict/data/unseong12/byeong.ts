import type { DictEntry } from "../../types";

export const byeongUnseong: DictEntry = {
  category: "unseong12",
  slug: "byeong",
  name: "병",
  hanja: "病",
  tagline: "12운성 일곱 번째, 병이 들기 시작하는 자리",
  meta: {
    title: "병(病) — 12운성 일곱 번째, 병이 드는 자리",
    description:
      "12운성 병의 의미와 작용, 약한 기운으로 분류되는 이유, 사주 해석을 정리합니다.",
  },
  hero: {
    variant: "concept",
    accentColor: "#6B7280",
    orderLabel: "12운성 · 7단계",
  },
  highlight: [
    { label: "한자", value: "病 (병듦)" },
    { label: "단계", value: "12운성 7단계" },
    { label: "기운", value: "약(弱)" },
    { label: "비유", value: "병상 · 회복기" },
  ],
  body: {
    intro:
      "병(病)은 12운성의 일곱 번째 단계입니다. 활동력이 줄어들어 병상에 누운 자리, 또는 회복을 준비하는 시기에 비유됩니다. 12운성 천간 '병화(丙火)'와는 한자가 다른 별개의 개념입니다.",
    sections: [
      {
        heading: "병의 의미",
        paragraphs: [
          "병은 활동의 표면이 가라앉고 내면으로 침잠하는 자리입니다. 외향성은 줄어들지만 내면적 깊이가 형성되는 시기로 보기도 합니다.",
          "12운성 강약 분류에서 병은 '약함' 그룹입니다. 다만 단순한 약함이 아니라, 회복과 성찰의 자리로 해석되기도 합니다.",
        ],
      },
      {
        heading: "사주에 병이 들면",
        paragraphs: [
          "일주에 병이 들면 외향적 활동력은 약하지만 섬세함과 통찰이 강한 기질이 됩니다. 예술·연구·정밀 작업에 잘 맞을 수 있습니다.",
          "월주에 병이 들면 사회 활동에서 부침이 잦거나 신중한 행보가 따르고, 시주에 들면 노년에 건강 관리가 중요한 흐름이 됩니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "병이 일주에 있으면 건강이 안 좋다는 뜻인가요?",
      a: "직접적 의미는 아닙니다. 12운성의 '병'은 인생 단계에 비유한 추상적 자리이지 실제 건강을 결정짓진 않습니다. 다만 정점 이후의 신중함을 의미합니다.",
    },
    {
      q: "12운성 병과 천간 병화는 같은가요?",
      a: "다릅니다. 12운성 병(病)은 단계 이름이고, 천간 병(丙)은 양화 천간 글자입니다. 한자도 다르며 의미도 별개입니다.",
    },
  ],
  related: [
    { category: "unseong12", slug: "soe", label: "쇠", hint: "12운성" },
    { category: "unseong12", slug: "sa", label: "사", hint: "12운성" },
    { category: "cheongan", slug: "byeong", label: "병화(丙)", hint: "천간" },
  ],
  updatedAt: "2026-04-28",
};
