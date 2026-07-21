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

test("금지 신살(괴강살) 언급 제거 — 일주 파생 지어내기 2차 안전망", () => {
  const parsed = { jaeseongDiagnosis: "일주가 경진이라 괴강살이 있어 재물 그릇이 크다.", advice: [] };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(violations.some((v) => v.includes("금지신살")));
  assert.ok(!blocks.jaeseongDiagnosis.includes("괴강살"));
});

test("금지 신살(백호살·양인살) 언급 제거", () => {
  const parsed = {
    jaeGripDiagnosis: "일지에 백호살이 있고 시주엔 양인살도 겹칩니다.",
    advice: [],
  };
  const { blocks, violations } = applyWealthGuards(parsed, facts, "");
  assert.ok(violations.filter((v) => v.includes("금지신살")).length >= 2);
  assert.ok(!blocks.jaeGripDiagnosis.includes("백호살"));
  assert.ok(!blocks.jaeGripDiagnosis.includes("양인살"));
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
  ["정당 진단", "버는 힘보다 담고 관리하는 그릇이 관건인 구조야."], // 그릇용어 없는 재해석(그릇용어 치환은 별도 테스트)
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

// ── Phase 5: 총량 soft 하한 (2026-07-19) ──
import { validateWealthRichness } from "./wealth-postprocess";
test("본문 총량 얇으면 채움경로 명시된 이슈 반환(soft)", () => {
  const thin: any = { jaeseongDiagnosis: "짧다.", jaeGripDiagnosis: "짧다.", savingStyle: "짧다.", riskAndPace: "짧다.", timingFlow: "짧다." };
  const issues = validateWealthRichness(thin);
  assert.equal(issues.length, 1);
  assert.ok(issues[0].includes("궁위"));
  assert.ok(issues[0].includes("타이밍"));
  assert.ok(issues[0].includes("패러프레이즈"));
});
test("총량 충분하면 이슈 없음", () => {
  const fat: any = Object.fromEntries(
    ["jaeseongDiagnosis","jaeGripDiagnosis","savingStyle","riskAndPace","timingFlow"].map((k) => [k, "가".repeat(400)]),
  );
  assert.equal(validateWealthRichness(fat).length, 0);
});

// ── 한자 병기 스크럽 (2026-07-19) ──
test("본문 한자 병기를 결정론적으로 제거하고 괄호 정리", () => {
  const { blocks, violations } = applyWealthGuards(
    { jaeseongDiagnosis: "겁재(劫財, 다투는 기운)가 홍염살(紅艶殺)처럼 財를 눌러.", advice: [] },
    {}, "",
  );
  assert.ok(!/[㐀-鿿]/.test(blocks.jaeseongDiagnosis), "한자 잔존: " + blocks.jaeseongDiagnosis);
  assert.ok(blocks.jaeseongDiagnosis.includes("겁재(다투는 기운)"));
  void violations; // 한자는 조용히 제거(violations 미포함)
});

// ── 소수점 강도값 누출 제거 (2026-07-19) ──
test("소수점 강도 수치를 제거하고 문장이 자연스럽게 남는다", () => {
  const { blocks } = applyWealthGuards(
    { jaeGripDiagnosis: "비겁의 강도가 10.5로 태강한 수준이라 고집이 세.", advice: [] },
    {}, "",
  );
  assert.ok(!/\d+\.\d+/.test(blocks.jaeGripDiagnosis), "소수점 잔존: " + blocks.jaeGripDiagnosis);
  assert.ok(blocks.jaeGripDiagnosis.includes("강도가 태강한"), "부자연: " + blocks.jaeGripDiagnosis);
});

// ── 2026-07-21 커리어운 역포팅: 그릇용어·등급·정수강도 백스톱 + tag 제외 + 재검증 ──
test("그릇 4상한 용어 본문 노출 → 중립 치환(문장 보존) + 위반", () => {
  const { blocks, violations } = applyWealthGuards(
    { jaeGripDiagnosis: "너는 신왕재왕이라 그릇이 크고 재물을 담을 힘이 넉넉해." }, facts, "",
  );
  assert.ok(!blocks.jaeGripDiagnosis.includes("신왕재왕"));
  assert.ok(blocks.jaeGripDiagnosis.includes("그릇이 크고"), "재해석 문장이 날아감");
  assert.ok(violations.some((v: string) => v.includes("그릇용어")));
});

test("advice tag의 그릇용어는 스크럽 제외(자기모순 방지) — [근거:재다신약] 보존", () => {
  const { blocks } = applyWealthGuards(
    { advice: [{ text: "큰돈 들어온 달엔 절반을 먼저 떼놔", tag: "[근거:재다신약]" }] }, facts, "",
  );
  assert.equal(blocks.advice.length, 1);
  assert.equal(blocks.advice[0].tag, "[근거:재다신약]");
});

test("teaser 등급 알파벳(S등급) 스크럽 + 정수 강도(힘도 5 정도로) 스크럽, 연도·나이 보존", () => {
  const r1 = applyWealthGuards({ teaserSummary: "S등급다운 든든한 재물 그릇이야." }, facts, "");
  assert.ok(!/(SS|[SABCD])\s*등급/.test(r1.blocks.teaserSummary));
  const r2 = applyWealthGuards({ savingStyle: "재성이 5 정도로 뚜렷해서 2028년, 34세 무렵에 흐름이 좋아." }, facts, "");
  assert.ok(!r2.blocks.savingStyle.includes("5 정도"));
  assert.ok(r2.blocks.savingStyle.includes("2028") && r2.blocks.savingStyle.includes("34"));
});

test("스크럽이 tag를 비우면 항목 재검증 컷(빈 근거태그 출고 방지)", () => {
  const { blocks, violations } = applyWealthGuards(
    { advice: [
      { text: "이 시기엔 큰 지출 전에 한 번 더 점검해봐", tag: "[근거:반드시대박]" },
      { text: "새는 구멍은 강제저축으로 먼저 막아둬", tag: "[근거:겁재탈재]" },
    ] }, facts, "",
  );
  assert.equal(blocks.advice.length, 1);
  assert.equal(blocks.advice[0].tag, "[근거:겁재탈재]");
  assert.ok(violations.some((v: string) => v.includes("재검증 컷")));
});

test("중복 괄호 collapse: 정관(정관, 바른 규칙)→정관(바른 규칙), 정상 괄호 무변형", () => {
  const { blocks } = applyWealthGuards({ jaeseongDiagnosis: "정관(정관, 바른 규칙)이 있고 편재(유동적인 큰돈)도 떠 있어." }, facts, "");
  assert.ok(blocks.jaeseongDiagnosis.includes("정관(바른 규칙)"));
  assert.ok(blocks.jaeseongDiagnosis.includes("편재(유동적인 큰돈)"));
  assert.ok(!blocks.jaeseongDiagnosis.includes("정관(정관"));
});
test("성사단정 '기회가 쏟아질 거야' 컷 / '기회가 보이면 살펴봐' 보존", () => {
  const cut = applyWealthGuards({ timingFlow: "앞 문장. 2028년엔 기회가 여기저기서 쏟아질 거야. 뒤 문장." }, facts, "");
  assert.ok(!cut.blocks.timingFlow.includes("쏟아질"));
  const keep = applyWealthGuards({ timingFlow: "2028년은 기회가 보이면 살펴볼 만한 시기야." }, facts, "");
  assert.ok(keep.blocks.timingFlow.includes("살펴볼"));
});
