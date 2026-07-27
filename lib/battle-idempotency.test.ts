import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isUniqueViolation,
  findBattleBySession,
  insertBattleIdempotent,
  type BattleStore,
  type StoredBattle,
} from "./battle-idempotency";

// ── 테스트용 인메모리 store ───────────────────────────
// 실제 saju_battles(session_id UNIQUE WHERE NOT NULL)의 동작을 흉내낸다.
function makeStore(opts: { failInsertTimes?: number } = {}) {
  const rows: StoredBattle[] = [];
  let seq = 0;
  let failLeft = opts.failInsertTimes ?? 0;
  const calls = { find: 0, insert: 0 };

  const store: BattleStore = {
    async findBySessionId(sessionId) {
      calls.find++;
      return rows.find((r) => r.session_id === sessionId) ?? null;
    },
    async insert(row) {
      calls.insert++;
      if (failLeft > 0) {
        failLeft--;
        return { row: null, error: { code: "XX000", message: "일시 오류" } };
      }
      const sid = (row.session_id as string | null) ?? null;
      if (sid !== null && rows.some((r) => r.session_id === sid)) {
        // UNIQUE 부분인덱스 위반
        return { row: null, error: { code: "23505", message: "duplicate key" } };
      }
      const created: StoredBattle = {
        id: `battle-${++seq}`,
        session_id: sid,
        full_result: row.full_result,
      };
      rows.push(created);
      return { row: created, error: null };
    },
  };
  return { store, rows, calls };
}

const RESULT_A = { llmAnalysis: "A" };
const RESULT_B = { llmAnalysis: "B" };

// ── isUniqueViolation ────────────────────────────────
test("isUniqueViolation: 23505만 UNIQUE 위반으로 본다", () => {
  assert.equal(isUniqueViolation({ code: "23505" }), true);
  assert.equal(isUniqueViolation({ code: "XX000" }), false);
  assert.equal(isUniqueViolation(null), false);
  assert.equal(isUniqueViolation(undefined), false);
  assert.equal(isUniqueViolation({}), false);
});

// ── findBattleBySession ──────────────────────────────
test("findBattleBySession: sessionId 없으면 조회 자체를 안 한다", async () => {
  const { store, calls } = makeStore();
  assert.equal(await findBattleBySession(store, null), null);
  assert.equal(await findBattleBySession(store, ""), null);
  assert.equal(calls.find, 0);
});

test("findBattleBySession: 같은 세션의 기존 배틀을 돌려준다", async () => {
  const { store } = makeStore();
  await insertBattleIdempotent(store, { full_result: RESULT_A }, "sess-1");
  const found = await findBattleBySession(store, "sess-1");
  assert.equal(found?.session_id, "sess-1");
  assert.deepEqual(found?.full_result, RESULT_A);
  assert.equal(await findBattleBySession(store, "sess-other"), null);
});

// ── insertBattleIdempotent: 핵심 ─────────────────────
test("같은 세션으로 두 번 insert 해도 배틀은 1건 (동시 더블탭)", async () => {
  const { store, rows } = makeStore();
  const first = await insertBattleIdempotent(store, { full_result: RESULT_A }, "sess-1");
  const second = await insertBattleIdempotent(store, { full_result: RESULT_B }, "sess-1");

  assert.equal(rows.length, 1, "배틀 row는 1건이어야 한다");
  assert.equal(first.reused, false);
  assert.equal(second.reused, true, "두 번째는 기존 row 재사용");
  assert.equal(second.battleId, first.battleId, "같은 배틀 id로 수렴");
  assert.deepEqual(second.result, RESULT_A, "먼저 저장된 결과를 돌려준다");
});

test("다른 세션이면 각각 생성된다 (정상 재시도 = 신규 배틀)", async () => {
  const { store, rows } = makeStore();
  const a = await insertBattleIdempotent(store, { full_result: RESULT_A }, "sess-1");
  const b = await insertBattleIdempotent(store, { full_result: RESULT_B }, "sess-2");
  assert.equal(rows.length, 2);
  assert.notEqual(a.battleId, b.battleId);
});

test("sessionId 없으면(게스트) 멱등 처리 없이 매번 생성 — 기존 동작 유지", async () => {
  const { store, rows } = makeStore();
  await insertBattleIdempotent(store, { full_result: RESULT_A }, null);
  await insertBattleIdempotent(store, { full_result: RESULT_B }, null);
  assert.equal(rows.length, 2);
});

test("일시적 DB 오류는 1회 재시도한다", async () => {
  const { store, rows, calls } = makeStore({ failInsertTimes: 1 });
  const res = await insertBattleIdempotent(store, { full_result: RESULT_A }, "sess-1");
  assert.equal(res.battleId !== null, true, "재시도로 성공해야 한다");
  assert.equal(rows.length, 1);
  assert.equal(calls.insert, 2);
});

test("재시도해도 실패하면 battleId=null + error 를 돌려준다 (throw 안 함)", async () => {
  const { store, rows } = makeStore({ failInsertTimes: 5 });
  const res = await insertBattleIdempotent(store, { full_result: RESULT_A }, "sess-1");
  assert.equal(res.battleId, null);
  assert.equal(res.error?.code, "XX000");
  assert.equal(rows.length, 0);
});

test("UNIQUE 위반인데 조회도 비면 error 를 돌려준다 (무한루프 없음)", async () => {
  const calls = { insert: 0 };
  const store: BattleStore = {
    async findBySessionId() {
      return null; // 경쟁 row 를 못 찾는 비정상 상황
    },
    async insert() {
      calls.insert++;
      return { row: null, error: { code: "23505", message: "duplicate key" } };
    },
  };
  const res = await insertBattleIdempotent(store, { full_result: RESULT_A }, "sess-1");
  assert.equal(res.battleId, null);
  assert.equal(res.error?.code, "23505");
  assert.ok(calls.insert <= 2, "UNIQUE 위반으로 무한 재시도하면 안 된다");
});
