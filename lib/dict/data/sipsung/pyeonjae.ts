import type { DictEntry } from "../../types";

export const pyeonjae: DictEntry = {
  category: "sipsung",
  slug: "pyeonjae",
  name: "편재",
  hanja: "偏財",
  tagline: "유통되는 재물의 별, 활동력과 사업의 기운",
  meta: {
    title: "편재(偏財) — 유통되는 재물, 활동의 별",
    description:
      "사주 십성 편재의 정의, 정재와의 차이, 편재가 강한 사주의 특징을 정리합니다.",
  },
  hero: {
    variant: "concept",
    accentColor: "#EAB308",
    orderLabel: "십성 · 재성(財星)",
  },
  highlight: [
    { label: "한자", value: "偏財 (한쪽으로 치우친 재물)" },
    { label: "분류", value: "재성(財星) · 편(偏)" },
    { label: "관계", value: "일간이 극함 · 음양 같음" },
    { label: "상징", value: "사업 자금 · 활동 · 부친(남자)" },
  ],
  body: {
    intro:
      "편재(偏財)는 사주 십성 중 재성(財星)에 속하는 별입니다. 일간이 극하는 오행이면서 음양도 같을 때 편재라 부릅니다. 한곳에 묶이지 않고 유통되는 재물·활동의 기운입니다.",
    sections: [
      {
        heading: "편재란",
        paragraphs: [
          "편재는 큰 자금·활동성 있는 재물·사업의 자리입니다. 갑목 일간에게는 양토 무토·진토·술토가 편재가 됩니다.",
          "남자에게 편재는 부친이나 새로운 인연(애인)으로 보기도 합니다. 또한 누구에게나 활동적이고 큰 그림의 재물 운을 의미합니다.",
        ],
      },
      {
        heading: "편재가 강한 사주의 특징",
        paragraphs: [
          "편재가 잘 자리 잡으면 사업 수완·활동력·돈을 보는 눈이 두드러집니다. 큰 자금을 다루거나 다양한 활동을 통해 재물을 만들어내는 자질이 강합니다.",
          "다만 활동 폭이 너무 넓으면 안정이 떨어지거나 정착하기 어려운 흐름이 될 수 있습니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "편재와 정재의 차이는?",
      a: "둘 다 재성이지만 편재는 활동·사업·유통의 재물, 정재는 안정·저축·정직한 재물입니다. 자질의 결이 다릅니다.",
    },
    {
      q: "편재가 강한 사람의 직업 적성은?",
      a: "활동력과 사업 감각이 자산이 되는 분야 — 영업·자기 사업·무역·트레이딩·부동산 — 가 잘 맞습니다.",
    },
  ],
  related: [
    { category: "sipsung", slug: "jeongjae", label: "정재", hint: "재성" },
    { category: "sipsung", slug: "sikshin", label: "식신", hint: "식상" },
  ],
  updatedAt: "2026-04-28",
};
