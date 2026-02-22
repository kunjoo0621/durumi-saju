import type { EnrichedSajuData, KoreanElement } from "./saju-enrichment";
import { STEM_ELEMENT, GENERATES, CONTROLS } from "./saju-enrichment";
import type { FortuneResult } from "./saju-fortune";

/* ── 천간합 / 천간충 ── */
const CHEONGAN_HAP: [string, string][] = [
  ["甲", "己"], ["乙", "庚"], ["丙", "辛"], ["丁", "壬"], ["戊", "癸"],
];
const CHEONGAN_CHUNG: [string, string][] = [
  ["甲", "庚"], ["乙", "辛"], ["丙", "壬"], ["丁", "癸"],
];

/* ── Types ── */
export type DayStemRelation = "합" | "충" | "생" | "극" | "비화";

export interface BattleInteraction {
  yongshinCompat: {
    aHelpsB: boolean;
    bHelpsA: boolean;
    aHurtsB: boolean;
    bHurtsA: boolean;
    summary: string;
  };
  dayStemRelation: {
    type: DayStemRelation;
    detail: string;
  };
  elementCoverage: {
    percent: number;
    combined: Record<KoreanElement, number>;
    deficientAlone: { a: KoreanElement[]; b: KoreanElement[] };
    coveredByOther: { a: KoreanElement[]; b: KoreanElement[] };
  };
  fortuneSync?: {
    currentDaeunA: string;
    currentDaeunB: string;
    synced: boolean;
    summary: string;
  };
}

/* ── Main ── */
export function calculateBattleInteraction(
  enrichedA: EnrichedSajuData,
  enrichedB: EnrichedSajuData,
  fortuneA?: FortuneResult | null,
  fortuneB?: FortuneResult | null,
  birthYearA?: number,
  birthYearB?: number,
): BattleInteraction {
  return {
    yongshinCompat: calcYongshinCompat(enrichedA, enrichedB),
    dayStemRelation: calcDayStemRelation(enrichedA.dayMaster.stem, enrichedB.dayMaster.stem),
    elementCoverage: calcElementCoverage(enrichedA, enrichedB),
    fortuneSync: calcFortuneSync(fortuneA, fortuneB, birthYearA, birthYearB),
  };
}

/* ── 1. 용신 상보성 ── */
function calcYongshinCompat(a: EnrichedSajuData, b: EnrichedSajuData) {
  const aDom = a.elementAnalysis.dominant;
  const bDom = b.elementAnalysis.dominant;

  const aHelpsB = aDom.includes(b.yongshin.eokbu);
  const bHelpsA = bDom.includes(a.yongshin.eokbu);
  const aHurtsB = aDom.includes(b.yongshin.gisin);
  const bHurtsA = bDom.includes(a.yongshin.gisin);

  let summary: string;
  if (aHelpsB && bHelpsA) {
    summary = "서로의 용신을 채워주는 이상적 조합";
  } else if (aHelpsB && !bHelpsA) {
    summary = `A가 B의 용신(${b.yongshin.eokbu})을 채워주지만, 반대는 아닌 일방적 구조`;
  } else if (!aHelpsB && bHelpsA) {
    summary = `B가 A의 용신(${a.yongshin.eokbu})을 채워주지만, 반대는 아닌 일방적 구조`;
  } else if (aHurtsB && bHurtsA) {
    summary = "서로의 기신을 자극하는 조합 — 갈등 소지 높음";
  } else if (aHurtsB) {
    summary = `A가 B의 기신(${b.yongshin.gisin})을 자극하는 구조`;
  } else if (bHurtsA) {
    summary = `B가 A의 기신(${a.yongshin.gisin})을 자극하는 구조`;
  } else {
    summary = "용신 관점에서 특별한 상호작용 없음";
  }

  return { aHelpsB, bHelpsA, aHurtsB, bHurtsA, summary };
}

/* ── 2. 일간 관계 ── */
function calcDayStemRelation(
  stemA: string,
  stemB: string,
): { type: DayStemRelation; detail: string } {
  const koA = STEM_ELEMENT[stemA]?.korean ?? stemA;
  const koB = STEM_ELEMENT[stemB]?.korean ?? stemB;

  // 천간합
  for (const [s1, s2] of CHEONGAN_HAP) {
    if ((stemA === s1 && stemB === s2) || (stemA === s2 && stemB === s1)) {
      return { type: "합", detail: `${koA}${koB}합 — 서로 끌리는 관계` };
    }
  }

  // 천간충
  for (const [s1, s2] of CHEONGAN_CHUNG) {
    if ((stemA === s1 && stemB === s2) || (stemA === s2 && stemB === s1)) {
      return { type: "충", detail: `${koA}${koB}충 — 충돌하는 관계` };
    }
  }

  // 오행 상생 / 상극
  const elA = STEM_ELEMENT[stemA]?.element;
  const elB = STEM_ELEMENT[stemB]?.element;
  if (elA && elB) {
    if (elA === elB) return { type: "비화", detail: `같은 ${elA} 기운 — 비화 관계` };
    if (GENERATES[elA] === elB) return { type: "생", detail: `${elA}→${elB} 상생 — A가 B를 돕는 구조` };
    if (GENERATES[elB] === elA) return { type: "생", detail: `${elB}→${elA} 상생 — B가 A를 돕는 구조` };
    if (CONTROLS[elA] === elB) return { type: "극", detail: `${elA}→${elB} 상극 — A가 B를 제압하는 구조` };
    if (CONTROLS[elB] === elA) return { type: "극", detail: `${elB}→${elA} 상극 — B가 A를 제압하는 구조` };
  }

  return { type: "비화", detail: "특별한 상호작용 없음" };
}

/* ── 3. 오행 상보율 ── */
function calcElementCoverage(a: EnrichedSajuData, b: EnrichedSajuData) {
  const ELEMENTS: KoreanElement[] = ["목", "화", "토", "금", "수"];
  const combined = {} as Record<KoreanElement, number>;
  const defA: KoreanElement[] = [];
  const defB: KoreanElement[] = [];
  const covByB: KoreanElement[] = []; // A 부족 → B가 채움
  const covByA: KoreanElement[] = []; // B 부족 → A가 채움

  for (const el of ELEMENTS) {
    const va = a.elementDist[el] ?? 0;
    const vb = b.elementDist[el] ?? 0;
    combined[el] = va + vb;
    if (va === 0) { defA.push(el); if (vb > 0) covByB.push(el); }
    if (vb === 0) { defB.push(el); if (va > 0) covByA.push(el); }
  }

  const covered = ELEMENTS.filter((el) => combined[el] > 0).length;
  return {
    percent: Math.round((covered / 5) * 100),
    combined,
    deficientAlone: { a: defA, b: defB },
    coveredByOther: { a: covByB, b: covByA },
  };
}

/* ── 4. 대운 동기화 ── */
function calcFortuneSync(
  fortuneA?: FortuneResult | null,
  fortuneB?: FortuneResult | null,
  birthYearA?: number,
  birthYearB?: number,
) {
  if (!fortuneA?.daeun?.pillars?.length || !fortuneB?.daeun?.pillars?.length) return undefined;
  if (!birthYearA || !birthYearB) return undefined;

  const currentYear = new Date().getFullYear();
  const ageA = currentYear - birthYearA + 1;
  const ageB = currentYear - birthYearB + 1;

  const dA = fortuneA.daeun.pillars.find((p) => ageA >= p.startAge && ageA <= p.endAge);
  const dB = fortuneB.daeun.pillars.find((p) => ageB >= p.startAge && ageB <= p.endAge);
  if (!dA || !dB) return undefined;

  const elA = STEM_ELEMENT[dA.stem]?.element;
  const elB = STEM_ELEMENT[dB.stem]?.element;

  let synced = false;
  let summary: string;

  if (!elA || !elB) {
    summary = "대운 정보 부족";
  } else if (elA === elB) {
    synced = true;
    summary = `현재 대운이 둘 다 ${elA} 기운 — 같은 흐름`;
  } else if (GENERATES[elA] === elB) {
    synced = true;
    summary = `A의 대운(${elA})이 B의 대운(${elB})을 생 — A가 B의 운을 밀어주는 시기`;
  } else if (GENERATES[elB] === elA) {
    synced = true;
    summary = `B의 대운(${elB})이 A의 대운(${elA})을 생 — B가 A의 운을 밀어주는 시기`;
  } else if (CONTROLS[elA] === elB) {
    summary = `A의 대운(${elA})이 B의 대운(${elB})을 극 — 충돌 가능`;
  } else if (CONTROLS[elB] === elA) {
    summary = `B의 대운(${elB})이 A의 대운(${elA})을 극 — 충돌 가능`;
  } else {
    summary = "현재 대운이 서로 다른 방향";
  }

  return {
    currentDaeunA: `${dA.pillar} (${dA.tenStar})`,
    currentDaeunB: `${dB.pillar} (${dB.tenStar})`,
    synced,
    summary,
  };
}
