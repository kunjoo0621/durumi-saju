import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCareerGrade, extractCareerScore } from "./career-grade";

test("커리어운 점수 → 등급 밴드 (결혼운·재물운 동일 컷 상속)", () => {
  assert.equal(computeCareerGrade(92).grade, "SS");
  assert.equal(computeCareerGrade(85).grade, "S");
  assert.equal(computeCareerGrade(78).grade, "A");
  assert.equal(computeCareerGrade(62).grade, "B");
  assert.equal(computeCareerGrade(40).grade, "C");
});

test("경계·범위 밖 방어", () => {
  assert.equal(computeCareerGrade(90).grade, "SS"); // ≥90 (직장운 clamp 상한 90 = SS 희귀)
  assert.equal(computeCareerGrade(82).grade, "S");
  assert.equal(computeCareerGrade(72).grade, "A");
  assert.equal(computeCareerGrade(55).grade, "B");
  assert.equal(computeCareerGrade(54).grade, "C");
  assert.equal(computeCareerGrade(150).grade, "SS"); // 클램프
  assert.equal(computeCareerGrade(-5).grade, "C");
});

test("비유한값 → 0점 취급(C)", () => {
  assert.equal(computeCareerGrade(NaN).grade, "C");
  assert.equal(computeCareerGrade(Infinity).grade, "C");
  assert.equal(computeCareerGrade(-Infinity).grade, "C");
});

test("extractCareerScore: 직장운 숫자 값 그대로", () => {
  assert.equal(extractCareerScore({ scores: { 직장운: 71 } }), 71);
});

test("extractCareerScore: {score:n} 형태 허용", () => {
  assert.equal(extractCareerScore({ scores: { 직장운: { score: 71 } } }), 71);
});

test("extractCareerScore: 실제 0점은 null 아님(결측과 구분)", () => {
  assert.equal(extractCareerScore({ scores: { 직장운: 0 } }), 0);
});

test("extractCareerScore: 결측 케이스는 전부 null (0→C 뭉개기 금지)", () => {
  assert.equal(extractCareerScore(undefined), null);
  assert.equal(extractCareerScore(null), null);
  assert.equal(extractCareerScore({}), null);
  assert.equal(extractCareerScore({ scores: null }), null);
  assert.equal(extractCareerScore({ scores: {} }), null);
  assert.equal(extractCareerScore({ scores: { 재물운: 80 } }), null);
  assert.equal(extractCareerScore({ scores: { 직장운: NaN } }), null);
  assert.equal(extractCareerScore({ scores: { 직장운: { foo: 1 } } }), null);
});
