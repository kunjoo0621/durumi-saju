import type { DictEntry } from "../../types";

export const jeongjae: DictEntry = {
  category: "sipsung",
  slug: "jeongjae",
  name: "정재",
  hanja: "正財",
  tagline: "안정된 재물의 별, 정직과 저축의 기운",
  meta: {
    title: "정재(正財) — 안정된 재물, 정직의 별",
    description:
      "사주 십성 정재의 정의, 편재와의 차이, 정재가 강한 사주의 특징을 정리합니다.",
  },
  hero: {
    variant: "concept",
    accentColor: "#EAB308",
    orderLabel: "십성 · 재성(財星)",
  },
  highlight: [
    { label: "한자", value: "正財 (바른 재물)" },
    { label: "분류", value: "재성(財星) · 정(正)" },
    { label: "관계", value: "일간이 극함 · 음양 다름" },
    { label: "상징", value: "월급 · 저축 · 아내(남자)" },
  ],
  body: {
    intro:
      "정재(正財)는 사주 십성 중 재성(財星)에 속하는 별입니다. 일간이 극하는 오행이면서 음양은 다를 때 정재라 부릅니다. 안정적이고 정직한 재물 — 월급·저축·정도의 재물 — 의 기운입니다.",
    sections: [
      {
        heading: "정재란",
        paragraphs: [
          "정재는 시간을 들여 차곡차곡 쌓이는 재물입니다. 갑목 일간에게는 음토 기토·축토·미토가 정재가 됩니다.",
          "남자에게 정재는 흔히 정실 부인을 의미합니다. 누구에게나 정재는 안정·저축·근면의 자질로 작용합니다.",
        ],
      },
      {
        heading: "정재가 강한 사주의 특징",
        paragraphs: [
          "정재가 잘 자리 잡으면 성실·근면·신뢰성이 두드러집니다. 안정적 직장과 꾸준한 저축으로 재물을 쌓는 자질입니다.",
          "고전에서는 사길신 중 하나로 분류되며, 정재가 좋은 사주는 풍족하고 안정된 흐름을 갖는다고 봅니다.",
          "다만 정재가 너무 강하면 변화 적응이 늦거나 보수적인 성향이 부담이 될 수 있습니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "정재가 강한 사람의 직업 적성은?",
      a: "안정과 신뢰가 자산이 되는 분야 — 회계·금융·공무원·관리직·전문직·연구직 — 이 잘 맞습니다.",
    },
    {
      q: "정재와 편재 모두 사주에 있으면?",
      a: "둘 다 재성이라 재물 운이 풍부한 사주가 될 수 있지만, 너무 많으면 일간이 약해져 부담이 됩니다. 비겁(비견·겁재)의 도움이 필요합니다.",
    },
  ],
  related: [
    { category: "sipsung", slug: "pyeonjae", label: "편재", hint: "재성" },
    { category: "sipsung", slug: "jeonggwan", label: "정관", hint: "관성" },
  ],
  updatedAt: "2026-04-28",
};
