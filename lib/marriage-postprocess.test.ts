import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMarriageGuards } from "./marriage-postprocess";

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
