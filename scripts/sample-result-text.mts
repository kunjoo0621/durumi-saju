import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

// 최근 분석 1건의 LLM 출력 가져오기
const { data: rows } = await sb
  .from("saju_results")
  .select("name, gender, full_json, saju_text")
  .not("full_json", "is", null)
  .order("created_at", { ascending: false })
  .limit(1);

const r = (rows ?? [])[0];
if (!r) { console.log("no data"); process.exit(0); }

const fj = r.full_json;
console.log(`이름: ${r.name} (${r.gender})`);
console.log(`등급: ${fj.tier?.grade} / composite ${fj.tier?.composite}`);
console.log(`카테고리: ${JSON.stringify(fj.scores)}`);
console.log();
console.log("=== 사주 표 ===");
console.log(r.saju_text?.slice(0, 400));
console.log();

console.log("=== LLM 섹션 텍스트 (전체) ===\n");
const sections = fj.sections ?? [];
for (const s of sections) {
  const heading = s.heading ?? s.title ?? s.icon ?? "(섹션)";
  console.log(`▶ ${heading}`);
  console.log(s.body ?? s.content ?? s.text ?? "(본문 없음)");
  console.log();
}
