/**
 * 등급 경계 조합 시뮬레이션
 * 기존 Monte Carlo 점수 분포에 다양한 경계를 적용하여 최적 조합 탐색
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

function generateElementDist(): Record<string, number> {
  const e = ["목","화","토","금","수"];
  const d: Record<string,number> = {목:0,화:0,토:0,금:0,수:0};
  for (let i = 0; i < 8; i++) d[pick(e)]++;
  return d;
}

function generateTenStars(): string[] {
  const all = ["비견","겁재","식신","상관","정재","편재","정관","편관","정인","편인"];
  const count = randInt(3, 6);
  const stars: string[] = [];
  const available = [...all];
  for (let i = 0; i < count; i++) {
    if (!available.length) break;
    const idx = Math.floor(Math.random() * available.length);
    stars.push(available[idx]);
    if (chance(60)) available.splice(idx, 1);
  }
  return stars;
}

function generateRelationships() {
  const hapOpts = ["자축합","인해합","묘술합","진유합","사신합","오미합화","인오술 삼합","해묘미 삼합","신자진 삼합","사유축 삼합"];
  const chungOpts = ["자오충","축미충","인신충","묘유충","진술충","사해충"];
  const hyungOpts = ["인사형","사신형","인신형","축술형","술미형","축미형","자묘형","오오형 자형(自刑)","해해형 자형(自刑)"];
  const hap: string[] = [], chung: string[] = [], hyung: string[] = [];
  if (chance(45)) hap.push(pick(hapOpts));
  if (chance(15)) hap.push(pick(hapOpts));
  if (chance(25)) chung.push(pick(chungOpts));
  if (chance(25)) hyung.push(pick(hyungOpts));
  if (chance(8)) hyung.push(pick(hyungOpts));
  return { hap, chung, hyung };
}

function generateScoringInput(): ScoringInput {
  const elementDist = generateElementDist();
  const relationships = generateRelationships();
  const shinsal: string[] = [];
  let bad = 0, good = 0;
  for (const s of ["천을귀인","문창귀인","천덕귀인","월덕귀인","장성","학당"]) { if (chance(15)) { shinsal.push(s); good++; } }
  for (const s of ["도화살","홍염살","화개살","역마살"]) { if (chance(12)) shinsal.push(s); }
  for (const s of ["양인","겁살","현침살"]) { if (chance(10)) { shinsal.push(s); bad++; } }
  if (chance(20)) { shinsal.push("공망"); shinsal.push(pick(["년지","월지","시지"])); }
  if (chance(8)) shinsal.push("백호");
  if (chance(8)) shinsal.push("재살");
  if (chance(5)) shinsal.push("괴강");

  const sr = Math.random();
  let strength: ScoringInput["strength"];
  if (sr < 0.35) strength = "신강";
  else if (sr < 0.45) strength = "추정 신강";
  else if (sr < 0.80) strength = "신약";
  else strength = "추정 신약";

  return {
    elementDist, strength, tenStars: generateTenStars(), relationships, shinsal, shinsalBadCount: bad,
    isTimeUnknown: false, hasManselyeok: true,
    has건록제왕: chance(25), hasYongshinInStems: chance(20), goodShinsalCount: good,
    hasYongshinMonthRoot: chance(15), hasSamhap: relationships.hap.some(h => h.includes("삼합")),
  };
}

// 10,000명 composite 점수 수집
const N = 10000;
const composites: number[] = [];
for (let i = 0; i < N; i++) {
  const input = generateScoringInput();
  const scores = calculateScores(input);
  const tier = calculateTier(input, scores);
  composites.push(tier.composite);
}

const avg = Math.round(composites.reduce((a, b) => a + b, 0) / N);
const sorted = [...composites].sort((a, b) => a - b);
const median = sorted[Math.floor(N / 2)];

console.log("═══════════════════════════════════════════════════════════════════");
console.log("  등급 경계 조합 시뮬레이션 (10,000명)");
console.log("  composite 평균: " + avg + "점, 중앙값: " + median + "점");
console.log("═══════════════════════════════════════════════════════════════════\n");

// 경계 조합들
type Boundary = { label: string; S: number; A: number; B: number; C: number };

const candidates: Boundary[] = [
  { label: "현재       ", S: 86, A: 79, B: 66, C: 45 },
  // B 하단을 올려서 C 확대 (B→C 이동)
  { label: "안1: B↑68  ", S: 86, A: 79, B: 68, C: 45 },
  { label: "안2: B↑70  ", S: 86, A: 79, B: 70, C: 45 },
  { label: "안3: B↑72  ", S: 86, A: 79, B: 72, C: 45 },
  // B 하단 올리고 + A 하단도 올림 (A 축소)
  { label: "안4: B↑70,A↑81", S: 86, A: 81, B: 70, C: 45 },
  { label: "안5: B↑70,A↑82", S: 86, A: 82, B: 70, C: 45 },
  { label: "안6: B↑72,A↑82", S: 86, A: 82, B: 72, C: 45 },
  // S도 조정
  { label: "안7: B↑70,A↑82,S↑88", S: 88, A: 82, B: 70, C: 45 },
  { label: "안8: B↑70,A↑81,S↑87", S: 87, A: 81, B: 70, C: 45 },
  // C 하단도 조정 (D 약간 확대)
  { label: "안9: B↑70,A↑82,C↑48", S: 86, A: 82, B: 70, C: 48 },
  { label: "안10: B↑70,A↑81,C↑48", S: 86, A: 81, B: 70, C: 48 },
];

function gradeFromComposite(c: number, b: Boundary): GradeLabel {
  if (c >= b.S) return "S";
  if (c >= b.A) return "A";
  if (c >= b.B) return "B";
  if (c >= b.C) return "C";
  return "D";
}

console.log("| 경계조합          | D→C | C→B | B→A | A→S |   S    A    B    C    D  | C가최대 | B-C차 |");
console.log("|-------------------|-----|-----|-----|-----|--------------------------|---------|-------|");

for (const b of candidates) {
  const counts: Record<GradeLabel, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const c of composites) {
    counts[gradeFromComposite(c, b)]++;
  }

  const pct = (g: GradeLabel) => (counts[g] / N * 100).toFixed(1).padStart(5);
  const cIsMax = counts.C >= counts.B && counts.C >= counts.A;
  const bcDiff = Math.abs(counts.B / N * 100 - counts.C / N * 100).toFixed(0);

  console.log(
    `| ${b.label} | ${String(b.C).padStart(3)} | ${String(b.B).padStart(3)} | ${String(b.A).padStart(3)} | ${String(b.S).padStart(3)} | ${pct("S")} ${pct("A")} ${pct("B")} ${pct("C")} ${pct("D")} | ${cIsMax ? "  ✅   " : "  ❌   "} | ${bcDiff.padStart(4)}% |`
  );
}

console.log("\n목표: C가 최대 등급, B와 C가 비슷(차이 <10%), S ~3-5%, A ~10-13%, D ~5-8%");
