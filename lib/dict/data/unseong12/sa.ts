import type { DictEntry } from "../../types";

export const saUnseong: DictEntry = {
  category: "unseong12",
  slug: "sa",
  name: "사",
  hanja: "死",
  tagline: "12운성 여덟 번째, 활동의 끝에서 응축으로 가는 자리",
  meta: {
    title: "사(死) — 12운성 여덟 번째, 활동의 끝",
    description:
      "12운성 사의 의미와 작용, 약한 기운으로 분류되는 이유, 사주 해석을 정리합니다.",
  },
  hero: {
    variant: "concept",
    accentColor: "#6B7280",
    orderLabel: "12운성 · 8단계",
  },
  highlight: [
    { label: "한자", value: "死 (죽음)" },
    { label: "단계", value: "12운성 8단계" },
    { label: "기운", value: "약(弱)" },
    { label: "비유", value: "활동의 종결 · 침잠" },
  ],
  body: {
    intro:
      "사(死)는 12운성의 여덟 번째 단계입니다. 활동의 표면이 멈추고 다시 응축으로 가기 직전의 자리에 비유됩니다. 12지지 '사(巳)'와는 한자가 다른 별개의 개념입니다.",
    sections: [
      {
        heading: "사의 의미",
        paragraphs: [
          "사는 외향적 활동이 멈추는 자리입니다. 가시적 결과보다 보이지 않는 내면의 정리가 일어나는 시기로 보입니다.",
          "12운성 강약 분류에서 사는 '약함' 그룹의 깊은 자리입니다. 다만 단순한 끝이 아니라 다음 묘(墓)·절(絶)을 거쳐 다시 잉태로 이어지는 순환 속의 한 단계입니다.",
        ],
      },
      {
        heading: "사주에 사가 들면",
        paragraphs: [
          "일주에 사가 들면 외향적 추진력은 약하지만 사색·연구·정신 활동에서 강점이 나올 수 있습니다.",
          "월주에 사가 들면 사회 활동의 표면적 성과는 늦게 드러나고, 시주에 들면 노년에 종교·철학·내면 정리에 끌리는 흐름이 됩니다.",
        ],
      },
    ],
  },
  faq: [
    {
      q: "사가 일주에 있으면 단명한다는 뜻인가요?",
      a: "절대 아닙니다. 12운성의 '사'는 인생 단계의 추상적 자리이지 실제 수명과 직접 관련이 없습니다. 옛 자료의 단편을 그대로 받아들이면 곤란합니다.",
    },
    {
      q: "12운성 사와 12지지 사(巳)는 같은가요?",
      a: "다릅니다. 12운성 사(死)는 단계 이름이고, 12지지 사(巳)는 뱀띠에 해당하는 음화 지지 글자입니다. 한자도 의미도 다릅니다.",
    },
  ],
  related: [
    { category: "unseong12", slug: "byeong", label: "병", hint: "12운성" },
    { category: "unseong12", slug: "myo", label: "묘", hint: "12운성" },
    { category: "jiji", slug: "sa", label: "사(巳)", hint: "지지" },
  ],
  updatedAt: "2026-04-28",
};
