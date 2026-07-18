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

// 아래부터: 프롬프트(lib/wealth-prompt.ts ~154-190) 자체가 명시한 금지 예시들이
// 실제로 가드에 걸리는지 검증 (리뷰에서 발견된 커버리지 갭 수정)

test("프롬프트 금지 예시: 재물운이 없는 사주예요 → 제거", () => {
  const parsed = { advice: [{ text: "재물운이 없는 사주예요.", tag: "[근거:재다신약]" }] };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(violations.some((v) => v.includes("단정")));
  assert.equal(blocks.advice.length, 0);
});

test("프롬프트 금지 예시: 재물운이 약하다 → 제거", () => {
  const parsed = { jaeGripDiagnosis: "이 사람은 재물운이 약하다는 게 핵심입니다.", advice: [] };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(!blocks.jaeGripDiagnosis.includes("재물운이 약하다"));
  assert.ok(violations.some((v) => v.includes("단정 예언 제거")));
});

test("프롬프트 금지 예시: 2027년에 반드시 큰돈이 들어옵니다 → 제거", () => {
  const parsed = {
    advice: [{ text: "2027년에 반드시 큰돈이 들어옵니다.", tag: "[근거:타이밍]" }],
  };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(violations.some((v) => v.includes("단정")));
  assert.equal(blocks.advice.length, 0);
});

test("프롬프트 금지 예시: 무조건 이득입니다 → 제거", () => {
  const parsed = {
    advice: [{ text: "이 시기에 투자하면 무조건 이득입니다.", tag: "[근거:타이밍]" }],
  };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(violations.some((v) => v.includes("단정")));
  assert.equal(blocks.advice.length, 0);
});

test("프롬프트 금지 예시: 분명 손해를 봅니다 → 제거", () => {
  const parsed = { jaeGripDiagnosis: "그 해엔 분명 손해를 봅니다.", advice: [] };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(!blocks.jaeGripDiagnosis.includes("손해를 봅니다"));
  assert.ok(violations.some((v) => v.includes("단정 예언 제거")));
});

test("재무자문 면책 문장(부정형 추천)은 스크럽하지 않고 보존", () => {
  const parsed = {
    advice: [{ text: "특정 주식이나 부동산을 추천하지 않습니다.", tag: "[근거:법적고지]" }],
  };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.equal(blocks.advice.length, 1);
  assert.equal(blocks.advice[0].text, "특정 주식이나 부동산을 추천하지 않습니다.");
  assert.ok(!violations.some((v) => v.includes("재무자문")));
});

test("실제 종목 추천(긍정형)은 여전히 스크럽됨", () => {
  const parsed = {
    advice: [{ text: "삼성전자 주식을 매수하세요.", tag: "[근거:타이밍]" }],
  };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(violations.some((v) => v.includes("재무자문")));
  assert.equal(blocks.advice.length, 0);
});
