import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveMarriageFacts } from "./marriage-facts";
import { enrichSajuData } from "./utils/saju";
import type { SajuData } from "./utils/saju";
import type { FortuneResult } from "./utils/saju-fortune";

// 일간 甲(목/양). 辛(금/음)=정관, 庚(금/양)=편관 → 관살혼잡. 여명.
const chart: SajuData = {
  year:  { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },       // 辛=정관
  month: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["庚","壬","戊"] }, // 庚=편관
  day:   { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },        // 일간 甲, 일지 子
  hour:  { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲","丙","戊"] },
};

test("여명: 정관+편관 존재 → 관성 배우자성 탐지 + 관살혼잡", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, chart, "female", "솔로", 2026);
  assert.equal(facts.spouseStarType, "관성");
  assert.equal(facts.spouseStarAbsent, false);
  assert.equal(facts.gwansalHonjap, true);
  assert.ok(facts.spouseStars.some((s) => s.star === "정관"));
  assert.ok(facts.spouseStars.some((s) => s.star === "편관"));
});

test("남명: 재성이 배우자성", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, chart, "male", "기혼", 2026);
  assert.equal(facts.spouseStarType, "재성");
});

test("일지 지장간 십성 산출", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, chart, "female", "솔로", 2026);
  // 일지 子 지장간 癸(수/음) vs 일간 甲(목/양) → 정인
  assert.ok(facts.spousePalaceHiddenStars.includes("정인"));
});

const fortune: FortuneResult = {
  daeun: {
    gender: "female", isForward: true, startAge: 5,
    startAgeDetail: { years: 5, months: 0, days: 0 }, daysToTerm: 0,
    pillars: [
      { index: 0, startAge: 25, endAge: 34, pillar: "辛酉", stem: "辛", branch: "酉", tenStar: "정관", twelveStage: "제왕" },
    ],
  },
  seun: [
    // 일간 甲, 일지 子. 丑=子와 육합(子丑合) → 세운합일지. 辛=정관 투출 → 배우자성투출.
    { year: 2027, age: 33, pillar: "辛丑", stem: "辛", branch: "丑", tenStar: "정관", twelveStage: "관대" },
  ],
};

test("타이밍: 세운 지지 일지합 + 배우자성 투출 → 트리거 2종", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, fortune, chart, "female", "솔로", 2026);
  const w = facts.timingWindows.find((x) => x.year === 2027);
  assert.ok(w, "2027 창이 있어야 함");
  assert.ok(w!.triggers.includes("세운합일지"));
  assert.ok(w!.triggers.includes("배우자성투출"));
  assert.equal(w!.isPast, false);
});

test("무관/무재 폴백: 배우자성 없으면 대운 배우자성 구간 수집", () => {
  // 배우자성 없는 차트: 일간 甲, 배우자성(정/편관) 천간·지장간 전무하게 구성
  const noStar: SajuData = {
    year:  { heavenlyStem: "甲", earthlyBranch: "寅", hiddenStems: ["甲","丙","戊"] },
    month: { heavenlyStem: "丙", earthlyBranch: "午", hiddenStems: ["丁","己"] },
    day:   { heavenlyStem: "甲", earthlyBranch: "寅", hiddenStems: ["甲","丙","戊"] },
    hour:  { heavenlyStem: "戊", earthlyBranch: "辰", hiddenStems: ["戊","乙","癸"] },
  };
  const en = enrichSajuData(noStar, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(en, fortune, noStar, "female", "솔로", 2026);
  assert.equal(facts.spouseStarAbsent, true);
  assert.ok(facts.daeunSpouseYears.length >= 1, "대운 정관(辛酉) 구간이 잡혀야 함");
});
