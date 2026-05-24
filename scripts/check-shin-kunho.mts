import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

// yearly_results 최신 5건에서 신건호 찾기
const { data: yr } = await sb
  .from("yearly_results")
  .select("id, full_json, created_at, target_year")
  .order("created_at", { ascending: false })
  .limit(20);

console.log(`yearly_results 최근 ${yr?.length ?? 0}건`);
console.log("");

for (const r of yr ?? []) {
  const fj = r.full_json as any;
  const name = fj?.input?.name ?? fj?.name;
  if (name && name.includes("건호")) {
    console.log(`=== 매치: ${r.id.slice(0, 8)} | name=${name} | ${r.created_at} | year=${r.target_year} ===`);
    console.log("input:", JSON.stringify(fj?.input ?? {}, null, 2));
    console.log("");
    console.log("yearlyMeta:", JSON.stringify(fj?.yearlyMeta ?? {}, null, 2));
    console.log("");
    console.log("luckyMeta:", JSON.stringify(fj?.luckyMeta ?? {}, null, 2));
    console.log("");
    console.log("monthlyFlow 12개월 mood:");
    for (const m of fj?.monthlyFlow ?? []) {
      console.log(`  ${m.month}월 ${m.pillar} ${m.tenStar} ${m.twelveStage} mood=${m.mood}`);
    }
    console.log("");
    console.log("tier:", JSON.stringify(fj?.tier ?? {}, null, 2));
    break;
  }
}
