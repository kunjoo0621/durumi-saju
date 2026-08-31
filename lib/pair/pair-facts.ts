// 두 원국의 관계 사실(PairFacts) 산출 — couple·child 가 공유하는 결정론 코어.
//
// 설계 원칙 두 가지가 이 파일의 전부다.
//
// ① **오늘 날짜를 읽지 않는다.** `currentYear` 를 반드시 인자로 받는다.
//    기존 `battle-interaction.ts:161` 은 `new Date().getFullYear()` 를 읽는다. 배틀은
//    즉석 재계산이라 드러나지 않았지만, couple 은 teaser 를 저장해 두고 나중에 결제할 때
//    "판정이 그새 바뀌었나"를 재계산해 대조한다(marriage analyze 미러). 12/31 teaser →
//    1/1 analyze 면 나이가 한 살 올라 대운 구간이 넘어가고, **정당한 결제가 409로 튕긴다.**
//    그래서 연도를 주입받아 산출물에 박고, 재계산도 저장된 연도로 한다.
//
// ② **못 본 축을 "관계 없음"으로 처리하지 않는다.** 시주 미상이면 어느 축이 죽었는지
//    `reliability.neutralizedAxes` 에 남긴다. 실제로 없는 것과 못 본 것이 섞이면 판정이
//    거짓말이 된다. 선례: `pet-compat-saju.ts:376` 의 tier 중화(지시-only 가드는 샌다).

import {
  calcDayStemRelation,
  calcElementCoverage,
  calcYongshinCompat,
} from "@/lib/utils/battle-interaction";
import type { TimingWindow } from "@/lib/marriage-facts";
import { BRANCH_INFO, type EnrichedSajuData } from "@/lib/utils/saju-enrichment";
import { PILLARS, tenStarOf, type PillarKey } from "@/lib/facts-core";

import { getBranchRelations, type BranchRelationKind } from "./relation-tables";

export type PairAxis = "일간관계" | "지지매트릭스" | "오행상보" | "용신상보" | "타이밍";

export interface PairReliability {
  aTimeUnknown: boolean;
  bTimeUnknown: boolean;
  /** 시주 미상 등으로 신뢰도가 떨어진 축. 프롬프트가 이 축을 단정하면 안 된다. */
  neutralizedAxes: PairAxis[];
}

/**
 * 두 원국의 지지 한 쌍. **궁위(posA/posB)를 반드시 들고 다닌다.**
 * 평탄 카운트(원진 N개)로 뭉개면 년↔시 원진과 월↔월 원진이 같은 1이 된다.
 * 자리마다 뜻이 다르므로(년=뿌리, 월=사회, 일=배우자궁, 시=말년·자식) 가중은
 * 판정 레이어가 이 궁위를 보고 준다. 사실 레이어는 raw 로 남긴다.
 */
export interface BranchCell {
  posA: PillarKey;
  posB: PillarKey;
  branchA: string;
  branchB: string;
  /** 성립하는 관계 전부. 하나만 고르면 巳申 형합처럼 절반이 사라진다. */
  relations: BranchRelationKind[];
}

export interface PairFacts {
  /** 산출에 쓰인 연도. 저장해 두고 재계산 시 그대로 다시 넣는다. */
  currentYear: number;
  reliability: PairReliability;
  dayStemRelation: ReturnType<typeof calcDayStemRelation>;
  /** ★summary 는 배틀 프롬프트용 프로즈(용신·기신 라벨이 박혀 있다)라 싣지 않는다. */
  yongshinCompat: Omit<ReturnType<typeof calcYongshinCompat>, "summary">;
  elementCoverage: ReturnType<typeof calcElementCoverage>;
  /** 관계가 성립하는 칸만 담는다. 시주 미상이면 그 기둥 칸은 아예 만들지 않는다. */
  branchMatrix: BranchCell[];
  /**
   * 십성 교차 — "상대 일간이 나에게 무슨 별인가". 상대 원국이 들어와야만 나오는 값이라
   * 1인 상품(결혼운 10알)이 구조적으로 낼 수 없다. **방향에 따라 값이 다르다** —
   * 대칭으로 만들면 이 축이 죽는다. 천간을 알 수 없으면 null(호출부가 분기).
   */
  tenStarExchange: { aSeesB: string | null; bSeesA: string | null };
  /**
   * 배우자성 교차 — "상대가 내 짝 자리에 실제로 걸리는가".
   *
   * ★운영자 확정(§1-1): **동성/이성 분기를 만들지 않는다.** 배우자성은 각자 자기 성별로
   * 자기 원국에서 뽑는 값이고(여명=관성, 남명=재성 — marriage-facts.ts:157 과 동일),
   * "상대 일간·상대 일지 정기가 거기 걸리는가"의 대조는 상대 성별과 무관하게 성립한다.
   * 분기 플래그 없이도 동성 커플에서 양쪽 결과가 자연스럽게 갈린다.
   *
   * 서술할 때 "남편·아내" 같은 혼인 신분어를 쓰지 않는 것은 프롬프트·postprocess 의 몫이다.
   */
  spouseStarCross: { aHitByB: boolean; bHitByA: boolean };
  /**
   * 타이밍 교차 — **둘 다 열리는 해**. 1인 상품이 구조적으로 낼 수 없는 산출이라
   * 20알(2인)의 값어치를 가장 직접적으로 보여주는 축이다.
   *
   * ★이미 지나간 해는 뺀다. `timingWindows` 는 `currentYear − 1` 부터 담기므로
   * (marriage-facts.ts:300) 단순 교집합이면 작년이 "앞으로 둘 다 열리는 해"로 나간다.
   */
  fortuneCross: { timingOverlapYears: number[] };
  /**
   * 신살 교차.
   * - 도화·홍염은 **양쪽에 다 있을 때**를 따로 잡는다(한쪽만 있는 것과 결이 다르다).
   * - 천을귀인은 한쪽만 있어도 상대에게 작용하는 결로 보므로 각자 보유 여부를 남긴다.
   * ★신살 키는 saju-enrichment 의 SHINSAL_DEFS 정본을 그대로 쓴다(dohwa/hongryeom/chuneul).
   */
  shinsalCross: {
    dohwaBoth: boolean;
    hongryeomBoth: boolean;
    chuneul: { a: boolean; b: boolean };
  };
}

function hasShinsal(e: EnrichedSajuData, key: string): boolean {
  return Boolean(e.shinsal?.matches?.some((m) => m.key === key));
}

export type Sex = "male" | "female";

/** 여명은 관성, 남명은 재성이 배우자성 (marriage-facts.ts:157 과 같은 정의) */
function spouseSetOf(sex: Sex): Set<string> {
  return sex === "female"
    ? new Set(["정관", "편관"])
    : new Set(["정재", "편재"]);
}

/** 상대의 일간과 일지 정기(본기)가 내 배우자성에 걸리는지 */
/** 양쪽 타이밍의 교집합. 지나간 해는 뺀다. */
function intersectTiming(a?: TimingWindow[], b?: TimingWindow[]): number[] {
  if (!a?.length || !b?.length) return [];
  const future = (w: TimingWindow[]) =>
    new Set(w.filter((x) => !x.isPast).map((x) => x.year));
  const setA = future(a);
  const setB = future(b);
  return [...setA].filter((y) => setB.has(y)).sort((x, y) => x - y);
}

/** 상대의 일간과 일지 정기(본기)가 내 배우자성에 걸리는지 */
function spouseStarHit(
  mySex: Sex,
  myDayStem: string,
  otherDayStem: string,
  otherDayBranch: string | null,
): boolean {
  const set = spouseSetOf(mySex);

  const byStem = tenStarOf(myDayStem, otherDayStem);
  if (byStem && set.has(byStem)) return true;

  // 지장간 본기(index 0) = 그 지지의 정기. 사람으로 온 배우자성의 두 번째 경로.
  const jeonggi = otherDayBranch ? BRANCH_INFO[otherDayBranch]?.jijanggan?.[0]?.stem : null;
  if (!jeonggi) return false;
  const byBranch = tenStarOf(myDayStem, jeonggi);
  return Boolean(byBranch && set.has(byBranch));
}

/** "戊辰" → "辰". 기둥이 없으면(시주 미상) null. */
function branchOf(pillar: string | null | undefined): string | null {
  if (!pillar || pillar.length < 2) return null;
  return pillar.slice(1, 2);
}

/**
 * 4×4 전수 대조. **못 본 칸은 만들지 않는다** — "관계 없음"으로 남기면 실제로
 * 관계가 없는 칸과 구분이 사라져서, 시주 미상인 사람이 "부딪히는 데가 적은 사람"으로
 * 둔갑한다.
 */
function buildBranchMatrix(a: EnrichedSajuData, b: EnrichedSajuData): BranchCell[] {
  const out: BranchCell[] = [];
  for (const posA of PILLARS) {
    const branchA = branchOf(a.pillars?.[posA]);
    if (!branchA) continue;
    for (const posB of PILLARS) {
      const branchB = branchOf(b.pillars?.[posB]);
      if (!branchB) continue;
      const relations = getBranchRelations(branchA, branchB);
      if (relations.length === 0) continue;
      out.push({ posA, posB, branchA, branchB, relations });
    }
  }
  return out;
}

/**
 * 시주 미상일 때 신뢰도가 떨어지는 축.
 *
 * - `지지매트릭스`: 4×4 가 3×3 이 된다(시지가 없다).
 * - `오행상보`: `calcElementCoverage` 는 `va === 0` 으로 결핍을 판정하는데(battle-interaction.ts:138),
 *   시주 미상은 8글자가 아니라 6글자라 결핍이 **구조적으로 더 뜬다**. 그러면 상대가
 *   "채워준다"는 신호가 가짜로 커진다 — 못 본 축이 "관계 없음"이 아니라 **"상보 있음"으로
 *   조작되는 방향**이라 지지매트릭스보다 오히려 위험하다.
 * - `용신상보`: 용신·기신은 강약에서 나오고 강약은 시주에 의존한다(CLAUDE.md 의 시간 미입력
 *   보정이 있는 이유).
 *
 * `일간관계`는 시주와 무관하다 — 시간을 몰라도 일간은 확정된다. `타이밍`은 대운·세운 기반이라
 * 대운수가 시주에 의존하지 않으므로 여기 넣지 않는다.
 */
const TIME_DEPENDENT_AXES: PairAxis[] = ["지지매트릭스", "오행상보", "용신상보"];

export function derivePairFacts(
  a: EnrichedSajuData,
  b: EnrichedSajuData,
  opts: {
    currentYear: number;
    sexA?: Sex;
    sexB?: Sex;
    /** 각자의 deriveMarriageFacts(...).timingWindows. 호출부가 넣어 준다. */
    timingA?: TimingWindow[];
    timingB?: TimingWindow[];
  },
): PairFacts {
  const aTimeUnknown = Boolean(a.isTimeUnknown);
  const bTimeUnknown = Boolean(b.isTimeUnknown);

  // 한쪽만 몰라도 그 축의 대조는 이미 반쪽이다 — 둘 다 모를 때만 중화하면 늦다.
  const neutralizedAxes: PairAxis[] =
    aTimeUnknown || bTimeUnknown ? [...TIME_DEPENDENT_AXES] : [];

  // ★배틀의 순수 계산을 복사하지 않고 그대로 호출한다(정본 한 벌).
  const { summary: _yongshinProse, ...yongshinCompat } = calcYongshinCompat(a, b);

  return {
    currentYear: opts.currentYear,
    reliability: { aTimeUnknown, bTimeUnknown, neutralizedAxes },
    dayStemRelation: calcDayStemRelation(a.dayMaster.stem, b.dayMaster.stem),
    yongshinCompat,
    elementCoverage: calcElementCoverage(a, b),
    branchMatrix: buildBranchMatrix(a, b),
    tenStarExchange: {
      aSeesB: tenStarOf(a.dayMaster.stem, b.dayMaster.stem),
      bSeesA: tenStarOf(b.dayMaster.stem, a.dayMaster.stem),
    },
    spouseStarCross: {
      aHitByB: opts.sexA
        ? spouseStarHit(opts.sexA, a.dayMaster.stem, b.dayMaster.stem, branchOf(b.pillars?.day))
        : false,
      bHitByA: opts.sexB
        ? spouseStarHit(opts.sexB, b.dayMaster.stem, a.dayMaster.stem, branchOf(a.pillars?.day))
        : false,
    },
    fortuneCross: { timingOverlapYears: intersectTiming(opts.timingA, opts.timingB) },
    shinsalCross: {
      dohwaBoth: hasShinsal(a, "dohwa") && hasShinsal(b, "dohwa"),
      hongryeomBoth: hasShinsal(a, "hongryeom") && hasShinsal(b, "hongryeom"),
      chuneul: { a: hasShinsal(a, "chuneul"), b: hasShinsal(b, "chuneul") },
    },
  };
}
