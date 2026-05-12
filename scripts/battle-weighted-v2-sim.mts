/**
 * 배틀 가중 카테고리 승수 v2 — 전문가 토론 반영
 * - 압승 임계값 6+ (보수화)
 * - 무승부 강도는 가중 승점 0 동률만, composite tiebreaker는 composite 차이로 강도 재산출
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

function categoryIntensity(diff: number): Intensity {
  const abs = Math.abs(diff);
  if (abs >= 15) return "압승";
  if (abs >= 8) return "승리";
  if (abs >= 1) return "신승";
  return "무승부";
}

function compositeIntensity(diff: number): Intensity {
  const abs = Math.abs(diff);
  if (abs >= 15) return "압승";
  if (abs >= 8) return "승리";
  if (abs >= 1) return "신승";
  return "무승부";
}

// 신규 강도: 가중 승점 차이 기준 — 압승 6+ / 승리 3+ / 신승 1+
function pointsIntensity(pointsDiff: number): Intensity {
  if (pointsDiff >= 6) return "압승";
  if (pointsDiff >= 3) return "승리";
  if (pointsDiff >= 1) return "신승";
  return "무승부";
}

interface Result { winner: "A"|"B"|"draw"; pointsA: number; pointsB: number; intensity: Intensity; tiebreakUsed: boolean; }

function applyV2(scoresA: any, scoresB: any, compA: number, compB: number): Result {
  let pointsA = 0, pointsB = 0;
  for (const c of CATEGORY_ORDER) {
    const d = scoresA[c] - scoresB[c];
    const w = INTENSITY_WEIGHT[categoryIntensity(d)];
    if (d > 0) pointsA += w;
    else if (d < 0) pointsB += w;
  }
  const pointsDiff = Math.abs(pointsA - pointsB);
  let winner: "A"|"B"|"draw";
  let tiebreakUsed = false;
  let intensity: Intensity;

  if (pointsA > pointsB) {
    winner = "A";
    intensity = pointsIntensity(pointsDiff);
  } else if (pointsB > pointsA) {
    winner = "B";
    intensity = pointsIntensity(pointsDiff);
  } else {
    // 가중 승점 동률 → composite로 결정 + composite 차이로 강도
    tiebreakUsed = true;
    if (compA > compB) winner = "A";
    else if (compB > compA) winner = "B";
    else winner = "draw";
    const compDiff = Math.abs(compA - compB);
    intensity = compositeIntensity(compDiff); // 0이면 무승부
  }

  return { winner, pointsA, pointsB, intensity, tiebreakUsed };
}

const { data: rows } = await sb.from("saju_battles").select("*").order("created_at", { ascending: false }).limit(200);
const N = (rows ?? []).length;
console.log(`\n분석 대상: ${N}건\n`);

let analyzed = 0;
let upsetResolved = 0, upsetRemains = 0;
const newDist = { 압승: 0, 승리: 0, 신승: 0, 무승부: 0 };
let newDraws = 0, newTiebreakUsed = 0;

const upsetCases: any[] = [];

for (const r of rows ?? []) {
  const scoresA = r.full_result?.playerA?.scores;
  const scoresB = r.full_result?.playerB?.scores;
  const compA = r.full_result?.playerA?.tier?.composite;
  const compB = r.full_result?.playerB?.tier?.composite;
  if (!scoresA || !scoresB || typeof compA !== "number" || typeof compB !== "number") continue;
  analyzed++;

  const newR = applyV2(scoresA, scoresB, compA, compB);
  newDist[newR.intensity]++;
  if (newR.winner === "draw") newDraws++;
  if (newR.tiebreakUsed) newTiebreakUsed++;

  // 등급 역전 분석
  const ga = GRADE_RANK[r.player_a_grade];
  const gb = GRADE_RANK[r.player_b_grade];
  // 기존 알고리즘에서 등급 역전이었는지
  let oldWinsA = 0, oldWinsB = 0;
  for (const c of CATEGORY_ORDER) {
    const d = scoresA[c] - scoresB[c];
    if (d > 0) oldWinsA++;
    else if (d < 0) oldWinsB++;
  }
  let oldWinner: "A"|"B"|"draw";
  if (oldWinsA > oldWinsB) oldWinner = "A";
  else if (oldWinsB > oldWinsA) oldWinner = "B";
  else oldWinner = compA > compB ? "A" : compB > compA ? "B" : "draw";

  const oldUpset = oldWinner !== "draw" && (oldWinner === "A" ? ga < gb : gb < ga);
  const newUpset = newR.winner !== "draw" && (newR.winner === "A" ? ga < gb : gb < ga);

  if (oldUpset && !newUpset) {
    upsetResolved++;
    upsetCases.push({ r, oldWinner, newR, ga, gb });
  }
  if (oldUpset && newUpset) upsetRemains++;
}

console.log(`분석 완료: ${analyzed}건\n`);
console.log("━━━ v2 알고리즘 결과 ━━━");
console.log(`등급 역전 해소: ${upsetResolved}건`);
console.log(`등급 역전 유지: ${upsetRemains}건`);
console.log(`tiebreaker 발동(가중 승점 동률): ${newTiebreakUsed}건`);
console.log(`최종 무승부: ${newDraws}건\n`);

console.log("강도 분포 (v2):");
const totalPct = (k: keyof typeof newDist) => `${(newDist[k]/analyzed*100).toFixed(1)}%`;
console.log(`  압승   ${String(newDist["압승"]).padStart(3)}건 (${totalPct("압승")})`);
console.log(`  승리   ${String(newDist["승리"]).padStart(3)}건 (${totalPct("승리")})`);
console.log(`  신승   ${String(newDist["신승"]).padStart(3)}건 (${totalPct("신승")})`);
console.log(`  무승부 ${String(newDist["무승부"]).padStart(3)}건 (${totalPct("무승부")})`);

console.log("\n━━━ 등급 역전 해소 사례 (v2) ━━━");
for (const u of upsetCases.slice(0, 3)) {
  const r = u.r;
  console.log(`${r.player_a_name}(${r.player_a_grade}) vs ${r.player_b_name}(${r.player_b_grade})`);
  console.log(`  v2: 가중 승점 ${u.newR.pointsA}:${u.newR.pointsB} → ${u.newR.winner === "A" ? r.player_a_name : r.player_b_name} ${u.newR.intensity}`);
}
