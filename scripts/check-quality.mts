import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const D7 = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
const H24 = new Date(Date.now() - 24 * 3600_000).toISOString();

const { data: all } = await sb.from("saju_results").select("id, full_json, saju_text, created_at").gte("created_at", D7);
const { data: h24 } = await sb.from("saju_results").select("id, full_json, saju_text, created_at").gte("created_at", H24);

function tally(rows: any[], label: string) {
  const total = rows.length;
  const completed = rows.filter(r => r.full_json && !(r.full_json._error)).length;
  const errored = rows.filter(r => r.full_json && r.full_json._error).length;
  const pending = rows.filter(r => !r.full_json).length;
  const noText = rows.filter(r => r.full_json && !r.full_json._error && (!r.saju_text || r.saju_text.length < 100)).length;
  const grades: Record<string, number> = {};
  for (const r of rows) {
    if (r.full_json && !r.full_json._error) {
      const g = r.full_json.tier?.grade ?? "?";
      grades[g] = (grades[g] ?? 0) + 1;
    }
  }
  console.log(`\n=== ${label} (${total}건) ===`);
  console.log(`  완료:    ${completed} (${Math.round(completed/total*100)}%)`);
  console.log(`  실패:    ${errored}`);
  console.log(`  미완료:  ${pending}`);
  console.log(`  본문누락: ${noText}`);
  console.log(`  등급:    ${Object.entries(grades).sort().map(([g, n]) => `${g}=${n}`).join(", ")}`);
}

tally(all ?? [], "최근 7일");
tally(h24 ?? [], "최근 24시간");
