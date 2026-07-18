import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMarriageGuards, validateMarriageBlocks } from "./marriage-postprocess";

const facts: any = { sex: "female", maritalStatus: "기혼", dohwa: true };

test("이혼·사별·외도 예언 문장 제거", () => {
  const parsed = { advice: [{ text: "곧 이혼수가 있습니다.", tag: "[근거:일지충]" }] };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(violations.some(v => v.includes("단정")));
  assert.equal(blocks.advice.length, 0);
});

test("근거 태그 없는 조언 컷", () => {
  const parsed = { advice: [{ text: "대화를 많이 하세요.", tag: "" }] };
  const { blocks } = applyMarriageGuards(parsed, facts, "");
  assert.equal(blocks.advice.length, 0);
});

test("금지 신살(과숙살) 언급 제거", () => {
  const parsed = { spousePalace: "과숙살이 있어 외롭습니다.", advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(violations.some(v => v.includes("금지신살")));
  assert.ok(!blocks.spousePalace.includes("과숙살"));
});

test("금지 신살(괴강살) 언급 제거 — 일주 파생 지어내기 2차 안전망", () => {
  const parsed = { spouseStar: "일주가 경진이라 괴강살이 있어 기가 세다.", advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(violations.some(v => v.includes("금지신살")));
  assert.ok(!blocks.spouseStar.includes("괴강살"));
});

test("금지 신살(백호살·양인살) 언급 제거", () => {
  const parsed = {
    spousePalace: "일지에 백호살이 있고 시주엔 양인살도 겹칩니다.",
    advice: [],
  };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(violations.filter(v => v.includes("금지신살")).length >= 2);
  assert.ok(!blocks.spousePalace.includes("백호살"));
  assert.ok(!blocks.spousePalace.includes("양인살"));
});

test("advice가 아닌 중첩 객체 속 단정 예언도 재귀적으로 제거", () => {
  const parsed = { extraSection: { sub: { text: "과숙살이 있고 이혼수도 보입니다." } }, advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(!blocks.extraSection.sub.text.includes("과숙살"));
  assert.ok(!blocks.extraSection.sub.text.includes("이혼수"));
  assert.ok(violations.some(v => v.includes("단정 예언 제거")));
});

test("줄바꿈으로 구분된 한국어 블록: 문제되는 한 줄만 제거하고 나머지 줄은 보존", () => {
  const parsed = {
    spousePalace:
      "결혼 생활은 대체로 안정적입니다.\n하지만 외도 가능성도 있습니다.\n서로 배려하면 좋아질 것입니다.",
    advice: [],
  };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(blocks.spousePalace.includes("안정적입니다"));
  assert.ok(blocks.spousePalace.includes("배려하면 좋아질 것입니다"));
  assert.ok(!blocks.spousePalace.includes("외도"));
  assert.ok(violations.some(v => v.includes("단정 예언 제거")));
});

// ── F-1: 확장된 단정 예언 금지어(신규 13종+) 각각 컷 ──────────────────
const NEW_FORBIDDEN_SENTENCES = [
  "곧 이별수가 크게 보입니다.",
  "이 시기에 곧 헤어지게 됩니다.",
  "결국 헤어질 운명입니다.",
  "머지않아 파혼하게 됩니다.",
  "두 사람은 갈라서게 됩니다.",
  "나중에 재혼하게 됩니다.",
  "안타깝게도 결혼운이 없습니다.",
  "사주에 불임의 기운이 있습니다.",
  "자식이 없을 상입니다.",
  "자식 복이 없는 사주입니다.",
  "바람기가 다분한 팔자입니다.",
  "말년에 과부가 될 상입니다.",
  "평생 독수공방할 팔자입니다.",
  "배우자를 일찍 떠나보내게 됩니다.",
];

for (const sentence of NEW_FORBIDDEN_SENTENCES) {
  test(`신규 금지어 컷: "${sentence.slice(0, 12)}…"`, () => {
    const parsed = { spousePalace: `앞부분 안전 문장입니다.\n${sentence}`, advice: [] };
    const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
    assert.ok(blocks.spousePalace.includes("앞부분 안전 문장"), "안전 문장은 남아야 함");
    assert.ok(!new RegExp(sentence.slice(0, 4)).test(blocks.spousePalace.replace("앞부분 안전 문장입니다.", "")), "금지 문장이 제거돼야 함");
    assert.ok(violations.some(v => v.includes("단정 예언 제거")));
  });
}

test("안전 문장 '이별의 아픔을 딛고'는 생존한다(과삭제 방지)", () => {
  const safe = "이별의 아픔을 딛고 다시 시작하는 힘이 있어요.";
  const parsed = { spousePalace: safe, advice: [] };
  const { blocks } = applyMarriageGuards(parsed, facts, "");
  assert.equal(blocks.spousePalace, safe);
});

// ── F-2: validateMarriageBlocks 5케이스 ──────────────────────────────
function fullValidParsed(): any {
  const long = (n: number) => "가".repeat(n);
  return {
    teaserSummary: long(20),
    gradeHeadline: long(90),
    spousePalace: long(90),
    spouseStar: long(90),
    partnerProfile: long(90),
    relationshipPattern: long(90),
    timingFlow: long(90),
    gunghapCta: long(40),
    advice: [
      { text: "일지충 근거로 이런 조언을 드려요", tag: "[근거:일지충]" },
      { text: "도화 근거로 이런 조언을 드려요", tag: "[근거:도화]" },
    ],
  };
}

test("validateMarriageBlocks: 완전한 객체는 이슈 0", () => {
  assert.deepEqual(validateMarriageBlocks(fullValidParsed()), []);
});

test("validateMarriageBlocks: 35자 이내 짧은 gradeHeadline 통과(재물운과 통일, minLen 8)", () => {
  const p = fullValidParsed();
  p.gradeHeadline = "가".repeat(20);   // 20자 — 옛 minLen 80이면 반려됐을 정상 헤드라인
  assert.deepEqual(validateMarriageBlocks(p), []);
});

test("validateMarriageBlocks: 루트가 객체 아니면 즉시 실패", () => {
  assert.deepEqual(validateMarriageBlocks(null), ["루트가 객체 아님"]);
  assert.deepEqual(validateMarriageBlocks([]), ["루트가 객체 아님"]);
  assert.deepEqual(validateMarriageBlocks("x"), ["루트가 객체 아님"]);
});

test("validateMarriageBlocks: 텍스트 블록 누락/부족 잡음", () => {
  const p = fullValidParsed();
  delete p.spousePalace;         // 누락
  p.spouseStar = "짧음";          // 80자 미만
  const issues = validateMarriageBlocks(p);
  assert.ok(issues.some(i => i.includes("spousePalace")));
  assert.ok(issues.some(i => i.includes("spouseStar")));
});

test("validateMarriageBlocks: advice 배열 아니면 잡음", () => {
  const p = fullValidParsed();
  p.advice = "not-array";
  assert.ok(validateMarriageBlocks(p).some(i => i.includes("advice 배열 아님")));
});

test("validateMarriageBlocks: advice 유효 항목 부족(minAdvice 기본 2)", () => {
  const p = fullValidParsed();
  p.advice = [{ text: "일지충 근거 조언 문장이에요", tag: "[근거:일지충]" }]; // 1개만
  assert.ok(validateMarriageBlocks(p).some(i => i.includes("advice 유효 항목")));
  // minAdvice:1 이면 통과
  assert.deepEqual(validateMarriageBlocks(p, { minAdvice: 1 }), []);
});

// ── Task 2: 금지어 status-aware 분리 (2026-07-19) ──
test("다시 혼자: '재혼' 정당 문맥(앞으로의 시기)은 보존", () => {
  const f: any = { sex: "female", maritalStatus: "다시 혼자" };
  const parsed = { timingFlow: "재혼을 생각한다면 2027년 이후의 인연 창을 살펴보면 좋아.", advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, f, "");
  assert.ok(blocks.timingFlow.includes("재혼"));
  assert.equal(violations.filter((v: string) => v.includes("단정")).length, 0);
});

test("다시 혼자: '이혼 후'(과거 언급)는 보존, '이혼수'(예언형)는 컷", () => {
  const f: any = { sex: "female", maritalStatus: "다시 혼자" };
  const parsed = {
    partnerProfile: "이혼 후 다시 시작하는 인연은 서두르지 않는 게 좋아. 이혼수가 또 보인다.",
    advice: [],
  };
  const { blocks } = applyMarriageGuards(parsed, f, "");
  assert.ok(blocks.partnerProfile.includes("이혼 후"));
  assert.ok(!blocks.partnerProfile.includes("이혼수"));
});

test("다시 혼자: '재혼 못 한다' 낙인·'사별수' 예언은 여전히 컷", () => {
  const f: any = { sex: "male", maritalStatus: "다시 혼자" };
  const parsed = { timingFlow: "너는 재혼 못 할 팔자야. 사별수도 보여.", advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, f, "");
  assert.ok(!blocks.timingFlow.includes("재혼 못"));
  assert.ok(!blocks.timingFlow.includes("사별수"));
  assert.ok(violations.length >= 2);
});

test("기혼(비-다시혼자): '재혼'·'사별' 단어 자체가 기존대로 컷", () => {
  const f: any = { sex: "female", maritalStatus: "기혼" };
  const parsed = { timingFlow: "재혼 이야기가 나올 수 있어.", advice: [] };
  const { blocks } = applyMarriageGuards(parsed, f, "");
  assert.ok(!blocks.timingFlow.includes("재혼"));
});

// ── Phase 3+재미: marriage-prompt 긍정 예시 블록이 가드 금지 패턴에 안 걸리는지 (fs, 엔진 불필요) ──
import { readFileSync } from "node:fs";
test("marriage-prompt 긍정 예시 블록이 status별 가드 금지 패턴에 안 걸린다", () => {
  const src = readFileSync(new URL("./marriage-prompt.ts", import.meta.url), "utf8");
  const block = src.match(/\[좋은 문장 예시[^\]]*\]([\s\S]*?)────/)?.[1] ?? "";
  assert.ok(block.length > 100, "예시 블록 추출 실패");
  for (const status of ["솔로", "연애중", "기혼", "다시 혼자"]) {
    const { violations } = applyMarriageGuards({ probe: block }, { maritalStatus: status }, "");
    assert.equal(violations.length, 0, `${status}에서 위반: ${violations.join(", ")}`);
  }
});
