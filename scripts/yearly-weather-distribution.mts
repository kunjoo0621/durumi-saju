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
  .from("yearly_results")
  .select("id, full_json, created_at")
  .order("created_at", { ascending: false })
  .limit(200);

if (!results || results.length === 0) {
  console.log("yearly_results 없음");
  process.exit(0);
}

const MOOD_PRIORITY = ["강세", "위기", "주의", "보통"] as const;
const WEATHER_LABEL: Record<string, string> = {
  강세: "맑은 한 해 ☀️",
  보통: "흐림 우세 ⛅",
  주의: "비 자주 🌧",
  위기: "변동 큰 한 해 ⛈",
};

let totalCounts: Record<string, number> = { 강세: 0, 보통: 0, 주의: 0, 위기: 0 };
const dominantCounts: Record<string, number> = { 강세: 0, 보통: 0, 주의: 0, 위기: 0 };
const tieCases: Array<{ id: string; counts: Record<string, number>; dominant: string }> = [];

console.log(`yearly_results 총 ${results.length}건 분석`);
console.log("");

for (const r of results) {
  const fj = r.full_json as any;
  const monthly: any[] = fj?.monthlyFlow ?? fj?.monthly_flow ?? [];
  if (!monthly || monthly.length === 0) continue;

  const counts: Record<string, number> = { 강세: 0, 보통: 0, 주의: 0, 위기: 0 };
  monthly.forEach((m) => {
    if (m.mood && counts[m.mood] !== undefined) counts[m.mood]++;
  });

  for (const k of Object.keys(counts)) totalCounts[k] += counts[k];

  const dominant = MOOD_PRIORITY.reduce<string>(
    (best, curr) => (counts[curr] > counts[best] ? curr : best),
    MOOD_PRIORITY[0],
  );
  dominantCounts[dominant]++;

  // 동률 여부 (강세와 다른 mood가 같은 max인 경우)
  const max = Math.max(...Object.values(counts));
  const tied = Object.entries(counts).filter(([_, v]) => v === max).map(([k]) => k);
  if (tied.length > 1 && dominant === "강세" && tied[0] !== "강세") {
    tieCases.push({ id: r.id, counts, dominant });
  }
  if (tied.length > 1 && tied.includes("강세")) {
    tieCases.push({ id: r.id, counts, dominant });
  }
}

console.log("=== 한 해 weather 분포 ===");
const totalResults = Object.values(dominantCounts).reduce((a, b) => a + b, 0);
for (const k of ["강세", "보통", "주의", "위기"]) {
  const c = dominantCounts[k];
  const pct = totalResults > 0 ? ((c / totalResults) * 100).toFixed(1) : "0";
  console.log(`  ${WEATHER_LABEL[k]}: ${c}건 (${pct}%)`);
}
console.log("");

console.log("=== 월별 mood 총량 (12 × N건) ===");
const totalMonths = Object.values(totalCounts).reduce((a, b) => a + b, 0);
for (const k of ["강세", "보통", "주의", "위기"]) {
  const c = totalCounts[k];
  const pct = totalMonths > 0 ? ((c / totalMonths) * 100).toFixed(1) : "0";
  console.log(`  ${k}: ${c}개월 (${pct}%)`);
}
console.log("");

console.log(`=== 강세-동률 케이스 ${tieCases.length}건 (전체 ${totalResults} 중) ===`);
for (const t of tieCases.slice(0, 8)) {
  console.log(`  ${t.id.slice(0, 8)}: ${JSON.stringify(t.counts)} → ${t.dominant}`);
}
