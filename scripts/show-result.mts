import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  brand: "\x1b[38;5;203m",
};

const HR = c.gray + "━".repeat(70) + c.reset;
const RULE = c.gray + "─".repeat(70) + c.reset;

async function main() {
  // 인자: kakao_id 또는 name 또는 latest
  const arg = process.argv[2] ?? "latest";

  let query = sb.from("saju_results").select("*").not("full_json", "is", null);
  if (arg === "latest") {
    query = query.order("created_at", { ascending: false }).limit(1);
  } else {
    query = query.eq("name", arg).order("created_at", { ascending: false }).limit(1);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    console.error("결과 없음");
    return;
  }
  const r = data[0];
  const fj = r.full_json as any;

  // 가입자 닉네임 lookup
  let userNick = "(게스트)";
  if (r.user_id) {
    const { data: u } = await sb.from("users").select("nickname, kakao_id").eq("id", r.user_id).single();
    userNick = u?.nickname ?? `(없음, kakao=${u?.kakao_id ?? "?"})`;
  }

  console.log(`\n${HR}`);
  console.log(`  ${c.bold}${c.brand}🔮 사주 분석 결과표${c.reset}`);
  console.log(`${HR}`);

  // 1. 입력 정보
  console.log(`\n${c.bold}${c.cyan}📥 입력 정보${c.reset}`);
  console.log(RULE);
  const fmt = (k: string, v: any) => console.log(`  ${c.dim}${k.padEnd(12)}${c.reset} ${v ?? "-"}`);
  fmt("가입자", userNick);
  fmt("이름", r.name);
  fmt("생년월일", `${r.birth_date} ${r.birth_time ?? ""} (${r.calendar_type ?? "?"})`);
  fmt("성별", r.gender);
  fmt("지역", r.region);
  fmt("연애 상태", r.relationship_status);
  fmt("직업", r.employment_status);
  fmt("분석 시각", new Date(new Date(r.created_at).getTime() + 9 * 3600_000).toISOString().slice(0, 19).replace("T", " ") + " KST");

  // 2. 등급 / 점수
  const tier = fj.tier ?? {};
  const gradeColor: Record<string, string> = {
    S: "\x1b[38;5;203m", A: "\x1b[38;5;205m", B: "\x1b[38;5;208m", C: "\x1b[38;5;110m", D: "\x1b[38;5;130m",
  };
  const gc = gradeColor[tier.grade ?? "C"] ?? c.dim;

  console.log(`\n${c.bold}${c.cyan}🏆 등급 / 종합점수${c.reset}`);
  console.log(RULE);
  console.log(`  ${gc}${c.bold} ${tier.grade ?? "?"} ${c.reset}  composite ${gc}${c.bold}${tier.composite ?? "?"}${c.reset}점  ${c.dim}(상위 ${tier.topPercent ?? "?"}% / percentileRank ${tier.percentileRank ?? "?"})${c.reset}`);
  if (tier.title) console.log(`\n  제목: ${c.bold}${tier.title}${c.reset}`);
  if (tier.description) {
    console.log(`\n  설명:`);
    console.log(`  ${c.dim}${tier.description.replace(/\n/g, "\n  ")}${c.reset}`);
  }

  // 3. 5개 운 점수
  console.log(`\n${c.bold}${c.cyan}💎 카테고리별 점수${c.reset}`);
  console.log(RULE);
  const scores = fj.scores ?? {};
  for (const [cat, val] of Object.entries(scores)) {
    const v = val as number;
    const col = v >= 80 ? c.green : v >= 65 ? c.yellow : v >= 50 ? c.dim : c.red;
    const bar = "█".repeat(Math.round(v / 3.5));
    console.log(`  ${c.dim}${cat.padEnd(6)}${c.reset}  ${col}${String(v).padStart(3)}점${c.reset}  ${col}${bar}${c.reset}`);
  }

  // 4. coreFearAxisBlock
  if (fj.coreFearAxisBlock) {
    console.log(`\n${c.bold}${c.cyan}🪞 핵심 두려움 (coreFearAxisBlock)${c.reset}`);
    console.log(RULE);
    console.log(`  ${c.dim}${fj.coreFearAxisBlock.replace(/\n/g, "\n  ").slice(0, 800)}${(fj.coreFearAxisBlock.length > 800 ? "..." : "")}${c.reset}`);
  }

  // 5. 섹션 (8개)
  if (Array.isArray(fj.sections)) {
    console.log(`\n${c.bold}${c.cyan}📚 8개 섹션${c.reset}`);
    console.log(RULE);
    for (let i = 0; i < fj.sections.length; i++) {
      const s = fj.sections[i];
      console.log(`\n  ${c.bold}${i + 1}. ${s.icon ?? ""} ${s.title ?? "(제목 없음)"}${c.reset}`);
      if (s.content) {
        const preview = s.content.slice(0, 600);
        console.log(`  ${c.dim}${preview.replace(/\n/g, "\n  ")}${(s.content.length > 600 ? "...(더 있음)" : "")}${c.reset}`);
      }
    }
  }

  // 6. 메타데이터
  console.log(`\n${c.bold}${c.cyan}🔧 메타데이터${c.reset}`);
  console.log(RULE);
  fmt("scoringVer", fj.scoringVersion);
  fmt("result_id", r.id);
  fmt("user_id", r.user_id ?? "(게스트)");
  fmt("order_id", r.order_id);

  console.log(`\n${HR}\n`);
}
main();
