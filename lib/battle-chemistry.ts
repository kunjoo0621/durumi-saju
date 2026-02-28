import type { DayStemRelation } from "./utils/battle-interaction";
import type { ChemistryLabel } from "@/types/battle";

type Balance = "팽팽" | "일방";

function getBalance(winsA: number, winsB: number): Balance {
  return Math.abs(winsA - winsB) <= 1 ? "팽팽" : "일방";
}

const LABEL_POOL: Record<string, Record<string, ChemistryLabel>> = {
  lover: {
    "합_팽팽": { emoji: "🔥", title: "밀당의 정석 커플", description: "끌리는데 쉽게 안 넘어가는 사이" },
    "합_일방": { emoji: "🐶", title: "주인과 강아지", description: "한쪽이 따라가는데 그게 또 편한 관계" },
    "충_팽팽": { emoji: "💣", title: "시한폭탄 커플", description: "터지기 직전이 제일 뜨거워" },
    "충_일방": { emoji: "🩹", title: "매일 싸우고 한쪽만 우는 관계", description: "갈등의 화살이 한쪽으로만 꽂혀" },
    "생_팽팽": { emoji: "⚡", title: "서로 충전해주는 배터리", description: "같이 있으면 에너지가 올라가" },
    "생_일방": { emoji: "🕯️", title: "촛불과 바람", description: "한쪽이 태우고, 한쪽이 바람막이" },
    "극_팽팽": { emoji: "🗡️", title: "칼 갈면서 성장하는 사이", description: "싸우면서 서로 단련돼" },
    "극_일방": { emoji: "🪨", title: "벽 앞의 계란", description: "한쪽이 일방적으로 눌려" },
    "비화_팽팽": { emoji: "🪞", title: "거울 보는 느낌", description: "닮아서 편한데, 닮아서 지루해" },
    "비화_일방": { emoji: "📏", title: "같은 듯 다른 온도차", description: "비슷해 보이는데 체감 격차가 커" },
  },
  friend: {
    "합_팽팽": { emoji: "🍻", title: "평생 술친구", description: "안 만나도 보면 바로 통하는 사이" },
    "합_일방": { emoji: "🧸", title: "인형 뽑기 같은 우정", description: "한쪽이 더 매달리는 구조" },
    "충_팽팽": { emoji: "🎯", title: "웃으면서 겨루는 라이벌", description: "겉은 친한데 속으로 경쟁" },
    "충_일방": { emoji: "🔋", title: "에너지 뱀파이어", description: "만나면 한쪽만 지쳐" },
    "생_팽팽": { emoji: "🌱", title: "같이 자라는 나무", description: "서로한테 좋은 영향" },
    "생_일방": { emoji: "📱", title: "읽씹 당하는 쪽이 정해진 사이", description: "한쪽이 더 연락하고 더 챙겨" },
    "극_팽팽": { emoji: "🧊", title: "팩폭 주고받는 관계", description: "서로 까는데 그게 애정 표현" },
    "극_일방": { emoji: "🎭", title: "한쪽만 맞춰주는 우정", description: "참다 터지면 끝나는 구조" },
    "비화_팽팽": { emoji: "🔄", title: "데칼코마니", description: "취향도 행동도 비슷해서 편해" },
    "비화_일방": { emoji: "📐", title: "같은 반 다른 등수", description: "비슷한데 미묘한 서열이 있어" },
  },
  colleague: {
    "합_팽팽": { emoji: "⚙️", title: "맞물리는 톱니바퀴", description: "같이 일하면 효율 최고" },
    "합_일방": { emoji: "📋", title: "사수와 부사수", description: "한쪽이 이끌고 한쪽이 따라가" },
    "충_팽팽": { emoji: "🏁", title: "매일이 경쟁 PT", description: "서로 의식하면서 성과 올려" },
    "충_일방": { emoji: "💼", title: "한쪽이 뒤치다꺼리", description: "성과는 한쪽이, 잡일은 한쪽이" },
    "생_팽팽": { emoji: "🚀", title: "같이 있으면 승진 빨라지는 조합", description: "시너지가 진짜 나는 팀" },
    "생_일방": { emoji: "🪜", title: "사다리 놓아주는 관계", description: "한쪽이 다른 쪽 커리어를 밀어줘" },
    "극_팽팽": { emoji: "🔨", title: "부딪히면서 결과 내는 팀", description: "회의는 싸움인데 성과는 나와" },
    "극_일방": { emoji: "📉", title: "같은 팀 배정되면 안 되는 조합", description: "한쪽 퍼포먼스가 깎여" },
    "비화_팽팽": { emoji: "🤝", title: "무난한 동기 사이", description: "갈등은 없는데 불꽃도 없어" },
    "비화_일방": { emoji: "📊", title: "같은 일 다른 평가", description: "비슷하게 하는데 결과가 다르게 나와" },
  },
  family: {
    "합_팽팽": { emoji: "🏡", title: "베스트 동거인", description: "같이 살아도 스트레스 적어" },
    "합_일방": { emoji: "🧹", title: "한쪽이 다 챙기는 집", description: "살림은 한쪽이, 감사는 없어" },
    "충_팽팽": { emoji: "🌋", title: "명절마다 터지는 화산", description: "정은 있는데 만나면 싸워" },
    "충_일방": { emoji: "📢", title: "잔소리 일방통행", description: "한쪽이 계속 쏘고 한쪽이 받아" },
    "생_팽팽": { emoji: "🌳", title: "뿌리 깊은 관계", description: "서로 든든한 버팀목" },
    "생_일방": { emoji: "☂️", title: "우산 써주는 쪽이 정해진 사이", description: "항상 한쪽이 보호자 역할" },
    "극_팽팽": { emoji: "🪓", title: "사랑의 매 주고받는 관계", description: "까고 까여도 정은 남아" },
    "극_일방": { emoji: "🏔️", title: "넘기 힘든 벽 같은 존재", description: "한쪽이 다른 쪽을 부담스러워해" },
    "비화_팽팽": { emoji: "🧬", title: "DNA가 느껴지는 사이", description: "닮은 점이 너무 많아" },
    "비화_일방": { emoji: "⚖️", title: "비교 당하는 쪽이 정해진 관계", description: "쟤는 잘하는데 넌 왜" },
  },
  other: {
    "합_팽팽": { emoji: "🔗", title: "묘하게 연결된 사이", description: "이유 없이 자꾸 마주치는 인연" },
    "합_일방": { emoji: "🧲", title: "한쪽만 끌리는 자석", description: "관심의 방향이 일방적" },
    "충_팽팽": { emoji: "⚡", title: "만나면 스파크 튀는 관계", description: "짧지만 강렬한 인연" },
    "충_일방": { emoji: "🚪", title: "문 닫힌 관계", description: "한쪽이 벽을 세워버린 사이" },
    "생_팽팽": { emoji: "🌊", title: "흐르는 대로 좋은 사이", description: "애쓰지 않아도 자연스러운 관계" },
    "생_일방": { emoji: "🌤️", title: "한쪽만 햇살인 관계", description: "한쪽이 주고 한쪽이 받는 구조" },
    "극_팽팽": { emoji: "🔩", title: "불편한데 필요한 사이", description: "안 맞지만 엮여야 하는 관계" },
    "극_일방": { emoji: "🪤", title: "빠지면 손해 보는 관계", description: "한쪽이 이용당하기 쉬운 구조" },
    "비화_팽팽": { emoji: "🫥", title: "있어도 없어도 모를 사이", description: "관심도 갈등도 없는 관계" },
    "비화_일방": { emoji: "👻", title: "한쪽만 기억하는 관계", description: "한쪽은 기억하고 한쪽은 잊어버린 사이" },
  },
};

export function selectChemistryLabel(
  dayStemRelationType: DayStemRelation,
  winsA: number,
  winsB: number,
  relationshipType: string,
): ChemistryLabel {
  const balance = getBalance(winsA, winsB);
  const groupKey = `${dayStemRelationType}_${balance}`;
  const relType = LABEL_POOL[relationshipType] ? relationshipType : "other";
  const label = LABEL_POOL[relType][groupKey];

  if (!label) {
    return LABEL_POOL.other["비화_팽팽"];
  }
  return label;
}
