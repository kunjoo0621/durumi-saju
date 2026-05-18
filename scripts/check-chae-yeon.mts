import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const { data: results } = await sb
  .from("saju_results")
  .select("name, birth_date, birth_time, gender, saju_text, full_json")
  .eq("name", "김채연")
  .eq("birth_date", "1998-07-24")
  .order("created_at", { ascending: false })
  .limit(1);

if (results && results.length > 0) {
  const r = results[0] as any;
  console.log("=== 김채연 1998-07-24 12:30 여성 ===");
  console.log("saju_text 컬럼:");
  console.log(r.saju_text);
  console.log("");
  console.log("--- fortune.pillars (원국) ---");
  const seunNow = r.full_json?.fortune?.seun?.find((s: any) => s.year === new Date().getFullYear());
  console.log("올해 세운:", seunNow);
  console.log("");
  const daeun = r.full_json?.fortune?.daeun;
  console.log("대운 pillars:", JSON.stringify(daeun?.pillars, null, 2)?.slice(0, 800));
}
