import { test } from "node:test";
import assert from "node:assert/strict";
import { assertCareerConsistency } from "./career-consistency";

const okArgs = {
  grade: "A", // 직장운 78 → A
  careerScore: 78,
  facts: {
    gwanseongType: "정관우세" as const,
    gwanseong: [{ pillar: "month" }],
    gwandaSinyak: false,
    careerGrip: "신왕관쇠" as const,
    sanggwanGyeongwan: false,
    gwanseongAbsent: false,
  },
};

test("정합 케이스는 이슈 없음", () => {
  assert.deepEqual(assertCareerConsistency(okArgs), []);
});

test("등급 불일치 감지", () => {
  const issues = assertCareerConsistency({ ...okArgs, grade: "SS" });
  assert.ok(issues.some((i) => i.includes("등급 불일치")));
});

test("무관인데 관성 목록 존재 → 불일치", () => {
  const issues = assertCareerConsistency({
    ...okArgs,
    facts: { ...okArgs.facts, gwanseongType: "무관", gwanseong: [{ pillar: "month" }] },
  });
  assert.ok(issues.some((i) => i.includes("관성 유형 불일치")));
});

test("관성 유형 있는데 관성 목록 비어있음 → 불일치", () => {
  const issues = assertCareerConsistency({
    ...okArgs,
    facts: { ...okArgs.facts, gwanseongType: "정관우세", gwanseong: [] },
  });
  assert.ok(issues.some((i) => i.includes("관성 유형 불일치")));
});

test("gwandaSinyak ↔ careerGrip 불일치 감지", () => {
  const issues = assertCareerConsistency({
    ...okArgs,
    facts: { ...okArgs.facts, gwandaSinyak: true, careerGrip: "신왕관왕" },
  });
  assert.ok(issues.some((i) => i.includes("관다신약 불일치")));
});

test("상관견관인데 무관(관성 없음) → 불일치", () => {
  const issues = assertCareerConsistency({
    ...okArgs,
    facts: {
      ...okArgs.facts,
      gwanseongType: "무관",
      gwanseong: [],
      sanggwanGyeongwan: true,
      gwanseongAbsent: true,
    },
  });
  assert.ok(issues.some((i) => i.includes("상관견관")));
});
