import { test } from "node:test";
import assert from "node:assert/strict";
import { assertWealthConsistency } from "./wealth-consistency";
import { computeWealthGrade } from "./wealth-grade";

function baseFacts(overrides: Partial<Parameters<typeof assertWealthConsistency>[0]["facts"]> = {}) {
  return {
    jaeseongType: "정재우세" as const,
    jaeseong: [{ pillar: "month", source: "천간", star: "정재" }],
    jaedaShinyak: false,
    jaeGrip: "신왕재쇠" as const,
    ...overrides,
  };
}

test("등급이 재물운 점수 매핑과 다르면 불일치", () => {
  const issues = assertWealthConsistency({ grade: "SS", wealthScore: 40, facts: baseFacts() });
  assert.ok(issues.some((i) => i.includes("등급")));
});

test("무재인데 jaeseong 있으면 불일치", () => {
  const issues = assertWealthConsistency({
    grade: computeWealthGrade(60).grade,
    wealthScore: 60,
    facts: baseFacts({ jaeseongType: "무재", jaeseong: [{ pillar: "day", source: "지장간", star: "편재" }] }),
  });
  assert.ok(issues.some((i) => i.includes("재성 유형")));
});

test("재성 있다는데 jaeseong 비어있으면 불일치", () => {
  const issues = assertWealthConsistency({
    grade: computeWealthGrade(60).grade,
    wealthScore: 60,
    facts: baseFacts({ jaeseongType: "편재우세", jaeseong: [] }),
  });
  assert.ok(issues.some((i) => i.includes("재성 유형")));
});

test("재다신약 플래그와 jaeGrip 불일치 탐지", () => {
  const issues = assertWealthConsistency({
    grade: computeWealthGrade(60).grade,
    wealthScore: 60,
    facts: baseFacts({ jaedaShinyak: true, jaeGrip: "신왕재왕" }),
  });
  assert.ok(issues.some((i) => i.includes("재다신약")));
});

test("정합이면 빈 배열", () => {
  const issues = assertWealthConsistency({
    grade: computeWealthGrade(60).grade,
    wealthScore: 60,
    facts: baseFacts(),
  });
  assert.deepEqual(issues, []);
});

test("재다신약 정합 케이스", () => {
  const issues = assertWealthConsistency({
    grade: computeWealthGrade(30).grade,
    wealthScore: 30,
    facts: baseFacts({ jaedaShinyak: true, jaeGrip: "재다신약" }),
  });
  assert.deepEqual(issues, []);
});
