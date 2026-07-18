import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMarriageGrade, extractLoveScore } from "./marriage-grade";

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

test("extractLoveScore: 숫자 연애운 그대로 반환", () => {
  assert.equal(extractLoveScore({ scores: { 연애운: 78 } }), 78);
});

test("extractLoveScore: {score} 객체 형태도 추출", () => {
  assert.equal(extractLoveScore({ scores: { 연애운: { score: 71 } } }), 71);
});

test("extractLoveScore: 0점은 null이 아니라 0 (결측과 구분)", () => {
  assert.equal(extractLoveScore({ scores: { 연애운: 0 } }), 0);
});

test("extractLoveScore: 결측/무효는 null (0으로 뭉개지 않음)", () => {
  assert.equal(extractLoveScore(null), null);
  assert.equal(extractLoveScore(undefined), null);
  assert.equal(extractLoveScore({}), null);              // scores 없음
  assert.equal(extractLoveScore({ scores: {} }), null);  // 연애운 키 없음
  assert.equal(extractLoveScore({ scores: { 연애운: NaN } }), null);
  assert.equal(extractLoveScore({ scores: { 연애운: "78" } }), null); // 문자열 무효
  assert.equal(extractLoveScore({ scores: { 연애운: { foo: 1 } } }), null); // score 없는 객체
});
