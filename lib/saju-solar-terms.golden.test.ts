import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 절기 골든값 대조 — 엔진이 계산한 절입 시각이 발행 만세력과 맞는지 직접 검사한다.
 *
 * 왜 이 형태인가 (2026-08-06, 독립 검수 지적 반영):
 * 처음엔 "프로세스 TZ가 X인지"를 검사하는 테스트를 썼는데 그건 틀린 가드였다.
 *  ① 환경 변수 값만 볼 뿐 **계산 결과가 맞는지는 안 본다**
 *  ② 방향을 잘못 잡으면(실제로 잘못 잡았다) 틀린 동작을 테스트로 고착시킨다
 * 골든값 대조는 어느 환경에서 돌든 TZ 오염을 잡는다.
 *
 * 배경 — @gracefullight/saju 는 "한국 벽시계를 UTC 인 척 인코딩한" 공간에서 계산한다.
 * 어댑터 필드 getter 가 timeZone 을 무시하고 프로세스 로컬 필드를 읽고
 * (adapters/date-fns.js:34-40), 절기 탐색이 그 필드를 UTC 로 간주해 태양황경을 푼다
 * (core/four-pillars.js:56-88). 그래서 프로세스가 UTC 여야 결과가 천문학적으로 맞는다.
 * KST 로 돌리면 절기가 9시간 밀려 절입 경계 출생자의 월주가 뒤집힌다.
 *
 * 골든값 출처: 발행 만세력(uncle.tools, KASI 계열).
 * 허용 오차 10분 — 라이브러리는 Meeus 근사라 실측 2~3분 차이가 정상이다.
 */
const TOLERANCE_MIN = 10;

/** 라이브러리 규약: 반환 millis 의 **UTC 필드**가 곧 한국 벽시계 값이다. */
function wallClock(ms: number) {
  const d = new Date(ms);
  return {
    text: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
    ms,
  };
}

function expectedMs(y: number, mo: number, d: number, h: number, mi: number) {
  return Date.UTC(y, mo - 1, d, h, mi);
}

// [설명, 기준 출생일시(한국 벽시계), 기대 직전절기, 기대 다음절기]
const CASES: Array<[string, [number, number, number, number, number], [number, number, number, number, number], [number, number, number, number, number]]> = [
  ["1990 청명→입하", [1990, 5, 6, 1, 0], [1990, 4, 5, 10, 12], [1990, 5, 6, 3, 35]],
  ["1999 청명→입하", [1999, 4, 10, 22, 40], [1999, 4, 5, 14, 44], [1999, 5, 6, 8, 0]],
];

test("절기 시각이 발행 만세력과 일치한다(프로세스 TZ 오염 감지)", async () => {
  const { getAdapter } = await import("./utils/saju");
  const { analyzeSolarTerms } = await import("@gracefullight/saju");
  const adapter = await getAdapter();

  for (const [label, birth, prevExp, nextExp] of CASES) {
    const [by, bmo, bd, bh, bmi] = birth;
    // ★프로덕션과 **똑같은 방식**으로 만든다(로컬 필드 생성자). 이래야 TZ 오염이 재현된다.
    const dt = { date: new Date(by, bmo - 1, bd, bh, bmi), timeZone: "Asia/Seoul" };
    const terms: any = analyzeSolarTerms(dt, { adapter });

    for (const [kind, got, exp] of [
      ["직전절기", terms.prevJieMillis, prevExp],
      ["다음절기", terms.nextJieMillis, nextExp],
    ] as const) {
      const want = expectedMs(exp[0], exp[1], exp[2], exp[3], exp[4]);
      const diffMin = Math.abs(got - want) / 60000;
      assert.ok(
        diffMin <= TOLERANCE_MIN,
        `${label} ${kind}: 엔진 ${wallClock(got).text} vs 만세력 ${wallClock(want).text} — ` +
          `${Math.round(diffMin)}분 어긋남. 프로세스 TZ가 UTC가 아닐 가능성이 크다` +
          `(현재 offset ${-new Date().getTimezoneOffset() / 60}h). instrumentation.ts 참조.`,
      );
    }
  }
});
