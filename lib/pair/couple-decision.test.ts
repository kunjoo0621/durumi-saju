import { test } from "node:test";
import assert from "node:assert/strict";

import type { PairFacts } from "./pair-facts";
import { decideCouple } from "./couple-decision";

// PairFacts 중 판정에 쓰이는 필드만 채운 최소 픽스처
function facts(over: Partial<PairFacts> = {}): PairFacts {
  return {
    currentYear: 2026,
    dayStemA: "甲",
    dayStemB: "辛",
    reliability: { aTimeUnknown: false, bTimeUnknown: false, neutralizedAxes: [] },
    dayStemRelation: { type: "비화", detail: "" },
    yongshinCompat: { aHelpsB: false, bHelpsA: false, aHurtsB: false, bHurtsA: false },
    elementCoverage: {
      percent: 60,
      combined: { 목: 1, 화: 1, 토: 1, 금: 0, 수: 0 },
      deficientAlone: { a: [], b: [] },
      coveredByOther: { a: [], b: [] },
    },
    branchMatrix: [],
    tenStarExchange: { aSeesB: null, bSeesA: null },
    spouseStarCross: { aHitByB: null, bHitByA: null },
    fortuneCross: { timingOverlapYears: [] },
    shinsalCross: { dohwaBoth: false, hongryeomBoth: false, chuneul: { a: false, b: false } },
    ...over,
  } as PairFacts;
}

const cell = (posA: string, posB: string, relations: string[]) =>
  ({ posA, posB, branchA: "子", branchB: "丑", relations }) as never;

/* ── 마음의 결 (일간) ── */

test("일간 축 — 합은 가장 높고 충은 가장 낮다", () => {
  const score = (type: string) =>
    decideCouple(facts({ dayStemRelation: { type, detail: "" } as never })).axes.마음.score;

  assert.equal(score("합"), 2);
  assert.equal(score("생"), 1);
  assert.equal(score("비화"), 0);
  assert.equal(score("극"), -1);
  assert.equal(score("충"), -2);
});

/* ── 생활의 결 (일지·궁위 가중) ── */

// ★사실 레이어는 궁위를 raw 로 두고, 가중은 여기서 준다.
// 부부 자리끼리 부딪히는 것과 년지끼리 부딪히는 것이 같은 무게면 판정이 뭉개진다.
test("생활 축 — 일지↔일지 충이 년지↔년지 충보다 무겁다", () => {
  const dayDay = decideCouple(facts({
    branchMatrix: [cell("day", "day", ["충"])],
  })).axes.생활.score;

  const yearYear = decideCouple(facts({
    branchMatrix: [cell("year", "year", ["충"])],
  })).axes.생활.score;

  assert.ok(dayDay < yearYear, `부부 자리가 더 무거워야 한다: day=${dayDay} year=${yearYear}`);
  assert.ok(dayDay < 0 && yearYear < 0, "둘 다 음수여야 한다");
});

test("생활 축 — 붙는 관계는 양수, 부딪히는 관계는 음수", () => {
  const hap = decideCouple(facts({ branchMatrix: [cell("day", "day", ["육합"])] })).axes.생활.score;
  const chung = decideCouple(facts({ branchMatrix: [cell("day", "day", ["충"])] })).axes.생활.score;

  assert.ok(hap > 0, `육합은 양수여야 한다: ${hap}`);
  assert.ok(chung < 0, `충은 음수여야 한다: ${chung}`);
});

// 巳申처럼 붙으면서 동시에 부딪히는 자리는 상쇄되어 중간이 된다 — 한쪽만 세면 왜곡된다.
test("생활 축 — 한 칸에 붙는 관계와 부딪히는 관계가 같이 있으면 상쇄된다", () => {
  const both = decideCouple(facts({
    branchMatrix: [cell("day", "day", ["육합", "형"])],
  })).axes.생활.score;
  const onlyHap = decideCouple(facts({
    branchMatrix: [cell("day", "day", ["육합"])],
  })).axes.생활.score;

  assert.ok(both < onlyHap, "형이 붙었는데 육합만 있을 때보다 높으면 안 된다");
});

/* ── 서로 채우는가 (용신·오행) ── */

test("보완 축 — 서로 용신을 채우면 최고, 서로 기신을 자극하면 최저", () => {
  const best = decideCouple(facts({
    yongshinCompat: { aHelpsB: true, bHelpsA: true, aHurtsB: false, bHurtsA: false },
  })).axes.보완.score;
  const worst = decideCouple(facts({
    yongshinCompat: { aHelpsB: false, bHelpsA: false, aHurtsB: true, bHurtsA: true },
  })).axes.보완.score;

  assert.equal(best, 2);
  assert.equal(worst, -2);
});

/* ── 때가 맞는가 ── */

test("시기 축 — 둘 다 열리는 해가 있으면 양수, 없으면 0 (음수가 아니다)", () => {
  const has = decideCouple(facts({
    fortuneCross: { timingOverlapYears: [2027, 2029] },
  })).axes.시기.score;
  const none = decideCouple(facts({
    fortuneCross: { timingOverlapYears: [] },
  })).axes.시기.score;

  assert.ok(has > 0);
  // ★없다고 감점하지 않는다. "겹치는 해가 안 보인다"는 "나쁘다"가 아니다 —
  //   marriage-prompt.ts:197 의 "인연 약함 단정 금지"와 같은 이유.
  assert.equal(none, 0);
});

/* ── 중화 축 처리 ── */

// ★Phase 1 은 플래그만 세웠다. 여기서 실제로 판정에서 빼야 한다.
// 안 빼면 시주 미상이 부풀린 가짜 상보 신호가 그대로 점수가 된다.
test("중화된 축은 판정에서 빠지고 어느 축이 빠졌는지 남는다", () => {
  const f = facts({
    reliability: { aTimeUnknown: true, bTimeUnknown: false, neutralizedAxes: ["오행상보", "용신상보", "지지매트릭스"] },
    yongshinCompat: { aHelpsB: true, bHelpsA: true, aHurtsB: false, bHurtsA: false },
    branchMatrix: [cell("day", "day", ["육합"])],
  });
  const d = decideCouple(f);

  assert.equal(d.axes.보완.score, 0, "중화된 보완 축이 점수를 냈다");
  assert.equal(d.axes.생활.score, 0, "중화된 생활 축이 점수를 냈다");
  assert.deepEqual([...d.neutralized].sort(), ["보완", "생활"]);
  // 일간·시기는 시주와 무관하므로 살아 있다
  assert.ok(!d.neutralized.includes("마음"));
});

/* ── 종합 판정 ── */

test("종합 판정은 5단계이고, 지시형 문구가 아니다", () => {
  const good = decideCouple(facts({
    dayStemRelation: { type: "합", detail: "" },
    yongshinCompat: { aHelpsB: true, bHelpsA: true, aHurtsB: false, bHurtsA: false },
    branchMatrix: [cell("day", "day", ["육합"])],
    fortuneCross: { timingOverlapYears: [2027] },
  }));
  const bad = decideCouple(facts({
    dayStemRelation: { type: "충", detail: "" },
    yongshinCompat: { aHelpsB: false, bHelpsA: false, aHurtsB: true, bHurtsA: true },
    branchMatrix: [cell("day", "day", ["충", "형"])],
  }));

  assert.notEqual(good.verdict, bad.verdict);
  assert.ok(good.total > bad.total);

  // "결혼해라 / 하지 마라" 단정은 명리적으로도 CS적으로도 불가하다.
  for (const v of [good.verdict, bad.verdict]) {
    for (const banned of ["해라", "하지 마", "안 된다", "결혼하", "헤어"]) {
      assert.ok(!v.includes(banned), `지시형 문구가 들어 있다: ${v}`);
    }
  }
});

test("모든 축이 중화되면 판정을 내지 않는다 (없는 걸 지어내지 않는다)", () => {
  const d = decideCouple(facts({
    reliability: { aTimeUnknown: true, bTimeUnknown: true, neutralizedAxes: ["오행상보", "용신상보", "지지매트릭스"] },
    dayStemRelation: { type: "비화", detail: "" },
  }));

  // 마음·시기는 살아 있으므로 판정은 나온다 — 전부 죽는 경우가 아니다
  assert.ok(d.verdict.length > 0);
  assert.equal(d.neutralized.length, 2);
});
