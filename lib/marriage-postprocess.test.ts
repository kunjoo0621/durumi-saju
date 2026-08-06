import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMarriageGuards, validateMarriageBlocks } from "./marriage-postprocess";

const facts: any = { sex: "female", maritalStatus: "기혼", dohwa: true };

test("이혼·사별·외도 예언 문장 제거", () => {
  const parsed = { advice: [{ text: "곧 이혼수가 있습니다.", tag: "[근거:일지충]" }] };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(violations.some(v => v.includes("단정")));
  assert.equal(blocks.advice.length, 0);
});

test("근거 태그 없는 조언 컷", () => {
  const parsed = { advice: [{ text: "대화를 많이 하세요.", tag: "" }] };
  const { blocks } = applyMarriageGuards(parsed, facts, "");
  assert.equal(blocks.advice.length, 0);
});

test("금지 신살(과숙살) 언급 제거", () => {
  const parsed = { spousePalace: "과숙살이 있어 외롭습니다.", advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(violations.some(v => v.includes("금지신살")));
  assert.ok(!blocks.spousePalace.includes("과숙살"));
});

test("금지 신살(괴강살) 언급 제거 — 일주 파생 지어내기 2차 안전망", () => {
  const parsed = { spouseStar: "일주가 경진이라 괴강살이 있어 기가 세다.", advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(violations.some(v => v.includes("금지신살")));
  assert.ok(!blocks.spouseStar.includes("괴강살"));
});

test("금지 신살(백호살·양인살) 언급 제거", () => {
  const parsed = {
    spousePalace: "일지에 백호살이 있고 시주엔 양인살도 겹칩니다.",
    advice: [],
  };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(violations.filter(v => v.includes("금지신살")).length >= 2);
  assert.ok(!blocks.spousePalace.includes("백호살"));
  assert.ok(!blocks.spousePalace.includes("양인살"));
});

test("advice가 아닌 중첩 객체 속 단정 예언도 재귀적으로 제거", () => {
  const parsed = { extraSection: { sub: { text: "과숙살이 있고 이혼수도 보입니다." } }, advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(!blocks.extraSection.sub.text.includes("과숙살"));
  assert.ok(!blocks.extraSection.sub.text.includes("이혼수"));
  assert.ok(violations.some(v => v.includes("단정 예언 제거")));
});

test("줄바꿈으로 구분된 한국어 블록: 문제되는 한 줄만 제거하고 나머지 줄은 보존", () => {
  const parsed = {
    spousePalace:
      "결혼 생활은 대체로 안정적입니다.\n하지만 외도 가능성도 있습니다.\n서로 배려하면 좋아질 것입니다.",
    advice: [],
  };
  const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
  assert.ok(blocks.spousePalace.includes("안정적입니다"));
  assert.ok(blocks.spousePalace.includes("배려하면 좋아질 것입니다"));
  assert.ok(!blocks.spousePalace.includes("외도"));
  assert.ok(violations.some(v => v.includes("단정 예언 제거")));
});

// ── F-1: 확장된 단정 예언 금지어(신규 13종+) 각각 컷 ──────────────────
const NEW_FORBIDDEN_SENTENCES = [
  "곧 이별수가 크게 보입니다.",
  "이 시기에 곧 헤어지게 됩니다.",
  "결국 헤어질 운명입니다.",
  "머지않아 파혼하게 됩니다.",
  "두 사람은 갈라서게 됩니다.",
  "나중에 재혼하게 됩니다.",
  "안타깝게도 결혼운이 없습니다.",
  "사주에 불임의 기운이 있습니다.",
  "자식이 없을 상입니다.",
  "자식 복이 없는 사주입니다.",
  "바람기가 다분한 팔자입니다.",
  "말년에 과부가 될 상입니다.",
  "평생 독수공방할 팔자입니다.",
  "배우자를 일찍 떠나보내게 됩니다.",
];

for (const sentence of NEW_FORBIDDEN_SENTENCES) {
  test(`신규 금지어 컷: "${sentence.slice(0, 12)}…"`, () => {
    const parsed = { spousePalace: `앞부분 안전 문장입니다.\n${sentence}`, advice: [] };
    const { blocks, violations } = applyMarriageGuards(parsed, facts, "");
    assert.ok(blocks.spousePalace.includes("앞부분 안전 문장"), "안전 문장은 남아야 함");
    assert.ok(!new RegExp(sentence.slice(0, 4)).test(blocks.spousePalace.replace("앞부분 안전 문장입니다.", "")), "금지 문장이 제거돼야 함");
    assert.ok(violations.some(v => v.includes("단정 예언 제거")));
  });
}

test("안전 문장 '이별의 아픔을 딛고'는 생존한다(과삭제 방지)", () => {
  const safe = "이별의 아픔을 딛고 다시 시작하는 힘이 있어요.";
  const parsed = { spousePalace: safe, advice: [] };
  const { blocks } = applyMarriageGuards(parsed, facts, "");
  assert.equal(blocks.spousePalace, safe);
});

// ── F-2: validateMarriageBlocks 5케이스 ──────────────────────────────
function fullValidParsed(): any {
  const long = (n: number) => "가".repeat(n);
  return {
    teaserSummary: long(20),
    gradeHeadline: long(90),
    spousePalace: long(90),
    spouseStar: long(90),
    partnerProfile: long(90),
    relationshipPattern: long(90),
    timingFlow: long(90),
    gunghapCta: long(40),
    advice: [
      { text: "일지충 근거로 이런 조언을 드려요", tag: "[근거:일지충]" },
      { text: "도화 근거로 이런 조언을 드려요", tag: "[근거:도화]" },
    ],
  };
}

test("validateMarriageBlocks: 완전한 객체는 이슈 0", () => {
  assert.deepEqual(validateMarriageBlocks(fullValidParsed()), []);
});

test("validateMarriageBlocks: 35자 이내 짧은 gradeHeadline 통과(재물운과 통일, minLen 8)", () => {
  const p = fullValidParsed();
  p.gradeHeadline = "가".repeat(20);   // 20자 — 옛 minLen 80이면 반려됐을 정상 헤드라인
  assert.deepEqual(validateMarriageBlocks(p), []);
});

test("validateMarriageBlocks: 루트가 객체 아니면 즉시 실패", () => {
  assert.deepEqual(validateMarriageBlocks(null), ["루트가 객체 아님"]);
  assert.deepEqual(validateMarriageBlocks([]), ["루트가 객체 아님"]);
  assert.deepEqual(validateMarriageBlocks("x"), ["루트가 객체 아님"]);
});

test("validateMarriageBlocks: 텍스트 블록 누락/부족 잡음", () => {
  const p = fullValidParsed();
  delete p.spousePalace;         // 누락
  p.spouseStar = "짧음";          // 80자 미만
  const issues = validateMarriageBlocks(p);
  assert.ok(issues.some(i => i.includes("spousePalace")));
  assert.ok(issues.some(i => i.includes("spouseStar")));
});

test("validateMarriageBlocks: advice 배열 아니면 잡음", () => {
  const p = fullValidParsed();
  p.advice = "not-array";
  assert.ok(validateMarriageBlocks(p).some(i => i.includes("advice 배열 아님")));
});

test("validateMarriageBlocks: advice 유효 항목 부족(minAdvice 기본 2)", () => {
  const p = fullValidParsed();
  p.advice = [{ text: "일지충 근거 조언 문장이에요", tag: "[근거:일지충]" }]; // 1개만
  assert.ok(validateMarriageBlocks(p).some(i => i.includes("advice 유효 항목")));
  // minAdvice:1 이면 통과
  assert.deepEqual(validateMarriageBlocks(p, { minAdvice: 1 }), []);
});

// ── Task 2: 금지어 status-aware 분리 (2026-07-19) ──
test("다시 혼자: '재혼' 정당 문맥(앞으로의 시기)은 보존", () => {
  const f: any = { sex: "female", maritalStatus: "다시 혼자" };
  const parsed = { timingFlow: "재혼을 생각한다면 2027년 이후의 인연 창을 살펴보면 좋아.", advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, f, "");
  assert.ok(blocks.timingFlow.includes("재혼"));
  assert.equal(violations.filter((v: string) => v.includes("단정")).length, 0);
});

test("다시 혼자: '이혼 후'(과거 언급)는 보존, '이혼수'(예언형)는 컷", () => {
  const f: any = { sex: "female", maritalStatus: "다시 혼자" };
  const parsed = {
    partnerProfile: "이혼 후 다시 시작하는 인연은 서두르지 않는 게 좋아. 이혼수가 또 보인다.",
    advice: [],
  };
  const { blocks } = applyMarriageGuards(parsed, f, "");
  assert.ok(blocks.partnerProfile.includes("이혼 후"));
  assert.ok(!blocks.partnerProfile.includes("이혼수"));
});

test("다시 혼자: '재혼 못 한다' 낙인·'사별수' 예언은 여전히 컷", () => {
  const f: any = { sex: "male", maritalStatus: "다시 혼자" };
  const parsed = { timingFlow: "너는 재혼 못 할 팔자야. 사별수도 보여.", advice: [] };
  const { blocks, violations } = applyMarriageGuards(parsed, f, "");
  assert.ok(!blocks.timingFlow.includes("재혼 못"));
  assert.ok(!blocks.timingFlow.includes("사별수"));
  assert.ok(violations.length >= 2);
});

test("기혼(비-다시혼자): '재혼'·'사별' 단어 자체가 기존대로 컷", () => {
  const f: any = { sex: "female", maritalStatus: "기혼" };
  const parsed = { timingFlow: "재혼 이야기가 나올 수 있어.", advice: [] };
  const { blocks } = applyMarriageGuards(parsed, f, "");
  assert.ok(!blocks.timingFlow.includes("재혼"));
});

// ── Phase 3+재미: marriage-prompt 긍정 예시 블록이 가드 금지 패턴에 안 걸리는지 (fs, 엔진 불필요) ──
import { readFileSync } from "node:fs";
test("marriage-prompt 긍정 예시 블록이 status별 가드 금지 패턴에 안 걸린다", () => {
  const src = readFileSync(new URL("./marriage-prompt.ts", import.meta.url), "utf8");
  const block = src.match(/\[좋은 문장 예시[^\]]*\]([\s\S]*?)────/)?.[1] ?? "";
  assert.ok(block.length > 100, "예시 블록 추출 실패");
  for (const status of ["솔로", "연애중", "기혼", "다시 혼자"]) {
    const { violations } = applyMarriageGuards({ probe: block }, { maritalStatus: status }, "");
    assert.equal(violations.length, 0, `${status}에서 위반: ${violations.join(", ")}`);
  }
});

// ── Phase 5: 총량 soft 하한 (2026-07-19) ──
import { validateMarriageRichness } from "./marriage-postprocess";
test("결혼 본문 총량 얇으면 채움경로(지장간·타이밍) 명시 이슈 반환", () => {
  const thin: any = { spousePalace: "짧.", spouseStar: "짧.", partnerProfile: "짧.", relationshipPattern: "짧.", timingFlow: "짧." };
  const issues = validateMarriageRichness(thin);
  assert.equal(issues.length, 1);
  assert.ok(issues[0].includes("지장간"));
  assert.ok(issues[0].includes("타이밍"));
});
test("결혼 총량 충분하면 이슈 없음", () => {
  const fat: any = Object.fromEntries(
    ["spousePalace","spouseStar","partnerProfile","relationshipPattern","timingFlow"].map((k) => [k, "가".repeat(400)]),
  );
  assert.equal(validateMarriageRichness(fat).length, 0);
});

// ── 한자 병기 스크럽 (2026-07-19) ──
test("결혼 본문 한자 병기 제거", () => {
  const { blocks } = applyMarriageGuards(
    { spousePalace: "2026년은 홍염살(紅艶殺)의 기운이 강해. 도화(桃花, 매력)도 있어.", advice: [] },
    { maritalStatus: "솔로" }, "",
  );
  assert.ok(!/[㐀-鿿]/.test(blocks.spousePalace), "한자 잔존: " + blocks.spousePalace);
  assert.ok(blocks.spousePalace.includes("홍염살의"));
  assert.ok(blocks.spousePalace.includes("도화(매력)"));
});

// ── 2026-07-21 커리어운 역포팅: 등급·정수강도 스크럽 + tag 재검증 ──
test("teaser 등급 알파벳(S등급) 스크럽 + 정수 강도 스크럽, 연도·나이 보존", () => {
  const r1 = applyMarriageGuards({ teaserSummary: "S등급다운 인연 흐름이야." }, { maritalStatus: "미혼" } as any, "");
  assert.ok(!/(SS|[SABCD])\s*등급/.test(r1.blocks.teaserSummary));
  const r2 = applyMarriageGuards({ timingFlow: "배우자성이 5 정도로 뚜렷해 2029년, 34세 무렵 인연이 또렷해." }, { maritalStatus: "미혼" } as any, "");
  assert.ok(!r2.blocks.timingFlow.includes("5 정도"));
  assert.ok(r2.blocks.timingFlow.includes("2029") && r2.blocks.timingFlow.includes("34"));
});

test("스크럽이 tag를 비우면 항목 재검증 컷(빈 근거태그 출고 방지)", () => {
  const { blocks, violations } = applyMarriageGuards(
    { advice: [
      { text: "먼저 빈틈을 보여줄 때 인연이 들어와 좋아", tag: "[근거:불임걱정]" }, // 태그가 금지어(불임) → 스크럽으로 비워짐
      { text: "기준을 세 가지로 줄여보면 도움이 돼", tag: "[근거:도화]" },
    ] }, { maritalStatus: "미혼" } as any, "",
  );
  assert.equal(blocks.advice.length, 1);
  assert.equal(blocks.advice[0].tag, "[근거:도화]");
  assert.ok(violations.some((v: string) => v.includes("재검증 컷")));
});

test("중복 괄호 collapse + 성사단정 컷 / 보존", () => {
  const r = applyMarriageGuards({ spouseStar: "축토(축토, 얼어붙은 땅)와 정관(정관)이 있어." }, { maritalStatus: "미혼" } as any, "");
  assert.ok(r.blocks.spouseStar.includes("축토(얼어붙은 땅)") && r.blocks.spouseStar.includes("정관") && !r.blocks.spouseStar.includes("정관(정관"));
  const cut = applyMarriageGuards({ timingFlow: "앞 문장. 다정한 사람을 만나게 될 운명이야. 뒤 문장." }, { maritalStatus: "미혼" } as any, "");
  assert.ok(!cut.blocks.timingFlow.includes("운명"));
  const keep = applyMarriageGuards({ timingFlow: "좋은 인연을 놓치지 마. 만나게 될 수도 있어." }, { maritalStatus: "미혼" } as any, "");
  assert.ok(keep.blocks.timingFlow.includes("놓치지 마") && keep.blocks.timingFlow.includes("수도 있어"));
});

// ★2026-08-06 실측 회귀: 대운 근거 오탐.
// 가드는 blocks.serverTimeline?.daeun 을 봤는데 serverTimeline 은 가드가 끝난 뒤에야
// route 에서 붙는다(marriage/analyze/route.ts). 그래서 대운 배열이 항상 [] 이 되어
// **대운을 언급하는 모든 리포트가 무조건 위반** 처리됐다(결혼운 실측 34/38건).
// 대조 검증: 그 리포트들의 대운 서술은 재계산 결과와 전부 일치했다 — LLM 은 무죄였다.
// 근거는 facts.daeunSpouseYears(전체 구간)여야 한다. serverTimeline 은 upcoming 필터까지
// 걸려 있어 "이미 지나온 대운"을 정확히 말한 문장도 걸리는 이중 오류였다.
test("대운 근거가 facts 에 있으면 대운 언급을 위반으로 잡지 않는다", () => {
  const facts = {
    maritalStatus: "미혼",
    daeunSpouseYears: [{ startAge: 27, endAge: 36, star: "정관" }, { startAge: 37, endAge: 46, star: "편관" }],
  } as any;
  const { violations } = applyMarriageGuards(
    { timingFlow: "현재 넌 27세부터 이어진 정관 대운의 끝자락을 지나고 있어. 37세부터 시작되는 편관 대운이 진짜 중요해." },
    facts, "",
  );
  assert.equal(violations.filter((v: string) => v.includes("대운 데이터가 비었")).length, 0);
});

test("대운 근거가 실제로 없으면 대운 주장은 여전히 위반", () => {
  const { violations } = applyMarriageGuards(
    { timingFlow: "47세부터 정관 대운이 들어와서 안정될 거야." },
    { maritalStatus: "미혼", daeunSpouseYears: [] } as any, "",
  );
  assert.ok(violations.some((v: string) => v.includes("대운 데이터가 비었")));
});

// ★독립 검수(Fable, 2026-08-06)가 잡은 잔존 오탐.
// DAEUN_CLAIM_RE 가 /대운/ 이라 단어만 나와도 걸리는데, marriage-prompt.ts:201 은
// 배우자성 대운이 "없음"인 사람에게 **정확히** "인연은 대운·세운의 흐름을 더 타는 편"이라고
// 쓰라고 지시한다. 프롬프트가 시킨 문장을 가드가 잡는 자기모순이었다.
// 데이터가 있어야 하는 건 '구체 주장'(십성 특정 또는 나이 구간)뿐이다.
test("대운 데이터가 없어도 일반적 언급은 위반이 아니다(프롬프트 지시 문장)", () => {
  const { violations } = applyMarriageGuards(
    { spouseStar: "원국에 배우자성이 뚜렷하지 않아 인연은 대운·세운의 흐름을 더 타는 편이야." },
    { maritalStatus: "미혼", daeunSpouseYears: [] } as any, "",
  );
  assert.equal(violations.filter((v: string) => v.includes("대운 데이터가 비었")).length, 0);
});
