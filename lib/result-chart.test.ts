/**
 * 원국 스냅샷 빌더 회귀 가드.
 *
 * 이 테스트가 있는 이유: D-14(2026-08-22 유료 클레임)는 **출생지역 인자 하나가 빠져서**
 * 화면 시주가 서버 분석값과 6개월간 갈라진 사고였다. 같은 실수가 다시 들어오면
 * 여기서 잡힌다. `npm test` 로 CI 에서 돈다.
 *
 * 실행: TZ=UTC npx tsx --test lib/result-chart.test.ts
 * ★TZ=UTC 필수 — 로컬 KST 로 돌리면 프로덕션과 다른 값이 나온다(CLAUDE.md).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// ★.test.ts 는 CJS 로 변환돼 top-level await 를 못 쓴다 — 각 테스트 안에서 import 한다.
const load = () => import("./result-chart");

const pillar = (p: any) => p.heavenlyStem + p.earthlyBranch;

test("출생지역 보정이 시주에 반영된다 (D-14 회귀 가드)", async () => {
  const { buildChartSnapshot } = await load();
  // 실제 클레임 케이스: 1995-07-22 15:35. 경남이면 壬申, 서울 기준이면 辛未.
  const gyeongnam = await buildChartSnapshot({
    birth_date: "1995-07-22", birth_time: "15:35", calendar_type: "solar", region: "경남",
  });
  const seoul = await buildChartSnapshot({
    birth_date: "1995-07-22", birth_time: "15:35", calendar_type: "solar", region: "서울",
  });

  assert.ok(gyeongnam && seoul);
  assert.equal(pillar(gyeongnam.sajuData.hour), "壬申", "경남 15:35 는 임신이다");
  assert.equal(pillar(seoul.sajuData.hour), "辛未", "서울 15:35 는 신미다 — 지역이 시주를 바꾼다");

  // 나머지 세 기둥은 지역과 무관하다(경도는 시주에만 반영된다).
  for (const key of ["year", "month", "day"] as const) {
    assert.equal(pillar(gyeongnam.sajuData[key]), pillar(seoul.sajuData[key]), `${key}주는 지역 무관`);
  }
});

test("지역 미지정이면 서울 기본값과 같다 (서버·화면 대칭)", async () => {
  const { buildChartSnapshot } = await load();
  const none = await buildChartSnapshot({ birth_date: "1995-07-22", birth_time: "15:35" });
  const seoul = await buildChartSnapshot({
    birth_date: "1995-07-22", birth_time: "15:35", region: "서울",
  });
  assert.ok(none && seoul);
  assert.equal(pillar(none.sajuData.hour), pillar(seoul.sajuData.hour));
});

test("enrichment 이 스냅샷에 함께 들어간다", async () => {
  const { buildChartSnapshot } = await load();
  const c = await buildChartSnapshot({
    birth_date: "1995-07-22", birth_time: "15:35", calendar_type: "solar", region: "경남",
  });
  assert.ok(c);
  assert.ok(c.enriched, "enriched 가 있어야 화면이 계산할 필요가 없다");
  assert.ok((c.enriched as any).shinsal, "신살");
  assert.ok((c.enriched as any).tenStars, "십성");
  assert.equal(c.unknownBirthTime, false);
  assert.equal(c.birthYear, 1995);
});

test("음력 윤달이 결과를 바꾼다", async () => {
  const { buildChartSnapshot } = await load();
  // 2020년 윤4월 — 평달과 윤달의 양력 날짜가 다르므로 사주도 달라야 한다.
  const plain = await buildChartSnapshot({
    birth_date: "2020-04-15", birth_time: "10:00", calendar_type: "lunar", region: "서울",
  });
  const leap = await buildChartSnapshot({
    birth_date: "2020-04-15", birth_time: "10:00", calendar_type: "lunar", region: "서울",
    is_leap_month: true,
  });
  assert.ok(plain && leap);
  assert.notEqual(pillar(plain.sajuData.day), pillar(leap.sajuData.day), "윤달이면 일주가 달라진다");
});

test("시간 미상이면 그렇게 표시된다", async () => {
  const { buildChartSnapshot } = await load();
  const c = await buildChartSnapshot({ birth_date: "1995-07-22", birth_time: null, region: "서울" });
  assert.ok(c);
  assert.equal(c.unknownBirthTime, true);
});

test("생년월일이 없으면 null (표시 경로라 던지지 않는다)", async () => {
  const { buildChartSnapshot } = await load();
  assert.equal(await buildChartSnapshot({}), null);
  assert.equal(await buildChartSnapshot({ birth_date: "" }), null);
});

test("readStoredChart: 저장된 스냅샷만 인정한다", async () => {
  const { buildChartSnapshot, readStoredChart } = await load();
  const c = await buildChartSnapshot({
    birth_date: "1995-07-22", birth_time: "15:35", region: "경남",
  });
  assert.ok(c);

  // 정상 — 분석 결과 안에 들어 있는 형태
  const stored = readStoredChart({ tier: {}, scores: {}, chart: c });
  assert.ok(stored);
  assert.equal(pillar(stored.sajuData.hour), "壬申");

  // 스냅샷 없는 과거 행 → null 이어야 호출부가 읽기 시점 계산으로 폴백한다
  assert.equal(readStoredChart({ tier: {}, scores: {} }), null);
  assert.equal(readStoredChart(null), null);
  // 깨진 형태를 그대로 그리면 화면이 터진다 — 반드시 걸러야 한다
  assert.equal(readStoredChart({ chart: {} }), null);
  assert.equal(readStoredChart({ chart: { sajuData: {} } }), null);
  assert.equal(readStoredChart({ chart: { sajuData: c.sajuData } }), null, "enriched 없으면 무효");
});
