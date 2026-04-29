/**
 * 등급 분포 테스트 — 새 등급 경계 검증
 * 5가지 대표 프로필 + 신건주 실제 데이터
 *
 * 실행: npx tsx scripts/test-grade-distribution.ts
 */

import * as path from "path";
import { register } from "tsconfig-paths";
import * as tsconfig from "../tsconfig.json";

register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths as Record<string, string[]>,
});

import {
  calculateScores,
  calculateTier,
  type ScoringInput,
  type ServerScores,
  type TierResult,
  scoreToGrade,
} from "@/lib/utils/saju-scoring";
import { COMPOSITE_GRADE_CUTOFFS, GRADE_MAX } from "@/lib/gradeSystem";

// ─── 등급 경계 출력 ─────────────────────────────────
console.log("╔══════════════════════════════════════════════════╗");
console.log("║  등급 분포 테스트 — 새 등급 경계 검증            ║");
console.log("╚══════════════════════════════════════════════════╝");
console.log("\n[등급 경계]");
console.log(`  S: ${COMPOSITE_GRADE_CUTOFFS.S}+  (max ${GRADE_MAX.S})`);
console.log(`  A: ${COMPOSITE_GRADE_CUTOFFS.A}-${GRADE_MAX.A}`);
console.log(`  B: ${COMPOSITE_GRADE_CUTOFFS.B}-${GRADE_MAX.B}`);
console.log(`  C: ${COMPOSITE_GRADE_CUTOFFS.C}-${GRADE_MAX.C}`);
console.log(`  D: 0-${GRADE_MAX.D}`);

// ─── 헬퍼 ────────────────────────────────────────────

function printResult(label: string, input: ScoringInput) {
  const scores = calculateScores(input);
  const tier = calculateTier(input, scores);

  console.log(`\n${"─".repeat(55)}`);
  console.log(`  ${label}`);
  console.log(`${"─".repeat(55)}`);
  console.log(`  종합: ${tier.grade}등급 (composite: ${tier.composite}, 상위 ${tier.topPercent}%)`);
  console.log(`  confidence: ${tier.confidence}`);
  console.log(`  카테고리:`);
  for (const [key, val] of Object.entries(scores)) {
    console.log(`    ${key}: ${val} (${scoreToGrade(val)})`);
  }
  return { scores, tier };
}

// ─── 프로필 1: 평범한 사주 (1결핍, 신약, 특별 없음) ──

const profile1: ScoringInput = {
  elementDist: { 목: 2, 화: 3, 토: 1, 금: 2, 수: 0 },  // 수 결핍
  strength: "신약",
  tenStars: ["편인", "비견"],
  relationships: { hap: [], chung: [], hyung: [] },
  shinsal: [],
  shinsalBadCount: 0,
  isTimeUnknown: false,
  hasManselyeok: true,
  has건록제왕: false,
  hasYongshinInStems: false,
  goodShinsalCount: 0,
  hasYongshinMonthRoot: false,
  hasSamhap: false,
};

// ─── 프로필 2: 꽤 나쁜 사주 (2결핍, 신약, 충, 상관) ──

const profile2: ScoringInput = {
  elementDist: { 목: 0, 화: 4, 토: 2, 금: 0, 수: 2 },  // 목,금 결핍 + 화 편중
  strength: "신약",
  tenStars: ["상관", "편관", "비견", "겁재"],
  relationships: { hap: [], chung: ["자오충"], hyung: ["인사형"] },
  shinsal: [],
  shinsalBadCount: 0,
  isTimeUnknown: false,
  hasManselyeok: true,
  has건록제왕: false,
  hasYongshinInStems: false,
  goodShinsalCount: 0,
  hasYongshinMonthRoot: false,
  hasSamhap: false,
};

// ─── 프로필 3: 괜찮은 사주 (균형, 신강, 정재, 식신) ──

const profile3: ScoringInput = {
  elementDist: { 목: 2, 화: 2, 토: 1, 금: 2, 수: 1 },  // 균형
  strength: "신강",
  tenStars: ["정재", "식신", "편인", "비견"],
  relationships: { hap: ["인오술 합화"], chung: [], hyung: [] },
  shinsal: ["천을귀인"],
  shinsalBadCount: 0,
  isTimeUnknown: false,
  hasManselyeok: true,
  has건록제왕: true,
  hasYongshinInStems: true,
  goodShinsalCount: 2,
  hasYongshinMonthRoot: false,
  hasSamhap: false,
};

// ─── 프로필 4: 좋은 사주 (균형, 신강, 관인상생, 합 다수) ──

const profile4: ScoringInput = {
  elementDist: { 목: 2, 화: 2, 토: 2, 금: 1, 수: 1 },  // 극균형
  strength: "신강",
  tenStars: ["정관", "정재", "식신", "정인"],
  relationships: { hap: ["자축합", "인해합"], chung: [], hyung: [] },
  shinsal: ["천을귀인", "문창귀인", "장성"],
  shinsalBadCount: 0,
  isTimeUnknown: false,
  hasManselyeok: true,
  has건록제왕: true,
  hasYongshinInStems: true,
  goodShinsalCount: 4,
  hasYongshinMonthRoot: true,
  hasSamhap: true,
};

// ─── 프로필 5: 시간 미상 + 적당한 사주 (medium confidence) ──

const profile5: ScoringInput = {
  elementDist: { 목: 1, 화: 2, 토: 2, 금: 1, 수: 0 },  // 1결핍
  strength: "추정 신강",
  tenStars: ["편재", "정관", "식신"],
  relationships: { hap: ["유축합"], chung: [], hyung: [] },
  shinsal: ["도화"],
  shinsalBadCount: 0,
  isTimeUnknown: true,
  hasManselyeok: true,
  has건록제왕: false,
  hasYongshinInStems: false,
  goodShinsalCount: 1,
  hasYongshinMonthRoot: false,
  hasSamhap: false,
};

// ─── 실행 ────────────────────────────────────────────

const results: { label: string; grade: string; composite: number }[] = [];

const profiles = [
  { label: "프로필1: 평범한 사주 (1결핍, 신약)", input: profile1 },
  { label: "프로필2: 나쁜 사주 (2결핍, 신약, 충+형, 상관)", input: profile2 },
  { label: "프로필3: 괜찮은 사주 (균형, 신강, 정재+식신, 합)", input: profile3 },
  { label: "프로필4: 좋은 사주 (극균형, 관인상생, 합 다수)", input: profile4 },
  { label: "프로필5: 시간 미상 (medium confidence)", input: profile5 },
];

for (const p of profiles) {
  const { tier } = printResult(p.label, p.input);
  results.push({ label: p.label, grade: tier.grade, composite: tier.composite });
}

// ─── 요약 ────────────────────────────────────────────

console.log("\n" + "═".repeat(55));
console.log("  요약");
console.log("═".repeat(55));
for (const r of results) {
  console.log(`  ${r.grade}등급 (${r.composite}점) — ${r.label}`);
}

// 등급 분포
const gradeCounts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
for (const r of results) gradeCounts[r.grade]++;
console.log("\n  등급 분포:");
for (const [g, c] of Object.entries(gradeCounts)) {
  console.log(`    ${g}: ${c}명 (${((c / results.length) * 100).toFixed(0)}%)`);
}
