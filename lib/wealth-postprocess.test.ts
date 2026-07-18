import { test } from "node:test";
import assert from "node:assert/strict";
import { applyWealthGuards, validateWealthBlocks } from "./wealth-postprocess";

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

// ── 2026-07-18 검증 probe에서 통과 확인된 구멍 보강(F-1 확대) ──
const SAFE = "재물의 흐름은 대체로 안정적입니다.";
// 문장단위 컷 검증: 금지문장은 사라지고, 같은 블록의 안전문장은 살아남는다.
for (const forbidden of [
  "이 사주는 돈 잃을 팔자예요.",
  "관리를 못 하면 파산한다고 봐요.",
  "빚더미에 앉게 됩니다.",
  "올해는 대박 난다고 확신해요.",
  "떼돈을 벌 수 있어요.",
  "그 해엔 손실 확정입니다.",
  "내년엔 큰돈이 들어와요.",
  "이 사주는 가난을 못 벗어나요.",
  "동업하면 망해요.",
  "로또를 사면 좋아요.",
  "도박운이 강한 시기예요.",
  "재물운이 약한 사주예요.",
]) {
  test(`F-1 확대 금지어 컷: ${forbidden.slice(0, 12)}`, () => {
    const parsed = { jaeGripDiagnosis: `${SAFE}\n${forbidden}`, advice: [] };
    const { blocks, violations } = applyWealthGuards(parsed, facts, "");
    assert.ok(blocks.jaeGripDiagnosis.includes("안정적입니다"), "안전문장 보존");
    const core = forbidden.replace(/[.!?]$/, "").slice(3, 8);
    assert.ok(!blocks.jaeGripDiagnosis.includes(core), `금지 표현 제거: ${core}`);
    assert.ok(violations.length > 0);
  });
}

// F-1(2) 재무자문 확대: 종목명·투자권유 활용형
for (const advice of [
  "삼성전자 사둬.",
  "지금이 부동산 살 타이밍이야.",
  "코인에 넣어봐.",
  "강남 아파트 노려봐.",
]) {
  test(`F-1 재무자문 확대 컷: ${advice}`, () => {
    const parsed = { savingStyle: `${SAFE}\n${advice}`, advice: [] };
    const { blocks, violations } = applyWealthGuards(parsed, facts, "");
    assert.ok(blocks.savingStyle.includes("안정적입니다"));
    assert.ok(!blocks.savingStyle.includes(advice.replace(/[.!?]$/, "").slice(0, 3)));
    assert.ok(violations.some((v) => v.includes("재무자문")));
  });
}

// F-1(3) 역방향 negation 구멍: "…아니야"로 스크럽을 탈출하던 실제 권유 문장은 이제 컷된다.
test("F-1 역방향 구멍: '코인에 넣어봐, 나쁜 선택이 아니야' 컷", () => {
  const parsed = { riskAndPace: `${SAFE}\n코인에 넣어봐, 나쁜 선택이 아니야.`, advice: [] };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(blocks.riskAndPace.includes("안정적입니다"));
  assert.ok(!blocks.riskAndPace.includes("코인에 넣어"));
  assert.ok(violations.some((v) => v.includes("재무자문")));
});

// 보존 케이스: 정당 진단·면책·허용 프레임·중립 타이밍은 살아남는다.
for (const [label, keep] of [
  ["정당 진단", "재다신약이라 관리가 관건이야."],
  ["허용 프레임(입재 가능성)", "큰돈이 들어올 수 있는 시기야."],
  ["중립 타이밍", "2027년은 점검할 시기야."],
] as Array<[string, string]>) {
  test(`보존: ${label}`, () => {
    const parsed = { timingFlow: keep, advice: [] };
    const { blocks } = applyWealthGuards(parsed, facts, "");
    assert.equal(blocks.timingFlow, keep);
  });
}

test("보존: 재무자문 면책(부정형 추천)", () => {
  const parsed = {
    advice: [{ text: "특정 주식이나 부동산을 추천하지 않아요.", tag: "[근거:법적고지]" }],
  };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.equal(blocks.advice.length, 1);
  assert.ok(!violations.some((v) => v.includes("재무자문")));
});

// ── F-2 validateWealthBlocks ──
const LONG = "가".repeat(90); // 80자 하한 초과
const fullValid: any = {
  teaserSummary: "재물의 그릇이 넉넉한 편이에요.",
  gradeHeadline: "재물 관리가 관건인 사주",
  jaeseongDiagnosis: LONG,
  jaeGripDiagnosis: LONG,
  savingStyle: LONG,
  riskAndPace: LONG,
  timingFlow: LONG,
  yearlyCta: "올해 재물 흐름을 더 자세히 확인해 보세요. 궁합도 함께.",
  advice: [
    { text: "지출을 기록하는 습관을 들이세요.", tag: "[근거:재다신약]" },
    { text: "비상금을 먼저 확보하세요.", tag: "[근거:식상생재]" },
  ],
};

test("F-2 정상 전체 블록 통과", () => {
  assert.deepEqual(validateWealthBlocks(fullValid), []);
});

test("F-2 gradeHeadline 20자 정상 헤드라인 통과(포팅 함정 회귀 방지)", () => {
  // gradeHeadline은 '35자 이내' 스키마라 minLen 8. 80으로 두면 정상 출력이 전부 반려된다.
  const v = { ...fullValid, gradeHeadline: "재물의 그릇은 크나 관리가 관건" };
  assert.deepEqual(validateWealthBlocks(v), []);
});

test("F-2 키 누락 검출", () => {
  const v = { ...fullValid };
  delete v.timingFlow;
  assert.ok(validateWealthBlocks(v).some((i) => i.includes("timingFlow")));
});

test("F-2 짧은 블록 검출", () => {
  const v = { ...fullValid, jaeseongDiagnosis: "너무 짧음" };
  assert.ok(validateWealthBlocks(v).some((i) => i.includes("jaeseongDiagnosis")));
});

test("F-2 advice tag 없음 → minAdvice 미달", () => {
  const v = { ...fullValid, advice: [{ text: "지출을 기록하는 습관을 들이세요." }] };
  assert.ok(validateWealthBlocks(v).some((i) => i.includes("advice")));
});

test("F-2 루트가 배열이면 즉시 반려", () => {
  assert.deepEqual(validateWealthBlocks([]), ["루트가 객체 아님"]);
});
