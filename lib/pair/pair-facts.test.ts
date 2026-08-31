import { test } from "node:test";
import assert from "node:assert/strict";

import type { EnrichedSajuData, KoreanElement } from "@/lib/utils/saju-enrichment";

import { derivePairFacts } from "./pair-facts";

/** derivePairFacts 가 실제로 읽는 필드만 채운 최소 픽스처 */
function mk(opts: {
  stem: string;
  timeUnknown?: boolean;
  dominant?: KoreanElement[];
  eokbu?: KoreanElement;
  gisin?: KoreanElement;
  dist?: Partial<Record<KoreanElement, number>>;
}): EnrichedSajuData {
  return {
    dayMaster: { stem: opts.stem },
    isTimeUnknown: opts.timeUnknown ?? false,
    elementAnalysis: { dominant: opts.dominant ?? [], deficient: [] },
    yongshin: { eokbu: opts.eokbu ?? "목", gisin: opts.gisin ?? "금" },
    elementDist: {
      목: opts.dist?.목 ?? 0, 화: opts.dist?.화 ?? 0, 토: opts.dist?.토 ?? 0,
      금: opts.dist?.금 ?? 0, 수: opts.dist?.수 ?? 0,
    },
  } as unknown as EnrichedSajuData;
}

const YEAR = { currentYear: 2026 };

// ★결정론 — battle-interaction.ts:161 이 new Date().getFullYear() 를 읽어서
// "같은 입력, 다른 결과"가 되는 문제를 pair 에서는 구조적으로 막는다.
// 연도는 반드시 인자로 들어오고 산출물에 그대로 박혀 저장된다.
test("currentYear 는 인자로 받아 산출물에 박힌다 (오늘 날짜를 읽지 않는다)", () => {
  const a = mk({ stem: "甲" });
  const b = mk({ stem: "己" });

  assert.equal(derivePairFacts(a, b, { currentYear: 2026 }).currentYear, 2026);
  assert.equal(derivePairFacts(a, b, { currentYear: 2027 }).currentYear, 2027);
});

// ★시주 미상 — 못 본 축을 "관계 없음"으로 처리하면 실제로 없는 것과 섞인다.
// 어느 축이 죽었는지 기록해 두어야 프롬프트가 단정하지 못한다.
test("양쪽 다 시간을 알면 죽은 축이 없다", () => {
  const f = derivePairFacts(mk({ stem: "甲" }), mk({ stem: "己" }), YEAR);

  assert.equal(f.reliability.aTimeUnknown, false);
  assert.equal(f.reliability.bTimeUnknown, false);
  assert.deepEqual(f.reliability.neutralizedAxes, []);
});

test("한쪽이라도 시간을 모르면 지지매트릭스·오행상보·용신상보 축이 중화 대상이 된다", () => {
  const aUnknown = derivePairFacts(
    mk({ stem: "甲", timeUnknown: true }), mk({ stem: "己" }), YEAR,
  );

  assert.equal(aUnknown.reliability.aTimeUnknown, true);
  assert.equal(aUnknown.reliability.bTimeUnknown, false);
  assert.deepEqual(
    [...aUnknown.reliability.neutralizedAxes].sort(),
    ["오행상보", "용신상보", "지지매트릭스"],
  );
});

// ★오행상보가 중화 대상인 이유 — calcElementCoverage(battle-interaction.ts:126)는
// va===0 으로 결핍을 판정한다. 시주 미상이면 6글자라 결핍이 구조적으로 더 뜨고,
// 상대가 "채워준다"는 가짜 양(+) 신호가 커진다. 못 본 축이 "관계 없음"이 아니라
// "상보 있음"으로 조작되는 방향이라 지지매트릭스보다 오히려 위험하다.
test("양쪽 다 시간을 모르면 죽은 축은 같고 플래그만 둘 다 선다", () => {
  const both = derivePairFacts(
    mk({ stem: "甲", timeUnknown: true }), mk({ stem: "己", timeUnknown: true }), YEAR,
  );

  assert.equal(both.reliability.aTimeUnknown, true);
  assert.equal(both.reliability.bTimeUnknown, true);
  assert.deepEqual(
    [...both.reliability.neutralizedAxes].sort(),
    ["오행상보", "용신상보", "지지매트릭스"],
  );
});

// 일간 관계는 시주와 무관하다 — 시간을 몰라도 일간은 확정되므로 중화 대상이 아니다.
test("일간 관계 축은 시주 미상에도 살아 있다", () => {
  const f = derivePairFacts(
    mk({ stem: "甲", timeUnknown: true }), mk({ stem: "己", timeUnknown: true }), YEAR,
  );

  assert.ok(!f.reliability.neutralizedAxes.includes("일간관계"));
  assert.equal(f.dayStemRelation.type, "합"); // 甲己합
});

// ★운영자 확정(§1-0) 강제 — 배틀의 summary 문자열에는 "A가 B의 용신(화)을 채워주지만…"
// 처럼 용신·기신 오행 라벨이 박혀 있다(battle-interaction.test.ts 로 확인함).
// PairFacts 가 그걸 실어 나르면 프롬프트로 새고, postprocess 가 뒤에서 지우는 술래잡기가 된다.
// 애초에 안 싣는다.
test("PairFacts 는 배틀의 프로즈(summary)를 싣지 않는다 — 구조 필드만", () => {
  const f = derivePairFacts(
    mk({ stem: "甲", dominant: ["화"], eokbu: "토", gisin: "금" }),
    mk({ stem: "丙", dominant: ["수"], eokbu: "화", gisin: "목" }),
    YEAR,
  );

  assert.ok(!("summary" in f.yongshinCompat), "yongshinCompat 에 summary 가 있으면 안 된다");
  assert.deepEqual(Object.keys(f.yongshinCompat).sort(), ["aHelpsB", "aHurtsB", "bHelpsA", "bHurtsA"]);

  // 산출물 전체 어디에도 용신·기신·희신 용어가 문자열로 들어가 있으면 안 된다.
  const dumped = JSON.stringify(f);
  for (const banned of ["용신", "기신", "희신"]) {
    assert.ok(!dumped.includes(banned), `산출물에 '${banned}' 이 새어 있다: ${dumped}`);
  }
});

// 결정론 잠금 — 연도를 주입하므로 이제 성립한다(오늘 날짜를 읽으면 성립하지 않는다).
test("같은 입력·같은 연도면 결과가 완전히 같다 (결정론)", () => {
  const a = mk({ stem: "甲", dominant: ["화"], dist: { 목: 3, 화: 2 } });
  const b = mk({ stem: "庚", dominant: ["수"], dist: { 토: 2, 금: 3, 수: 1 } });

  assert.deepEqual(
    derivePairFacts(a, b, YEAR),
    derivePairFacts(a, b, YEAR),
  );
});
