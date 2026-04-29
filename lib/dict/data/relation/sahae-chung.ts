import type { DictEntry } from "../../types";

export const sahaeChung: DictEntry = {
  category: "relation",
  slug: "sahae-chung",
  name: "사해충",
  hanja: "巳亥沖",
  tagline: "지지 6충의 여섯 번째, 여름의 시작 사화와 겨울의 시작 해수가 부딪히는 역마충",
  meta: {
    title: "사해충(巳亥沖) — 사화와 해수의 충",
    description:
      "지지 6충의 여섯 번째 사해충의 의미, 음화 사와 음수 해의 충, 역마충으로서의 해석을 정리합니다.",
  },
  hero: {
    variant: "combination",
    leftLabel: "음화",
    rightLabel: "음수",
    orderLabel: "지지 6충 · 6번",
    left: { char: "사", hanja: "巳", element: "화", yinYang: "음" },
    right: { char: "해", hanja: "亥", element: "수", yinYang: "음" },
  },
  highlight: [
    { label: "한자", value: "巳亥沖 (사와 해의 충)" },
    { label: "특징", value: "역마축선의 충 — 이동·변동" },
    { label: "분류", value: "지지 6충 · 역마충" },
    { label: "성격", value: "음화 vs 음수, 수극화" },
  ],
  body: {
    intro:
      "사해충(巳亥沖)은 지지 6충 중 마지막 여섯 번째 충입니다. 여름의 시작 음화 사(巳)와 겨울의 시작 음수 해(亥)가 부딪히며, 둘 다 역마(驛馬)에 해당해 '역마충'이라 불립니다.",
    sections: [
      {
        heading: "사해충의 의미",
        paragraphs: [
          "사는 여름의 시작, 해는 겨울의 시작으로 계절이 정반대입니다. 수극화(水剋火) 관계에서 음수가 음화를 칩니다.",
          "사해는 모두 역마의 지지(인신사해)라, 두 글자가 충하면 이동·여행·변동·먼 곳의 인연이 강하게 작동합니다.",
        ],
      },
      {
        heading: "사해충의 작용",
        paragraphs: [
          "사주에 사해가 들면 거주지 이동·해외 출입·장거리 이동의 흐름이 두드러집니다.",
          "음 vs 음의 충이라 표면 충돌보다 내부 정서·생각의 변동이 더 강한 편입니다.",
        ],
      },
      {
        heading: "사주에서의 해석",
        paragraphs: [
          "역마충은 활동성이 좋은 사주에서는 기회·성장의 동력이 됩니다. 사해는 출장·해외 인연·먼 곳의 활동으로 자주 해석됩니다.",
          "사주 전체에 인(寅)이나 신(申)이 함께 있으면 형(刑)·합(合)이 동시에 작동해 더 복잡해집니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "사해충은 왜 역마충인가요?",
      a: "사와 해 모두 역마살의 지지(인신사해)에 해당해, 두 글자의 충은 이동·먼 곳의 활동으로 해석됩니다.",
    },
    {
      q: "사해충은 인신충과 어떻게 다른가요?",
      a: "둘 다 역마충이지만 인신은 양 vs 양으로 외적 변동이 강하고, 사해는 음 vs 음으로 내적 동요가 강한 편입니다.",
    },
  ],
  related: [
    { category: "jiji", slug: "sa", label: "사(巳)", hint: "음화" },
    { category: "jiji", slug: "hae", label: "해(亥)", hint: "음수" },
    { category: "relation", slug: "insin-chung", label: "인신충", hint: "또 다른 역마충" },
    { category: "relation", slug: "jao-chung", label: "자오충", hint: "지지 6충 1번" },
  ],
  updatedAt: "2026-04-28",
};
