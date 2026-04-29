/**
 * 등급 분포 Monte Carlo 시뮬레이션
 * 1000명의 현실적인 랜덤 사주를 생성하여 등급 분포 추정
 *
 * 실행: npx tsx scripts/test-grade-monte-carlo.ts
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
  scoreToGrade,
} from "@/lib/utils/saju-scoring";
import { COMPOSITE_GRADE_CUTOFFS } from "@/lib/gradeSystem";
import type { GradeLabel } from "@/lib/gradeSystem";

// ─── 랜덤 유틸 ──────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chance(pct: number): boolean {
  return Math.random() * 100 < pct;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── 오행 분포 생성 (8개 요소를 5행에 분배) ────────

function generateElementDist(): Record<string, number> {
  const elements = ["목", "화", "토", "금", "수"];
  const dist: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };

  // 8개의 글자(4기둥 × 천간+지지)를 5행에 랜덤 배분
  for (let i = 0; i < 8; i++) {
    dist[pick(elements)]++;
  }
  return dist;
}

// ─── 십성 생성 ────────────────────────────────────

function generateTenStars(): string[] {
  const allStars = [
    "비견", "겁재",   // 비겁
    "식신", "상관",   // 식상
    "정재", "편재",   // 재성
    "정관", "편관",   // 관성
    "정인", "편인",   // 인성
  ];

  // 4개의 기둥에서 4개의 십성이 나옴 (일간 제외하면 보통 3~5개)
  // 하지만 중복이 있을 수 있고 다양한 조합이 존재
  const count = randInt(3, 6);
  const stars: string[] = [];
  const available = [...allStars];

  for (let i = 0; i < count; i++) {
    if (available.length === 0) break;
    const idx = Math.floor(Math.random() * available.length);
    stars.push(available[idx]);
    // 같은 십성이 여러 번 나올 수 있으므로 제거하지 않을 때도 있음
    if (chance(60)) available.splice(idx, 1); // 60% 확률로 제거 (중복 방지)
  }
  return stars;
}

// ─── 관계 생성 ────────────────────────────────────

function generateRelationships() {
  const hapOptions = [
    "자축합", "인해합", "묘술합", "진유합", "사신합", "오미합화",
    "인오술 삼합", "해묘미 삼합", "신자진 삼합", "사유축 삼합",
  ];
  const chungOptions = ["자오충", "축미충", "인신충", "묘유충", "진술충", "사해충"];
  const hyungOptions = [
    "인사형", "사신형", "인신형",
    "축술형", "술미형", "축미형",
    "자묘형", "오오형 자형(自刑)", "해해형 자형(自刑)",
  ];

  const hap: string[] = [];
  const chung: string[] = [];
  const hyung: string[] = [];

  // 합: ~45% 확률로 1개, ~15% 확률로 2개
  if (chance(45)) hap.push(pick(hapOptions));
  if (chance(15)) hap.push(pick(hapOptions));

  // 충: ~25% 확률로 1개
  if (chance(25)) chung.push(pick(chungOptions));

  // 형: ~25% 확률로 1개, ~8% 확률로 2개
  if (chance(25)) hyung.push(pick(hyungOptions));
  if (chance(8)) hyung.push(pick(hyungOptions));

  return { hap, chung, hyung };
}

// ─── 신살 생성 ────────────────────────────────────

function generateShinsal(): { shinsal: string[]; shinsalBadCount: number; goodShinsalCount: number } {
  const goodShinsal = ["천을귀인", "문창귀인", "천덕귀인", "월덕귀인", "장성", "학당"];
  const neutralShinsal = ["도화살", "홍염살", "화개살", "역마살"];
  const badShinsal = ["양인", "겁살", "현침살"];

  const shinsal: string[] = [];
  let shinsalBadCount = 0;
  let goodShinsalCount = 0;

  // 길신살: 각 ~15% 확률
  for (const s of goodShinsal) {
    if (chance(15)) { shinsal.push(s); goodShinsalCount++; }
  }

  // 중립 신살: 각 ~12% 확률
  for (const s of neutralShinsal) {
    if (chance(12)) shinsal.push(s);
  }

  // 흉신살: 각 ~10% 확률
  for (const s of badShinsal) {
    if (chance(10)) { shinsal.push(s); shinsalBadCount++; }
  }

  // 공망: ~20% 확률
  if (chance(20)) {
    shinsal.push("공망");
    const position = pick(["년지", "월지", "시지"]);
    shinsal.push(position);
  }

  // 백호/재살: 각 ~8%
  if (chance(8)) { shinsal.push("백호"); }
  if (chance(8)) { shinsal.push("재살"); }
  // 괴강: ~5%
  if (chance(5)) { shinsal.push("괴강"); }

  return { shinsal, shinsalBadCount, goodShinsalCount };
}

// ─── 전체 ScoringInput 생성 ─────────────────────

function generateScoringInput(): ScoringInput {
  const elementDist = generateElementDist();
  const relationships = generateRelationships();
  const { shinsal, shinsalBadCount, goodShinsalCount } = generateShinsal();
  const hasSamhap = relationships.hap.some((h) => h.includes("삼합"));

  // 신강/신약: 대략 50/50
  const strengthRoll = Math.random();
  let strength: ScoringInput["strength"];
  if (strengthRoll < 0.35) strength = "신강";
  else if (strengthRoll < 0.45) strength = "추정 신강";
  else if (strengthRoll < 0.80) strength = "신약";
  else strength = "추정 신약";

  // 건록/제왕: ~25% 확률
  const has건록제왕 = chance(25);

  // 용신 투출: ~20% 확률
  const hasYongshinInStems = chance(20);

  // 용신 월근: ~15% 확률
  const hasYongshinMonthRoot = chance(15);

  return {
    elementDist,
    strength,
    tenStars: generateTenStars(),
    relationships,
    shinsal,
    shinsalBadCount,
    isTimeUnknown: false, // 시간 알고 있는 경우만 시뮬
    hasManselyeok: true,
    has건록제왕,
    hasYongshinInStems,
    goodShinsalCount,
    hasYongshinMonthRoot,
    hasSamhap,
  };
}

// ─── 시뮬레이션 실행 ────────────────────────────────

const N = 10000;
const gradeCounts: Record<GradeLabel, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
const composites: number[] = [];
const categoryAvgs: Record<string, number[]> = {
  재물운: [], 연애운: [], 직장운: [], 건강운: [], 대인운: [],
};

console.log("╔══════════════════════════════════════════════════╗");
console.log("║  등급 분포 Monte Carlo 시뮬레이션               ║");
console.log(`║  ${N.toLocaleString()}명 랜덤 사주 + 신건주 실제 데이터           ║`);
console.log("╚══════════════════════════════════════════════════╝");
console.log(`\n등급 경계: S(${COMPOSITE_GRADE_CUTOFFS.S}) A(${COMPOSITE_GRADE_CUTOFFS.A}) B(${COMPOSITE_GRADE_CUTOFFS.B}) C(${COMPOSITE_GRADE_CUTOFFS.C}) D(0)`);

for (let i = 0; i < N; i++) {
  const input = generateScoringInput();
  const scores = calculateScores(input);
  const tier = calculateTier(input, scores);

  gradeCounts[tier.grade]++;
  composites.push(tier.composite);

  for (const [key, val] of Object.entries(scores)) {
    categoryAvgs[key].push(val);
  }
}

// ─── 결과 출력 ──────────────────────────────────────

console.log("\n" + "═".repeat(55));
console.log("  등급 분포");
console.log("═".repeat(55));

const grades: GradeLabel[] = ["S", "A", "B", "C", "D"];
for (const g of grades) {
  const count = gradeCounts[g];
  const pct = (count / N * 100).toFixed(1);
  const per100 = Math.round(count / N * 100);
  const bar = "█".repeat(Math.round(count / N * 50));
  console.log(`  ${g}: ${bar} ${pct}% (${per100}명/100명)`);
}

// composite 분포
console.log("\n" + "═".repeat(55));
console.log("  composite 점수 분포");
console.log("═".repeat(55));

const sorted = [...composites].sort((a, b) => a - b);
const avg = Math.round(composites.reduce((a, b) => a + b, 0) / N);
const median = sorted[Math.floor(N / 2)];
const p10 = sorted[Math.floor(N * 0.1)];
const p25 = sorted[Math.floor(N * 0.25)];
const p75 = sorted[Math.floor(N * 0.75)];
const p90 = sorted[Math.floor(N * 0.9)];
const min = sorted[0];
const max = sorted[N - 1];

console.log(`\n  평균: ${avg}점  중앙값: ${median}점`);
console.log(`  최저: ${min}점  최고: ${max}점`);
console.log(`  하위10%: ${p10}점  하위25%: ${p25}점  상위25%: ${p75}점  상위10%: ${p90}점`);

// 히스토그램
console.log("\n  점수대별 분포:");
const buckets = [
  { label: " 0-29 (D하)", min: 0, max: 29 },
  { label: "30-39 (D중)", min: 30, max: 39 },
  { label: "40-44 (D상)", min: 40, max: 44 },
  { label: "45-49 (C하)", min: 45, max: 49 },
  { label: "50-54 (C중)", min: 50, max: 54 },
  { label: "55-59 (C중상)", min: 55, max: 59 },
  { label: "60-65 (C상)", min: 60, max: 65 },
  { label: "64-67 (B하)", min: 64, max: 67 },
  { label: "68-71 (B중)", min: 68, max: 71 },
  { label: "72-75 (B상)", min: 72, max: 75 },
  { label: "76-80 (A하)", min: 76, max: 80 },
  { label: "81-85 (A상)", min: 81, max: 85 },
  { label: "86-95 (S급)", min: 86, max: 95 },
];

for (const b of buckets) {
  const count = composites.filter((c) => c >= b.min && c <= b.max).length;
  const pct = (count / N * 100).toFixed(1);
  const bar = "█".repeat(Math.round(count / N * 50));
  console.log(`    ${b.label}: ${bar} ${pct}%`);
}

// 카테고리별 평균
console.log("\n" + "═".repeat(55));
console.log("  카테고리별 평균 점수");
console.log("═".repeat(55));

for (const [key, vals] of Object.entries(categoryAvgs)) {
  const catAvg = Math.round(vals.reduce((a, b) => a + b, 0) / N);
  const catMin = Math.min(...vals);
  const catMax = Math.max(...vals);
  console.log(`  ${key}: 평균 ${catAvg}점 (${scoreToGrade(catAvg)}) [${catMin}~${catMax}]`);
}

// 100명 기준 요약
console.log("\n" + "═".repeat(55));
console.log("  ★ 100명 중 예상 등급 분포");
console.log("═".repeat(55));
console.log();
for (const g of grades) {
  const per100 = Math.round(gradeCounts[g] / N * 100);
  const emoji = { S: "👑", A: "⭐", B: "✨", C: "📊", D: "📉" }[g];
  console.log(`  ${emoji} ${g}등급: 약 ${per100}명`);
}
console.log();
console.log(`  (${N.toLocaleString()}명 시뮬레이션 기반 추정)`);

// ─── 신건주 실제 데이터 ─────────────────────────────

async function testShinGeonJu() {
  console.log("\n" + "═".repeat(55));
  console.log("  신건주 실제 데이터 (1995.06.21 16:30 남자)");
  console.log("═".repeat(55));

  try {
    const res = await fetch("http://localhost:3000/api/debug/scoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "신건주",
        birthYear: "1995", birthMonth: "6", birthDay: "21",
        calendarType: "solar", birthHour: "16", birthMinute: "30",
        birthLocation: "서울", gender: "M",
        relationshipStatus: "single", employmentStatus: "employed",
        coreFearAxis: "", unknownBirthTime: false,
      }),
    });
    const data = await res.json();
    const { scores: sc, tier: ti } = data;

    console.log(`\n  ★ ${ti.grade}등급 (composite: ${ti.composite}, 상위 ${ti.topPercent}%)`);
    console.log(`  카테고리:`);
    for (const [key, val] of Object.entries(sc)) {
      console.log(`    ${key}: ${val} (${scoreToGrade(val as number)})`);
    }
  } catch (err) {
    console.log("\n  ⚠️ dev 서버 연결 실패 — 로컬 시뮬레이션만 표시");
  }
}

testShinGeonJu();
