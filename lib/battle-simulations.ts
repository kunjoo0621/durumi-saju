import type { EnrichedSajuData, KoreanElement } from "./utils/saju-enrichment";

/* ── 질문 선택 트리거 (기존) ── */

type TriggerCondition =
  | { type: "십성존재"; star: string; who: "A" | "B" | "any" }
  | { type: "신살존재"; key: string; who: "A" | "B" | "any" }
  | { type: "오행과다"; element: KoreanElement; who: "A" | "B" | "any" }
  | { type: "오행결핍"; element: KoreanElement; who: "A" | "B" | "any" }
  | { type: "신강격차"; minDiff: number }
  | { type: "기본"; score: number };

/* ── 주어 결정 조건 (신규) ── */

type SubjectCondition =
  | { type: "stronger"; weight?: number }
  | { type: "weaker"; weight?: number }
  | { type: "element_more"; element: KoreanElement; weight?: number }
  | { type: "element_less"; element: KoreanElement; weight?: number }
  | { type: "has_tenstar"; star: string; weight?: number }
  | { type: "has_shinsal"; key: string; weight?: number }
  | { type: "has_stage"; stage: string; weight?: number }
  | { type: "higher_category"; category: "wealth" | "love" | "career" | "health" | "social"; weight?: number };

interface SimulationTemplate {
  icon: string;
  question: string;
  triggers: TriggerCondition[];
  subjectRules: SubjectCondition[];
  subjectLabel: string;
}

export interface SelectedSimulation {
  icon: string;
  question: string;
  subject: "A" | "B";
  subjectLabel: string;
}

/* ── 상수 ── */

const STRENGTH_ORDER = ["극약", "태약", "신약", "중화신약", "중화신강", "신강", "태강", "극왕"];

const CATEGORY_KEY_MAP: Record<string, string> = {
  wealth: "재물운", love: "연애운", career: "직장운",
  health: "건강운", social: "대인운",
};

/* ── 질문 선택 스코어링 (기존) ── */

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

/* ── 주어 결정 함수 (신규) ── */

export function determineSubject(
  rules: SubjectCondition[],
  enrichedA: EnrichedSajuData,
  enrichedB: EnrichedSajuData,
  scores?: { A: Record<string, number>; B: Record<string, number> },
): "A" | "B" {
  let scoreA = 0;
  let scoreB = 0;

  for (const rule of rules) {
    const w = rule.weight ?? 1;

    switch (rule.type) {
      case "stronger": {
        const idxA = STRENGTH_ORDER.indexOf(enrichedA.strength?.result ?? "");
        const idxB = STRENGTH_ORDER.indexOf(enrichedB.strength?.result ?? "");
        if (idxA > idxB) scoreA += w;
        else if (idxB > idxA) scoreB += w;
        break;
      }
      case "weaker": {
        const idxA = STRENGTH_ORDER.indexOf(enrichedA.strength?.result ?? "");
        const idxB = STRENGTH_ORDER.indexOf(enrichedB.strength?.result ?? "");
        if (idxA < idxB) scoreA += w;
        else if (idxB < idxA) scoreB += w;
        break;
      }
      case "element_more": {
        const valA = enrichedA.elementDist[rule.element] ?? 0;
        const valB = enrichedB.elementDist[rule.element] ?? 0;
        if (valA > valB) scoreA += w;
        else if (valB > valA) scoreB += w;
        break;
      }
      case "element_less": {
        const valA = enrichedA.elementDist[rule.element] ?? 0;
        const valB = enrichedB.elementDist[rule.element] ?? 0;
        if (valA < valB) scoreA += w;
        else if (valB < valA) scoreB += w;
        break;
      }
      case "has_tenstar": {
        const hasA = enrichedA.tenStars.some((s) => s.includes(rule.star));
        const hasB = enrichedB.tenStars.some((s) => s.includes(rule.star));
        if (hasA && !hasB) scoreA += w;
        else if (hasB && !hasA) scoreB += w;
        break;
      }
      case "has_shinsal": {
        const hasA = enrichedA.shinsal?.matches?.some((m) => m.key === rule.key) ?? false;
        const hasB = enrichedB.shinsal?.matches?.some((m) => m.key === rule.key) ?? false;
        if (hasA && !hasB) scoreA += w;
        else if (hasB && !hasA) scoreB += w;
        break;
      }
      case "has_stage": {
        const dayStageA = enrichedA.twelveStages?.day?.korean ?? "";
        const dayStageB = enrichedB.twelveStages?.day?.korean ?? "";
        const hasA = dayStageA === rule.stage;
        const hasB = dayStageB === rule.stage;
        if (hasA && !hasB) scoreA += w;
        else if (hasB && !hasA) scoreB += w;
        break;
      }
      case "higher_category": {
        if (scores) {
          const korKey = CATEGORY_KEY_MAP[rule.category];
          if (korKey) {
            const sA = scores.A[korKey] ?? 0;
            const sB = scores.B[korKey] ?? 0;
            if (sA > sB) scoreA += w;
            else if (sB > sA) scoreB += w;
          }
        }
        break;
      }
    }
  }

  return scoreA >= scoreB ? "A" : "B";
}

// ── 시뮬레이션 풀 ──

const LOVER_POOL: SimulationTemplate[] = [
  {
    icon: "🏠", question: "동거하면 집안일 전쟁 먼저 일으키는 쪽은?",
    subjectLabel: "먼저 폭발하는 쪽",
    subjectRules: [
      { type: "weaker", weight: 2 },
      { type: "has_tenstar", star: "편관", weight: 1 },
      { type: "has_stage", stage: "묘", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "신강격차", minDiff: 2 }, { type: "기본", score: 1 }],
  },
  {
    icon: "💸", question: "공동 통장 만들면?",
    subjectLabel: "통장 주도권 잡는 쪽",
    subjectRules: [
      { type: "higher_category", category: "wealth", weight: 3 },
      { type: "has_tenstar", star: "정재", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "십성존재", star: "정재", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "😤", question: "싸우면 누가 먼저 연락해?",
    subjectLabel: "먼저 연락하는 쪽",
    subjectRules: [
      { type: "weaker", weight: 2 },
      { type: "element_more", element: "수", weight: 1 },
      { type: "has_tenstar", star: "정인", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "비견", who: "any" }, { type: "신강격차", minDiff: 2 }, { type: "기본", score: 1 }],
  },
  {
    icon: "😑", question: "권태기 먼저 오는 쪽은?",
    subjectLabel: "먼저 지루해하는 쪽",
    subjectRules: [
      { type: "has_shinsal", key: "dohwa", weight: 2 },
      { type: "has_tenstar", star: "상관", weight: 1 },
      { type: "stronger", weight: 1 },
    ],
    triggers: [{ type: "신살존재", key: "dohwa", who: "any" }, { type: "신살존재", key: "hongryeom", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🎂", question: "기념일 까먹는 쪽은?",
    subjectLabel: "까먹는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "편인", weight: 2 },
      { type: "element_less", element: "화", weight: 1 },
      { type: "has_tenstar", star: "식신", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "편인", who: "any" }, { type: "오행결핍", element: "화", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🍺", question: "술 마시면 본심 터뜨리는 쪽은?",
    subjectLabel: "본심 터뜨리는 쪽",
    subjectRules: [
      { type: "element_more", element: "수", weight: 2 },
      { type: "weaker", weight: 1 },
      { type: "has_stage", stage: "묘", weight: 2 },
    ],
    triggers: [{ type: "오행과다", element: "수", who: "any" }, { type: "십성존재", star: "식신", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "👫", question: "상대 친구 모임에 끼면?",
    subjectLabel: "더 어색해하는 쪽",
    subjectRules: [
      { type: "has_shinsal", key: "hwagae", weight: 2 },
      { type: "weaker", weight: 1 },
      { type: "element_more", element: "금", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "상관", who: "any" }, { type: "신살존재", key: "hwagae", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "💼", question: "한쪽이 야근 폭탄이면?",
    subjectLabel: "야근 당하는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "편관", weight: 2 },
      { type: "element_more", element: "금", weight: 1 },
      { type: "higher_category", category: "career", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "편관", who: "any" }, { type: "오행과다", element: "금", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "💍", question: "결혼 먼저 꺼내는 쪽은?",
    subjectLabel: "먼저 꺼내는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "정관", weight: 2 },
      { type: "has_tenstar", star: "정재", weight: 1 },
      { type: "stronger", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정관", who: "any" }, { type: "십성존재", star: "정재", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "💔", question: "이별 후 먼저 연락하는 쪽은?",
    subjectLabel: "먼저 연락하는 쪽",
    subjectRules: [
      { type: "element_more", element: "수", weight: 2 },
      { type: "has_tenstar", star: "정인", weight: 2 },
      { type: "weaker", weight: 1 },
    ],
    triggers: [{ type: "오행과다", element: "수", who: "any" }, { type: "십성존재", star: "정인", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🧳", question: "여행 가면 주도권 잡는 쪽은?",
    subjectLabel: "주도하는 쪽",
    subjectRules: [
      { type: "has_shinsal", key: "yeokma", weight: 2 },
      { type: "stronger", weight: 2 },
      { type: "has_tenstar", star: "편재", weight: 1 },
    ],
    triggers: [{ type: "신살존재", key: "yeokma", who: "any" }, { type: "신강격차", minDiff: 2 }, { type: "기본", score: 1 }],
  },
  {
    icon: "👨‍👩‍👧", question: "상대 가족 만나면 누가 더 긴장해?",
    subjectLabel: "더 긴장하는 쪽",
    subjectRules: [
      { type: "weaker", weight: 2 },
      { type: "has_tenstar", star: "정관", weight: 1 },
      { type: "element_less", element: "토", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정관", who: "any" }, { type: "오행결핍", element: "토", who: "any" }, { type: "기본", score: 1 }],
  },
];

const FRIEND_POOL: SimulationTemplate[] = [
  {
    icon: "✈️", question: "같이 여행 가면?",
    subjectLabel: "주도하는 쪽",
    subjectRules: [
      { type: "has_shinsal", key: "yeokma", weight: 2 },
      { type: "stronger", weight: 2 },
      { type: "has_tenstar", star: "편재", weight: 1 },
    ],
    triggers: [{ type: "신살존재", key: "yeokma", who: "any" }, { type: "신강격차", minDiff: 2 }, { type: "기본", score: 1 }],
  },
  {
    icon: "💸", question: "돈 빌려달라면?",
    subjectLabel: "빌려달라는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "겁재", weight: 2 },
      { type: "element_less", element: "토", weight: 1 },
      { type: "weaker", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "십성존재", star: "편재", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🗣️", question: "뒤에서 먼저 험담하는 쪽은?",
    subjectLabel: "험담하는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "상관", weight: 3 },
      { type: "element_more", element: "화", weight: 1 },
      { type: "has_tenstar", star: "겁재", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "상관", who: "any" }, { type: "오행과다", element: "화", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "📱", question: "10년 뒤에도 연락할까?",
    subjectLabel: "연락 유지하는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "정인", weight: 2 },
      { type: "element_more", element: "토", weight: 2 },
      { type: "has_tenstar", star: "비견", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "오행과다", element: "토", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🍺", question: "같이 술 마시면?",
    subjectLabel: "분위기 주도하는 쪽",
    subjectRules: [
      { type: "element_more", element: "수", weight: 2 },
      { type: "has_tenstar", star: "식신", weight: 2 },
      { type: "stronger", weight: 1 },
    ],
    triggers: [{ type: "오행과다", element: "수", who: "any" }, { type: "십성존재", star: "식신", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🎉", question: "한쪽이 대박 나면?",
    subjectLabel: "대박 나는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "편재", weight: 3 },
      { type: "higher_category", category: "wealth", weight: 2 },
    ],
    triggers: [{ type: "십성존재", star: "편재", who: "any" }, { type: "십성존재", star: "겁재", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🤫", question: "비밀 공유하면 지켜줄까?",
    subjectLabel: "비밀 못 지키는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "상관", weight: 2 },
      { type: "element_more", element: "화", weight: 1 },
      { type: "has_shinsal", key: "dohwa", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "신살존재", key: "hwagae", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "❤️", question: "같은 사람 좋아하면?",
    subjectLabel: "먼저 포기하는 쪽",
    subjectRules: [
      { type: "weaker", weight: 2 },
      { type: "has_tenstar", star: "정인", weight: 1 },
      { type: "element_more", element: "수", weight: 1 },
    ],
    triggers: [{ type: "신살존재", key: "dohwa", who: "any" }, { type: "십성존재", star: "비견", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🏃", question: "같이 운동하면?",
    subjectLabel: "먼저 포기하는 쪽",
    subjectRules: [
      { type: "weaker", weight: 2 },
      { type: "element_less", element: "목", weight: 1 },
      { type: "element_more", element: "수", weight: 1 },
    ],
    triggers: [{ type: "오행과다", element: "목", who: "any" }, { type: "신강격차", minDiff: 2 }, { type: "기본", score: 1 }],
  },
  {
    icon: "📞", question: "연락 안 하면 먼저 찾는 쪽은?",
    subjectLabel: "먼저 찾는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "정인", weight: 2 },
      { type: "element_more", element: "수", weight: 1 },
      { type: "weaker", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "오행과다", element: "수", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "😢", question: "고민 상담하면?",
    subjectLabel: "상담 요청하는 쪽",
    subjectRules: [
      { type: "weaker", weight: 2 },
      { type: "has_tenstar", star: "편관", weight: 1 },
      { type: "element_more", element: "수", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "십성존재", star: "식신", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "⚔️", question: "그룹에서 편 갈리면?",
    subjectLabel: "먼저 편 가르는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "겁재", weight: 2 },
      { type: "has_tenstar", star: "편관", weight: 1 },
      { type: "stronger", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "십성존재", star: "편관", who: "any" }, { type: "기본", score: 1 }],
  },
];

const COLLEAGUE_POOL: SimulationTemplate[] = [
  {
    icon: "📊", question: "같은 팀이면 누가 일 더 해?",
    subjectLabel: "일 더 하는 쪽",
    subjectRules: [
      { type: "higher_category", category: "career", weight: 2 },
      { type: "has_tenstar", star: "편관", weight: 1 },
      { type: "stronger", weight: 1 },
    ],
    triggers: [{ type: "신강격차", minDiff: 2 }, { type: "십성존재", star: "편관", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "📈", question: "누가 먼저 승진해?",
    subjectLabel: "먼저 승진하는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "정관", weight: 2 },
      { type: "has_tenstar", star: "정인", weight: 1 },
      { type: "higher_category", category: "career", weight: 2 },
    ],
    triggers: [{ type: "십성존재", star: "정관", who: "any" }, { type: "십성존재", star: "정인", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🚀", question: "같이 창업하면?",
    subjectLabel: "주도하는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "편재", weight: 2 },
      { type: "has_tenstar", star: "식신", weight: 1 },
      { type: "stronger", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "편재", who: "any" }, { type: "십성존재", star: "식신", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🗣️", question: "회의에서 의견 충돌하면?",
    subjectLabel: "먼저 목소리 높이는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "상관", weight: 2 },
      { type: "has_tenstar", star: "비견", weight: 1 },
      { type: "stronger", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "상관", who: "any" }, { type: "십성존재", star: "비견", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🌙", question: "같이 야근하면?",
    subjectLabel: "야근 주도하는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "편관", weight: 2 },
      { type: "element_more", element: "금", weight: 1 },
      { type: "higher_category", category: "career", weight: 1 },
    ],
    triggers: [{ type: "오행과다", element: "금", who: "any" }, { type: "십성존재", star: "편관", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "📩", question: "한쪽이 이직 제안 받으면?",
    subjectLabel: "이직 제안 받는 쪽",
    subjectRules: [
      { type: "has_shinsal", key: "yeokma", weight: 2 },
      { type: "has_tenstar", star: "편재", weight: 1 },
      { type: "has_tenstar", star: "상관", weight: 1 },
    ],
    triggers: [{ type: "신살존재", key: "yeokma", who: "any" }, { type: "십성존재", star: "편재", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "😤", question: "상사한테 깨지면?",
    subjectLabel: "더 많이 깨지는 쪽",
    subjectRules: [
      { type: "weaker", weight: 2 },
      { type: "has_tenstar", star: "편관", weight: 1 },
      { type: "element_less", element: "토", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "편관", who: "any" }, { type: "오행결핍", element: "토", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🏆", question: "성과 공 가르기하면?",
    subjectLabel: "공 가져가는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "겁재", weight: 2 },
      { type: "has_tenstar", star: "편재", weight: 1 },
      { type: "stronger", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "십성존재", star: "편재", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🍻", question: "회식에서 분위기는?",
    subjectLabel: "분위기 주도하는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "식신", weight: 2 },
      { type: "element_more", element: "수", weight: 1 },
      { type: "stronger", weight: 1 },
    ],
    triggers: [{ type: "오행과다", element: "수", who: "any" }, { type: "십성존재", star: "식신", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "✂️", question: "구조조정이면?",
    subjectLabel: "더 위험한 쪽",
    subjectRules: [
      { type: "weaker", weight: 2 },
      { type: "has_tenstar", star: "편관", weight: 1 },
      { type: "element_less", element: "금", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "편관", who: "any" }, { type: "오행결핍", element: "금", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🔀", question: "다른 부서로 갈리면?",
    subjectLabel: "부서 이동하는 쪽",
    subjectRules: [
      { type: "has_shinsal", key: "yeokma", weight: 2 },
      { type: "has_tenstar", star: "상관", weight: 1 },
      { type: "weaker", weight: 1 },
    ],
    triggers: [{ type: "신살존재", key: "yeokma", who: "any" }, { type: "십성존재", star: "정인", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "👔", question: "한쪽이 상사면?",
    subjectLabel: "상사 역할인 쪽",
    subjectRules: [
      { type: "stronger", weight: 3 },
      { type: "has_tenstar", star: "정관", weight: 1 },
      { type: "higher_category", category: "career", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정관", who: "any" }, { type: "신강격차", minDiff: 3 }, { type: "기본", score: 1 }],
  },
];

const FAMILY_POOL: SimulationTemplate[] = [
  {
    icon: "🎆", question: "명절에 누가 스트레스 더 받아?",
    subjectLabel: "스트레스 더 받는 쪽",
    subjectRules: [
      { type: "weaker", weight: 2 },
      { type: "has_tenstar", star: "편관", weight: 1 },
      { type: "element_more", element: "토", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "편관", who: "any" }, { type: "오행과다", element: "토", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "💰", question: "용돈/생활비 문제 생기면?",
    subjectLabel: "돈 문제 일으키는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "겁재", weight: 2 },
      { type: "element_less", element: "토", weight: 1 },
      { type: "weaker", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "십성존재", star: "정재", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🗳️", question: "가족 회의하면?",
    subjectLabel: "목소리 큰 쪽",
    subjectRules: [
      { type: "stronger", weight: 2 },
      { type: "has_tenstar", star: "상관", weight: 1 },
      { type: "has_tenstar", star: "비견", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "비견", who: "any" }, { type: "십성존재", star: "상관", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "👑", question: "가족 중심 역할은 누구?",
    subjectLabel: "중심 역할인 쪽",
    subjectRules: [
      { type: "stronger", weight: 2 },
      { type: "has_tenstar", star: "정인", weight: 1 },
      { type: "element_more", element: "토", weight: 1 },
    ],
    triggers: [{ type: "신강격차", minDiff: 2 }, { type: "십성존재", star: "정인", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "😇", question: "부모님 앞에서 착한 척하는 쪽은?",
    subjectLabel: "착한 척하는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "정관", weight: 2 },
      { type: "has_tenstar", star: "편인", weight: 1 },
      { type: "weaker", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정관", who: "any" }, { type: "십성존재", star: "편인", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🏠", question: "같이 살면 먼저 나가고 싶은 쪽은?",
    subjectLabel: "나가고 싶은 쪽",
    subjectRules: [
      { type: "has_shinsal", key: "yeokma", weight: 2 },
      { type: "has_tenstar", star: "상관", weight: 1 },
      { type: "element_more", element: "목", weight: 1 },
    ],
    triggers: [{ type: "신살존재", key: "yeokma", who: "any" }, { type: "십성존재", star: "상관", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "📋", question: "집안 대소사 결정권은?",
    subjectLabel: "결정권 가진 쪽",
    subjectRules: [
      { type: "stronger", weight: 3 },
      { type: "has_tenstar", star: "편관", weight: 1 },
    ],
    triggers: [{ type: "신강격차", minDiff: 2 }, { type: "십성존재", star: "편관", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "💥", question: "한쪽이 큰 실패하면?",
    subjectLabel: "실패하는 쪽",
    subjectRules: [
      { type: "weaker", weight: 2 },
      { type: "has_tenstar", star: "겁재", weight: 1 },
      { type: "element_less", element: "토", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "오행결핍", element: "토", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "💎", question: "유산/재산 문제 생기면?",
    subjectLabel: "더 챙기는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "편재", weight: 2 },
      { type: "has_tenstar", star: "겁재", weight: 1 },
      { type: "higher_category", category: "wealth", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "편재", who: "any" }, { type: "십성존재", star: "겁재", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🤗", question: "오랜만에 만나면?",
    subjectLabel: "먼저 반가워하는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "정인", weight: 2 },
      { type: "element_more", element: "수", weight: 1 },
      { type: "weaker", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "신살존재", key: "hwagae", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🏙️", question: "다른 도시에 살면?",
    subjectLabel: "먼저 떠나는 쪽",
    subjectRules: [
      { type: "has_shinsal", key: "yeokma", weight: 2 },
      { type: "has_tenstar", star: "상관", weight: 1 },
      { type: "element_less", element: "토", weight: 1 },
    ],
    triggers: [{ type: "신살존재", key: "yeokma", who: "any" }, { type: "오행결핍", element: "토", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🏡", question: "명절 누구 집에서?",
    subjectLabel: "자기 집 주장하는 쪽",
    subjectRules: [
      { type: "stronger", weight: 2 },
      { type: "has_tenstar", star: "편관", weight: 1 },
      { type: "element_more", element: "토", weight: 1 },
    ],
    triggers: [{ type: "신강격차", minDiff: 2 }, { type: "십성존재", star: "편관", who: "any" }, { type: "기본", score: 1 }],
  },
];

const OTHER_POOL: SimulationTemplate[] = [
  {
    icon: "🏘️", question: "같은 동네 살면?",
    subjectLabel: "먼저 말 거는 쪽",
    subjectRules: [
      { type: "element_more", element: "토", weight: 2 },
      { type: "has_tenstar", star: "식신", weight: 1 },
      { type: "stronger", weight: 1 },
    ],
    triggers: [{ type: "오행과다", element: "토", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "📂", question: "공동 프로젝트 하면?",
    subjectLabel: "주도하는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "식신", weight: 1 },
      { type: "has_tenstar", star: "편재", weight: 1 },
      { type: "stronger", weight: 2 },
    ],
    triggers: [{ type: "십성존재", star: "식신", who: "any" }, { type: "십성존재", star: "편재", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "⚔️", question: "이해관계 충돌하면?",
    subjectLabel: "먼저 싸움 거는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "겁재", weight: 2 },
      { type: "has_tenstar", star: "편관", weight: 1 },
      { type: "stronger", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "겁재", who: "any" }, { type: "십성존재", star: "편관", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "⏳", question: "이 인연 오래 갈까?",
    subjectLabel: "먼저 연락 끊는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "상관", weight: 2 },
      { type: "has_shinsal", key: "yeokma", weight: 1 },
      { type: "element_less", element: "토", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "오행과다", element: "토", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🤝", question: "서로 도움 필요할 때?",
    subjectLabel: "도움 요청하는 쪽",
    subjectRules: [
      { type: "weaker", weight: 2 },
      { type: "has_tenstar", star: "정인", weight: 1 },
      { type: "element_more", element: "수", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "십성존재", star: "식신", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🎮", question: "같은 취미 하면?",
    subjectLabel: "더 빠져드는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "식신", weight: 2 },
      { type: "has_tenstar", star: "비견", weight: 1 },
      { type: "element_more", element: "목", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "식신", who: "any" }, { type: "십성존재", star: "비견", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "💘", question: "소개팅 시켜달라면?",
    subjectLabel: "부탁하는 쪽",
    subjectRules: [
      { type: "has_shinsal", key: "dohwa", weight: 2 },
      { type: "element_more", element: "화", weight: 1 },
      { type: "weaker", weight: 1 },
    ],
    triggers: [{ type: "신살존재", key: "dohwa", who: "any" }, { type: "십성존재", star: "정재", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "⭐", question: "한쪽이 유명해지면?",
    subjectLabel: "유명해지는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "편재", weight: 2 },
      { type: "has_tenstar", star: "식신", weight: 1 },
      { type: "stronger", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "편재", who: "any" }, { type: "십성존재", star: "겁재", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "💬", question: "같은 커뮤니티에 있으면?",
    subjectLabel: "더 적극적인 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "비견", weight: 1 },
      { type: "element_more", element: "토", weight: 1 },
      { type: "stronger", weight: 2 },
    ],
    triggers: [{ type: "십성존재", star: "비견", who: "any" }, { type: "오행과다", element: "토", who: "any" }, { type: "기본", score: 1 }],
  },
  {
    icon: "🔁", question: "연락 끊겼다 다시 만나면?",
    subjectLabel: "먼저 찾는 쪽",
    subjectRules: [
      { type: "has_tenstar", star: "정인", weight: 2 },
      { type: "element_more", element: "수", weight: 1 },
      { type: "has_shinsal", key: "hwagae", weight: 1 },
    ],
    triggers: [{ type: "십성존재", star: "정인", who: "any" }, { type: "신살존재", key: "hwagae", who: "any" }, { type: "기본", score: 1 }],
  },
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
  categoryScores?: { A: Record<string, number>; B: Record<string, number> },
): SelectedSimulation[] {
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
    subject: determineSubject(s.subjectRules, enrichedA, enrichedB, categoryScores),
    subjectLabel: s.subjectLabel,
  }));
}
