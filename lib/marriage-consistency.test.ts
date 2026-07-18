import { test } from "node:test";
import assert from "node:assert/strict";
import { assertMarriageConsistency } from "./marriage-consistency";
import { computeMarriageGrade } from "./marriage-grade";

test("등급이 연애운 점수 매핑과 다르면 불일치", () => {
  const issues = assertMarriageConsistency({ grade: "SS", loveScore: 40, facts: { sex: "female" } as any, primaryGender: "female" });
  assert.ok(issues.some(i => i.includes("등급")));
});

test("성별-배우자성 불일치 탐지", () => {
  const issues = assertMarriageConsistency({ grade: computeMarriageGrade(60).grade, loveScore: 60, facts: { sex: "female", spouseStarType: "재성" } as any, primaryGender: "female" });
  assert.ok(issues.some(i => i.includes("배우자성")));
});

test("정합이면 빈 배열", () => {
  const issues = assertMarriageConsistency({ grade: computeMarriageGrade(60).grade, loveScore: 60, facts: { sex: "female", spouseStarType: "관성" } as any, primaryGender: "female" });
  assert.deepEqual(issues, []);
});
