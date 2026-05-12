/**
 * C가 B를 이기거나, 낮은 등급이 높은 등급을 이긴 배틀 사례 점검.
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

const { data: rows } = await sb
  .from("saju_battles")
  .select("player_a_name, player_b_name, player_a_grade, player_b_grade, overall_winner, overall_intensity, wins_a, wins_b, draws, full_result, created_at")
  .order("created_at", { ascending: false })
  .limit(200);

const N = (rows ?? []).length;
console.log(`\n전체 배틀: ${N}건\n`);

const upsets: any[] = [];
for (const r of rows ?? []) {
  const ga = GRADE_RANK[(r as any).player_a_grade];
  const gb = GRADE_RANK[(r as any).player_b_grade];
  const winner = (r as any).overall_winner;
  if (winner === "draw") continue;

  const winnerRank = winner === "A" ? ga : gb;
  const loserRank = winner === "A" ? gb : ga;
  if (winnerRank < loserRank) {
    upsets.push(r);
  }
}

console.log(`등급 역전(낮은 등급 → 높은 등급 격파) 사례: ${upsets.length}건\n`);

for (const u of upsets) {
  const winnerGrade = u.overall_winner === "A" ? u.player_a_grade : u.player_b_grade;
  const loserGrade = u.overall_winner === "A" ? u.player_b_grade : u.player_a_grade;
  const winnerName = u.overall_winner === "A" ? u.player_a_name : u.player_b_name;
  const loserName = u.overall_winner === "A" ? u.player_b_name : u.player_a_name;
  console.log(`[${winnerGrade}] ${winnerName}  >  [${loserGrade}] ${loserName}`);
  console.log(`  카테고리 승수: A ${u.wins_a} / B ${u.wins_b} / 무 ${u.draws}, 강도: ${u.overall_intensity}`);

  const scoresA = u.full_result?.scoresA;
  const scoresB = u.full_result?.scoresB;
  if (scoresA && scoresB) {
    const cats = ["재물운", "연애운", "직장운", "건강운", "대인운"];
    const detail = cats.map((c) => {
      const a = scoresA[c]; const b = scoresB[c];
      const sym = a > b ? "A승" : a < b ? "B승" : "무";
      return `${c} ${a}vs${b}(${sym})`;
    }).join(" | ");
    console.log(`  ${detail}`);
  }
  console.log();
}
