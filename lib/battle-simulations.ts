import type { EnrichedSajuData, KoreanElement } from "./utils/saju-enrichment";

interface SimulationTemplate {
  icon: string;
  question: string;
  triggers: TriggerCondition[];
}

type TriggerCondition =
  | { type: "십성존재"; star: string; who: "A" | "B" | "any" }
  | { type: "신살존재"; key: string; who: "A" | "B" | "any" }
  | { type: "오행과다"; element: KoreanElement; who: "A" | "B" | "any" }
  | { type: "오행결핍"; element: KoreanElement; who: "A" | "B" | "any" }
  | { type: "신강격차"; minDiff: number }
  | { type: "기본"; score: number };

const STRENGTH_ORDER = ["극약", "태약", "신약", "중화신약", "중화신강", "신강", "태강", "극왕"];

function evaluateTriggers(
  triggers: TriggerCondition[],
  enrichedA: EnrichedSajuData,
  enrichedB: EnrichedSajuData,
): number {
  let score = 0;
  for (const t of triggers) {
    switch (t.type) {
      case "십성존재": {
        const hasA = enrichedA.tenStars.some((s) => s.includes(t.star));
        const hasB = enrichedB.tenStars.some((s) => s.includes(t.star));
        if (t.who === "any" && (hasA || hasB)) score += 2;
        else if (t.who === "A" && hasA) score += 2;
        else if (t.who === "B" && hasB) score += 2;
        break;
      }
      case "신살존재": {
        const hasA = enrichedA.shinsal?.matches?.some((m) => m.key === t.key) ?? false;
        const hasB = enrichedB.shinsal?.matches?.some((m) => m.key === t.key) ?? false;
        if (t.who === "any" && (hasA || hasB)) score += 2;
        else if (t.who === "A" && hasA) score += 2;
        else if (t.who === "B" && hasB) score += 2;
        break;
      }
      case "오행과다": {
        const overA = (enrichedA.elementDist[t.element] ?? 0) >= 3;
        const overB = (enrichedB.elementDist[t.element] ?? 0) >= 3;
        if (t.who === "any" && (overA || overB)) score += 2;
        else if (t.who === "A" && overA) score += 2;
        else if (t.who === "B" && overB) score += 2;
        break;
      }
      case "오행결핍": {
        const defA = (enrichedA.elementDist[t.element] ?? 0) === 0;
        const defB = (enrichedB.elementDist[t.element] ?? 0) === 0;
        if (t.who === "any" && (defA || defB)) score += 2;
        else if (t.who === "A" && defA) score += 2;
        else if (t.who === "B" && defB) score += 2;
        break;
      }
      case "신강격차": {
        const idxA = STRENGTH_ORDER.indexOf(enrichedA.strength?.result ?? "");
        const idxB = STRENGTH_ORDER.indexOf(enrichedB.strength?.result ?? "");
        if (idxA >= 0 && idxB >= 0 && Math.abs(idxA - idxB) >= t.minDiff) score += 2;
        break;
      }
      case "기본":
        score += t.score;
        break;
    }
  }
  return score;
}

// ── 시뮬레이션 풀 ──

const LOVER_POOL: SimulationTemplate[] = [
  { icon: "🏠", question: "동거하면 집안일 전쟁 먼저 일으키는 쪽은?", triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "신강격차", minDiff: 2 }, { type: "기본", score: 1 }] },
  { icon: "💸", question: "공동 통장 만들면?", triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "십성존재", star: "정재", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "😤", question: "싸우면 누가 먼저 연락해?", triggers: [{ type: "십성존재", star: "비견", who: "any" }, { type: "신강격차", minDiff: 2 }, { type: "기본", score: 1 }] },
  { icon: "😑", question: "권태기 먼저 오는 쪽은?", triggers: [{ type: "신살존재", key: "dohwa", who: "any" }, { type: "신살존재", key: "hongryeom", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🎂", question: "기념일 까먹는 쪽은?", triggers: [{ type: "십성존재", star: "편인", who: "any" }, { type: "오행결핍", element: "화", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🍺", question: "술 마시면 본심 터뜨리는 쪽은?", triggers: [{ type: "오행과다", element: "수", who: "any" }, { type: "십성존재", star: "식신", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "👫", question: "상대 친구 모임에 끼면?", triggers: [{ type: "십성존재", star: "상관", who: "any" }, { type: "신살존재", key: "hwagae", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "💼", question: "한쪽이 야근 폭탄이면?", triggers: [{ type: "십성존재", star: "편관", who: "any" }, { type: "오행과다", element: "금", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "💍", question: "결혼 먼저 꺼내는 쪽은?", triggers: [{ type: "십성존재", star: "정관", who: "any" }, { type: "십성존재", star: "정재", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "💔", question: "이별 후 먼저 연락하는 쪽은?", triggers: [{ type: "오행과다", element: "수", who: "any" }, { type: "십성존재", star: "정인", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🧳", question: "여행 가면 주도권 잡는 쪽은?", triggers: [{ type: "신살존재", key: "yeokma", who: "any" }, { type: "신강격차", minDiff: 2 }, { type: "기본", score: 1 }] },
  { icon: "👨‍👩‍👧", question: "상대 가족 만나면 누가 더 긴장해?", triggers: [{ type: "십성존재", star: "정관", who: "any" }, { type: "오행결핍", element: "토", who: "any" }, { type: "기본", score: 1 }] },
];

const FRIEND_POOL: SimulationTemplate[] = [
  { icon: "✈️", question: "같이 여행 가면?", triggers: [{ type: "신살존재", key: "yeokma", who: "any" }, { type: "신강격차", minDiff: 2 }, { type: "기본", score: 1 }] },
  { icon: "💸", question: "돈 빌려달라면?", triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "십성존재", star: "편재", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🗣️", question: "뒤에서 먼저 험담하는 쪽은?", triggers: [{ type: "십성존재", star: "상관", who: "any" }, { type: "오행과다", element: "화", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "📱", question: "10년 뒤에도 연락할까?", triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "오행과다", element: "토", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🍺", question: "같이 술 마시면?", triggers: [{ type: "오행과다", element: "수", who: "any" }, { type: "십성존재", star: "식신", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🎉", question: "한쪽이 대박 나면?", triggers: [{ type: "십성존재", star: "편재", who: "any" }, { type: "십성존재", star: "겁재", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🤫", question: "비밀 공유하면 지켜줄까?", triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "신살존재", key: "hwagae", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "❤️", question: "같은 사람 좋아하면?", triggers: [{ type: "신살존재", key: "dohwa", who: "any" }, { type: "십성존재", star: "비견", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🏃", question: "같이 운동하면?", triggers: [{ type: "오행과다", element: "목", who: "any" }, { type: "신강격차", minDiff: 2 }, { type: "기본", score: 1 }] },
  { icon: "📞", question: "연락 안 하면 먼저 찾는 쪽은?", triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "오행과다", element: "수", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "😢", question: "고민 상담하면?", triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "십성존재", star: "식신", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "⚔️", question: "그룹에서 편 갈리면?", triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "십성존재", star: "편관", who: "any" }, { type: "기본", score: 1 }] },
];

const COLLEAGUE_POOL: SimulationTemplate[] = [
  { icon: "📊", question: "같은 팀이면 누가 일 더 해?", triggers: [{ type: "신강격차", minDiff: 2 }, { type: "십성존재", star: "편관", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "📈", question: "누가 먼저 승진해?", triggers: [{ type: "십성존재", star: "정관", who: "any" }, { type: "십성존재", star: "정인", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🚀", question: "같이 창업하면?", triggers: [{ type: "십성존재", star: "편재", who: "any" }, { type: "십성존재", star: "식신", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🗣️", question: "회의에서 의견 충돌하면?", triggers: [{ type: "십성존재", star: "상관", who: "any" }, { type: "십성존재", star: "비견", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🌙", question: "같이 야근하면?", triggers: [{ type: "오행과다", element: "금", who: "any" }, { type: "십성존재", star: "편관", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "📩", question: "한쪽이 이직 제안 받으면?", triggers: [{ type: "신살존재", key: "yeokma", who: "any" }, { type: "십성존재", star: "편재", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "😤", question: "상사한테 깨지면?", triggers: [{ type: "십성존재", star: "편관", who: "any" }, { type: "오행결핍", element: "토", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🏆", question: "성과 공 가르기하면?", triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "십성존재", star: "편재", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🍻", question: "회식에서 분위기는?", triggers: [{ type: "오행과다", element: "수", who: "any" }, { type: "십성존재", star: "식신", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "✂️", question: "구조조정이면?", triggers: [{ type: "십성존재", star: "편관", who: "any" }, { type: "오행결핍", element: "금", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🔀", question: "다른 부서로 갈리면?", triggers: [{ type: "신살존재", key: "yeokma", who: "any" }, { type: "십성존재", star: "정인", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "👔", question: "한쪽이 상사면?", triggers: [{ type: "십성존재", star: "정관", who: "any" }, { type: "신강격차", minDiff: 3 }, { type: "기본", score: 1 }] },
];

const FAMILY_POOL: SimulationTemplate[] = [
  { icon: "🎆", question: "명절에 누가 스트레스 더 받아?", triggers: [{ type: "십성존재", star: "편관", who: "any" }, { type: "오행과다", element: "토", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "💰", question: "용돈/생활비 문제 생기면?", triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "십성존재", star: "정재", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🗳️", question: "가족 회의하면?", triggers: [{ type: "십성존재", star: "비견", who: "any" }, { type: "십성존재", star: "상관", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "👑", question: "가족 중심 역할은 누구?", triggers: [{ type: "신강격차", minDiff: 2 }, { type: "십성존재", star: "정인", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "😇", question: "부모님 앞에서 착한 척하는 쪽은?", triggers: [{ type: "십성존재", star: "정관", who: "any" }, { type: "십성존재", star: "편인", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🏠", question: "같이 살면 먼저 나가고 싶은 쪽은?", triggers: [{ type: "신살존재", key: "yeokma", who: "any" }, { type: "십성존재", star: "상관", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "📋", question: "집안 대소사 결정권은?", triggers: [{ type: "신강격차", minDiff: 2 }, { type: "십성존재", star: "편관", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "💥", question: "한쪽이 큰 실패하면?", triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "오행결핍", element: "토", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "💎", question: "유산/재산 문제 생기면?", triggers: [{ type: "십성존재", star: "편재", who: "any" }, { type: "십성존재", star: "겁재", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🤗", question: "오랜만에 만나면?", triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "신살존재", key: "hwagae", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🏙️", question: "다른 도시에 살면?", triggers: [{ type: "신살존재", key: "yeokma", who: "any" }, { type: "오행결핍", element: "토", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🏡", question: "명절 누구 집에서?", triggers: [{ type: "신강격차", minDiff: 2 }, { type: "십성존재", star: "편관", who: "any" }, { type: "기본", score: 1 }] },
];

const OTHER_POOL: SimulationTemplate[] = [
  { icon: "🏘️", question: "같은 동네 살면?", triggers: [{ type: "오행과다", element: "토", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "📂", question: "공동 프로젝트 하면?", triggers: [{ type: "십성존재", star: "식신", who: "any" }, { type: "십성존재", star: "편재", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "⚔️", question: "이해관계 충돌하면?", triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "십성존재", star: "편관", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "⏳", question: "이 인연 오래 갈까?", triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "오행과다", element: "토", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🤝", question: "서로 도움 필요할 때?", triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "십성존재", star: "식신", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🎮", question: "같은 취미 하면?", triggers: [{ type: "십성존재", star: "식신", who: "any" }, { type: "십성존재", star: "비견", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "💘", question: "소개팅 시켜달라면?", triggers: [{ type: "신살존재", key: "dohwa", who: "any" }, { type: "십성존재", star: "정재", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "⭐", question: "한쪽이 유명해지면?", triggers: [{ type: "십성존재", star: "편재", who: "any" }, { type: "십성존재", star: "겁재", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "💬", question: "같은 커뮤니티에 있으면?", triggers: [{ type: "십성존재", star: "비견", who: "any" }, { type: "오행과다", element: "토", who: "any" }, { type: "기본", score: 1 }] },
  { icon: "🔁", question: "연락 끊겼다 다시 만나면?", triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "신살존재", key: "hwagae", who: "any" }, { type: "기본", score: 1 }] },
];

const SIMULATION_POOLS: Record<string, SimulationTemplate[]> = {
  lover: LOVER_POOL,
  friend: FRIEND_POOL,
  colleague: COLLEAGUE_POOL,
  family: FAMILY_POOL,
  other: OTHER_POOL,
};

export function selectSimulations(
  enrichedA: EnrichedSajuData,
  enrichedB: EnrichedSajuData,
  relationshipType: string,
  count: number = 5,
): { icon: string; question: string }[] {
  const relType = SIMULATION_POOLS[relationshipType] ? relationshipType : "other";
  const pool = SIMULATION_POOLS[relType];

  const scored = pool.map((sim, index) => ({
    ...sim,
    score: evaluateTriggers(sim.triggers, enrichedA, enrichedB),
    index,
  }));

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  return scored.slice(0, count).map((s) => ({
    icon: s.icon,
    question: s.question,
  }));
}
