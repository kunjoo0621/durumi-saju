import { test } from "node:test";
import assert from "node:assert/strict";

import { decideCouple } from "./couple-decision";
import { buildCoupleFactsBlock } from "./couple-prompt";
import type { PairFacts } from "./pair-facts";

function facts(over: Partial<PairFacts> = {}): PairFacts {
  return {
    currentYear: 2026,
    reliability: { aTimeUnknown: false, bTimeUnknown: false, neutralizedAxes: [] },
    dayStemRelation: { type: "합", detail: "갑기합 — 서로 끌리는 관계" },
    yongshinCompat: { aHelpsB: true, bHelpsA: false, aHurtsB: false, bHurtsA: true },
    elementCoverage: {
      percent: 80,
      combined: { 목: 2, 화: 1, 토: 1, 금: 1, 수: 0 },
      deficientAlone: { a: ["수"], b: ["목"] },
      coveredByOther: { a: [], b: ["목"] },
    },
    branchMatrix: [
      { posA: "day", posB: "day", branchA: "辰", branchB: "戌", relations: ["충"] },
      { posA: "year", posB: "month", branchA: "子", branchB: "未", relations: ["해", "원진"] },
    ],
    tenStarExchange: { aSeesB: "정관", bSeesA: "정재" },
    spouseStarCross: { aHitByB: true, bHitByA: false },
    fortuneCross: { timingOverlapYears: [2029, 2031] },
    shinsalCross: { dohwaBoth: true, hongryeomBoth: false, chuneul: { a: true, b: false } },
    ...over,
  } as PairFacts;
}

const block = (f: PairFacts) => buildCoupleFactsBlock(f, decideCouple(f), { nameA: "너", nameB: "쟤" });

/* ── 중화 축 차단 (Phase 2 완료 조건) ── */

// ★프롬프트 규칙이 "facts 블록 외 근거 금지"이므로, **블록에 들어간 것은 곧 허가된 것**이다.
// 못 믿는 축의 값이 블록에 실리면 LLM 이 그걸로 문장을 쓰고 postprocess 는 이의를
// 제기할 수 없다(블록 안에 있으니까). 그래서 아예 안 싣는다.
test("중화된 축의 값은 사실 블록에 아예 실리지 않는다", () => {
  const f = facts({
    reliability: {
      aTimeUnknown: true, bTimeUnknown: false,
      neutralizedAxes: ["오행상보", "용신상보", "지지매트릭스"],
    },
  });
  const out = block(f);

  // 오행 상보·용신 상보 값이 새면 안 된다
  assert.ok(!out.includes("80%"), `오행 상보율이 샜다:\n${out}`);
  assert.ok(!out.includes("辰"), `중화된 지지 매트릭스가 샜다:\n${out}`);
  assert.ok(!out.includes("戌"), `중화된 지지 매트릭스가 샜다:\n${out}`);

  // 대신 "이 축은 볼 수 없다"는 사실이 명시된다
  assert.match(out, /시간을 몰라|알 수 없|볼 수 없/, "죽은 축을 알리는 문장이 없다");
});

test("중화가 없으면 살아 있는 축이 다 실린다", () => {
  const out = block(facts());
  assert.ok(out.includes("辰") && out.includes("戌"), "지지 매트릭스가 안 실렸다");
  assert.match(out, /2029/, "타이밍 교차가 안 실렸다");
});

/* ── 용어 차단 ── */

// 운영자 확정(§1-0) — 등급·강약·용신 용어는 화면에도 글에도 안 나온다.
// 블록에 있으면 LLM 이 그대로 쓴다. 블록 단계에서 막는다.
test("사실 블록에 등급·용신·강약 용어가 없다", () => {
  const out = block(facts());
  for (const banned of ["용신", "기신", "희신", "신약", "신강", "등급", "점수", "S등급"]) {
    assert.ok(!out.includes(banned), `블록에 '${banned}' 이 있다:\n${out}`);
  }
});

/* ── 궁위를 사람 말로 ── */

test("궁위가 한자 자리 이름이 아니라 뜻으로 나온다", () => {
  const out = block(facts());
  assert.match(out, /부부 자리|배우자 자리/, "일지를 사람 말로 안 옮겼다");
  assert.ok(!out.includes("일지"), "명리 용어 '일지'가 그대로 있다");
  assert.ok(!out.includes("posA"), "내부 필드명이 샜다");
});

/* ── couple 만의 무기 ── */

// ★결혼운(1인)은 상대를 상상해서 그린다. couple 은 상대 원국이 실제로 있으므로
// "같은 상황에서 둘이 어떻게 다르게 반응하는가"를 쓸 수 있다 — 1인 상품이
// 구조적으로 못 쓰는 것이고, 여기가 재미의 원천이다.
test("두 사람의 반응 차이를 쓰라는 지시가 들어 있다", () => {
  const out = block(facts());
  assert.match(out, /반응|서로 다르게|둘이 어떻게/, "반응 차이 지시가 없다");
});

test("두 사람 호칭이 블록에 반영된다", () => {
  const out = buildCoupleFactsBlock(facts(), decideCouple(facts()), { nameA: "민수", nameB: "지영" });
  assert.ok(out.includes("민수") && out.includes("지영"));
});
