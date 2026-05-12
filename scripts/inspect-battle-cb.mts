import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

// 가장 최근 C가 B 이긴 케이스
const { data: rows } = await sb
  .from("saju_battles")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(50);

const GRADE_RANK: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };

for (const r of rows ?? []) {
  const ga = GRADE_RANK[r.player_a_grade];
  const gb = GRADE_RANK[r.player_b_grade];
  const winner = r.overall_winner;
  if (winner === "draw") continue;
  const winnerRank = winner === "A" ? ga : gb;
  const loserRank = winner === "A" ? gb : ga;
  if (winnerRank >= loserRank) continue;

  console.log("=== 등급 역전 사례 ===");
  console.log(`${r.player_a_name}(${r.player_a_grade}) vs ${r.player_b_name}(${r.player_b_grade})`);
  console.log(`승자: ${r.overall_winner}, 카테고리 승수 ${r.wins_a}:${r.wins_b}, 강도: ${r.overall_intensity}`);
  console.log(`full_result 최상위 키: ${Object.keys(r.full_result || {}).join(", ")}`);
  console.log(`full_result 일부:`, JSON.stringify(r.full_result, null, 2).slice(0, 1500));
  console.log("---");
  break;
}
