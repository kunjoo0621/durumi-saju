// 재물/인연 날씨 타임라인 — 전부 서버 결정론(LLM 무관여).
// 세운은 saju-fortune.ts가 이미 currentYear-1..+9를 계산한다(:149) — 여기서는 그중
// currentYear-1..currentYear+5 창만 잘라 무드·힌트를 파생한다.
// 무드는 3단(강세=맑음/보통=흐림/주의=비)만 쓴다 — "위기/폭풍"은 유료 리포트 안전장치
// (wealth 절대 규칙 3·4: 손실 단정·공포 금지)와 충돌하므로 의도적으로 배제.
// 트리거의 단일 진실원은 facts.timingWindows(엔진 계산값) — 여기서 재판정하지 않는다.

import type { FortuneResult } from "./utils/saju-fortune";
import type { WealthFacts } from "./wealth-facts";
import type { MarriageFacts } from "./marriage-facts";
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

function sliceWindow(fortune: FortuneResult, currentYear: number) {
  return (fortune.seun ?? []).filter(
    (s) => s.year >= currentYear - PAST_SPAN && s.year <= currentYear + FUTURE_SPAN,
  );
}

export function buildWealthTimeline(
  fortune: FortuneResult | null,
  facts: Pick<WealthFacts, "timingWindows" | "daeunWealthYears">,
  currentYear: number,
): ServerTimeline | null {
  if (!fortune) return null;
  const trigByYear = new Map(facts.timingWindows.map((w) => [w.year, w.triggers as string[]]));
  const entries: TimelineEntry[] = sliceWindow(fortune, currentYear).map((s) => {
    const triggers = trigByYear.get(s.year) ?? [];
    const lead = triggers[0];
    return {
      year: s.year,
      age: s.age,
      pillarKorean: pillarKoreanFor(s.stem, s.branch),
      tenStar: s.tenStar,
      twelveStage: s.twelveStage,
      mood: lead ? WEALTH_MOOD[lead] ?? "보통" : "보통",
      triggers,
      hint: lead ? WEALTH_HINT[lead] ?? WEALTH_HINT_NONE : WEALTH_HINT_NONE,
      isPast: s.year < currentYear,
      isCurrent: s.year === currentYear,
    };
  });
  if (entries.length === 0) return null;
  return { version: 1, entries, daeun: facts.daeunWealthYears };
}

export function buildMarriageTimeline(
  fortune: FortuneResult | null,
  facts: Pick<MarriageFacts, "timingWindows" | "daeunSpouseYears" | "maritalStatus">,
  currentYear: number,
): ServerTimeline | null {
  if (!fortune) return null;
  const married = facts.maritalStatus === "기혼";
  const hintTable = married ? MARRIAGE_HINT_MARRIED : MARRIAGE_HINT;
  const trigByYear = new Map(facts.timingWindows.map((w) => [w.year, w.triggers as string[]]));
  const entries: TimelineEntry[] = sliceWindow(fortune, currentYear).map((s) => {
    const triggers = trigByYear.get(s.year) ?? [];
    const lead = MARRIAGE_TRIGGER_PRIORITY.find((t) => triggers.includes(t));
    return {
      year: s.year,
      age: s.age,
      pillarKorean: pillarKoreanFor(s.stem, s.branch),
      tenStar: s.tenStar,
      twelveStage: s.twelveStage,
      mood: lead ? "강세" : "보통", // 결혼운 엔진엔 부정 트리거가 없다 — 주의 무드 미사용
      triggers,
      hint: lead ? hintTable[lead] : MARRIAGE_HINT_NONE,
      isPast: s.year < currentYear,
      isCurrent: s.year === currentYear,
    };
  });
  if (entries.length === 0) return null;
  return { version: 1, entries, daeun: facts.daeunSpouseYears };
}
