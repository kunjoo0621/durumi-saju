import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWealthTimeline, buildMarriageTimeline } from "./fortune-timeline";
import { applyWealthGuards } from "./wealth-postprocess";
import { applyMarriageGuards } from "./marriage-postprocess";
import type { FortuneResult } from "./utils/saju-fortune";

const YEAR = 2026;
// 세운 스텁: 2025~2031 (엔진 실제 범위 currentYear-1..+9의 부분집합)
const seun = [2025, 2026, 2027, 2028, 2029, 2030, 2031].map((year, i) => ({
  year,
  age: 30 + i,
  pillar: "丙午",
  stem: "丙",
  branch: "午",
  tenStar: "편재",
  twelveStage: "제왕",
}));
const fortune: FortuneResult = {
  daeun: {
    gender: "male",
    isForward: true,
    startAge: 3,
    startAgeDetail: { years: 3, months: 0, days: 0 },
    daysToTerm: 10,
    pillars: [],
  } as any,
  seun,
};

const wealthFacts: any = {
  timingWindows: [
    { year: 2025, age: 30, triggers: ["재성투출"], isPast: true },
    { year: 2027, age: 32, triggers: ["비겁손재"], isPast: false },
  ],
  daeunWealthYears: [{ startAge: 34, endAge: 43, star: "정재" }],
};

test("wealth: 범위 currentYear-1..+5, 과거/현재 플래그, 트리거→무드 결정론", () => {
  const tl = buildWealthTimeline(fortune, wealthFacts, YEAR)!;
  assert.equal(tl.entries.length, 7); // 2025..2031
  assert.equal(tl.entries[0].year, 2025);
  assert.equal(tl.entries[0].isPast, true);
  assert.equal(tl.entries[0].mood, "강세"); // 재성투출
  assert.equal(tl.entries[1].isCurrent, true); // 2026
  assert.equal(tl.entries[1].mood, "보통"); // 트리거 없음
  assert.equal(tl.entries[2].mood, "주의"); // 2027 비겁손재
  assert.ok(tl.entries[2].hint.includes("점검")); // 절대 규칙 4 프레임(손실 단정 금지)
  assert.equal(tl.entries[0].pillarKorean, "병오");
  assert.deepEqual(tl.daeun, wealthFacts.daeunWealthYears);
});

test("wealth: '위기' 무드는 존재하지 않는다(공포 프레임 금지 — 강세/보통/주의 3단만)", () => {
  const tl = buildWealthTimeline(fortune, wealthFacts, YEAR)!;
  assert.ok(tl.entries.every((e) => ["강세", "보통", "주의"].includes(e.mood)));
});

test("marriage: 기혼이면 도화홍염 힌트가 부부 내부 프레임", () => {
  const mFacts: any = {
    maritalStatus: "기혼",
    timingWindows: [{ year: 2027, age: 32, triggers: ["도화홍염"], isPast: false }],
    daeunSpouseYears: [],
  };
  const tl = buildMarriageTimeline(fortune, mFacts, YEAR)!;
  const e2027 = tl.entries.find((e) => e.year === 2027)!;
  assert.equal(e2027.mood, "강세");
  assert.ok(e2027.hint.includes("부부")); // 절대 규칙 3-4
  assert.ok(!e2027.hint.includes("새 인연"));
});

test("marriage: 솔로면 같은 트리거가 인연 창 프레임", () => {
  const mFacts: any = {
    maritalStatus: "솔로",
    timingWindows: [{ year: 2027, age: 32, triggers: ["배우자성투출"], isPast: false }],
    daeunSpouseYears: [],
  };
  const tl = buildMarriageTimeline(fortune, mFacts, YEAR)!;
  assert.ok(tl.entries.find((e) => e.year === 2027)!.hint.includes("인연"));
});

test("fortune null → null (타임라인 섹션 미노출 경로)", () => {
  assert.equal(buildWealthTimeline(null, wealthFacts, YEAR), null);
});

test("결정론 힌트 문자열은 양 모듈 가드 금지 패턴에 걸리지 않는다(3-layer 정합)", () => {
  const wtl = buildWealthTimeline(fortune, wealthFacts, YEAR)!;
  const wres = applyWealthGuards({ probe: wtl.entries.map((e) => e.hint).join(" ") }, {}, "");
  assert.equal(wres.violations.length, 0);
  const mFacts: any = {
    maritalStatus: "기혼",
    timingWindows: [{ year: 2027, age: 32, triggers: ["도화홍염"], isPast: false }],
    daeunSpouseYears: [],
  };
  const mtl = buildMarriageTimeline(fortune, mFacts, YEAR)!;
  const mres = applyMarriageGuards({ probe: mtl.entries.map((e) => e.hint).join(" ") }, mFacts, "");
  assert.equal(mres.violations.length, 0);
});
