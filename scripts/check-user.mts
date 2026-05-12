import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const USER_ID = "1f168320-917a-4a74-b92d-ab29f185bcc8";

const { data: user } = await sb
  .from("users")
  .select("id, name, kakao_id, created_at")
  .eq("id", USER_ID)
  .single();
console.log(`=== users ===`);
console.log(user);

const { data: prof } = await sb
  .from("profiles")
  .select("coin_balance, user_id")
  .eq("user_id", USER_ID)
  .single();
console.log(`\n=== profiles ===`);
console.log(prof);

const { data: results } = await sb
  .from("saju_results")
  .select("name, birth_date, birth_time, gender, full_json, created_at")
  .eq("user_id", USER_ID)
  .order("created_at", { ascending: false });
console.log(`\n=== 이 계정의 모든 분석 (${results?.length ?? 0}건) ===`);
for (const r of results ?? []) {
  const t = (r as any).full_json?.tier;
  const v = (r as any).full_json?.scoringVersion;
  console.log(`- ${r.name} | ${r.birth_date} ${r.birth_time ?? ""} | ${r.gender} | ${t?.grade ?? "?"} ${t?.composite ?? "?"} | v${v} | ${r.created_at}`);
}
