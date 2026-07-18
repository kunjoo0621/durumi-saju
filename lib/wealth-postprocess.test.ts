import { test } from "node:test";
import assert from "node:assert/strict";
import { applyWealthGuards } from "./wealth-postprocess";

const facts: any = { interest: "목돈·노후 준비", jaeGrip: "재다신약" };

test("숙명론 문장(돈복 없다) 제거", () => {
  const parsed = { advice: [{ text: "이 사주는 평생 돈복이 없습니다.", tag: "[근거:재다신약]" }] };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(violations.some((v) => v.includes("단정")));
  assert.equal(blocks.advice.length, 0);
});

test("근거 태그 없는 조언 컷", () => {
  const parsed = { advice: [{ text: "돈을 아끼세요.", tag: "" }] };
  const { blocks } = applyWealthGuards(parsed, facts, "");
  assert.equal(blocks.advice.length, 0);
});

test("재무자문(종목 추천) 문장 제거", () => {
  const parsed = {
    advice: [{ text: "이 시기엔 삼성전자 주식을 매수하세요.", tag: "[근거:2027년타이밍]" }],
  };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(violations.some((v) => v.includes("재무자문")));
  assert.equal(blocks.advice.length, 0);
});

test("금지 신살(과숙살) 언급 제거", () => {
  const parsed = { jaeseongDiagnosis: "과숙살이 있어 재물운이 약합니다.", advice: [] };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(violations.some((v) => v.includes("금지신살")));
  assert.ok(!blocks.jaeseongDiagnosis.includes("과숙살"));
});

test("advice가 아닌 중첩 객체 속 단정 예언/재무자문도 재귀적으로 제거", () => {
  const parsed = {
    extraSection: { sub: { text: "이 사주는 거지 사주라 부동산에 투자하면 안 됩니다." } },
    advice: [],
  };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(!blocks.extraSection.sub.text.includes("거지"));
  assert.ok(violations.some((v) => v.includes("단정 예언 제거")));
});

test("줄바꿈으로 구분된 한국어 블록: 문제되는 한 줄만 제거하고 나머지 줄은 보존", () => {
  const parsed = {
    jaeGripDiagnosis:
      "재물의 흐름은 대체로 안정적입니다.\n하지만 이 사주는 평생 돈복이 없습니다.\n관리 습관을 들이면 좋아질 것입니다.",
    advice: [],
  };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(blocks.jaeGripDiagnosis.includes("안정적입니다"));
  assert.ok(blocks.jaeGripDiagnosis.includes("좋아질 것입니다"));
  assert.ok(!blocks.jaeGripDiagnosis.includes("돈복"));
  assert.ok(violations.some((v) => v.includes("단정 예언 제거")));
});
