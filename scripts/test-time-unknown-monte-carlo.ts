/**
 * 시간 미입력(isTimeUnknown=true) 등급 분포 Monte Carlo
 * npx tsx scripts/test-time-unknown-monte-carlo.ts
 */
import * as path from "path";
import { register } from "tsconfig-paths";
import * as tsconfig from "../tsconfig.json";
register({ baseUrl: path.resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths as Record<string, string[]> });

import { calculateScores, calculateTier, type ScoringInput } from "@/lib/utils/saju-scoring";
import type { GradeLabel } from "@/lib/gradeSystem";

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(pct: number) { return Math.random() * 100 < pct; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateElementDist6(): Record<string, number> {
  const elements = ["목", "화", "토", "금", "수"];
  const dist: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (let i = 0; i < 6; i++) dist[pick(elements)]++;
  return dist;
}

function generateTenStars(): string[] {
  const allStars = ["비견","겁재","식신","상관","정재","편재","정관","편관","정인","편인"];
  const count = randInt(2, 4);
  const stars: string[] = [];
  const available = [...allStars];
  for (let i = 0; i < count; i++) {
    if (available.length === 0) break;
    const idx = Math.floor(Math.random() * available.length);
    stars.push(available[idx]);
    if (chance(60)) available.splice(idx, 1);
  }
  return stars;
}

function generateRelationships3() {
  const hapOpts = ["자축합","인해합","묘술합","진유합","사신합","오미합화","인오술 삼합","해묘미 삼합","신자진 삼합","사유축 삼합"];
  const chungOpts = ["자오충","축미충","인신충","묘유충","진술충","사해충"];
  const hyungOpts = ["인사형","사신형","인신형","축술형","술미형","축미형","자묘형"];
  const hap: string[] = [], chung: string[] = [], hyung: string[] = [];
  if (chance(30)) hap.push(pick(hapOpts));
  if (chance(10)) hap.push(pick(hapOpts));
  if (chance(18)) chung.push(pick(chungOpts));
  if (chance(18)) hyung.push(pick(hyungOpts));
  return { hap, chung, hyung };
}

function genInput(): ScoringInput {
  const elementDist = generateElementDist6();
  const relationships = generateRelationships3();
  const shinsal: string[] = [];
  let shinsalBadCount = 0, goodShinsalCount = 0;
  for (const s of ["천을귀인","문창귀인","천덕귀인","월덕귀인","장성","학당"]) { if (chance(12)) { shinsal.push(s); goodShinsalCount++; } }
  for (const s of ["도화살","홍염살","화개살","역마살"]) { if (chance(10)) shinsal.push(s); }
  for (const s of ["양인","겁살","현침살"]) { if (chance(8)) { shinsal.push(s); shinsalBadCount++; } }
  if (chance(15)) { shinsal.push("공망"); shinsal.push(pick(["년지","월지","시지"])); }
  if (chance(6)) shinsal.push("백호");
  if (chance(6)) shinsal.push("재살");

  const strengthRoll = Math.random();
  let strength: ScoringInput["strength"];
  if (strengthRoll < 0.25) strength = "추정 신강";
  else if (strengthRoll < 0.50) strength = "추정 신약";
  else if (strengthRoll < 0.70) strength = "신약";
  else strength = "신강";

  return {
    elementDist, strength, tenStars: generateTenStars(), relationships, shinsal, shinsalBadCount,
    isTimeUnknown: true, hasManselyeok: true,
    has건록제왕: chance(20), hasYongshinInStems: chance(15), goodShinsalCount,
    hasYongshinMonthRoot: chance(12), hasSamhap: relationships.hap.some(h => h.includes("삼합")),
  };
}

const N = 10000;
const gradeCounts: Record<GradeLabel, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
const composites: number[] = [];

for (let i = 0; i < N; i++) {
  const input = genInput();
  const scores = calculateScores(input);
  const tier = calculateTier(input, scores);
  gradeCounts[tier.grade]++;
  composites.push(tier.composite);
}

console.log("═══════════════════════════════════════════════");
console.log("  시간 미입력(isTimeUnknown=true) 등급 분포");
console.log("  v10 (isBalanced>=3 완화 + defScale 0.75)");
console.log("  10,000명 Monte Carlo");
console.log("═══════════════════════════════════════════════");

const grades: GradeLabel[] = ["S","A","B","C","D"];
for (const g of grades) {
  const count = gradeCounts[g];
  const pct = (count / N * 100).toFixed(1);
  const bar = "█".repeat(Math.round(count / N * 50));
  console.log(`  ${g}: ${bar} ${pct}% (${Math.round(count / N * 100)}명/100명)`);
}

const sorted = [...composites].sort((a, b) => a - b);
const avg = Math.round(composites.reduce((a, b) => a + b, 0) / N);
const median = sorted[Math.floor(N / 2)];
const p10 = sorted[Math.floor(N * 0.1)];
const p90 = sorted[Math.floor(N * 0.9)];
console.log(`\n  평균: ${avg}점  중앙값: ${median}점`);
console.log(`  최저: ${sorted[0]}점  최고: ${sorted[N-1]}점`);
console.log(`  하위10%: ${p10}점  상위10%: ${p90}점`);

// confidence 확인
console.log(`\n  ※ isTimeUnknown=true → confidence=medium → 점수 클램프 [40, 85]`);
console.log(`  ※ 시간O(기존 Monte Carlo) D비율: ~5% 참고`);
