import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMarriageGrade } from "./marriage-grade";

test("연애운 점수 → 결혼운 등급 밴드 (결정론)", () => {
  assert.equal(computeMarriageGrade(92).grade, "SS");
  assert.equal(computeMarriageGrade(85).grade, "S");
  assert.equal(computeMarriageGrade(78).grade, "A");
  assert.equal(computeMarriageGrade(62).grade, "B");
  assert.equal(computeMarriageGrade(40).grade, "C");
});

test("경계·범위 밖 방어", () => {
  assert.equal(computeMarriageGrade(90).grade, "SS");   // ≥90
  assert.equal(computeMarriageGrade(150).grade, "SS");  // 클램프
  assert.equal(computeMarriageGrade(-5).grade, "C");
});
