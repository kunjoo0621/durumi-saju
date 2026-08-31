import { test } from "node:test";
import assert from "node:assert/strict";

import { checkCoupleReport } from "./couple-postprocess";

const ctx = { allowedYears: [2029, 2031] };
const kinds = (text: string) => checkCoupleReport(text, ctx).violations.map((v) => v.kind);

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
