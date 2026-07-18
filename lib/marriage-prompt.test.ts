import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMarriagePrompt } from "./marriage-prompt";
import { deriveMarriageFacts } from "./marriage-facts";
import { enrichSajuData } from "./utils/saju";
import type { SajuData } from "./utils/saju";

// marriage-facts.test.ts 와 동일 차트(일간 甲, 여명이면 관살혼잡).
const chart: SajuData = {
  year:  { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },
  month: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
  day:   { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour:  { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

test("F-4: 여명이면 사실블록에 '관살혼잡' 라벨, '정편재혼잡' 미노출", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, chart, "female", "솔로", 2026);
  const prompt = buildMarriagePrompt(facts, "B", "사주 원국 텍스트");
  assert.ok(prompt.includes("관살혼잡(정관+편관"), "여명은 관살혼잡 라벨이어야 함");
  assert.ok(!prompt.includes("정편재혼잡(정재+편재"), "여명 사실블록에 정편재혼잡 라벨이 있으면 안 됨");
});

test("F-4: 남명이면 사실블록에 '정편재혼잡' 라벨, '관살혼잡' 미노출", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, chart, "male", "기혼", 2026);
  const prompt = buildMarriagePrompt(facts, "B", "사주 원국 텍스트");
  assert.ok(prompt.includes("정편재혼잡(정재+편재"), "남명은 정편재혼잡 라벨이어야 함");
  assert.ok(!prompt.includes("관살혼잡(정관+편관"), "남명 사실블록에 관살혼잡 라벨이 있으면 안 됨");
});
