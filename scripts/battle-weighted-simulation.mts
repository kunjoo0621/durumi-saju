/**
 * 배틀 가중 카테고리 승수 알고리즘 시뮬레이션
 * 실 데이터 saju_battles에 새 알고리즘 적용 → 변화 측정
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const GRADE_RANK: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
const CATEGORY_ORDER = ["재물운", "연애운", "직장운", "건강운", "대인운"];

type Intensity = "압승" | "승리" | "신승" | "무승부";
const INTENSITY_WEIGHT: Record<Intensity, number> = { "압승": 3, "승리": 2, "신승": 1, "무승부": 0 };

function intensityFromDiff(diff: number): Intensity {
  const abs = Math.abs(diff);
  if (abs >= 15) return "압승";
  if (abs >= 8) return "승리";
  if (abs >= 1) return "신승";
  return "무승부";
}

interface OldResult { winner: "A"|"B"|"draw"; winsA: number; winsB: number; intensity: Intensity; }
interface NewResult { winner: "A"|"B"|"draw"; pointsA: number; pointsB: number; intensity: Intensity; tiebreakUsed: boolean; }

function applyOldAlgo(scoresA: any, scoresB: any, compA: number, compB: number): OldResult {
  let winsA = 0, winsB = 0;
  for (const c of CATEGORY_ORDER) {
    const d = scoresA[c] - scoresB[c];
    if (d > 0) winsA++;
    else if (d < 0) winsB++;
  }
  let winner: "A"|"B"|"draw";
  if (winsA > winsB) winner = "A";
  else if (winsB > winsA) winner = "B";
  else {
    if (compA > compB) winner = "A";
    else if (compB > compA) winner = "B";
    else winner = "draw";
  }
  const compositeDiff = Math.abs(compA - compB);
  const intensity = intensityFromDiff(winner === "draw" ? 0 : winner === "A" ? compositeDiff : -compositeDiff);
  return { winner, winsA, winsB, intensity };
}

function applyNewAlgo(scoresA: any, scoresB: any, compA: number, compB: number): NewResult {
  let pointsA = 0, pointsB = 0;
  for (const c of CATEGORY_ORDER) {
    const d = scoresA[c] - scoresB[c];
    const intensity = intensityFromDiff(d);
    const w = INTENSITY_WEIGHT[intensity];
    if (d > 0) pointsA += w;
    else if (d < 0) pointsB += w;
  }
  let winner: "A"|"B"|"draw";
  let tiebreakUsed = false;
  if (pointsA > pointsB) winner = "A";
  else if (pointsB > pointsA) winner = "B";
  else {
    tiebreakUsed = true;
    if (compA > compB) winner = "A";
    else if (compB > compA) winner = "B";
    else winner = "draw";
  }
  // 강도 재정의: 가중 승점 차이 기반
  const pointsDiff = Math.abs(pointsA - pointsB);
  let intensity: Intensity;
  if (pointsDiff >= 5) intensity = "압승";
  else if (pointsDiff >= 3) intensity = "승리";
  else if (pointsDiff >= 1) intensity = "신승";
  else intensity = "무승부";
  return { winner, pointsA, pointsB, intensity, tiebreakUsed };
}

const { data: rows } = await sb
  .from("saju_battles")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(200);

const N = (rows ?? []).length;
console.log(`\n분석 대상: ${N}건\n`);

let analyzed = 0;
let winnerChanged = 0;
let intensityChanged = 0;
const upsetResolved: any[] = [];
const upsetRemains: any[] = [];

const oldDist = { 압승: 0, 승리: 0, 신승: 0, 무승부: 0 };
const newDist = { 압승: 0, 승리: 0, 신승: 0, 무승부: 0 };
let oldDraws = 0, newDraws = 0;
let newTiebreakUsed = 0;

for (const r of rows ?? []) {
  const scoresA = r.full_result?.playerA?.scores;
  const scoresB = r.full_result?.playerB?.scores;
  const compA = r.full_result?.playerA?.tier?.composite;
  const compB = r.full_result?.playerB?.tier?.composite;
  if (!scoresA || !scoresB || typeof compA !== "number" || typeof compB !== "number") continue;
  analyzed++;

  const oldR = applyOldAlgo(scoresA, scoresB, compA, compB);
  const newR = applyNewAlgo(scoresA, scoresB, compA, compB);

  oldDist[oldR.intensity]++;
  newDist[newR.intensity]++;
  if (oldR.winner === "draw") oldDraws++;
  if (newR.winner === "draw") newDraws++;
  if (newR.tiebreakUsed) newTiebreakUsed++;

  if (oldR.winner !== newR.winner) winnerChanged++;
  if (oldR.intensity !== newR.intensity) intensityChanged++;

  // 등급 역전 분석
  const ga = GRADE_RANK[r.player_a_grade];
  const gb = GRADE_RANK[r.player_b_grade];
  const oldUpset = oldR.winner !== "draw" && (oldR.winner === "A" ? ga < gb : gb < ga);
  const newUpset = newR.winner !== "draw" && (newR.winner === "A" ? ga < gb : gb < ga);
  if (oldUpset && !newUpset) upsetResolved.push({ r, oldR, newR });
  if (oldUpset && newUpset) upsetRemains.push({ r, oldR, newR });
}

console.log(`분석 완료: ${analyzed}건 (scoresA/B 있는 것)\n`);

console.log("━━━ 승자 변화 ━━━");
console.log(`승자 바뀐 배틀: ${winnerChanged}건 (${(winnerChanged/analyzed*100).toFixed(1)}%)`);
console.log(`강도 바뀐 배틀: ${intensityChanged}건 (${(intensityChanged/analyzed*100).toFixed(1)}%)`);

console.log("\n━━━ 등급 역전 (낮은 등급 → 높은 등급 이김) ━━━");
console.log(`기존 알고리즘에서 등급 역전 발생: ${upsetResolved.length + upsetRemains.length}건`);
console.log(`  새 알고리즘에서 해소(등급 일치): ${upsetResolved.length}건`);
console.log(`  새 알고리즘에서도 역전 유지:   ${upsetRemains.length}건`);

console.log("\n━━━ 강도 분포 ━━━");
console.log("강도         기존         신규");
for (const k of ["압승", "승리", "신승", "무승부"]) {
  console.log(`  ${k.padEnd(4)}     ${String(oldDist[k]).padStart(3)}건       ${String(newDist[k]).padStart(3)}건`);
}

console.log("\n━━━ 무승부·tiebreaker ━━━");
console.log(`기존 무승부: ${oldDraws}건 / 신규 무승부: ${newDraws}건`);
console.log(`신규 tiebreaker 발동(가중 승점 동률): ${newTiebreakUsed}건`);

console.log("\n━━━ 등급 역전 해소 사례 ━━━");
for (const u of upsetResolved.slice(0, 5)) {
  const r = u.r;
  console.log(`${r.player_a_name}(${r.player_a_grade}) vs ${r.player_b_name}(${r.player_b_grade})`);
  console.log(`  기존: ${u.oldR.winsA}:${u.oldR.winsB} → ${u.oldR.winner === "A" ? r.player_a_name : r.player_b_name} 승`);
  console.log(`  신규: ${u.newR.pointsA}:${u.newR.pointsB} 가중 승점 → ${u.newR.winner === "A" ? r.player_a_name : r.player_b_name} 승`);
  console.log();
}

if (upsetRemains.length > 0) {
  console.log("━━━ 등급 역전이 그대로 유지된 사례 ━━━");
  for (const u of upsetRemains.slice(0, 5)) {
    const r = u.r;
    console.log(`${r.player_a_name}(${r.player_a_grade}) vs ${r.player_b_name}(${r.player_b_grade})`);
    console.log(`  신규: ${u.newR.pointsA}:${u.newR.pointsB} 가중 승점 → ${u.newR.winner === "A" ? r.player_a_name : r.player_b_name} 승`);
  }
}
