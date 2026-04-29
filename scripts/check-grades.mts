import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const names = ["정진엽", "김세연"];
for (const n of names) {
  const { data } = await sb
    .from("saju_results")
    .select("name, birth_date, gender, region, full_json, created_at, user_id")
    .eq("name", n)
    .order("created_at", { ascending: false });
  console.log(`\n=== ${n} (${data?.length ?? 0}건) ===`);
  for (const r of data ?? []) {
    const t = r.full_json?.tier;
    const s = r.full_json?.scores;
    console.log(`  ${r.created_at?.slice(0,16)}  ${t?.grade} ${t?.composite}점  ${r.birth_date} ${r.gender} ${r.region}`);
    console.log(`    재물 ${s?.재물운} / 연애 ${s?.연애운} / 직장 ${s?.직장운} / 건강 ${s?.건강운} / 대인 ${s?.대인운}`);
  }
}
