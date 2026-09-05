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

/* ── 3-layer 정합 (블록 ↔ 가드) ── */

// ★검토에서 실제로 발견한 문제: 블록이 십성 이름(정관/정재)을 그대로 실었는데
// couple-postprocess 는 그걸 "명리용어" 위반으로 잡는다. AI 에게 사실로 준 단어를
// 쓰면 위반이라고 막는 셈이라, 그대로 받아쓰면 무한 재작성 루프에 빠진다.
// 블록은 자기가 만든 가드를 스스로 통과해야 한다.
// (사내 선례: "긍정 예시 문장이 가드 금지 패턴에 안 걸린다(3-layer 정합)")
test("사실 블록 자신이 후처리 가드를 위반하지 않는다", async () => {
  const { checkCoupleReport } = await import("./couple-postprocess");
  const f = facts();
  const out = block(f);

  const { violations } = checkCoupleReport(out, {
    allowedYears: f.fortuneCross.timingOverlapYears,
  });
  assert.deepEqual(
    violations,
    [],
    `블록이 스스로 가드를 위반한다:\n${violations.map((v) => `${v.kind}: ${v.hit}`).join("\n")}`,
  );
});

test("중화가 있어도 블록은 가드를 위반하지 않는다", async () => {
  const { checkCoupleReport } = await import("./couple-postprocess");
  const f = facts({
    reliability: {
      aTimeUnknown: true, bTimeUnknown: true,
      neutralizedAxes: ["오행상보", "용신상보", "지지매트릭스"],
    },
  });
  const { violations } = checkCoupleReport(block(f), {
    allowedYears: f.fortuneCross.timingOverlapYears,
  });
  assert.deepEqual(violations, [], JSON.stringify(violations));
});

/* ── 프롬프트 본체 ── */

import { buildCouplePrompt, COUPLE_BLOCK_KEYS } from "./couple-prompt";

const prompt = (f: PairFacts) => buildCouplePrompt(f, decideCouple(f), { nameA: "너", nameB: "쟤" });

test("프롬프트에 사실 블록이 그대로 들어간다", () => {
  const f = facts();
  assert.ok(prompt(f).includes(block(f)), "사실 블록이 프롬프트에 없다");
});

// ★예시 문장을 넣지 않는다. 기존 결혼운은 프롬프트에 적은 예시가 177편 중 38편(21.5%)에
// 그대로 복제됐다. 대신 "쓰지 마라" 목록으로만 관리한다.
test("프롬프트에 따라 쓸 예시 문장이 없다", () => {
  const out = prompt(facts());
  for (const worn of ["웬만한 바람", "뿌리 깊은 나무", "겉으로는", "예를 들어"]) {
    assert.ok(!out.includes(worn), `예시가 들어 있다: ${worn}`);
  }
});

test("닳은 표현·반복 골격 금지가 명시된다", () => {
  const out = prompt(facts());
  assert.match(out, /같은 틀|골격|반복/, "골격 반복 금지 지시가 없다");
});

test("반말·존댓말 규칙이 기존 상품과 같다", () => {
  assert.match(prompt(facts()), /반말/);
});

test("출력 블록 키가 프롬프트와 상수에서 일치한다", () => {
  const out = prompt(facts());
  for (const k of COUPLE_BLOCK_KEYS) {
    assert.ok(out.includes(k), `프롬프트에 ${k} 가 없다`);
  }
});

/* ── 블록 검증 ── */

import { validateCoupleBlocks, validateCoupleRichness, applyCoupleGuards } from "./couple-postprocess";

test("필수 블록이 없으면 잡는다", () => {
  assert.ok(validateCoupleBlocks({}).length > 0);
  assert.ok(validateCoupleBlocks({ headline: "짧" }).length > 0);
});

test("다 있으면 통과한다", () => {
  const ok: Record<string, unknown> = {
    headline: "가".repeat(40),
    mindScene: "가".repeat(400),
    lifeScene: "가".repeat(400),
    complement: "가".repeat(400),
    timing: "가".repeat(300),
    advice: ["가".repeat(50), "나".repeat(50), "다".repeat(50)],
  };
  assert.deepEqual(validateCoupleBlocks(ok), []);
});

// ★실측에서 나온 문제: 프롬프트는 headline 을 "한 줄"로 지시하는데 초안은 전 블록에
// 40자 하한을 걸어, 35자짜리 정상 헤드라인이 반려되고 첫 probe 실행이 통째로 실패했다.
test("headline 은 짧아도 통과한다 (본문 하한과 다르다)", () => {
  const b = {
    headline: "끌리는 마음은 자연스러운데 일상은 치열하게 조율해야 하는 사이야.",
    mindScene: "가".repeat(400), lifeScene: "가".repeat(400),
    complement: "가".repeat(400), timing: "가".repeat(300),
    advice: ["가".repeat(50), "나".repeat(50), "다".repeat(50)],
  };
  assert.deepEqual(validateCoupleBlocks(b), []);
});

// ★20알인데 실측 총량이 731~801자였다(marriage 10알의 하한은 1900자).
test("본문 블록이 얇으면 잡는다", () => {
  const thin: Record<string, unknown> = {
    headline: "가".repeat(30),
    mindScene: "가".repeat(150), lifeScene: "가".repeat(150),
    complement: "가".repeat(150), timing: "가".repeat(100),
    advice: ["가".repeat(50), "나".repeat(50), "다".repeat(50)],
  };
  const issues = validateCoupleBlocks(thin);
  assert.ok(issues.some((i) => i.startsWith("mindScene")), JSON.stringify(issues));
});

// ★볼 수 없는 축에 400자를 요구하면 모델이 필러를 쓰거나 단정하게 된다 —
// "못 본 것 ≠ 없는 것" 원칙과 정면 충돌이라 하한을 면제한다.
test("중화된 축의 블록은 분량 하한을 면제한다", () => {
  const b: Record<string, unknown> = {
    headline: "가".repeat(30),
    mindScene: "가".repeat(400),
    lifeScene: "시간을 몰라 이 자리는 못 봤어.",
    complement: "가".repeat(400), timing: "가".repeat(300),
    advice: ["가".repeat(50), "나".repeat(50), "다".repeat(50)],
  };
  assert.ok(validateCoupleBlocks(b).length > 0, "면제 없이는 걸려야 한다");
  assert.deepEqual(validateCoupleBlocks(b, { deadBlocks: ["lifeScene"] }), []);
});

test("advice 는 3개 이상이어야 한다", () => {
  const b: Record<string, unknown> = {
    headline: "가".repeat(30),
    mindScene: "가".repeat(400), lifeScene: "가".repeat(400),
    complement: "가".repeat(400), timing: "가".repeat(300),
    advice: ["가".repeat(50)],
  };
  assert.ok(validateCoupleBlocks(b).some((i) => i.includes("advice")));
});

// ★가드는 문체를 건드리지 않는다 — 재미를 깎으면 안 된다.
test("가드는 위반만 돌려주고 멀쩡한 문장은 그대로 둔다", () => {
  const blocks = { headline: "돈 얘기가 나오면 너는 계산부터 하고, 쟤는 표정부터 봐." };
  const r = applyCoupleGuards(blocks, { allowedYears: [2029] });
  assert.deepEqual(r.violations, []);
  assert.equal((r.blocks as typeof blocks).headline, blocks.headline);
});

test("가드가 닳은 표현을 잡아낸다", () => {
  const r = applyCoupleGuards(
    { headline: "웬만한 바람에는 흔들리지 않아" },
    { allowedYears: [] },
  );
  assert.ok(r.violations.some((v) => v.includes("닳은표현")), JSON.stringify(r.violations));
});

/* ── 전체 리뷰 지적 ── */

// ★생·극은 방향이 뼈대다. 블록이 "한쪽이 다른 쪽을 밀어준다"로만 실으면 누가 미는지
// 알 수 없고, 이 상품의 핵심 지시("둘이 어떻게 다르게 반응하는지")를 쓰려면 LLM 이
// 방향을 지어낼 수밖에 없다. 사실 블록에 없으니 후처리도 못 잡는다 = 지어낸 채로 출고.
test("일간 생·극은 누가 누구인지 방향까지 실린다", () => {
  const gen = block(facts({ dayStemRelation: { type: "생", detail: "목→화 상생 — A가 B를 돕는 구조" } as never }));
  assert.match(gen, /너가 쟤를 밀어준다/, `방향이 없다:\n${gen}`);

  const genRev = block(facts({ dayStemRelation: { type: "생", detail: "화→목 상생 — B가 A를 돕는 구조" } as never }));
  assert.match(genRev, /쟤가 너를 밀어준다/, `역방향이 없다:\n${genRev}`);

  const geuk = block(facts({ dayStemRelation: { type: "극", detail: "목→토 상극 — A가 B를 제압하는 구조" } as never }));
  assert.match(geuk, /너가 쟤를 누른다/, `극 방향이 없다:\n${geuk}`);
});

test("합·충·비화는 방향이 없으므로 그대로 쓴다", () => {
  assert.match(block(facts({ dayStemRelation: { type: "합", detail: "" } as never })), /서로 끌어당긴다/);
  assert.match(block(facts({ dayStemRelation: { type: "충", detail: "" } as never })), /정면으로 부딪힌다/);
});

// 총량 soft 검사 — 블록 하한을 아슬아슬하게 넘기며 전체가 얇아지는 걸 막는다.
test("총량이 얇으면 재생성 노트를 남긴다 (실패시키지는 않는다)", () => {
  const thin = { a: "가".repeat(500) };
  assert.ok(validateCoupleRichness(thin).length > 0);

  const fat = { a: "가".repeat(1700) };
  assert.deepEqual(validateCoupleRichness(fat), []);
});
