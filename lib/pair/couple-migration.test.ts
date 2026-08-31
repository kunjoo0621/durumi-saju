import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ★이 테스트가 있는 이유: 마이그레이션은 로컬에서 돌려볼 수 없다(프로덕션 DB 변경은
// 허락받고 적용한다). 그래서 "코드가 쓰려는 컬럼"과 "SQL 이 만드는 컬럼"이 어긋나는
// 것을 파일 대조로 잡는다. 컬럼을 빼먹으면 배포 후 런타임에서야 터진다.
//
// 판정 필드를 늘렸는데 마이그레이션을 안 고치면 여기서 먼저 깨진다.

const SQL = readFileSync("supabase/migrations/20260901_couple_results.sql", "utf-8");

test("couple_results 에 두 사람 입력 스냅샷 컬럼이 다 있다", () => {
  for (const col of [
    "name", "birth_date", "birth_time", "region", "gender", "calendar_type",
    "partner_name", "partner_birth_date", "partner_birth_time",
    "partner_region", "partner_gender", "partner_calendar_type",
    "partner_unknown_birth_time",
  ]) {
    assert.match(SQL, new RegExp(`\\b${col}\\b`), `컬럼 없음: ${col}`);
  }
});

// ★currentYear 주입(lib/pair/pair-facts.ts)과 한 쌍이다. 저장하지 않으면 결제 전
// 재계산 게이트가 '오늘'로 다시 계산하게 되고, 12/31 teaser → 1/1 analyze 에서
// 정당한 결제가 409로 튕긴다.
test("판정에 쓴 연도를 저장한다 (결제 전 재계산 게이트의 전제)", () => {
  assert.match(SQL, /current_year\s+int\s+not null/, "current_year 가 없거나 nullable 이다");
});

test("4축 판정과 중화 축을 저장한다", () => {
  for (const col of ["verdict", "axis_mind", "axis_life", "axis_complement", "axis_timing"]) {
    assert.match(SQL, new RegExp(`\\b${col}\\b`), `컬럼 없음: ${col}`);
  }
  assert.match(SQL, /neutralized_axes\s+text\[\]/, "중화 축 배열 컬럼이 없다");
});

// 화면은 서버가 내려준 스냅샷만 그린다(CLAUDE.md — 표시 계층 사주 계산 금지).
test("사실 스냅샷 컬럼이 있다", () => {
  assert.match(SQL, /pair_facts_json\s+jsonb/);
  assert.match(SQL, /teaser_json\s+jsonb/);
  assert.match(SQL, /full_json\s+jsonb/);
});

/* ── 돈 불변식의 바닥 ── */

// lib/server/report-unlock.ts 의 "삭제 승자 판정"은 order_id UNIQUE 를 전제로 동작한다.
// 이 인덱스가 없으면 동시 요청에서 unlock 이 두 개 생기고 환불이 두 번 나간다.
test("★unlock 테이블에 order_id UNIQUE 가 있다", () => {
  assert.match(
    SQL,
    /create unique index[^;]*couple_result_unlocks[^;]*\(order_id\)/i,
    "order_id UNIQUE 가 없다 — 환불 불변식의 바닥이 빠졌다",
  );
});

test("unlock 테이블에 (user_id, input_hash) UNIQUE 가 있다 (중복 차감 방지)", () => {
  assert.match(
    SQL,
    /create unique index[^;]*couple_result_unlocks[^;]*\(user_id,\s*input_hash\)/i,
  );
});

/* ── 운영자 확정 준수 ── */

// §1-0 — 등급은 개인사주에서만. 컬럼을 만들어 두면 언젠가 화면에 뜬다.
test("등급 컬럼을 만들지 않는다 (§1-0 운영자 확정)", () => {
  // ★\bgrade\b 로 검사하면 안 된다 — 밑줄이 단어 문자라서 couple_grade 를 놓친다.
  //   역검증에서 실제로 빠져나갔다(2026-09-01).
  const hit = SQL.match(/^.*grade.*$/im);
  assert.equal(hit, null, `등급 컬럼이 있다: ${hit?.[0]}`);
});

/* ── 삭제·보안 ── */

test("계정 삭제 시 cascade 되고, 소유자 없는 row 를 막는다", () => {
  assert.match(SQL, /user_id uuid references public\.users\(id\) on delete cascade/);
  assert.match(SQL, /couple_result_unlocks[\s\S]*?on delete cascade/);
  assert.match(SQL, /couple_results_owner_check/);
  assert.match(SQL, /enable row level security/);
});
