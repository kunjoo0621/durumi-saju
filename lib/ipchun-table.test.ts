import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSolarYear } from "./utils/ipchun";

/**
 * 입춘 테이블 골든 대조.
 *
 * 왜: 기존 표가 "KST·한국천문연구원 자료"라고 적혀 있었는데 실제로는 전 항목이
 * 정확히 1시간 이른 **중국표준시(CST) 값**이었다(2026-08-07 독립 검수 발견).
 * 주석의 출처 표기를 믿을 수 없다는 게 교훈이라, 값 자체를 발행 자료와 대조해 고정한다.
 * 발행값 출처: 만세력 24절기표(2024 입춘 17:27 · 2026 입춘 05:02, 한국시간).
 *
 * 허용 오차 5분 — 발행처마다 반올림 관행이 달라 ±1~2분은 정상이다.
 */
const GOLDEN: Array<[number, number, number, number, number]> = [
  // year, month, day, hour, minute (KST 발행값)
  [2024, 2, 4, 17, 27],
  [2026, 2, 4, 5, 2],
];

test("입춘 테이블이 발행 만세력과 일치한다(CST 혼입 방지)", () => {
  for (const [y, mo, d, h, mi] of GOLDEN) {
    // 입춘 '직후'로 질의하면 그 해가 세운 연도로 잡히고, ipchunDate 가 표 값이다.
    const got = resolveSolarYear(new Date(y, mo - 1, d, h, mi + 30)).ipchunDate;
    const want = new Date(y, mo - 1, d, h, mi);
    const diffMin = Math.abs(got.getTime() - want.getTime()) / 60000;
    assert.ok(
      diffMin <= 5,
      `${y} 입춘: 표 ${got.getMonth() + 1}/${got.getDate()} ${got.getHours()}:${String(got.getMinutes()).padStart(2, "0")} vs ` +
        `발행 ${mo}/${d} ${h}:${String(mi).padStart(2, "0")} — ${Math.round(diffMin)}분 어긋남. ` +
        `60분이면 CST 값이 섞인 것이다.`,
    );
  }
});

test("입춘 이전 접속은 전년도 세운으로 잡는다", () => {
  // 2026 입춘 05:02 → 04:00 접속이면 아직 2025년 세운
  assert.equal(resolveSolarYear(new Date(2026, 1, 4, 4, 0)).solarYear, 2025);
  assert.equal(resolveSolarYear(new Date(2026, 1, 4, 6, 0)).solarYear, 2026);
});
