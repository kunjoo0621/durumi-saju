// 재물/인연 날씨 타임라인 — 전부 서버 결정론(LLM 무관여).
// 세운은 saju-fortune.ts가 이미 currentYear-1..+9를 계산한다(:149) — 여기서는 그중
// currentYear-1..currentYear+5 창만 잘라 무드·힌트를 파생한다.
// 무드는 3단(강세=맑음/보통=흐림/주의=비)만 쓴다 — "위기/폭풍"은 유료 리포트 안전장치
// (wealth 절대 규칙 3·4: 손실 단정·공포 금지)와 충돌하므로 의도적으로 배제.
// 트리거의 단일 진실원은 facts.timingWindows(엔진 계산값) — 여기서 재판정하지 않는다.

import type { FortuneResult } from "./utils/saju-fortune";
import type { WealthFacts } from "./wealth-facts";
import type { MarriageFacts } from "./marriage-facts";
import type { CareerFacts } from "./career-facts";
import { STEM_ELEMENT, BRANCH_INFO } from "./utils/saju-enrichment";

export type TimelineMood = "강세" | "보통" | "주의";

export interface TimelineEntry {
  year: number;
  age: number;
  pillarKorean: string;
  tenStar: string;
  twelveStage: string;
  mood: TimelineMood;
  triggers: string[];
  hint: string;
  isPast: boolean;
  isCurrent: boolean;
}

export interface ServerTimeline {
  version: 1;
  entries: TimelineEntry[];
  daeun: Array<{ startAge: number; endAge: number; star: string }>;
}

const PAST_SPAN = 1; // 지나간 회색 맥락 칸
const FUTURE_SPAN = 5; // 향후 5년

function pillarKoreanFor(stem: string, branch: string): string {
  return `${STEM_ELEMENT[stem]?.korean ?? stem}${BRANCH_INFO[branch]?.korean ?? branch}`;
}

// 세운 한 해의 십성은 단일이므로 wealth 트리거는 해마다 최대 1개(재성/식상/비겁 셋은 서로소).
const WEALTH_MOOD: Record<string, TimelineMood> = {
  재성투출: "강세",
  식상투출: "강세",
  비겁조력: "보통",
  비겁손재: "주의",
};
const WEALTH_HINT: Record<string, string> = {
  재성투출: "재성이 들어오는 해 — 돈이 움직일 여지가 큰 시기야",
  식상투출: "벌이를 만드는 기운이 드는 해 — 새 수입 흐름을 살펴볼 만해",
  비겁조력: "힘을 보태주는 기운 — 기반을 다지기 좋은 해야",
  비겁손재: "지출·대여·보증 같은 결정은 한 번 더 점검하고 넘어가",
};
const WEALTH_HINT_NONE = "큰 트리거 없이 흘러가는 해야";

// marriage 트리거는 동시 발생 가능(합·십성·도화는 독립) → 우선순위로 힌트 대표 트리거 선정.
const MARRIAGE_TRIGGER_PRIORITY = ["배우자성투출", "세운합일지", "도화홍염"] as const;
const MARRIAGE_HINT: Record<string, string> = {
  배우자성투출: "배우자 기운이 드는 해 — 인연의 흐름이 또렷해지는 시기야",
  세운합일지: "배우자궁이 움직이는 해 — 관계가 가까워지기 좋은 시기야",
  도화홍염: "매력이 도는 해 — 인연이 다가오기 좋은 시기야",
};
// 기혼 전용(절대 규칙 3-4: 모든 신호를 부부 관계 내부로만)
const MARRIAGE_HINT_MARRIED: Record<string, string> = {
  배우자성투출: "부부 사이를 재점검하고 소통하기 좋은 해야",
  세운합일지: "부부의 발을 다시 맞추기 좋은 해야",
  도화홍염: "부부 사이에 설렘을 되찾기 좋은 해야",
};
const MARRIAGE_HINT_NONE = "큰 트리거 없이 흘러가는 해야";

// 같은 트리거가 창(7년) 안에 두 번 이상 뜰 때(예: 2028·2029 둘 다 비겁손재) 같은 문장이 반복돼
// 버그처럼 보인다 → 두 번째부터 변주(ALT)로 교차. 뜻은 같고 표현만 다르게(fabrication 아님).
const WEALTH_HINT_ALT: Record<string, string> = {
  재성투출: "재물 기운이 한 번 더 드는 해 — 앞선 흐름을 이어받기 좋아",
  식상투출: "만들어내는 힘이 이어지는 해 — 벌이의 폭을 넓혀볼 만해",
  비겁조력: "다시 힘이 실리는 해 — 다져둔 기반을 밀어붙여도 좋아",
  비겁손재: "돈이 새기 쉬운 흐름이 이어지니 지갑 관리에 한 번 더 신경 써",
};
const MARRIAGE_HINT_ALT: Record<string, string> = {
  배우자성투출: "배우자 기운이 한 번 더 드는 해 — 인연의 결이 이어지는 시기야",
  세운합일지: "배우자궁이 다시 움직이는 해 — 관계를 한 발 더 좁히기 좋아",
  도화홍염: "매력이 이어지는 해 — 인연의 온도를 데우기 좋아",
};
const MARRIAGE_HINT_MARRIED_ALT: Record<string, string> = {
  배우자성투출: "부부 사이를 한 번 더 다독이기 좋은 해야",
  세운합일지: "부부의 호흡을 다시 맞춰가기 좋은 해야",
  도화홍염: "부부 사이 설렘을 이어가기 좋은 해야",
};

function sliceWindow(fortune: FortuneResult, currentYear: number) {
  return (fortune.seun ?? []).filter(
    (s) => s.year >= currentYear - PAST_SPAN && s.year <= currentYear + FUTURE_SPAN,
  );
}

// 대운은 "현재 진행 중이거나 앞으로 올 것"만 남긴다 — 이미 끝난 대운(endAge < 현재 나이)을
// "앞으로의 큰 흐름"에 노출하면 어릴 적 대운만 떠서 고장처럼 보인다(④). 전부 과거면 빈 배열.
function filterUpcomingDaeun(
  daeun: ServerTimeline["daeun"],
  fortune: FortuneResult,
  currentYear: number,
): ServerTimeline["daeun"] {
  const currentAge = (fortune.seun ?? []).find((s) => s.year === currentYear)?.age;
  if (currentAge === undefined) return daeun;
  return daeun.filter((d) => d.endAge >= currentAge);
}

// 트리거 없는 해의 힌트 — 그 해 세운 십성으로 해마다 다른 plain 문구를 파생한다(⑥).
// 종전엔 "큰 트리거 없이 흘러가는 해야"가 매해 반복돼 버그처럼 보였다. 십성 용어는 노출하지 않고
// (전문용어 최소화), 관계상태 무관 안전 문구만 쓴다(기혼 포함 — 외부 인연 암시 배제).
const MARRIAGE_YEAR_HINT: Record<string, string> = {
  비견: "내 색이 또렷해지는 해 — 나를 먼저 세우기 좋아",
  겁재: "사람들과 부대끼며 나를 알아가는 해",
  식신: "마음이 편해지고 표현이 부드러워지는 해",
  상관: "하고 싶은 말과 끼가 살아나는 해",
  편재: "여유가 생기고 활동 폭이 넓어지는 해",
  정재: "관계를 차분히 챙기기 좋은 해",
  편관: "책임과 긴장이 함께 오는 해 — 관계의 틀을 점검해",
  정관: "관계에 질서를 세우기 좋은 해",
  편인: "혼자 채우고 정비하는 해",
  정인: "마음이 안정되고 기대는 힘이 느는 해",
};
const WEALTH_YEAR_HINT: Record<string, string> = {
  비견: "내 힘으로 버는 데 집중하는 해",
  겁재: "돈이 오가는 폭이 커지는 해 — 관리가 필요해",
  식신: "손에 익은 일로 벌이가 도는 해",
  상관: "새 아이디어로 벌 여지가 생기는 해",
  편재: "돈이 크게 움직일 여지가 보이는 해",
  정재: "안정적으로 모으기 좋은 해",
  편관: "일과 자리에 힘이 실리는 해 — 압박도 함께 와",
  정관: "자리와 신용을 다지는 해",
  편인: "배우고 준비하며 기반을 만드는 해",
  정인: "문서와 자격이 도움이 되는 해",
};

export function buildWealthTimeline(
  fortune: FortuneResult | null,
  facts: Pick<WealthFacts, "timingWindows" | "daeunWealthYears">,
  currentYear: number,
): ServerTimeline | null {
  if (!fortune) return null;
  const trigByYear = new Map(facts.timingWindows.map((w) => [w.year, w.triggers as string[]]));
  const triggerSeen = new Map<string, number>();
  const entries: TimelineEntry[] = sliceWindow(fortune, currentYear).map((s) => {
    const triggers = trigByYear.get(s.year) ?? [];
    const lead = triggers[0];
    let hint: string;
    if (lead) {
      const n = triggerSeen.get(lead) ?? 0;
      triggerSeen.set(lead, n + 1);
      hint = n % 2 === 1
        ? WEALTH_HINT_ALT[lead] ?? WEALTH_HINT[lead] ?? WEALTH_HINT_NONE
        : WEALTH_HINT[lead] ?? WEALTH_HINT_NONE;
    } else {
      hint = WEALTH_YEAR_HINT[s.tenStar] ?? WEALTH_HINT_NONE;
    }
    return {
      year: s.year,
      age: s.age,
      pillarKorean: pillarKoreanFor(s.stem, s.branch),
      tenStar: s.tenStar,
      twelveStage: s.twelveStage,
      mood: lead ? WEALTH_MOOD[lead] ?? "보통" : "보통",
      triggers,
      hint,
      isPast: s.year < currentYear,
      isCurrent: s.year === currentYear,
    };
  });
  if (entries.length === 0) return null;
  return { version: 1, entries, daeun: filterUpcomingDaeun(facts.daeunWealthYears, fortune, currentYear) };
}

// 커리어 트리거(관성투출·인성투출·식상투출)는 세운 십성이 단일이라 해마다 최대 1개(서로소).
// 부정 트리거가 없다 — 커리어 안전장치(절대 규칙 3·4: 실패·해고 단정 금지)와 충돌하므로 '주의'
// 무드를 만들지 않는다. 식상투출은 "새 판" 기운이라 강세가 아니라 '보통'(벌이기 전 점검 프레임).
const CAREER_MOOD: Record<string, TimelineMood> = {
  관성투출: "강세",
  인성투출: "강세",
  식상투출: "보통",
};
const CAREER_HINT: Record<string, string> = {
  관성투출: "자리·평가가 움직일 여지가 큰 해 — 기회가 보이면 살펴볼 만한 시기야",
  인성투출: "자격·문서·배움이 힘이 되는 해 — 실력을 증명할 판을 챙겨봐",
  식상투출: "새 판·전환의 기운이 드는 해 — 벌이고 싶어도 한 번 더 점검하고 가",
};
const CAREER_HINT_ALT: Record<string, string> = {
  관성투출: "자리 기운이 한 번 더 드는 해 — 앞선 흐름을 이어받기 좋아",
  인성투출: "배움·자격의 힘이 이어지는 해 — 준비해둔 걸 꺼내 쓰기 좋아",
  식상투출: "만들어내는 기운이 이어지는 해 — 판을 넓히기 전에 속도를 점검해",
};
const CAREER_HINT_NONE = "큰 트리거 없이 흘러가는 해야";

// 트리거 없는 해(재성·비겁 세운)의 힌트 — 그 해 세운 십성으로 해마다 다른 plain 문구를 파생.
// 십성 용어는 노출하지 않고 커리어 결의 안전 문구만(공포·단정 배제).
const CAREER_YEAR_HINT: Record<string, string> = {
  비견: "내 힘으로 밀고 나가는 데 집중하는 해",
  겁재: "경쟁·협업이 오가며 부대끼는 해 — 내 몫을 챙겨",
  식신: "손에 익은 전문성으로 꾸준히 가는 해",
  상관: "새 아이디어와 자기 방식이 살아나는 해",
  편재: "활동 폭이 넓어지고 기회가 도는 해",
  정재: "맡은 일을 차분히 다지기 좋은 해",
  편관: "책임과 자리에 힘이 실리는 해 — 압박도 함께 와",
  정관: "자리와 신용을 쌓기 좋은 해",
  편인: "배우고 준비하며 기반을 만드는 해",
  정인: "자격·문서가 도움이 되는 해",
};

export function buildCareerTimeline(
  fortune: FortuneResult | null,
  facts: Pick<CareerFacts, "timingWindows" | "daeunCareerYears">,
  currentYear: number,
): ServerTimeline | null {
  if (!fortune) return null;
  const trigByYear = new Map(facts.timingWindows.map((w) => [w.year, w.triggers as string[]]));
  const triggerSeen = new Map<string, number>();
  const entries: TimelineEntry[] = sliceWindow(fortune, currentYear).map((s) => {
    const triggers = trigByYear.get(s.year) ?? [];
    const lead = triggers[0];
    let hint: string;
    if (lead) {
      const n = triggerSeen.get(lead) ?? 0;
      triggerSeen.set(lead, n + 1);
      hint = n % 2 === 1
        ? CAREER_HINT_ALT[lead] ?? CAREER_HINT[lead] ?? CAREER_HINT_NONE
        : CAREER_HINT[lead] ?? CAREER_HINT_NONE;
    } else {
      hint = CAREER_YEAR_HINT[s.tenStar] ?? CAREER_HINT_NONE;
    }
    return {
      year: s.year,
      age: s.age,
      pillarKorean: pillarKoreanFor(s.stem, s.branch),
      tenStar: s.tenStar,
      twelveStage: s.twelveStage,
      mood: lead ? CAREER_MOOD[lead] ?? "보통" : "보통",
      triggers,
      hint,
      isPast: s.year < currentYear,
      isCurrent: s.year === currentYear,
    };
  });
  if (entries.length === 0) return null;
  return { version: 1, entries, daeun: filterUpcomingDaeun(facts.daeunCareerYears, fortune, currentYear) };
}

export function buildMarriageTimeline(
  fortune: FortuneResult | null,
  facts: Pick<MarriageFacts, "timingWindows" | "daeunSpouseYears" | "maritalStatus">,
  currentYear: number,
): ServerTimeline | null {
  if (!fortune) return null;
  const married = facts.maritalStatus === "기혼";
  const hintTable = married ? MARRIAGE_HINT_MARRIED : MARRIAGE_HINT;
  const hintTableAlt = married ? MARRIAGE_HINT_MARRIED_ALT : MARRIAGE_HINT_ALT;
  const trigByYear = new Map(facts.timingWindows.map((w) => [w.year, w.triggers as string[]]));
  const triggerSeen = new Map<string, number>();
  const entries: TimelineEntry[] = sliceWindow(fortune, currentYear).map((s) => {
    const triggers = trigByYear.get(s.year) ?? [];
    const lead = MARRIAGE_TRIGGER_PRIORITY.find((t) => triggers.includes(t));
    let hint: string;
    if (lead) {
      const n = triggerSeen.get(lead) ?? 0;
      triggerSeen.set(lead, n + 1);
      hint = n % 2 === 1 ? hintTableAlt[lead] ?? hintTable[lead] : hintTable[lead];
    } else {
      hint = MARRIAGE_YEAR_HINT[s.tenStar] ?? MARRIAGE_HINT_NONE;
    }
    return {
      year: s.year,
      age: s.age,
      pillarKorean: pillarKoreanFor(s.stem, s.branch),
      tenStar: s.tenStar,
      twelveStage: s.twelveStage,
      mood: lead ? "강세" : "보통", // 결혼운 엔진엔 부정 트리거가 없다 — 주의 무드 미사용
      triggers,
      hint,
      isPast: s.year < currentYear,
      isCurrent: s.year === currentYear,
    };
  });
  if (entries.length === 0) return null;
  return { version: 1, entries, daeun: filterUpcomingDaeun(facts.daeunSpouseYears, fortune, currentYear) };
}
