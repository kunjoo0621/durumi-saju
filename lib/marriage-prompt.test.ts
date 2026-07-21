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

// ── Phase 3: 일지 지장간 층위 + 긍정 예시 (2026-07-19) — 엔진 어댑터 이슈로 이 환경선 스킵, build/5명 테스트로 검증 ──
test("프롬프트에 일지 지장간 층위 라인 + 긍정 예시 블록 + 반말 예시", () => {
  const chart: SajuData = {
    year: { heavenlyStem: "壬", earthlyBranch: "子", hiddenStems: ["癸"] },
    month: { heavenlyStem: "乙", earthlyBranch: "卯", hiddenStems: ["乙"] },
    day: { heavenlyStem: "甲", earthlyBranch: "戌", hiddenStems: ["戊", "辛", "丁"] },
    hour: { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },
  };
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, chart, "male", "솔로", 2026);
  const p = buildMarriagePrompt(facts, "A", "사주텍스트");
  assert.ok(p.includes("일지 지장간 구조"));
  assert.ok(p.includes("[좋은 문장 예시"));
  // 본기 라벨이 실제 값으로 채워졌는지 (일간 甲·일지 戌 본기 戊=편재)
  assert.ok(p.includes("본기 편재"));
});

test("도화홍염 트리거는 프롬프트에 '매력부각'으로 전달(홍염살 오명명 방지)", () => {
  const base = deriveMarriageFacts(enrichSajuData(chart, { isTimeUnknown: false }), null, chart, "female", "솔로", 2026);
  const f: any = {
    ...base,
    timingWindows: [{ year: 2029, age: 34, triggers: ["도화홍염"], isPast: false }],
  };
  const p = buildMarriagePrompt(f, "A", "사주텍스트");
  assert.ok(!p.includes("도화홍염"), "도화홍염 원문이 프롬프트에 노출됨");
  assert.ok(p.includes("매력부각"));
});
