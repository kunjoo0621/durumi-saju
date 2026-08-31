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
import type { EnrichedSajuData } from "@/lib/utils/saju-enrichment";

export type PairAxis = "일간관계" | "지지매트릭스" | "오행상보" | "용신상보" | "타이밍";

export interface PairReliability {
  aTimeUnknown: boolean;
  bTimeUnknown: boolean;
  /** 시주 미상 등으로 신뢰도가 떨어진 축. 프롬프트가 이 축을 단정하면 안 된다. */
  neutralizedAxes: PairAxis[];
}

export interface PairFacts {
  /** 산출에 쓰인 연도. 저장해 두고 재계산 시 그대로 다시 넣는다. */
  currentYear: number;
  reliability: PairReliability;
  dayStemRelation: ReturnType<typeof calcDayStemRelation>;
  /** ★summary 는 배틀 프롬프트용 프로즈(용신·기신 라벨이 박혀 있다)라 싣지 않는다. */
  yongshinCompat: Omit<ReturnType<typeof calcYongshinCompat>, "summary">;
  elementCoverage: ReturnType<typeof calcElementCoverage>;
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
  opts: { currentYear: number },
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
  };
}
