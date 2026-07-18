import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWealthGrade, extractWealthScore } from "./wealth-grade";

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

test("extractWealthScore: 숫자 값 그대로", () => {
  assert.equal(extractWealthScore({ scores: { 재물운: 71 } }), 71);
});

test("extractWealthScore: {score:n} 형태 허용", () => {
  assert.equal(extractWealthScore({ scores: { 재물운: { score: 71 } } }), 71);
});

test("extractWealthScore: 실제 0점은 null 아님(결측과 구분)", () => {
  assert.equal(extractWealthScore({ scores: { 재물운: 0 } }), 0);
});

test("extractWealthScore: 결측 케이스는 전부 null", () => {
  assert.equal(extractWealthScore(undefined), null);
  assert.equal(extractWealthScore(null), null);
  assert.equal(extractWealthScore({}), null);
  assert.equal(extractWealthScore({ scores: null }), null);
  assert.equal(extractWealthScore({ scores: {} }), null);
  assert.equal(extractWealthScore({ scores: { 연애운: 80 } }), null);
  assert.equal(extractWealthScore({ scores: { 재물운: NaN } }), null);
  assert.equal(extractWealthScore({ scores: { 재물운: { foo: 1 } } }), null);
});
