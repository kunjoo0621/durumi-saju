// couple 판정 레이어 — PairFacts(사실)를 4축 신호등 + 종합 판정으로 옮긴다.
//
// ★사실과 판정을 가르는 이유: 궁위 가중·중화 처리 같은 "해석 파라미터"가 사실 레이어에
//   들어가면 사실이 오염된다. PairFacts 는 raw 로 두고 여기서만 무게를 준다.
//
// ★"결혼해라 / 하지 마라"는 내지 않는다. 명리적으로도 CS적으로도 단정할 수 없다.
//   4축을 각각 보여주고 종합은 "어떤 결의 관계인가"까지만 말한다.
//   (marriage-prompt.ts:197 의 "인연 약함 단정 금지"와 같은 태도)

import type { PairAxis, PairFacts } from "./pair-facts";

export type AxisKey = "마음" | "생활" | "보완" | "시기";
export type AxisVerdict = "순" | "평" | "역" | "모름";

export interface AxisResult {
  score: number;
  verdict: AxisVerdict;
}

export interface CoupleDecision {
  axes: Record<AxisKey, AxisResult>;
  /** 살아 있는 축의 합 */
  total: number;
  verdict: string;
  /** 신뢰도가 떨어져 판정에서 뺀 축 */
  neutralized: AxisKey[];
}

/** PairFacts 의 중화 축 → 판정 축 매핑. 하나라도 중화되면 그 판정 축을 통째로 뺀다. */
const AXIS_DEPENDS_ON: Record<AxisKey, PairAxis[]> = {
  마음: ["일간관계"],
  생활: ["지지매트릭스"],
  보완: ["오행상보", "용신상보"],
  시기: ["타이밍"],
};

/* ── 마음의 결 (일간 관계) ── */
const DAY_STEM_SCORE: Record<string, number> = {
  합: 2, 생: 1, 비화: 0, 극: -1, 충: -2,
};

/* ── 생활의 결 (지지 매트릭스) ── */

// 붙는 관계는 양수, 부딪히는 관계는 음수. 한 칸에 둘 다 있으면 상쇄된다 —
// 巳申(육합+형)처럼 붙으면서 동시에 부딪히는 자리를 한쪽만 세면 해석이 반대로 간다.
const RELATION_SCORE: Record<string, number> = {
  육합: 2, 삼합: 1.5, 방합: 1, 동일: 0.5,
  충: -2, 형: -1.5, 원진: -1.5, 귀문: -1, 해: -1,
};

// 궁위 가중 — 자리마다 뜻이 다르다(년=뿌리·집안, 월=사회, 일=배우자궁, 시=말년·자식).
// ★배율의 출처: 고전은 겉궁합(년지)↔속궁합(일지)의 경중 차등 자체는 지지하지만
//   구체 배율은 없다. 자사 선례를 초기값으로 쓴다 —
//   월지 ×1.5 는 career-facts.ts:84 MONTH_BRANCH_MULTIPLIER,
//   원거리(년↔시) 할인은 marriage-facts.ts:59 ADJACENT_PILLARS 의 원거리 절삭 철학.
//   Phase 2 의 판정 경계 캘리브레이션에서 분포를 보고 조정한다.
const PILLAR_WEIGHT: Record<string, number> = {
  year: 1, month: 1.5, day: 2.5, hour: 1,
};

function isFarPair(posA: string, posB: string): boolean {
  return (posA === "year" && posB === "hour") || (posA === "hour" && posB === "year");
}

function cellWeight(posA: string, posB: string): number {
  const base = (PILLAR_WEIGHT[posA] ?? 1) * (PILLAR_WEIGHT[posB] ?? 1);
  return isFarPair(posA, posB) ? base * 0.5 : base;
}

function livingScore(f: PairFacts): number {
  let raw = 0;
  for (const c of f.branchMatrix) {
    const cellSum = c.relations.reduce((s, r) => s + (RELATION_SCORE[r] ?? 0), 0);
    raw += cellSum * cellWeight(c.posA, c.posB);
  }
  // 칸이 많을수록 절대값이 커지므로 −2~+2 로 눌러 담는다(축 간 무게를 맞춘다).
  return clamp(raw / 6, -2, 2);
}

/* ── 서로 채우는가 (용신·오행) ── */
function complementScore(f: PairFacts): number {
  const y = f.yongshinCompat;
  let s = 0;
  if (y.aHelpsB) s += 1;
  if (y.bHelpsA) s += 1;
  if (y.aHurtsB) s -= 1;
  if (y.bHurtsA) s -= 1;
  return clamp(s, -2, 2);
}

/* ── 때가 맞는가 ── */
// ★겹치는 해가 없다고 감점하지 않는다. "안 보인다"는 "나쁘다"가 아니다.
function timingScore(f: PairFacts): number {
  const n = f.fortuneCross.timingOverlapYears.length;
  if (n === 0) return 0;
  return n >= 2 ? 2 : 1;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function verdictOf(score: number): AxisVerdict {
  if (score >= 1) return "순";
  if (score <= -1) return "역";
  return "평";
}

/**
 * 5단계. 지시형(해라/하지 마라)이 아니라 "어떤 결의 관계인가"만 말한다.
 *
 * ★경계는 **실사용자 원국 1,200쌍 실측에서 뽑았다**(scripts/couple-decision-dist.ts).
 *   초안은 감으로 정한 ±1.5/±4.5 였고, 그 값으로는
 *     · 맨 끝 "많이 다른 두 사람" 이 0.4% — 5단계가 아니라 사실상 4단계였고
 *     · 전체가 위로 치우쳐 있었다(총점 중앙 1.00, 75% 3.00).
 *   목표 비율 10/25/35/22/8 의 분위수를 그대로 경계로 삼는다.
 *
 * ★총점이 위로 치우치는 구조적 이유: 시기 축은 **감점을 하지 않는다**
 *   (겹치는 해가 없다고 나쁜 게 아니다 — marriage-prompt:197 과 같은 태도).
 *   실측에서 시기 축은 순 68.7% / 평 31.3% / 역 0% 다. 그 편향을 경계가 흡수한다.
 *
 * ★경계를 다시 만지면 배경 3장 매핑(app/couple/result 의 VERDICT_BG)도 함께 봐야 한다 —
 *   라벨 문자열로 걸려 있다.
 */
const VERDICTS: Array<{ min: number; label: string }> = [
  { min: 4, label: "서로를 편하게 하는 결" },
  { min: 2, label: "무리 없이 굴러가는 결" },
  { min: 0, label: "맞춰가며 사는 결" },
  { min: -2, label: "손이 자주 가는 결" },
  { min: -Infinity, label: "많이 다른 두 사람" },
];

export function decideCouple(f: PairFacts): CoupleDecision {
  const neutralizedSet = new Set(f.reliability.neutralizedAxes);
  const neutralized: AxisKey[] = [];

  const raw: Record<AxisKey, number> = {
    마음: DAY_STEM_SCORE[f.dayStemRelation.type] ?? 0,
    생활: livingScore(f),
    보완: complementScore(f),
    시기: timingScore(f),
  };

  const axes = {} as Record<AxisKey, AxisResult>;
  let total = 0;

  for (const key of ["마음", "생활", "보완", "시기"] as AxisKey[]) {
    const dead = AXIS_DEPENDS_ON[key].some((dep) => neutralizedSet.has(dep));
    if (dead) {
      // ★0 으로 만들고 판정에서 뺀다. 플래그만 세우고 값을 흘려보내면
      //   시주 미상이 부풀린 가짜 상보 신호가 그대로 점수가 된다.
      neutralized.push(key);
      axes[key] = { score: 0, verdict: "모름" };
      continue;
    }
    const score = Math.round(raw[key] * 100) / 100;
    axes[key] = { score, verdict: verdictOf(score) };
    total += score;
  }

  total = Math.round(total * 100) / 100;
  const verdict = VERDICTS.find((v) => total >= v.min)!.label;

  return { axes, total, verdict, neutralized };
}
