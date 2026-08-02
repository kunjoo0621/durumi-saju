// ⑥ FAQ — 네이티브 <details>/<summary> (JS 0). 목업 7문항 그대로. "무료" 오주장 없음(검수 통과).
// 타로 홈이 같은 마크업에 다른 문답을 쓰므로 items를 받는다. 미지정이면 사주 홈 기본값.
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import Reveal from "./Reveal";

export interface HubFaqItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: HubFaqItem[] = [
  {
    q: "돈 내기 전에 볼 수 있는 건 없나요?",
    a: "매거진과 사주 사전은 로그인 없이 전부 읽을 수 있어요. 분석 서비스는 알(코인)로 이용해요.",
  },
  {
    q: "출생 시간을 모르면 어떻게 돼?",
    a: "시주를 빼고 일주·월주·년주로 분석해요. 핵심 결과는 나오지만 정확도는 떨어질 수 있어요.",
  },
  {
    q: "결과에서 뭘 볼 수 있어?",
    a: "종합 등급과 재물·연애·직장·건강·대인 5가지 운의 점수, 그리고 왜 그렇게 나왔는지 근거까지 담겨요. 대운·세운 흐름과 터닝포인트도 한눈에 볼 수 있어요.",
  },
  {
    q: "배틀·반려동물 궁합은 뭐가 달라?",
    a: "배틀은 두 사람의 사주를 5가지 항목으로 비교해 궁합과 관계를 풀어줘요. 반려동물 궁합은 내 사주와 우리 아이의 생일로 둘의 합을 봐요.",
  },
  {
    q: "알(코인)은 어떻게 충전해?",
    a: "카카오로 로그인한 뒤 알을 충전하면 바로 이용할 수 있어요. 사주 10알, 배틀 20알처럼 서비스마다 필요한 알이 달라요.",
  },
  {
    q: "분석은 AI가 하는 거야? 정확해?",
    a: "만세력은 정확히 계산하고, 풀이는 명리 원리를 담아 AI가 읽기 쉽게 정리해요. 절대적인 예언이 아니라 나를 이해하는 재미로 봐주세요.",
  },
  {
    q: "결과를 저장하거나 공유할 수 있어?",
    a: "카카오 로그인을 하면 결과가 자동 저장돼요. 공유 링크를 보내면 상대는 로그인 없이도 결과를 볼 수 있어요.",
  },
];

export default function HubFaq({ items = FAQ_ITEMS }: { items?: HubFaqItem[] }) {
  return (
    <Reveal className="px-5 pt-10">
      <h2 className="mb-4 text-center font-aggro text-[22px]">자주 묻는 질문</h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <details
            key={item.q}
            open={i === 0}
            className="group overflow-hidden rounded-2xl bg-white/[0.04]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-[15px] font-semibold">
              <span>{item.q}</span>
              <CaretDown
                size={18}
                className="shrink-0 text-text-tertiary transition group-open:rotate-180"
              />
            </summary>
            <p className="break-keep px-5 pb-5 text-[14px] leading-relaxed text-text-secondary">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </Reveal>
  );
}
