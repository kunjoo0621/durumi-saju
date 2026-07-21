import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWealthTimeline, buildMarriageTimeline, buildCareerTimeline } from "./fortune-timeline";
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

// ── career ──
const careerFacts: any = {
  timingWindows: [
    { year: 2025, age: 30, triggers: ["관성투출"], isPast: true },
    { year: 2027, age: 32, triggers: ["식상투출"], isPast: false },
    { year: 2029, age: 34, triggers: ["관성투출"], isPast: false },
  ],
  daeunCareerYears: [{ startAge: 34, endAge: 43, star: "정관" }],
};

test("career: 트리거→무드 결정론(관성투출=강세·식상투출=보통), 과거/현재 플래그", () => {
  const tl = buildCareerTimeline(fortune, careerFacts, YEAR)!;
  assert.equal(tl.entries.length, 7); // 2025..2031
  assert.equal(tl.entries[0].year, 2025);
  assert.equal(tl.entries[0].isPast, true);
  assert.equal(tl.entries[0].mood, "강세"); // 관성투출
  assert.equal(tl.entries[1].isCurrent, true); // 2026
  assert.equal(tl.entries[1].mood, "보통"); // 트리거 없음(편재 세운)
  assert.equal(tl.entries[2].mood, "보통"); // 2027 식상투출=보통
  assert.deepEqual(tl.daeun, careerFacts.daeunCareerYears);
});

test("career: '주의' 무드는 존재하지 않는다(실패·해고 단정 프레임 금지 — 강세/보통만)", () => {
  const tl = buildCareerTimeline(fortune, careerFacts, YEAR)!;
  assert.ok(tl.entries.every((e) => ["강세", "보통"].includes(e.mood)));
});

test("career: 같은 트리거 반복 시 두 번째부터 ALT 변주(반복 힌트 버그 방지)", () => {
  const tl = buildCareerTimeline(fortune, careerFacts, YEAR)!;
  const h2025 = tl.entries.find((e) => e.year === 2025)!.hint; // 관성투출 1회차
  const h2029 = tl.entries.find((e) => e.year === 2029)!.hint; // 관성투출 2회차 → ALT
  assert.notEqual(h2025, h2029);
});

test("career: 트리거 없는 해는 세운 십성별 힌트(반복 방지)", () => {
  const tl = buildCareerTimeline(fortune, careerFacts, YEAR)!;
  const h2026 = tl.entries.find((e) => e.year === 2026)!.hint;
  assert.ok(h2026.length > 0);
});

test("career: fortune null → null", () => {
  assert.equal(buildCareerTimeline(null, careerFacts, YEAR), null);
});

test("career 3-layer: 결정론 힌트가 커리어 가드 금지 패턴에 안 걸린다", async () => {
  const { applyCareerGuards } = await import("./career-postprocess");
  const tl = buildCareerTimeline(fortune, careerFacts, YEAR)!;
  const probe = tl.entries.map((e) => e.hint).join(" ");
  const { violations } = applyCareerGuards({ probe }, {}, "");
  assert.equal(violations.length, 0, `힌트가 가드에 걸림: ${violations.join(" | ")}`);
});
