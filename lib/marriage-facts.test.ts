import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveMarriageFacts } from "./marriage-facts";
import { enrichSajuData } from "./utils/saju";
import type { SajuData } from "./utils/saju";

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
