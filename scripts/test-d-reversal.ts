import * as path from "path";
import { register } from "tsconfig-paths";
import * as tsconfig from "../tsconfig.json";
register({ baseUrl: path.resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths as Record<string, string[]> });

import { calculateScores, calculateTier, type ScoringInput, scoreToGrade } from "@/lib/utils/saju-scoring";
import type { GradeLabel } from "@/lib/gradeSystem";

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(pct: number) { return Math.random() * 100 < pct; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// 시간O용 8글자 분포 생성
function genDist8(): Record<string, number> {
  const e = ["목","화","토","금","수"];
  const d: Record<string,number> = {목:0,화:0,토:0,금:0,수:0};
  for (let i = 0; i < 8; i++) d[pick(e)]++;
  return d;
}

// 시간O → 시간X 변환: 랜덤 2개 제거 (시주 천간+지지)
function removeTwoFromDist(dist8: Record<string,number>): Record<string,number> {
  const d = { ...dist8 };
  const elements = Object.keys(d).filter(k => d[k] > 0);
  // 2번 제거
  for (let i = 0; i < 2; i++) {
    const available = Object.keys(d).filter(k => d[k] > 0);
    if (available.length === 0) break;
    d[pick(available)]--;
  }
  return d;
}

function genTenStars(count: number): string[] {
  const all = ["비견","겁재","식신","상관","정재","편재","정관","편관","정인","편인"];
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

function genRels(branchCount: number) {
  const hapOpts = ["자축합","인해합","묘술합","진유합","사신합","오미합화","인오술 삼합","해묘미 삼합"];
  const chungOpts = ["자오충","축미충","인신충","묘유충","진술충","사해충"];
  const hyungOpts = ["인사형","사신형","축술형","자묘형"];
  const hap: string[] = [], chung: string[] = [], hyung: string[] = [];
  if (chance(branchCount === 4 ? 45 : 30)) hap.push(pick(hapOpts));
  if (chance(branchCount === 4 ? 15 : 8)) hap.push(pick(hapOpts));
  if (chance(branchCount === 4 ? 25 : 18)) chung.push(pick(chungOpts));
  if (chance(branchCount === 4 ? 25 : 18)) hyung.push(pick(hyungOpts));
  return { hap, chung, hyung };
}

function genShinsal() {
  const shinsal: string[] = [];
  let bad = 0, good = 0;
  for (const s of ["천을귀인","문창귀인","천덕귀인","월덕귀인","장성","학당"]) { if (chance(12)) { shinsal.push(s); good++; } }
  for (const s of ["도화살","홍염살"]) { if (chance(10)) shinsal.push(s); }
  for (const s of ["양인","겁살","현침살"]) { if (chance(10)) { shinsal.push(s); bad++; } }
  if (chance(8)) shinsal.push("백호");
  return { shinsal, shinsalBadCount: bad, goodShinsalCount: good };
}

const N = 50000;
let reversalCount = 0;
const reversals: { dist8: Record<string,number>; dist6: Record<string,number>; gradeO: string; gradeX: string; compO: number; compX: number }[] = [];

for (let i = 0; i < N; i++) {
  const dist8 = genDist8();
  const dist6 = removeTwoFromDist(dist8);
  const relsO = genRels(4);
  // 시간X: 관계가 줄어들 수 있음 (시지 제거)
  const relsX = { hap: relsO.hap.filter(() => chance(70)), chung: relsO.chung.filter(() => chance(70)), hyung: relsO.hyung.filter(() => chance(70)) };
  const starsO = genTenStars(randInt(3, 6));
  const starsX = starsO.slice(0, Math.max(2, starsO.length - randInt(0, 2)));
  const { shinsal, shinsalBadCount, goodShinsalCount } = genShinsal();

  const strengthRoll = Math.random();
  let strengthO: ScoringInput["strength"], strengthX: ScoringInput["strength"];
  if (strengthRoll < 0.35) { strengthO = "신강"; strengthX = "추정 신강"; }
  else if (strengthRoll < 0.70) { strengthO = "신약"; strengthX = "추정 신약"; }
  else if (strengthRoll < 0.85) { strengthO = "추정 신강"; strengthX = "추정 신강"; }
  else { strengthO = "추정 신약"; strengthX = "추정 신약"; }

  const common = { shinsal, shinsalBadCount, hasManselyeok: true, has건록제왕: chance(25), hasYongshinInStems: chance(20), goodShinsalCount, hasYongshinMonthRoot: chance(15), hasSamhap: relsO.hap.some(h => h.includes("삼합")) };

  const inputO: ScoringInput = { elementDist: dist8, strength: strengthO, tenStars: starsO, relationships: relsO, isTimeUnknown: false, ...common };
  const inputX: ScoringInput = { elementDist: dist6, strength: strengthX, tenStars: starsX, relationships: relsX, isTimeUnknown: true, ...common };

  const scoresO = calculateScores(inputO);
  const tierO = calculateTier(inputO, scoresO);
  const scoresX = calculateScores(inputX);
  const tierX = calculateTier(inputX, scoresX);

  // 역전: 시간X에서 D가 아닌데, 시간O에서 D
  if (tierX.grade !== "D" && tierO.grade === "D") {
    reversalCount++;
    if (reversals.length < 5) {
      reversals.push({ dist8, dist6, gradeO: tierO.grade, gradeX: tierX.grade, compO: tierO.composite, compX: tierX.composite });
    }
  }
}

console.log("═══════════════════════════════════════════════");
console.log("  시간X는 D가 아닌데 시간O에서 D가 되는 역전 검사");
console.log("  " + N.toLocaleString() + "건 시뮬레이션");
console.log("═══════════════════════════════════════════════");
console.log();
console.log("  역전 발생: " + reversalCount + "건 (" + (reversalCount / N * 100).toFixed(2) + "%)");
console.log();

if (reversals.length > 0) {
  console.log("  예시:");
  for (const r of reversals) {
    console.log("  ─────────────────────────────────────");
    console.log("    시간O: " + r.gradeO + "등급 (composite " + r.compO + ") dist=" + JSON.stringify(r.dist8));
    console.log("    시간X: " + r.gradeX + "등급 (composite " + r.compX + ") dist=" + JSON.stringify(r.dist6));
  }
}
