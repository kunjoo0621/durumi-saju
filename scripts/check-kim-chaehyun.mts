import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL!, envVars.SUPABASE_SERVICE_ROLE_KEY!);

const { data } = await sb
  .from("saju_results")
  .select("id, name, created_at, full_json")
  .or("name.ilike.%김채현%,name.ilike.%김채연%")
  .order("created_at", { ascending: false })
  .limit(5);

for (const r of data ?? []) {
  const fj = r.full_json as any;
  console.log(`${r.created_at?.slice(0, 16)}  name=${r.name}`);
  console.log(`  v${fj?.scoringVersion}  tier.grade=${fj?.tier?.grade}  composite=${fj?.tier?.composite}  topPercent=${fj?.tier?.topPercent}%`);
}
