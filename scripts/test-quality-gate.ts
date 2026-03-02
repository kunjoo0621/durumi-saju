/**
 * Quality Gate 검증 테스트 스크립트
 *
 * 실행: npx tsx scripts/test-quality-gate.ts
 */

import { validateBattleResult, validatePersonalResult } from "../lib/quality-gate";

// ─── 배틀 테스트: 반복이 많은 케이스 ──────────────────

const mockBattle = {
  categoryResults: {
    wealth: {
      killingLine: "테스트",
      detail: "묘(墓)에 앉아 감정을 숨기는 구조야. 편관이 재성을 누르는 구조야.",
    },
    love: {
      killingLine: "테스트",
      detail: "묘(墓)에 앉아 감정을 숨기는 구조야. 토 과다가 감정을 눌러.",
    },
    career: {
      killingLine: "테스트",
      detail: "지에 앉아 능력을 펼치기 어려운 구조야. 편관이 압도하는 구조.",
    },
    health: {
      killingLine: "테스트",
      detail: "지에 앉아 스트레스를 받는 구조야. 토 과다가 건강을 위협해.",
    },
    social: {
      killingLine: "테스트",
      detail: "지에 앉아 대인관계에 소극적인 구조야. 겁재가 눈치를 보는 구조.",
    },
  },
  chemistry: {
    punchline: "테스트 상성",
    analysis: "일반 분석 텍스트야.",
    bonusScenarios: [],
  },
  simulations: [
    {
      question: "술 마시면?",
      reasoning: "식신과 겁재가 술기운과 만나 폭발하는 모습이야. 가능성이 높아.",
      punchline: "",
    },
    {
      question: "이별 후?",
      reasoning: "식신과 겁재가 술기운과 만나 폭발하는 모습이야. 가능성이 높아.",
      punchline: "",
    },
    {
      question: "결혼하면?",
      reasoning: "다른 내용의 분석이지만 마지막이 같아. 가능성이 높아.",
      punchline: "",
    },
  ],
  futureOutlook: {
    punchline: "시간이 지나면 바뀌어",
    timeline: [
      { year: 2027, label: "1년 후", eventA: "이직", eventB: "승진", relationship: "갈등", mood: "down" },
      { year: 2029, label: "3년 후", eventA: "안정", eventB: "번아웃", relationship: "위기", mood: "down" },
      { year: 2031, label: "5년 후", eventA: "성장", eventB: "이직", relationship: "회복", mood: "up" },
    ],
  },
  finalVerdict: {
    punchline: "최종 판정",
    verdict: "종합적으로 볼 때 이런 결과야.",
  },
};

console.log("=== 배틀 QUALITY GATE TEST ===\n");
const battleIssues = validateBattleResult(mockBattle);
battleIssues.forEach((i) => {
  console.log(`[${i.severity.toUpperCase()}] ${i.code}: ${i.message}`);
  if (i.details) console.log(`  → ${i.details}`);
});
console.log(
  `\n배틀 Total: ${battleIssues.length} issues (${battleIssues.filter((i) => i.severity === "error").length} errors)`,
);

// ─── 예상 결과 ──────────────────────────────────────
console.log("\n--- 예상되는 검출 항목 ---");
console.log("✅ 묘(墓)에 앉아 반복 → REPETITION");
console.log("✅ 지에 앉아 반복 → REPETITION");
console.log("✅ ~하는 구조야 반복 → REPETITION");
console.log("✅ 시뮬레이션 복붙 (술 ↔ 이별) → SIM_COPYPASTE");
console.log("✅ 카테고리 detail 패턴화 → DETAIL_PATTERN");

// ─── 개인 사주 테스트 ──────────────────────────────────

const mockPersonal = {
  tier: {
    grade: "B",
    composite: 55,
    percentileRank: 50,
    topPercent: 50,
    title: "멈추면 녹스는 엔진",
    description: "이 사람의 사주는 이런 특성이 있다.",
  },
  sections: [
    { icon: "🧭", title: "멈추면 녹스는 성격", content: "멈추면 녹스는 패턴이야. 묘(墓)에 앉아 감정을 삭이는 구조야. 이런 구조가 반복된다." },
    { icon: "💎", title: "멈추면 녹스는 무기", content: "이것도 멈추면 녹스는 패턴이야. 하는 구조야. 반복되는 패턴이야." },
    { icon: "🧩", title: "대인 패턴", content: "가능성이 높아. 해봐. 일반적인 텍스트." },
    { icon: "💰", title: "재물 분석", content: "정상적인 재물 분석 내용이야." },
    { icon: "💞", title: "연애 분석", content: "정상적인 연애 분석 내용이야." },
    { icon: "💼", title: "직장 분석", content: "정상적인 직장 분석 내용이야." },
    { icon: "🩺", title: "건강 분석", content: "정상적인 건강 분석 내용이야." },
    { icon: "🚧", title: "리스크 관리", content: "정상적인 리스크 분석 내용이야." },
    { icon: "📍", title: "터닝포인트", content: "정상적인 터닝포인트 내용이야." },
    { icon: "✅", title: "현실적인 결론", content: "정상적인 결론이야." },
  ],
  scores: { 재물운: 60, 연애운: 55, 직장운: 50, 건강운: 45, 대인운: 40 },
  coreFearAxisBlock: "",
};

console.log("\n\n=== 개인 사주 QUALITY GATE TEST ===\n");
const personalIssues = validatePersonalResult(mockPersonal);
personalIssues.forEach((i) => {
  console.log(`[${i.severity.toUpperCase()}] ${i.code}: ${i.message}`);
  if (i.details) console.log(`  → ${i.details}`);
});
console.log(
  `\n개인 Total: ${personalIssues.length} issues (${personalIssues.filter((i) => i.severity === "error").length} errors)`,
);

console.log("\n--- 예상되는 검출 항목 ---");
console.log('✅ 타이틀 키워드 "멈추면" 또는 "녹스는" 3개 섹션 반복 → TITLE_REPEAT');
console.log('✅ "~하는 패턴이야" 또는 "~하는 구조야" 반복 → REPETITION');
console.log('✅ "~해봐" 잔존 → HAEBWA');
console.log('✅ "있다." 문어체 잔존 → FORMAL_TONE');

// ─── 결과 요약 ──────────────────────────────────────

const allErrors = [
  ...battleIssues.filter((i) => i.severity === "error"),
  ...personalIssues.filter((i) => i.severity === "error"),
];

console.log(`\n\n=== SUMMARY ===`);
console.log(`배틀: ${battleIssues.length} issues (${battleIssues.filter((i) => i.severity === "error").length} errors)`);
console.log(`개인: ${personalIssues.length} issues (${personalIssues.filter((i) => i.severity === "error").length} errors)`);

if (allErrors.length > 0) {
  console.log(`\n✅ Quality gate가 ${allErrors.length}개 error를 정상적으로 감지했습니다.`);
} else {
  console.log("\n⚠️ error가 0개 — 테스트 데이터가 문제를 감지하지 못하고 있습니다.");
}
