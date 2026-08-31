import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isOrphanUnlock,
  ORPHAN_GRACE_MS,
  refundReportUnlock,
  type UnlockStore,
} from "./report-unlock";

// ── 인메모리 store (lib/battle-idempotency.test.ts 패턴 미러) ──
// 실제 DB의 원자적 삭제를 흉내낸다: 같은 order_id 를 두 번 지우면 두 번째는 0건이다.
function makeStore(opts: { refunded?: boolean; failLookup?: boolean; failDelete?: boolean } = {}) {
  let unlockExists = true;
  const refunds: Array<{ orderId: string; amount: number }> = [];
  if (opts.refunded) refunds.push({ orderId: "ord_1", amount: 20 });

  const store: UnlockStore = {
    async hasRefund(_userId, orderId) {
      if (opts.failLookup) return { ok: false, found: false };
      return { ok: true, found: refunds.some((r) => r.orderId === orderId) };
    },
    async deleteUnlock(_orderId) {
      if (opts.failDelete) return { ok: false, deletedCount: 0 };
      if (!unlockExists) return { ok: true, deletedCount: 0 };
      unlockExists = false; // 원자적 승자 결정
      return { ok: true, deletedCount: 1 };
    },
    async refund(_userId, amount, orderId) {
      refunds.push({ orderId, amount });
    },
  };
  return { store, refunds, get unlockExists() { return unlockExists; } };
}

/* ── 핵심 불변식: 차감 1회당 환불 최대 1회 ── */

test("정상 경로 — unlock 을 지운 호출만 환불한다", async () => {
  const { store, refunds } = makeStore();
  const ok = await refundReportUnlock(store, "u1", "ord_1", 20);

  assert.equal(ok, true);
  assert.equal(refunds.length, 1);
  assert.deepEqual(refunds[0], { orderId: "ord_1", amount: 20 });
});

// ★이 프로젝트는 이미 이중과금 사고(75건/54명)를 겪었다. 반대 방향(이중 환불)도
// 똑같이 막아야 한다 — refundCoins 는 참조 기준 멱등이 아니라서 두 번 부르면 코인이 는다.
test("★동시에 두 번 불려도 환불은 정확히 한 번", async () => {
  const { store, refunds } = makeStore();

  const [a, b] = await Promise.all([
    refundReportUnlock(store, "u1", "ord_1", 20),
    refundReportUnlock(store, "u1", "ord_1", 20),
  ]);

  assert.equal(a, true);
  assert.equal(b, true);
  assert.equal(refunds.length, 1, `환불이 ${refunds.length}회 일어났다 — 코인 증식`);
});

test("다른 경로가 이미 unlock 을 정리했으면 환불하지 않는다", async () => {
  const { store, refunds } = makeStore();
  await refundReportUnlock(store, "u1", "ord_1", 20); // 첫 호출이 승자
  const ok = await refundReportUnlock(store, "u1", "ord_1", 20);

  assert.equal(ok, true, "이미 정리된 건 실패가 아니다");
  assert.equal(refunds.length, 1);
});

test("환불이 이미 기록돼 있으면 unlock 만 지우고 재환불하지 않는다", async () => {
  const { store, refunds } = makeStore({ refunded: true });
  const ok = await refundReportUnlock(store, "u1", "ord_1", 20);

  assert.equal(ok, true);
  assert.equal(refunds.length, 1, "기존 환불 1건 그대로여야 한다");
});

/* ── 실패는 조용히 넘기지 않는다 ── */

// ★fail-closed. 조회가 실패했는데 "환불 기록 없음"으로 오판하면 이중 환불이 된다.
test("환불 기록 조회가 실패하면 아무것도 건드리지 않고 false", async () => {
  const s = makeStore({ failLookup: true });
  const ok = await refundReportUnlock(s.store, "u1", "ord_1", 20);

  assert.equal(ok, false);
  assert.equal(s.refunds.length, 0);
  assert.equal(s.unlockExists, true, "조회 실패인데 unlock 을 지웠다");
});

test("unlock 삭제가 실패하면 환불하지 않고 false", async () => {
  const { store, refunds } = makeStore({ failDelete: true });
  const ok = await refundReportUnlock(store, "u1", "ord_1", 20);

  assert.equal(ok, false);
  assert.equal(refunds.length, 0);
});

/* ── orphan 유예 ── */

// 크래시로 full_json 없이 남은 unlock. 유예 안이면 "진행 중"으로 보고 재차감을 막는다.
test("orphan 판정은 유예 시간을 기준으로 한다", () => {
  const now = 1_700_000_000_000;

  assert.equal(isOrphanUnlock(now - 1000, now), false, "방금 만든 건 진행 중이다");
  assert.equal(isOrphanUnlock(now - ORPHAN_GRACE_MS + 1000, now), false, "유예 안이다");
  assert.equal(isOrphanUnlock(now - ORPHAN_GRACE_MS - 1000, now), true, "유예를 넘겼다");
});

test("생성 시각을 모르면 orphan 으로 보지 않는다 (재차감 방지 쪽으로 기운다)", () => {
  assert.equal(isOrphanUnlock(null, Date.now()), false);
});
