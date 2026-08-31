import { test } from "node:test";
import assert from "node:assert/strict";

import { calculateBattleInteraction } from "./battle-interaction";
import type { EnrichedSajuData, KoreanElement } from "./saju-enrichment";
import type { FortuneResult } from "./saju-fortune";

// ★이 파일은 TDD 드라이버가 아니라 특성화(characterization) 테스트다.
// battle-interaction.ts 에는 지금까지 동작 테스트가 하나도 없었다(천간표 상수를
// 소스 파싱으로 비교하는 계약 테스트만 있었다). couple 엔진이 이 계산을 복사하지 않고
// import 해서 쓰려면 export 키워드를 붙여야 하는데, 배틀은 30일 62건 도는 현역이고
// 즉석 재계산이라 값이 조금이라도 바뀌면 사용자 결과가 바로 바뀐다.
// 그래서 만지기 "전에" 현재 동작을 봉인한다.

type Dist = Partial<Record<KoreanElement, number>>;

/** calculateBattleInteraction 이 실제로 읽는 필드만 채운 최소 픽스처 */
function mk(opts: {
  stem: string;
  dominant?: KoreanElement[];
  eokbu?: KoreanElement;
  gisin?: KoreanElement;
  dist?: Dist;
}): EnrichedSajuData {
  return {
    dayMaster: { stem: opts.stem },
    elementAnalysis: { dominant: opts.dominant ?? [], deficient: [] },
    yongshin: { eokbu: opts.eokbu ?? "목", gisin: opts.gisin ?? "금" },
    elementDist: {
      목: opts.dist?.목 ?? 0,
      화: opts.dist?.화 ?? 0,
      토: opts.dist?.토 ?? 0,
      금: opts.dist?.금 ?? 0,
      수: opts.dist?.수 ?? 0,
    },
  } as unknown as EnrichedSajuData;
}

/* ── 1. 일간 관계 ── */

test("[battle] 천간합이면 type=합 (甲己)", () => {
  const r = calculateBattleInteraction(mk({ stem: "甲" }), mk({ stem: "己" }));
  assert.equal(r.dayStemRelation.type, "합");
  assert.match(r.dayStemRelation.detail, /합 — 서로 끌리는 관계$/);
});

test("[battle] 천간충이면 type=충 (甲庚). 합이 충보다 먼저 검사된다", () => {
  const r = calculateBattleInteraction(mk({ stem: "甲" }), mk({ stem: "庚" }));
  assert.equal(r.dayStemRelation.type, "충");
  assert.match(r.dayStemRelation.detail, /충 — 충돌하는 관계$/);
});

test("[battle] 같은 오행이면 비화 (甲乙 — 둘 다 목)", () => {
  const r = calculateBattleInteraction(mk({ stem: "甲" }), mk({ stem: "乙" }));
  assert.equal(r.dayStemRelation.type, "비화");
  assert.equal(r.dayStemRelation.detail, "같은 목 기운 — 비화 관계");
});

test("[battle] 상생이면 생, detail 이 방향을 A/B 로 적는다 (甲목 → 丙화)", () => {
  const r = calculateBattleInteraction(mk({ stem: "甲" }), mk({ stem: "丙" }));
  assert.equal(r.dayStemRelation.type, "생");
  assert.equal(r.dayStemRelation.detail, "목→화 상생 — A가 B를 돕는 구조");
});

test("[battle] 상극이면 극 (甲목 ← 戊토: 목극토)", () => {
  const r = calculateBattleInteraction(mk({ stem: "甲" }), mk({ stem: "戊" }));
  assert.equal(r.dayStemRelation.type, "극");
  assert.equal(r.dayStemRelation.detail, "목→토 상극 — A가 B를 제압하는 구조");
});

/* ── 2. 용신 상보성 ── */

test("[battle] 서로 용신을 채우면 aHelpsB·bHelpsA 가 참", () => {
  const a = mk({ stem: "甲", dominant: ["화"], eokbu: "수" });
  const b = mk({ stem: "丙", dominant: ["수"], eokbu: "화" });
  const { yongshinCompat: y } = calculateBattleInteraction(a, b);

  assert.equal(y.aHelpsB, true);
  assert.equal(y.bHelpsA, true);
  assert.equal(y.summary, "서로의 용신을 채워주는 이상적 조합");
});

test("[battle] 서로 기신을 자극하면 aHurtsB·bHurtsA 가 참", () => {
  const a = mk({ stem: "甲", dominant: ["화"], eokbu: "목", gisin: "수" });
  const b = mk({ stem: "丙", dominant: ["수"], eokbu: "목", gisin: "화" });
  const { yongshinCompat: y } = calculateBattleInteraction(a, b);

  assert.equal(y.aHurtsB, true);
  assert.equal(y.bHurtsA, true);
  assert.equal(y.summary, "서로의 기신을 자극하는 조합 — 갈등 소지 높음");
});

test("[battle] 겹치는 게 없으면 상호작용 없음", () => {
  const a = mk({ stem: "甲", dominant: ["토"], eokbu: "목", gisin: "금" });
  const b = mk({ stem: "丙", dominant: ["토"], eokbu: "화", gisin: "수" });
  const { yongshinCompat: y } = calculateBattleInteraction(a, b);

  assert.deepEqual(
    { aHelpsB: y.aHelpsB, bHelpsA: y.bHelpsA, aHurtsB: y.aHurtsB, bHurtsA: y.bHurtsA },
    { aHelpsB: false, bHelpsA: false, aHurtsB: false, bHurtsA: false },
  );
  assert.equal(y.summary, "용신 관점에서 특별한 상호작용 없음");
});

// ★summary 에 용신·기신 오행 라벨이 문자열로 박힌다. couple 은 이 문장을 소비하면
// 안 된다(운영자 확정: 용신·기신 용어 미노출). 그 사실을 테스트로 못 박아 둔다.
test("[battle] 일방적 구조의 summary 에는 용신 오행 라벨이 박혀 있다", () => {
  const a = mk({ stem: "甲", dominant: ["화"], eokbu: "토", gisin: "금" });
  const b = mk({ stem: "丙", dominant: ["토"], eokbu: "화", gisin: "수" });
  const { yongshinCompat: y } = calculateBattleInteraction(a, b);

  assert.equal(y.aHelpsB, true);
  assert.equal(y.bHelpsA, true); // dominant 토 == a.eokbu 토
  assert.ok(y.summary.length > 0);

  // 한쪽만 도울 때 라벨이 새어나오는 경로
  const b2 = mk({ stem: "丙", dominant: ["수"], eokbu: "화", gisin: "목" });
  const y2 = calculateBattleInteraction(a, b2).yongshinCompat;
  assert.equal(y2.aHelpsB, true);
  assert.equal(y2.bHelpsA, false);
  assert.equal(y2.summary, "A가 B의 용신(화)을 채워주지만, 반대는 아닌 일방적 구조");
});

/* ── 3. 오행 상보율 ── */

test("[battle] 둘을 합쳐 5행이 다 차면 percent=100, 서로 채운 오행이 잡힌다", () => {
  const a = mk({ stem: "甲", dist: { 목: 3, 화: 2 } });
  const b = mk({ stem: "庚", dist: { 토: 2, 금: 3, 수: 1 } });
  const { elementCoverage: c } = calculateBattleInteraction(a, b);

  assert.equal(c.percent, 100);
  assert.deepEqual(c.combined, { 목: 3, 화: 2, 토: 2, 금: 3, 수: 1 });
  assert.deepEqual(c.deficientAlone.a, ["토", "금", "수"]);
  assert.deepEqual(c.deficientAlone.b, ["목", "화"]);
  assert.deepEqual(c.coveredByOther.a, ["토", "금", "수"]); // A 부족 → B가 채움
  assert.deepEqual(c.coveredByOther.b, ["목", "화"]); // B 부족 → A가 채움
});

test("[battle] 둘 다 없는 오행은 percent 에서 빠진다", () => {
  const a = mk({ stem: "甲", dist: { 목: 4 } });
  const b = mk({ stem: "乙", dist: { 목: 4 } });
  const { elementCoverage: c } = calculateBattleInteraction(a, b);

  assert.equal(c.percent, 20); // 목 하나만 채워짐
  assert.deepEqual(c.coveredByOther.a, []);
  assert.deepEqual(c.coveredByOther.b, []);
});

/* ── 4. 대운 동기화 ── */

function fortuneWithDaeun(
  pillars: Array<{ startAge: number; endAge: number; stem: string; pillar: string; tenStar: string }>,
): FortuneResult {
  return { daeun: { pillars } } as unknown as FortuneResult;
}

test("[battle] 대운·생년이 없으면 fortuneSync 는 undefined", () => {
  const r = calculateBattleInteraction(mk({ stem: "甲" }), mk({ stem: "丙" }));
  assert.equal(r.fortuneSync, undefined);

  const withFortuneOnly = calculateBattleInteraction(
    mk({ stem: "甲" }),
    mk({ stem: "丙" }),
    fortuneWithDaeun([{ startAge: 1, endAge: 100, stem: "甲", pillar: "甲子", tenStar: "비견" }]),
    fortuneWithDaeun([{ startAge: 1, endAge: 100, stem: "丙", pillar: "丙寅", tenStar: "식신" }]),
  );
  assert.equal(withFortuneOnly.fortuneSync, undefined, "생년이 없으면 undefined");
});

// ★★결함 문서화 — battle-interaction.ts:161 이 new Date().getFullYear() 를 읽는다.
// 나이가 현재 연도에서 나오므로 "같은 입력, 다른 결과"가 된다. 배틀은 즉석 재계산이라
// 드러나지 않았지만, couple 은 teaser 저장 → 나중에 결제 시 재계산 게이트를 거치므로
// 연말연시에 정당한 결제가 튕길 수 있다. couple 은 이 함수를 그대로 쓰지 않고
// currentYear 를 주입받는 형태로 다시 쓴다(Phase 1-2).
test("[battle] fortuneSync 는 현재 연도로 나이를 계산한다 (결정론 아님을 명시)", () => {
  const thisYear = new Date().getFullYear();
  const pillarsA = [
    { startAge: 1, endAge: 30, stem: "甲", pillar: "甲子", tenStar: "비견" },
    { startAge: 31, endAge: 40, stem: "丙", pillar: "丙寅", tenStar: "식신" },
  ];
  const pillarsB = [{ startAge: 1, endAge: 100, stem: "甲", pillar: "甲午", tenStar: "비견" }];

  // 만 나이가 아니라 세는 나이(currentYear - birthYear + 1)를 쓴다.
  const age30 = calculateBattleInteraction(
    mk({ stem: "甲" }), mk({ stem: "乙" }),
    fortuneWithDaeun(pillarsA), fortuneWithDaeun(pillarsB),
    thisYear - 29, thisYear - 29,
  );
  const age31 = calculateBattleInteraction(
    mk({ stem: "甲" }), mk({ stem: "乙" }),
    fortuneWithDaeun(pillarsA), fortuneWithDaeun(pillarsB),
    thisYear - 30, thisYear - 30,
  );

  assert.equal(age30.fortuneSync?.currentDaeunA, "甲子 (비견)");
  assert.equal(age31.fortuneSync?.currentDaeunA, "丙寅 (식신)");
  // 생년이 1년 다를 뿐인데 대운 구간이 넘어간다 = 해가 바뀌면 같은 사람의 값이 바뀐다.
});

test("[battle] 두 대운이 같은 오행이면 synced=true", () => {
  const thisYear = new Date().getFullYear();
  const p = (stem: string, pillar: string) => [
    { startAge: 1, endAge: 100, stem, pillar, tenStar: "비견" },
  ];
  const r = calculateBattleInteraction(
    mk({ stem: "甲" }), mk({ stem: "乙" }),
    fortuneWithDaeun(p("甲", "甲子")), fortuneWithDaeun(p("乙", "乙丑")),
    thisYear - 29, thisYear - 29,
  );

  assert.equal(r.fortuneSync?.synced, true);
  assert.equal(r.fortuneSync?.summary, "현재 대운이 둘 다 목 기운 — 같은 흐름");
});
