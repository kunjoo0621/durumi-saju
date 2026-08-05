import { test } from "node:test";
import assert from "node:assert/strict";
import { SHARE_REWARD_KIND_CHECKS } from "./share-reward-kinds";
import { SHARE_REWARD_KINDS } from "./constants/share-reward";

test("SHARE_REWARD_KINDS 7종이 전부 지급 관문에 등록돼 있다", () => {
  for (const kind of SHARE_REWARD_KINDS) {
    assert.ok(SHARE_REWARD_KIND_CHECKS[kind], `${kind} 미등록`);
  }
});

test("결제 게이팅 라인(marriage/wealth/career)은 full_json NOT NULL을 요구한다", () => {
  for (const kind of ["marriage", "wealth", "career"] as const) {
    assert.equal(
      SHARE_REWARD_KIND_CHECKS[kind]?.requireNonNull,
      "full_json",
      `${kind}에 결제 검증이 없다 — 공짜 티저 row로 5알이 나간다`
    );
  }
});

test("기존 4종에는 requireNonNull을 새로 붙이지 않는다(회귀 방지)", () => {
  for (const kind of ["result", "battle", "yearly", "pet"] as const) {
    assert.equal(SHARE_REWARD_KIND_CHECKS[kind]?.requireNonNull, undefined);
  }
});

test("kind별 테이블 매핑이 정확하다", () => {
  assert.equal(SHARE_REWARD_KIND_CHECKS.result?.table, "saju_results");
  assert.equal(SHARE_REWARD_KIND_CHECKS.battle?.table, "saju_battles");
  assert.equal(SHARE_REWARD_KIND_CHECKS.yearly?.table, "yearly_results");
  assert.equal(SHARE_REWARD_KIND_CHECKS.pet?.table, "pet_compat_results");
  assert.equal(SHARE_REWARD_KIND_CHECKS.marriage?.table, "marriage_results");
  assert.equal(SHARE_REWARD_KIND_CHECKS.wealth?.table, "wealth_results");
  assert.equal(SHARE_REWARD_KIND_CHECKS.career?.table, "career_results");
});
