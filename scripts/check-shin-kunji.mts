import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const { data: yr } = await sb
  .from("yearly_results")
  .select("id, name, birth_date, birth_time, saju_text, full_json, created_at")
  .order("created_at", { ascending: false })
  .limit(10);

for (const r of yr ?? []) {
  const name = r.name ?? (r.full_json as any)?.input?.name;
  if (name && name.includes("건지")) {
    console.log(`=== ${name} ${r.birth_date} ${r.birth_time} (${r.created_at}) ===`);
    console.log("saju_text:");
    console.log(r.saju_text);
    console.log("");
    const fj = r.full_json as any;
    console.log("yearlyMeta:", JSON.stringify(fj?.yearlyMeta, null, 2));
    console.log("luckyMeta:", JSON.stringify(fj?.luckyMeta, null, 2));
    break;
  }
}
