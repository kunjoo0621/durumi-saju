/**
 * 정밀 절기 모듈 골든 테스트.
 *
 * ★기존 `saju-solar-terms.golden.test.ts` 와 역할이 다르다. 그건 **엔진 경로**의
 *   TZ 오염을 잡는 가드라 허용치가 넉넉하다. 여기는 **새 소스의 정확성** 자체를
 *   증명하는 테스트라 허용치가 2분이다. 기존 파일은 손대지 않는다.
 *
 * 케이스 출처:
 *  - 1990/1999 : 발행 만세력 (기존 골든 테스트와 동일 값, 3출처 교차확인)
 *  - 2005      : 한국천문연구원(KASI) get24DivisionsInfo 실측
 *  - 2026      : KASI 실측. ★이 해는 엔진 Meeus 공식이 12~13분 벌어지는 구간이라
 *                기존 테스트엔 못 넣던 연도다. 여기서 0분이 나오는 게 새 소스의 우월성 증명.
 *
 * 실행: TZ=UTC npx tsx --test lib/solar-terms-precise.golden.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const TOLERANCE_MIN = 2;

/** 한국 벽시계를 UTC 로 인코딩 — 프로젝트 millis 규약 */
const wall = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo - 1, d, h, mi);
const text = (ms: number) => {
  const x = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getUTCFullYear()}-${p(x.getUTCMonth() + 1)}-${p(x.getUTCDate())} ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}`;
};

// [설명, 연, 절기명, 정답(한국 벽시계)]
const CASES: Array<[string, number, string, [number, number, number, number, number]]> = [
  // 발행 만세력 (기존 골든과 동일)
  ["1990 청명", 1990, "청명", [1990, 4, 5, 10, 12]],
  ["1990 입하", 1990, "입하", [1990, 5, 6, 3, 35]],
  ["1999 청명", 1999, "청명", [1999, 4, 5, 14, 44]],
  ["1999 입하", 1999, "입하", [1999, 5, 6, 8, 1]],
  // KASI 실측 (2005)
  ["2005 입춘", 2005, "입춘", [2005, 2, 4, 2, 43]],
  ["2005 입하", 2005, "입하", [2005, 5, 5, 18, 53]],
  ["2005 입추", 2005, "입추", [2005, 8, 7, 19, 3]],
  ["2005 대설", 2005, "대설", [2005, 12, 7, 9, 33]],
  // KASI 실측 (2026) — 엔진이 12~13분 벌어지는 구간
  ["2026 입춘", 2026, "입춘", [2026, 2, 4, 5, 2]],
  ["2026 청명", 2026, "청명", [2026, 4, 5, 3, 40]],
  ["2026 입하", 2026, "입하", [2026, 5, 5, 20, 49]],
  ["2026 입추", 2026, "입추", [2026, 8, 7, 20, 43]],
];

test("정밀 절기가 발행 만세력·KASI 와 일치한다", async () => {
  const { getJieOfYear } = await import("./utils/solar-terms-precise");

  for (const [label, year, name, exp] of CASES) {
    const want = wall(exp[0], exp[1], exp[2], exp[3], exp[4]);
    const got = getJieOfYear(year).find((t) => t.name === name);
    assert.ok(got, `${label}: 절기 '${name}' 을 못 찾았다`);
    const diffMin = Math.abs(got!.ms - want) / 60000;
    assert.ok(
      diffMin <= TOLERANCE_MIN,
      `${label}: 계산 ${text(got!.ms)} vs 정답 ${text(want)} — ${diffMin.toFixed(0)}분 어긋남. ` +
        `CST→KST +1h 보정 또는 12절 필터를 확인할 것.`,
    );
  }
});

test("prev/next 가 출생 시각을 감싸고, 해 경계에서도 깨지지 않는다", async () => {
  const { getPreciseJieMillis } = await import("./utils/solar-terms-precise");

  // ★1월 3일 — 직전 절이 '전해 대설'이라 y-1 병합이 없으면 깨진다.
  const early = getPreciseJieMillis(wall(2026, 1, 3, 12, 0));
  assert.ok(early, "1월 초 조회 실패 — y-1 병합 누락 가능성");
  assert.equal(early!.prevName, "대설");
  assert.equal(early!.nextName, "소한");

  // ★12월 30일 — 다음 절이 '다음해 소한'이라 y+1 병합이 없으면 깨진다.
  const late = getPreciseJieMillis(wall(2026, 12, 30, 12, 0));
  assert.ok(late, "12월 말 조회 실패 — y+1 병합 누락 가능성");
  assert.equal(late!.prevName, "대설");
  assert.equal(late!.nextName, "소한");

  // 감싸기 불변식
  for (const [y, mo, d] of [[1990, 5, 6], [2005, 8, 7], [2026, 4, 5]] as [number, number, number][]) {
    const ms = wall(y, mo, d, 12, 0);
    const r = getPreciseJieMillis(ms);
    assert.ok(r, `${y}-${mo}-${d} 조회 실패`);
    assert.ok(r!.prevJieMillis <= ms && ms < r!.nextJieMillis,
      `${y}-${mo}-${d}: prev ≤ 출생 < next 가 깨졌다`);
  }
});

test("중기(氣)는 절기 목록에 섞이지 않는다", async () => {
  const { getJieOfYear } = await import("./utils/solar-terms-precise");
  const names = getJieOfYear(2026).map((t) => t.name);
  assert.equal(names.length, 12, `12절이어야 하는데 ${names.length}개다: ${names.join(",")}`);
  for (const gi of ["춘분", "하지", "추분", "동지", "대한", "처서", "곡우", "소만"])
    assert.ok(!names.includes(gi), `중기 '${gi}' 가 섞였다 — 화이트리스트 확인`);
});
