import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit } from "./server/rateLimit";

// checkRateLimit은 4개 라우트(battle/analyze, analyze, results/full, yearly/full)가 이미
// 의존하는데 테스트가 없었다. 2026-07-29 무한루프 사고 대응으로 career/wealth/marriage의
// start 라우트에도 "비용 상한"으로 붙였으므로(분당 20 / 시간당 120), 그 임계값이 실제로
// 기대대로 끊기는지 못박아 둔다. off-by-one이 생기면 세 라우트의 천장이 조용히 바뀐다.
//
// 주의: rateLimitStore가 모듈 전역 Map이라 테스트마다 고유 키를 써야 서로 간섭하지 않는다.

test("첫 호출은 통과하고 remaining이 max-1이다", () => {
  const r = checkRateLimit("t:first", 20, 60_000);
  assert.equal(r.allowed, true);
  assert.equal(r.remaining, 19);
});

test("max번째까지 통과하고 max+1번째에 막힌다 (start 라우트 분당 20 기준)", () => {
  const key = "t:boundary-20";
  for (let i = 1; i <= 20; i++) {
    assert.equal(checkRateLimit(key, 20, 60_000).allowed, true, `${i}번째는 통과해야 한다`);
  }
  const blocked = checkRateLimit(key, 20, 60_000);
  assert.equal(blocked.allowed, false, "21번째는 막혀야 한다");
  assert.equal(blocked.remaining, 0);
});

test("시간당 120 임계값도 동일하게 동작한다", () => {
  const key = "t:boundary-120";
  for (let i = 1; i <= 120; i++) {
    assert.equal(checkRateLimit(key, 120, 60 * 60_000).allowed, true);
  }
  assert.equal(checkRateLimit(key, 120, 60 * 60_000).allowed, false);
});

test("키가 다르면 카운터가 독립이다 — 유저별 격리(userId 키잉)가 성립한다", () => {
  const a = "t:userA";
  const b = "t:userB";
  for (let i = 1; i <= 20; i++) checkRateLimit(a, 20, 60_000);
  assert.equal(checkRateLimit(a, 20, 60_000).allowed, false, "A는 소진되어야 한다");
  assert.equal(checkRateLimit(b, 20, 60_000).allowed, true, "B는 영향받지 않아야 한다");
});

test("윈도우가 지나면 카운터가 리셋된다", async () => {
  const key = "t:window";
  assert.equal(checkRateLimit(key, 1, 30).allowed, true);
  assert.equal(checkRateLimit(key, 1, 30).allowed, false, "같은 윈도우 안에서는 막힌다");
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(checkRateLimit(key, 1, 30).allowed, true, "윈도우 만료 후 다시 통과해야 한다");
});

test("막힌 뒤에도 retryAfter가 음수가 되지 않는다", () => {
  const key = "t:retry-after";
  checkRateLimit(key, 1, 60_000);
  const blocked = checkRateLimit(key, 1, 60_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter >= 0, `retryAfter=${blocked.retryAfter}`);
  assert.ok(blocked.retryAfter <= 60, `retryAfter=${blocked.retryAfter}`);
});
