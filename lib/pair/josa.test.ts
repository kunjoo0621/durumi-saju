import { test } from "node:test";
import assert from "node:assert/strict";

import { withJosa } from "./josa";

// ★사실 블록이 `${이름}를` 처럼 조사를 박아 두면 AI 가 그대로 따라 쓴다.
// 실측(probe): "지영를 밀어준다", "서연가 준호에게" 가 리포트에 그대로 나갔다.
// 받침 유무로 결정론적으로 고른다.

test("받침이 없으면 를·가·는·와", () => {
  assert.equal(withJosa("민수", "을"), "민수를");
  assert.equal(withJosa("민수", "이"), "민수가");
  assert.equal(withJosa("민수", "은"), "민수는");
  assert.equal(withJosa("민수", "와"), "민수와");
});

test("받침이 있으면 을·이·은·과", () => {
  assert.equal(withJosa("지영", "을"), "지영을");
  assert.equal(withJosa("지영", "이"), "지영이");
  assert.equal(withJosa("지영", "은"), "지영은");
  assert.equal(withJosa("지영", "와"), "지영과");
});

test("실측에서 틀렸던 이름들", () => {
  assert.equal(withJosa("서연", "이"), "서연이");   // "서연가" 였다
  assert.equal(withJosa("지영", "을"), "지영을");   // "지영를" 이었다
  assert.equal(withJosa("준호", "을"), "준호를");
  assert.equal(withJosa("다혜", "이"), "다혜가");
});

// 한글이 아닌 이름(영문·숫자)도 깨지지 않아야 한다 — 이름은 사용자 입력이다.
test("한글이 아니면 받침 없음으로 본다 (깨지지 않는다)", () => {
  assert.equal(withJosa("Amy", "을"), "Amy를");
  assert.equal(withJosa("", "을"), "를");
});

// 로/으로도 자주 쓴다. ㄹ 받침은 예외다.
test("로·으로는 ㄹ 받침이 예외", () => {
  assert.equal(withJosa("민수", "로"), "민수로");
  assert.equal(withJosa("지영", "로"), "지영으로");
  assert.equal(withJosa("서울", "로"), "서울로"); // ㄹ 받침
});
