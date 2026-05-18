import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const { data: r } = await sb
  .from("yearly_results")
  .select("id, full_json")
  .eq("id", "eca3f99a-3ca2-41d9-939c-3f54806940e1")
  .maybeSingle();

const fj = (r as any).full_json;
const sections = fj.sections ?? {};
let total = "";
for (const [k, v] of Object.entries(sections)) {
  const x = v as any;
  const text = [x?.title, x?.headline, x?.body].filter(Boolean).join("\n");
  console.log(`[${k}] ${text.length}자`);
  total += text + "\n";
}
console.log("\n=== 본문 총 길이:", total.length, "자");
const fullJsonStr = JSON.stringify(fj);
console.log("=== full_json JSON 직렬화:", fullJsonStr.length, "자");
console.log("\n출력 토큰 추정 (한글 1자 ≈ 0.85토큰):", Math.round(fullJsonStr.length * 0.85), "tokens");

// 시스템 프롬프트 크기 확인
const prompt = readFileSync("lib/yearly-prompt.ts", "utf-8");
const sysStart = prompt.indexOf("YEARLY_SYSTEM_PROMPT");
const sysEnd = prompt.indexOf("export async function callYearlyGemini") - 1;
console.log("\n시스템 프롬프트 정의 길이 (rough):", sysEnd - sysStart, "자");
