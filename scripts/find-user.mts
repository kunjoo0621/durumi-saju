import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const NAME = "이상윤";

console.log(`=== users 테이블 (kakao 닉네임) ===`);
const { data: users } = await sb
  .from("users")
  .select("id, name, kakao_id, created_at")
  .ilike("name", `%${NAME}%`)
  .limit(20);
console.table(users ?? []);

console.log(`\n=== saju_results (분석 입력 이름) ===`);
const { data: results } = await sb
  .from("saju_results")
  .select("id, name, birth_date, birth_time, gender, user_id, full_json, created_at")
  .ilike("name", `%${NAME}%`)
  .order("created_at", { ascending: false })
  .limit(20);

for (const r of results ?? []) {
  const tier = (r as any).full_json?.tier;
  const ver = (r as any).full_json?.scoringVersion;
  console.log(`- ${r.name} | ${r.birth_date} ${r.birth_time ?? ""} | ${r.gender} | ${tier?.grade ?? "?"} ${tier?.composite ?? "?"} | v${ver} | ${r.created_at} | user=${r.user_id ?? "guest"}`);
}
