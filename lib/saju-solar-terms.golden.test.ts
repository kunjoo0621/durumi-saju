import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 절기 골든값 대조 — 엔진이 계산한 절입 시각이 발행 만세력과 맞는지 직접 검사한다.
 *
 * ★역할 분담(2026-08-07 정리): TZ 오염 자체는 `getAdapter()` 의 ensureUtcProcess 가
 *   진입 시점에 교정하므로 여기까진 오지 않는다(그래서 이 테스트는 어떤 TZ에서도 통과한다).
 *   이 파일이 지키는 건 **천문값의 정확성** — 라이브러리 업그레이드나 테이블 교체로
 *   절기 시각이 틀어지면 여기서 잡힌다. 자가치유 동작 자체는 아래 별도 테스트가 지킨다.
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
 * 허용 오차 10분. ★근거(독립 검수 실측): 라이브러리의 Meeus 근사 오차는 **연도마다 다르다** —
 * 1990·1999는 1~4분이지만 2015년 ~6분, **2026년은 12~13분**까지 벌어진다.
 * 그래서 ①골든 케이스는 **1985~2010년 범위에서만** 추가할 것(최근 연도를 넣으면 TZ와
 * 무관하게 깨진다) ②허용치를 15분으로 올리지 말 것 — 최소 TZ 오프셋 단위가 15분이라
 * 구분이 흐려진다. 10분이 '근사 오차는 통과, TZ 오염은 검출' 사이의 마진이다.
 * 검출 범위 실측: America/New_York·Asia/Tokyo·Asia/Kathmandu(+5:45) 전부 실패로 잡힌다.
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
  ["1999 청명→입하", [1999, 4, 10, 22, 40], [1999, 4, 5, 14, 44], [1999, 5, 6, 8, 1]], // 입하 08:01 (3출처 교차확인)
];

test("절기 시각이 발행 만세력과 일치한다", async () => {
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

/**
 * 자가치유 가드 — `getAdapter()` 가 오염된 프로세스 TZ를 UTC로 되돌리는지.
 * scripts/*.mts 는 instrumentation 훅을 안 거치므로 이 교정이 유일한 방어선이다.
 * 이게 깨지면 KST 맥에서 돌린 감사 스크립트가 **조용히 틀린 값**을 낸다.
 */
test("오염된 TZ로 진입해도 getAdapter가 UTC로 교정한다", async () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "Asia/Seoul";
    assert.notEqual(new Date().getTimezoneOffset(), 0, "전제: 오염 상태여야 한다");
    const { getAdapter } = await import("./utils/saju");
    await getAdapter();
    assert.equal(new Date().getTimezoneOffset(), 0, "getAdapter 후 UTC여야 한다");
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
