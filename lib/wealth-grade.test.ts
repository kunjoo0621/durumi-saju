import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWealthGrade } from "./wealth-grade";

test("재물운 점수 → 등급 밴드 (결정론)", () => {
  assert.equal(computeWealthGrade(92).grade, "SS");
  assert.equal(computeWealthGrade(85).grade, "S");
  assert.equal(computeWealthGrade(78).grade, "A");
  assert.equal(computeWealthGrade(62).grade, "B");
  assert.equal(computeWealthGrade(40).grade, "C");
});

test("경계·범위 밖 방어", () => {
  assert.equal(computeWealthGrade(90).grade, "SS");   // ≥90
  assert.equal(computeWealthGrade(150).grade, "SS");  // 클램프
  assert.equal(computeWealthGrade(-5).grade, "C");
});

test("비유한값 → 0점 취급(C)", () => {
  assert.equal(computeWealthGrade(NaN).grade, "C");
  assert.equal(computeWealthGrade(Infinity).grade, "C");
  assert.equal(computeWealthGrade(-Infinity).grade, "C");
});
