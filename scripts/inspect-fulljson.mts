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
  .select("*")
  .not("full_json", "is", null)
  .limit(1);

if (rows && rows[0]) {
  console.log("All columns:", Object.keys(rows[0]).filter(k => k !== "full_json" && k !== "saju_text"));
  for (const k of Object.keys(rows[0])) {
    if (k === "full_json" || k === "saju_text") continue;
    const v = (rows[0] as any)[k];
    if (typeof v === "string" && v.length < 100) console.log(`  ${k} = ${v}`);
    else if (typeof v === "number" || typeof v === "boolean") console.log(`  ${k} = ${v}`);
    else if (v === null) console.log(`  ${k} = null`);
  }
  console.log("\nsaju_text sample:");
  console.log((rows[0] as any).saju_text?.slice(0, 300));
}
