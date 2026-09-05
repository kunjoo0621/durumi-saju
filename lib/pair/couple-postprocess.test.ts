import { test } from "node:test";
import assert from "node:assert/strict";

import { checkCoupleReport } from "./couple-postprocess";

const ctx = { allowedYears: [2029, 2031] };
const kinds = (text: string) => checkCoupleReport(text, ctx).violations.map((v) => v.kind);
const kinds2 = (text: string, c: Parameters<typeof checkCoupleReport>[1]) =>
  checkCoupleReport(text, c).violations.map((v) => v.kind);

/* ── 실측으로 확인한 닳은 표현 ── */

// 기존 결혼운 177편 중 38편(21.5%)이 이 문장을 썼다. 프롬프트에 예시로 적어 둔
// 문장이 그대로 복제된 것이다. couple 에서는 나오면 안 된다.
test("프롬프트 예시에서 새어나온 닳은 표현을 잡는다", () => {
  assert.ok(kinds("웬만한 바람에는 흔들리지 않는 자리야").includes("닳은표현"));
  assert.ok(kinds("뿌리 깊은 나무처럼 단단해").includes("닳은표현"));
  assert.deepEqual(kinds("둘이 같은 자리에서 다르게 반응해"), []);
});

// 177편 중 108편(61.0%)이 쓴 골격. 다른 사람 리포트인데 같은 글로 읽힌다.
test("반복 골격을 잡는다 — 겉으로는~속으로는 / 예를 들어~장면", () => {
  assert.ok(kinds("겉으로는 무뚝뚝해 보여도 속으로는 다정한 사람이야").includes("반복골격"));
  assert.ok(kinds("겉은 딱딱해 보여도 속은 따뜻해").includes("반복골격"));
  assert.ok(
    kinds("예를 들어, 상대가 힘든 얘기를 꺼낼 때 정답부터 던지는 장면이 자주 나올 거야")
      .includes("반복골격"),
  );
});

/* ── 용어 ── */

// 리포트당 중앙값 7개(최대 16개)였다. 읽는 내내 수업을 시키는 주범.
test("용어 괄호 병기를 잡고, 스크럽으로 괄호를 지운다", () => {
  const r = checkCoupleReport("너에게 정재(바른 인연과 결실)가 깊이 숨어 있어", ctx);
  assert.ok(r.violations.map((v) => v.kind).includes("용어병기"));
  assert.ok(!r.text.includes("("), `괄호가 남았다: ${r.text}`);
});

test("명리 용어 자체를 잡는다 (등급·용신·강약·자리 이름)", () => {
  for (const t of ["용신이 서로 맞아", "너는 신약이라", "일지에 충이 들어", "S등급이야"]) {
    assert.ok(kinds(t).includes("명리용어"), `못 잡았다: ${t}`);
  }
});

/* ── 운영자 확정 규칙 ── */

// §1-1 — 동성 커플 분기를 만들지 않는 대신 표현을 중립으로 통일한다.
test("혼인 신분어를 잡는다 (남편·아내·시댁·처가)", () => {
  assert.ok(kinds("네 남편 될 사람은").includes("혼인신분어"));
  assert.ok(kinds("아내 자리가 흔들려").includes("혼인신분어"));
  assert.deepEqual(kinds("네 짝이 될 사람은"), []);
});

// "결혼해라 / 하지 마라"는 명리적으로도 CS적으로도 단정할 수 없다.
test("지시형·예언형 단정을 잡는다", () => {
  assert.ok(kinds("이 사람과는 결혼하지 마").includes("단정"));
  assert.ok(kinds("결혼해도 좋아, 해라").includes("단정"));
  assert.ok(kinds("곧 헤어질 거야").includes("단정"));
});

/* ── 지어내기 ── */

test("사실 블록에 없는 연도를 잡는다", () => {
  assert.ok(kinds("2033년에 인연이 무르익어").includes("없는연도"));
  assert.deepEqual(kinds("2029년과 2031년이 둘 다 열리는 해야"), []);
});

/* ── 통과 케이스 ── */

test("규칙을 다 지킨 글은 위반 0이고 원문이 보존된다", () => {
  const good = [
    "돈 얘기가 나오면 너는 계산부터 하고, 쟤는 표정부터 봐.",
    "싸우고 나서 너는 말수가 줄고 쟤는 오히려 말을 더 건다. 그래서 사흘이 간다.",
    "2029년엔 둘 다 여유가 생겨서, 미뤄둔 얘기를 꺼내기 쉬워져.",
  ].join("\n");

  const r = checkCoupleReport(good, ctx);
  assert.deepEqual(r.violations, [], `위반이 잡혔다: ${JSON.stringify(r.violations)}`);
  assert.equal(r.text, good, "멀쩡한 글이 변형됐다");
});

/* ── 오탐 차단 (실측에서 발견) ── */

// 기존 결혼운 177편에 이 가드를 돌렸더니 "단정" 히트의 대부분(87회)이 그냥 "~해라"였다.
// 막아야 하는 건 "결혼해라"이지 모든 조언 어미가 아니다. 가드가 과하면 생성할 때마다
// 재작성 루프에 빠져 Gemini 호출만 태운다 — 못 잡는 것만큼 나쁘다.
test("평범한 조언 어미(~해라)는 단정으로 잡지 않는다", () => {
  for (const t of [
    "먼저 말을 걸어라",
    "그럴 땐 한 박자 쉬어라",
    "돈 얘기는 미리 꺼내라",
    "반드시 필요한 건 아니야",
    "무조건 맞춰줄 필요는 없어",
  ]) {
    assert.deepEqual(kinds(t), [], `오탐: "${t}"`);
  }
});

// 그래도 진짜 단정은 계속 잡아야 한다.
test("미래를 확정하는 절대 표현은 여전히 잡는다", () => {
  assert.ok(kinds("이 사람과는 반드시 결혼하게 된다").includes("단정"));
  assert.ok(kinds("무조건 헤어지게 돼 있어").includes("단정"));
});

/* ── 전체 리뷰에서 재현된 오탐·구멍 ── */

// ★블록이 "기준 연도"를 싣는데 가드는 timingOverlapYears 만 허용해서, LLM 이 규칙을
// 성실히 지켜 블록에 있는 연도를 써도 위반으로 잡혔다 → 무의미한 재생성 루프.
test("사실 블록에 실린 기준 연도는 본문에 써도 위반이 아니다", () => {
  assert.deepEqual(kinds2("2026년 지금 두 사람은", { allowedYears: [2029], currentYear: 2026 }), []);
  // 그래도 아무 연도나 되는 건 아니다
  assert.ok(kinds2("2033년에는", { allowedYears: [2029], currentYear: 2026 }).includes("없는연도"));
});

// ★평범한 괄호까지 용어병기로 잡아 재생성을 태우고 있었다.
test("명리 용어가 아닌 일반 괄호는 잡지 않는다", () => {
  const r = checkCoupleReport("둘이 카페(단골집)에서 만나면", { allowedYears: [] });
  assert.deepEqual(r.violations, [], JSON.stringify(r.violations));
  assert.equal(r.text, "둘이 카페(단골집)에서 만나면", "멀쩡한 괄호가 지워졌다");
});

test("명리 용어 괄호 병기는 여전히 잡고 지운다", () => {
  const r = checkCoupleReport("정재(바른 인연과 결실)가 있어", { allowedYears: [] });
  assert.ok(r.violations.some((v) => v.kind === "용어병기"));
  assert.ok(!r.text.includes("("), r.text);
});

// ★강약 8단계 중 "극약"만 금지어에서 빠져 있었다(스펙 §1-0.4는 8단계 전부를 요구).
test("강약 8단계 명칭을 하나도 빠짐없이 잡는다", () => {
  for (const level of ["극왕", "태강", "신강", "중화신강", "중화신약", "신약", "태약", "극약"]) {
    assert.ok(kinds(`너는 ${level} 체질이라`).includes("명리용어"), `못 잡았다: ${level}`);
  }
});

/* ── 치환 스크럽 (실측: 2번 재생성해도 살아남아 그대로 출고됐다) ── */

// probe 실측에서 "아내" 3회, "편인", "일지" 가 재생성 2회를 견디고 유료 리포트로 나갔다.
// 지우면 문장이 부서지므로 **뜻으로 바꾼다**(펫 궁합의 용어 치환 선례).
test("혼인 신분어를 중립어로 바꾼다", () => {
  const r = checkCoupleReport("아내 자리가 흔들려서 남편이 힘들어", { allowedYears: [] });
  assert.ok(!r.text.includes("아내"), r.text);
  assert.ok(!r.text.includes("남편"), r.text);
  assert.ok(r.text.includes("짝"), r.text);
});

test("명리 용어를 뜻으로 바꾼다", () => {
  const r = checkCoupleReport("편인의 기운이 일지에 앉아 있어", { allowedYears: [] });
  assert.ok(!r.text.includes("편인"), r.text);
  assert.ok(!r.text.includes("일지"), r.text);
  assert.ok(r.text.length > 10, "문장이 부서졌다: " + r.text);
});

// 치환해도 위반은 기록한다 — 몇 번 새는지 재야 프롬프트를 고칠 수 있다.
test("치환해도 위반 기록은 남는다", () => {
  const r = checkCoupleReport("아내 자리가", { allowedYears: [] });
  assert.ok(r.violations.some((v) => v.kind === "혼인신분어"));
});

/* ── 치환이 멀쩡한 단어를 부수면 안 된다 (실측 버그) ── */

// ★probe 실측: /아내/g 가 "녹아내릴"·"쏟아내기" 안의 "아내"를 잡아
// "녹짝릴"·"쏟짝기" 로 문장을 부순 채 출고했다. 금지어 검사만 보면 0이라 안 보인다.
test("정상 단어 안의 글자를 치환하지 않는다", () => {
  for (const t of [
    "눈이 녹아내릴 즈음에",
    "속내를 쏟아내기 시작해",
    "그건 상관없어",
    "누구와도 비견할 만해",
    "정신을 차려",
  ]) {
    const r = checkCoupleReport(t, { allowedYears: [] });
    assert.equal(r.text, t, `멀쩡한 문장이 바뀌었다: "${t}" → "${r.text}"`);
  }
});

// 치환할 때 조사도 맞춰야 한다 — "아내가" → "짝가" 는 틀린 말이다.
test("치환 후 조사가 맞는다", () => {
  const cases: Array<[string, string]> = [
    ["아내가 힘들어", "짝이 힘들어"],
    ["아내를 봐", "짝을 봐"],
    ["아내는 조용해", "짝은 조용해"],
    ["남편이 그래", "짝이 그래"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(checkCoupleReport(input, { allowedYears: [] }).text, expected, input);
  }
});

test("실제 명리 용어 문맥에서는 치환한다", () => {
  const r = checkCoupleReport("아내 자리가 흔들려", { allowedYears: [] });
  assert.equal(r.text, "짝 자리가 흔들려");
  const r2 = checkCoupleReport("편인의 기운", { allowedYears: [] });
  assert.ok(!r2.text.includes("편인") && r2.text.includes("결"), r2.text);
});

// ★검출에도 같은 경계 규칙이 필요하다(실측): "쏟아내게"·"휴식처가"·"반대일지는" 이
// 각각 아내·처가·일지 위반으로 잡혀 매 리포트마다 재생성을 2회씩 태웠다.
// 치환은 경계를 지켜 문장을 안 부쉈는데(출고물은 깨끗) 검출만 오탐이었다.
test("정상 단어 안의 글자를 위반으로 잡지 않는다", () => {
  for (const t of [
    "속 깊은 이야기를 술술 쏟아내게 돼",
    "세상에서 가장 안전한 휴식처가 되고",
    "그 반대일지는 아직 알 수 없어",
    "그건 상관없어",
    "비견할 만한 사람이야",
  ]) {
    assert.deepEqual(kinds(t), [], `오탐: "${t}"`);
  }
});

test("진짜 위반은 여전히 잡는다", () => {
  assert.ok(kinds("아내 자리가 흔들려").includes("혼인신분어"));
  assert.ok(kinds("일지에 충이 들어").includes("명리용어"));
});
