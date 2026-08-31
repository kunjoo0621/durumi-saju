// 명리 사실 산출의 공용 원시 헬퍼.
//
// 왜 있는가: 같은 헬퍼가 marriage-facts.ts:42 · career-facts.ts:63 ·
// wealth-facts.ts:58 에 세 번 복사돼 있다. career-facts.ts:80 의 주석이
// "wealth-facts.ts와 동일 — 공유 함수로 뽑지 않음: 광범위 리팩토링 금지"라고
// 스스로 적어 둔, 의식적으로 진 빚이다. 신상품 3종이 여기에 네 번째·다섯 번째
// 복사본을 더하면 관계 명리까지 갈라지므로 먼저 뽑아 둔다.
//
// ★기존 3파일은 건드리지 않는다. 회귀 리스크 0을 유지하고, 신규 코드만 이 모듈을
//   쓴다. 레거시 치환은 이 계획의 스코프 밖이다(docs/superpowers/specs 참조).
//
// ★지금은 couple(상품 1)이 실제로 쓰는 것만 뽑는다. 가중 십성 모델
//   (collectWeightedHits·sumWeight·STEM_WEIGHT 등)은 child(상품 2)가 소비할 때
//   같은 자리로 옮긴다 — 소비자 없는 코드를 미리 만들지 않는다.

import { getTenStar, STEM_ELEMENT } from "./utils/saju-enrichment";

export const PILLARS = ["year", "month", "day", "hour"] as const;
export type PillarKey = (typeof PILLARS)[number];

/** "정관(正官)" → "정관". 병기가 없으면 그대로 둔다. */
export function bareStar(label: string): string {
  return label.replace(/\(.*\)/, "");
}

/**
 * 일간(dayStem) 기준으로 targetStem 이 무슨 십성인지. 병기 없는 이름으로 돌려준다.
 * 방향이 있는 함수다 — tenStarOf(A, B) 와 tenStarOf(B, A) 는 다른 값이다.
 * 천간을 알 수 없으면 null 을 돌려주고, 호출부가 분기한다(임의 기본값 금지).
 */
export function tenStarOf(dayStem: string, targetStem: string): string | null {
  const dm = STEM_ELEMENT[dayStem];
  const t = STEM_ELEMENT[targetStem];
  if (!dm || !t) return null;
  return bareStar(getTenStar(dm.element, dm.yin_yang, t.element, t.yin_yang));
}
