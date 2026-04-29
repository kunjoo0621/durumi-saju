import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data } = await sb.from("users").select("*").limit(1);
  if (data && data[0]) {
    console.log("users columns:");
    for (const k of Object.keys(data[0])) console.log(`  - ${k}: ${typeof data[0][k]} (sample: ${JSON.stringify(data[0][k])?.slice(0, 40)})`);
  }
}
main();
