import type { DictEntry } from "../../types";

export const yang: DictEntry = {
  category: "unseong12",
  slug: "yang",
  name: "양",
  hanja: "養",
  tagline: "12운성 마지막, 자궁에서 자라는 다음 장생 직전의 자리",
  meta: {
    title: "양(養) — 12운성 마지막, 자라남의 자리",
    description:
      "12운성 양의 의미와 작용, 자궁에서 형태를 갖춰가는 자리로 평가되는 이유를 정리합니다.",
  },
  hero: {
    variant: "concept",
    accentColor: "#EAB308",
    orderLabel: "12운성 · 12단계 (마지막)",
  },
  highlight: [
    { label: "한자", value: "養 (자라남)" },
    { label: "단계", value: "12운성 12단계" },
    { label: "기운", value: "보통 — 자라남" },
    { label: "비유", value: "자궁 안 성장 · 곧 태어남" },
  ],
  body: {
    intro:
      "양(養)은 12운성의 열두 번째이자 마지막 단계입니다. 잉태(태)된 생명이 자궁에서 자라며 형태를 갖춰가는 자리, 곧 태어남(장생)을 앞둔 시기입니다.",
    sections: [
      {
        heading: "양의 의미",
        paragraphs: [
          "양은 잉태된 가능성이 형태를 갖춰가는 자리입니다. 보이지 않는 곳에서 자라는 시간, 곧 다가올 새 시작을 준비하는 시점입니다.",
          "양 다음은 다시 장생으로 순환합니다. 이로써 12운성의 한 사이클이 마무리되고 새 사이클이 시작됩니다.",
        ],
      },
      {
        heading: "사주에 양이 들면",
        paragraphs: [
          "일주에 양이 들면 부드러운 성장형 기질, 보살핌을 받으며 자라는 자질이 부여됩니다. 가족·관계 안에서 안정적으로 흐릅니다.",
          "월주에 양이 들면 사회 활동에서 점진적 성장이 두드러지고, 시주에 들면 노년에 자식이 곁에서 자라는 흐름이 됩니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "양이 일주에 있으면 어떤 의미인가요?",
      a: "보살핌과 성장의 자리이기에 가족 인연이 깊고, 본인의 성장도 천천히 이루어지는 기질입니다.",
    },
    {
      q: "양과 장생의 차이는?",
      a: "양은 자궁 안에서 자라는 시점, 장생은 막 태어난 시점입니다. 양은 조용한 성장, 장생은 시작의 활발한 기운입니다.",
    },
  ],
  related: [
    { category: "unseong12", slug: "tae", label: "태", hint: "12운성" },
    { category: "unseong12", slug: "jangsaeng", label: "장생", hint: "12운성" },
  ],
  updatedAt: "2026-04-28",
};
