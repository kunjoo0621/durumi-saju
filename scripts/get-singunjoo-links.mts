import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL!, envVars.SUPABASE_SERVICE_ROLE_KEY!);

// 운영자 user
const { data: users } = await sb
  .from("users")
  .select("id, nickname, primary_result_id")
  .or("nickname.ilike.%신건주%,name.ilike.%신건주%");
console.log("운영자 user:");
for (const u of users ?? []) console.log(`  id=${u.id?.slice(0, 8)}  nickname=${u.nickname}  primary_result_id=${u.primary_result_id}`);

const uids = (users ?? []).map((u: any) => u.id);

// saju_results 본인 사주만 (생일 1995-06-21) — v16 우선
const { data: results } = await sb
  .from("saju_results")
  .select("id, name, created_at, full_json")
  .in("user_id", uids)
  .eq("birth_date", "1995-06-21")
  .order("created_at", { ascending: false });

console.log("\n본인 사주 row (1995-06-21):\n");
for (const r of results ?? []) {
  const fj = r.full_json as any;
  console.log(`  v${fj?.scoringVersion}  ${fj?.tier?.grade}등급 ${fj?.tier?.composite}점  name=${r.name}`);
  console.log(`    /result?resultId=${r.id}`);
  console.log(`    /result/share/${r.id}\n`);
}
