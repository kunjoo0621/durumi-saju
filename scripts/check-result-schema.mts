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
  const { data } = await sb
    .from("saju_results")
    .select("*")
    .not("full_json", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) {
    console.log("no row");
    return;
  }
  const r = data[0];
  console.log("== row keys ==");
  console.log(Object.keys(r).join(", "));
  console.log("\n== full_json keys ==");
  if (r.full_json) {
    console.log(Object.keys(r.full_json).slice(0, 30).join(", "));
    console.log("\n== full_json sample (truncated) ==");
    const sample: any = {};
    for (const k of Object.keys(r.full_json).slice(0, 20)) {
      const v = (r.full_json as any)[k];
      sample[k] = typeof v === "string" ? v.slice(0, 80) : (typeof v === "object" ? `[${typeof v}]` : v);
    }
    console.log(JSON.stringify(sample, null, 2));
  }

  // 등급/점수 관련 필드 찾기
  console.log("\n== grade / score 검색 ==");
  const json = r.full_json as any;
  const findFields = (obj: any, path = ""): string[] => {
    const found: string[] = [];
    if (!obj || typeof obj !== "object") return found;
    for (const [k, v] of Object.entries(obj)) {
      const p = path ? `${path}.${k}` : k;
      if (k.toLowerCase().includes("grade") || k.toLowerCase().includes("score") || k.toLowerCase().includes("composite") || k === "rank") {
        const preview = typeof v === "object" ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 60);
        found.push(`${p} = ${preview}`);
      }
      if (typeof v === "object" && v !== null && path.split(".").length < 3) {
        found.push(...findFields(v, p));
      }
    }
    return found;
  };
  for (const f of findFields(json)) console.log("  " + f);
}

main();
