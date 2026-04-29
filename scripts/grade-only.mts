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
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  S: "\x1b[38;5;203m", A: "\x1b[38;5;205m", B: "\x1b[38;5;208m", C: "\x1b[38;5;110m", D: "\x1b[38;5;130m",
  gray: "\x1b[90m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m",
};

const D7 = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

const { data: rows } = await sb
  .from("saju_results")
  .select("full_json, created_at")
  .gte("created_at", D7)
  .not("full_json", "is", null);

const valid = (rows ?? []).filter((r: any) => !r.full_json._error);
const total = valid.length;
const grades: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
const composites: number[] = [];
const cats: Record<string, number[]> = { 건강운: [], 대인운: [], 연애운: [], 재물운: [], 직장운: [] };

for (const r of valid) {
  const t = r.full_json.tier;
  if (t?.grade && grades[t.grade] !== undefined) grades[t.grade]++;
  if (typeof t?.composite === "number") composites.push(t.composite);
  for (const [k, v] of Object.entries(r.full_json.scores ?? {})) {
    if (cats[k] && typeof v === "number") cats[k].push(v);
  }
}

console.log(`\n${c.bold}🏆 등급 현황${c.reset} ${c.dim}(최근 7일 ${total}건)${c.reset}`);
console.log(c.gray + "─".repeat(56) + c.reset);
const ranges: Record<string, string> = { S: "≥86", A: "80~85", B: "69~79", C: "45~68", D: "<45" };
const max = Math.max(...Object.values(grades), 1);
for (const g of ["S", "A", "B", "C", "D"]) {
  const n = grades[g];
  const pct = ((n / total) * 100).toFixed(1);
  const bar = "█".repeat(Math.round((n / max) * 28));
  console.log(`  ${(c as any)[g]}${c.bold} ${g}${c.reset}  ${c.dim}${ranges[g].padEnd(7)}${c.reset}  ${(c as any)[g]}${String(n).padStart(2)}건${c.reset}  ${(c as any)[g]}${bar}${c.gray}${"·".repeat(28-bar.length)}${c.reset}  ${c.dim}${pct}%${c.reset}`);
}

if (composites.length) {
  composites.sort((a, b) => a - b);
  const avg = (composites.reduce((a, b) => a + b, 0) / composites.length).toFixed(1);
  const med = composites[Math.floor(composites.length / 2)];
  console.log(`\n${c.bold}📊 점수 통계${c.reset}`);
  console.log(c.gray + "─".repeat(56) + c.reset);
  console.log(`  평균 ${c.bold}${avg}${c.reset}점  /  중앙값 ${c.bold}${med}${c.reset}점  /  ${c.dim}최저 ${composites[0]} ~ 최고 ${composites[composites.length - 1]}${c.reset}`);
}

console.log(`\n${c.bold}💎 카테고리별 평균${c.reset}`);
console.log(c.gray + "─".repeat(56) + c.reset);
for (const [k, vs] of Object.entries(cats)) {
  if (!vs.length) continue;
  const a = vs.reduce((s, v) => s + v, 0) / vs.length;
  const col = a >= 70 ? c.green : a >= 60 ? c.yellow : c.red;
  console.log(`  ${k.padEnd(6)}  ${col}${a.toFixed(1)}${c.reset}점  ${col}${"█".repeat(Math.round(a / 3.5))}${c.reset}`);
}
console.log("");
