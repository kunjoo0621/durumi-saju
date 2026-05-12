/**
 * 사용자 본인(신건주, 1995-06-21) 최근 분석 row 조회 — v16 저장 검증
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

const { data: rows } = await sb
  .from("saju_results")
  .select("name, birth_date, created_at, full_json")
  .or("name.ilike.%신건주%,name.ilike.%신건쥬%,birth_date.eq.1995-06-21")
  .order("created_at", { ascending: false })
  .limit(5);

console.log(`신건주/1995-06-21 분석 row ${rows?.length ?? 0}건\n`);

for (const r of rows ?? []) {
  const v = (r as any).full_json?.scoringVersion ?? "(없음)";
  const composite = (r as any).full_json?.composite ?? "?";
  const grade = (r as any).full_json?.grade ?? "?";
  const scores = (r as any).full_json?.scores ?? {};
  console.log(`${(r as any).created_at.slice(0, 19)}`);
  console.log(`  이름: ${(r as any).name}`);
  console.log(`  생일: ${(r as any).birth_date}`);
  console.log(`  scoringVersion: v${v}`);
  console.log(`  composite: ${composite} / grade: ${grade}`);
  console.log(`  카테고리: 재물 ${scores.wealth ?? "?"} / 연애 ${scores.love ?? "?"} / 직장 ${scores.career ?? "?"} / 건강 ${scores.health ?? "?"} / 대인 ${scores.relation ?? "?"}`);
  console.log();
}
