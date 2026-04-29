import type { DictEntry } from "../../types";

export const sikshin: DictEntry = {
  category: "sipsung",
  slug: "sikshin",
  name: "식신",
  hanja: "食神",
  tagline: "표현과 식복의 별, 일간이 자연스럽게 흘려보내는 자질",
  meta: {
    title: "식신(食神) — 표현과 식복의 별, 사주 십성 풀이",
    description:
      "사주 십성 식신의 정의, 어떤 작용을 하는지, 식신이 강한 사주의 특징과 상관과의 차이를 정리합니다.",
  },
  hero: {
    variant: "concept",
    accentColor: "#22C55E",
    orderLabel: "십성 · 식상(食傷)",
  },
  highlight: [
    { label: "한자", value: "食神 (먹을 신)" },
    { label: "분류", value: "식상(食傷) · 정(正)" },
    { label: "관계", value: "일간이 생함 · 음양 같음" },
    { label: "상징", value: "표현 · 활동 · 자녀(여자)" },
  ],
  body: {
    intro:
      "식신(食神)은 사주 십성 중 식상(食傷)에 속하는 별입니다. 일간이 생해주는 오행이면서 음양도 같을 때 식신이라 부릅니다. '먹는 신'이라는 직역처럼 식복·활동·표현의 기운입니다.",
    sections: [
      {
        heading: "식신이란",
        paragraphs: [
          "식신은 일간이 자연스럽게 흘려보내는 자기 표현의 자리입니다. 갑목 일간에게는 양화 병화나 사화가, 을목에게는 음화 정화·오화가 식신입니다.",
          "여자에게 식신은 자녀를 의미하기도 합니다. 한편 누구에게나 식신은 활동력·표현력·식복의 자질로 작용합니다.",
        ],
      },
      {
        heading: "식신이 강한 사주의 특징",
        paragraphs: [
          "식신이 잘 자리 잡으면 표현력·활동력·여유로운 성격이 두드러집니다. 잘 먹고 잘 노는 자질, 즐길 줄 아는 기운입니다.",
          "고전에서는 사길신(四吉神) 중 하나로 평가되며, 식신이 좋은 사주는 의식주 걱정이 없다고 봅니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "식신과 상관의 차이는?",
      a: "둘 다 식상이지만 식신은 음양 같음(부드러운 표현), 상관은 음양 다름(강하고 반항적인 표현)입니다.",
    },
    {
      q: "식신이 강한 사람의 직업 적성은?",
      a: "표현·서비스·식복이 자산이 되는 분야 — 요식업·예술·교육·연예·강의·작가 — 가 잘 맞습니다.",
    },
  ],
  related: [
    { category: "sipsung", slug: "sanggwan", label: "상관", hint: "식상" },
    { category: "sipsung", slug: "jeongjae", label: "정재", hint: "재성" },
  ],
  updatedAt: "2026-04-28",
};
