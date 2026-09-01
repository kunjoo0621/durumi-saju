import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCoupleInputHash, isVerdictStale, type PartnerInput } from "./couple-input-hash";

const A = {
  name: "민수", birthYear: "1990", birthMonth: "5", birthDay: "6",
  birthHour: "1", birthMinute: "0", birthLocation: "서울", gender: "남성",
} as never;

const B: PartnerInput = {
  name: "지영", birthYear: "1995", birthMonth: "6", birthDay: "21",
  birthHour: "12", birthMinute: "0", birthLocation: "서울", gender: "여성",
  calendarType: "solar", unknownBirthTime: false,
};

/* ── 입력 해시 — 중복 차감을 좌우한다 ── */

test("같은 두 사람이면 같은 해시", () => {
  assert.equal(buildCoupleInputHash(A, B), buildCoupleInputHash(A, { ...B }));
});

// ★상대가 바뀌면 다른 리포트다. 해시가 같으면 "이미 결제함"으로 오인해
// 다른 상대의 옛 결과를 그대로 보여준다(재사용 이중과금 사고와 같은 계열).
test("상대가 바뀌면 해시가 달라진다", () => {
  const other = { ...B, birthYear: "1993" };
  assert.notEqual(buildCoupleInputHash(A, B), buildCoupleInputHash(A, other));
});

test("상대 이름만 달라도 다른 해시", () => {
  assert.notEqual(buildCoupleInputHash(A, B), buildCoupleInputHash(A, { ...B, name: "다른사람" }));
});

// ★A/B 순서는 고정이다(요청자=A). 뒤집으면 다른 리포트다 —
// 판정은 대칭이지만 서술은 "너/쟤" 시점이라 결과물이 다르다.
test("A·B 를 뒤집으면 다른 해시 (요청자 시점이 다르다)", () => {
  const asPartner: PartnerInput = {
    name: "민수", birthYear: "1990", birthMonth: "5", birthDay: "6",
    birthHour: "1", birthMinute: "0", birthLocation: "서울", gender: "남성",
    calendarType: "solar", unknownBirthTime: false,
  };
  const flipped = buildCoupleInputHash(B as never, asPartner);
  assert.notEqual(buildCoupleInputHash(A, B), flipped);
});

test("공백·자릿수 차이는 같은 사람으로 본다 (정규화)", () => {
  const messy: PartnerInput = { ...B, name: "  지영 ", birthMonth: "06", birthDay: "021" };
  assert.equal(buildCoupleInputHash(A, B), buildCoupleInputHash(A, messy));
});

// 시간 미상은 시·분을 무시해야 한다 — 안 그러면 같은 사람이 매번 다른 해시가 된다.
test("상대 시간 미상이면 시·분 값이 해시에 영향을 주지 않는다", () => {
  const u1: PartnerInput = { ...B, unknownBirthTime: true, birthHour: "3", birthMinute: "30" };
  const u2: PartnerInput = { ...B, unknownBirthTime: true, birthHour: "9", birthMinute: "45" };
  assert.equal(buildCoupleInputHash(A, u1), buildCoupleInputHash(A, u2));

  // 그리고 시간을 아는 경우와는 달라야 한다
  assert.notEqual(buildCoupleInputHash(A, u1), buildCoupleInputHash(A, B));
});

/* ── 결제 전 판정 게이트 ── */

// teaser 저장 시점과 결제 시점 사이에 대표사주 재분석 등으로 원국이 바뀔 수 있다.
// 그 상태로 과금하면 "본 것과 다른 리포트"를 팔게 된다.
test("판정이 그대로면 stale 이 아니다", () => {
  assert.equal(
    isVerdictStale({ verdict: "맞춰가며 사는 결", axes: ["순", "역", "평", "평"] },
                   { verdict: "맞춰가며 사는 결", axes: ["순", "역", "평", "평"] }),
    false,
  );
});

test("종합 판정이 바뀌면 stale", () => {
  assert.equal(
    isVerdictStale({ verdict: "맞춰가며 사는 결", axes: ["순", "역", "평", "평"] },
                   { verdict: "손이 자주 가는 결", axes: ["순", "역", "평", "평"] }),
    true,
  );
});

// 종합이 같아도 축이 바뀌면 본문이 달라진다 — 사용자가 본 것과 다른 걸 팔면 안 된다.
test("종합이 같아도 축이 바뀌면 stale", () => {
  assert.equal(
    isVerdictStale({ verdict: "맞춰가며 사는 결", axes: ["순", "역", "평", "평"] },
                   { verdict: "맞춰가며 사는 결", axes: ["순", "순", "평", "평"] }),
    true,
  );
});

/* ── 상대 입력 검증 ── */

import { validatePartnerInput } from "./couple-input-hash";

test("필수값이 빠지면 어느 필드가 문제인지 알려준다", () => {
  assert.deepEqual(validatePartnerInput({}).missing.sort(), [
    "birthDay", "birthMonth", "birthYear", "gender", "name",
  ]);
});

test("다 채우면 통과한다", () => {
  const r = validatePartnerInput(B);
  assert.equal(r.ok, true);
  assert.deepEqual(r.missing, []);
});

// ★시간은 필수가 아니다. 모르는 사람이 많고, 모른다는 사실 자체를 받아 중화 처리한다.
test("태어난 시간은 없어도 통과하되 '모름'으로 표시된다", () => {
  const r = validatePartnerInput({ ...B, birthHour: undefined, birthMinute: undefined, unknownBirthTime: true });
  assert.equal(r.ok, true);
  assert.equal(r.normalized.unknownBirthTime, true);
});

// 시를 안 넘겼는데 unknownBirthTime 도 없으면 "모름"으로 본다 — 빈 값을 0시로 오해하면
// 있지도 않은 시주를 만들어낸다(못 본 것 ≠ 없는 것).
test("시를 안 넘겼으면 0시가 아니라 '모름'으로 본다", () => {
  const r = validatePartnerInput({ ...B, birthHour: undefined, birthMinute: undefined });
  assert.equal(r.normalized.unknownBirthTime, true, "빈 시간을 0시로 오해했다");
});

test("미래 생년월일은 막는다", () => {
  const r = validatePartnerInput({ ...B, birthYear: "2999" });
  assert.equal(r.ok, false);
  assert.ok(r.invalid.includes("birthYear"));
});

test("말이 안 되는 월·일은 막는다", () => {
  assert.ok(validatePartnerInput({ ...B, birthMonth: "13" }).invalid.includes("birthMonth"));
  assert.ok(validatePartnerInput({ ...B, birthDay: "32" }).invalid.includes("birthDay"));
});

// 이름은 화면에 그대로 나간다 — 길이를 안 막으면 레이아웃이 깨지고 프롬프트도 오염된다.
test("이름 길이를 제한한다", () => {
  assert.ok(validatePartnerInput({ ...B, name: "가".repeat(40) }).invalid.includes("name"));
});
