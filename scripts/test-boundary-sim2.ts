import * as path from "path";
import { register } from "tsconfig-paths";
import * as tsconfig from "../tsconfig.json";
register({ baseUrl: path.resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths as Record<string, string[]> });

import { calculateScores, calculateTier, type ScoringInput } from "@/lib/utils/saju-scoring";
import type { GradeLabel } from "@/lib/gradeSystem";

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(pct: number) { return Math.random() * 100 < pct; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function genDist(): Record<string, number> {
  const e = ["목","화","토","금","수"];
  const d: Record<string,number> = {목:0,화:0,토:0,금:0,수:0};
  for (let i = 0; i < 8; i++) d[pick(e)]++;
  return d;
}
function genStars(): string[] {
  const all = ["비견","겁재","식신","상관","정재","편재","정관","편관","정인","편인"];
  const count = randInt(3, 6); const stars: string[] = []; const avail = [...all];
  for (let i = 0; i < count; i++) { if (!avail.length) break; const idx = Math.floor(Math.random() * avail.length); stars.push(avail[idx]); if (chance(60)) avail.splice(idx, 1); }
  return stars;
}
function genRels() {
  const h = ["자축합","인해합","묘술합","진유합","사신합","오미합화","인오술 삼합","해묘미 삼합","신자진 삼합","사유축 삼합"];
  const c = ["자오충","축미충","인신충","묘유충","진술충","사해충"];
  const y = ["인사형","사신형","인신형","축술형","술미형","축미형","자묘형","오오형 자형(自刑)","해해형 자형(自刑)"];
  const hap: string[] = [], chung: string[] = [], hyung: string[] = [];
  if (chance(45)) hap.push(pick(h)); if (chance(15)) hap.push(pick(h));
  if (chance(25)) chung.push(pick(c)); if (chance(25)) hyung.push(pick(y)); if (chance(8)) hyung.push(pick(y));
  return { hap, chung, hyung };
}
function genInput(): ScoringInput {
  const elementDist = genDist(); const relationships = genRels();
  const shinsal: string[] = []; let bad = 0, good = 0;
  for (const s of ["천을귀인","문창귀인","천덕귀인","월덕귀인","장성","학당"]) { if (chance(15)) { shinsal.push(s); good++; } }
  for (const s of ["도화살","홍염살","화개살","역마살"]) { if (chance(12)) shinsal.push(s); }
  for (const s of ["양인","겁살","현침살"]) { if (chance(10)) { shinsal.push(s); bad++; } }
  if (chance(20)) { shinsal.push("공망"); shinsal.push(pick(["년지","월지","시지"])); }
  if (chance(8)) shinsal.push("백호"); if (chance(8)) shinsal.push("재살"); if (chance(5)) shinsal.push("괴강");
  const sr = Math.random();
  let strength: ScoringInput["strength"];
  if (sr < 0.35) strength = "신강"; else if (sr < 0.45) strength = "추정 신강"; else if (sr < 0.80) strength = "신약"; else strength = "추정 신약";
  return { elementDist, strength, tenStars: genStars(), relationships, shinsal, shinsalBadCount: bad, isTimeUnknown: false, hasManselyeok: true, has건록제왕: chance(25), hasYongshinInStems: chance(20), goodShinsalCount: good, hasYongshinMonthRoot: chance(15), hasSamhap: relationships.hap.some(h => h.includes("삼합")) };
}

const N = 30000;
const composites: number[] = [];
for (let i = 0; i < N; i++) {
  const input = genInput();
  const scores = calculateScores(input);
  const tier = calculateTier(input, scores);
  composites.push(tier.composite);
}

type Boundary = { label: string; S: number; A: number; B: number; C: number };

const candidates: Boundary[] = [
  { label: "현재            ", S: 86, A: 79, B: 66, C: 45 },
  { label: "B70 A80 S87     ", S: 87, A: 80, B: 70, C: 45 },
  { label: "B70 A80 S86     ", S: 86, A: 80, B: 70, C: 45 },
  { label: "B69 A80 S87     ", S: 87, A: 80, B: 69, C: 45 },
  { label: "B69 A79 S87     ", S: 87, A: 79, B: 69, C: 45 },
  { label: "B70 A81 S87     ", S: 87, A: 81, B: 70, C: 45 },
  { label: "B68 A80 S87     ", S: 87, A: 80, B: 68, C: 45 },
];

function grade(c: number, b: Boundary): GradeLabel {
  if (c >= b.S) return "S"; if (c >= b.A) return "A"; if (c >= b.B) return "B"; if (c >= b.C) return "C"; return "D";
}

console.log("═══════════════════════════════════════════════════════════════");
console.log("  등급 경계 미세 조정 시뮬레이션 (30,000명)");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log("| 경계조합             |    S     A     B     C     D  | C최대 |");
console.log("|----------------------|------------------------------|-------|");

for (const b of candidates) {
  const counts: Record<GradeLabel, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const c of composites) counts[grade(c, b)]++;
  const pct = (g: GradeLabel) => (counts[g] / N * 100).toFixed(1).padStart(5);
  const cMax = counts.C >= counts.B && counts.C >= counts.A;
  console.log(`| ${b.label} | ${pct("S")} ${pct("A")} ${pct("B")} ${pct("C")} ${pct("D")} | ${cMax ? " ✅  " : " ❌  "} |`);
}
