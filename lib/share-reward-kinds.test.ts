import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

// ────────────────────────────────────────────────────────
// TS ↔ DB 대조. 위 세 테스트는 TS 안(유니언 ↔ 관문 맵)만 닫는다. 실제 게이트는
// Postgres CHECK 제약이고, 거기 빠진 kind는 타입체크도 이 테스트도 통과한 뒤
// 실서비스에서 첫 공유 시도가 CHECK 위반으로 터질 때에야 드러난다.
// 이 저장소는 "선언은 한 곳, 실사용은 파일마다 복제" 드리프트로 6개월짜리 버그를
// 겪은 적이 있다(12신살). 그래서 마이그레이션 SQL을 직접 읽어 대조한다.
// ────────────────────────────────────────────────────────

const MIGRATION_PATH = fileURLToPath(
  new URL("../supabase/migrations/20260728_share_kakao_reward.sql", import.meta.url)
);

function kindListsInMigration(): string[][] {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const matches = [...sql.matchAll(/result_kind\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(result_kind\s+IN\s*\(([^)]*)\)/g)];
  return matches.map((m) =>
    m[1]
      .split(",")
      .map((s) => s.trim().replace(/^'|'$/g, ""))
      .filter(Boolean)
  );
}

test("마이그레이션의 CHECK 제약이 SHARE_REWARD_KINDS와 일치한다", () => {
  const lists = kindListsInMigration();
  // share_reward_grants / share_kakao_nonces 두 테이블
  assert.equal(lists.length, 2, "CHECK 제약을 2개 찾지 못했다 — 마이그레이션 형식이 바뀌었나?");

  const expected = [...SHARE_REWARD_KINDS].sort();
  for (const list of lists) {
    assert.deepEqual(
      [...list].sort(),
      expected,
      `CHECK 제약과 SHARE_REWARD_KINDS가 어긋난다. SQL=${list.join(",")} / TS=${SHARE_REWARD_KINDS.join(",")}`
    );
  }
});

test("today는 CHECK 제약에 없다(5알 상품에 5알 지급 = 실질 무료화)", () => {
  for (const list of kindListsInMigration()) {
    assert.ok(!list.includes("today"), "today가 CHECK 제약에 들어갔다");
  }
});
