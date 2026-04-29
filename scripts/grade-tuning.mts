import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const D14 = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
const { data: rows } = await sb
  .from("saju_results")
  .select("full_json, name, created_at")
  .gte("created_at", D14)
  .not("full_json", "is", null);

const valid = (rows ?? []).filter((r: any) => !r.full_json._error);
const composites: number[] = [];
for (const r of valid) {
  const c = r.full_json.tier?.composite;
  if (typeof c === "number") composites.push(c);
}
composites.sort((a, b) => a - b);
const N = composites.length;

console.log(`\n=== 전체 점수 분포 (${N}건, 14일) ===\n`);

// 히스토그램 (5점 단위)
console.log("점수 구간별 분포:");
const buckets = new Map<number, number>();
for (const c of composites) {
  const b = Math.floor(c / 5) * 5;
  buckets.set(b, (buckets.get(b) ?? 0) + 1);
}
const max = Math.max(...buckets.values());
for (let b = 40; b <= 95; b += 5) {
  const n = buckets.get(b) ?? 0;
  const bar = "█".repeat(Math.round((n / max) * 30));
  console.log(`  ${b}~${b + 4}  ${String(n).padStart(2)}건  ${bar}`);
}

// 백분위
console.log("\n백분위:");
const pctiles = [10, 25, 50, 75, 90];
for (const p of pctiles) {
  const idx = Math.floor(((p / 100) * N));
  console.log(`  ${p}%:  ${composites[idx]}점`);
}

// 현재 등급 분포
function classify(c: number, cuts: { S: number; A: number; B: number; C: number }) {
  if (c >= cuts.S) return "S";
  if (c >= cuts.A) return "A";
  if (c >= cuts.B) return "B";
  if (c >= cuts.C) return "C";
  return "D";
}

function distribute(cuts: { S: number; A: number; B: number; C: number }, label: string) {
  const dist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const c of composites) dist[classify(c, cuts)]++;
  console.log(`\n${label} (S≥${cuts.S} A≥${cuts.A} B≥${cuts.B} C≥${cuts.C}):`);
  for (const g of ["S", "A", "B", "C", "D"]) {
    const n = dist[g];
    const pct = ((n / N) * 100).toFixed(1);
    console.log(`  ${g}  ${String(n).padStart(2)}건  ${pct.padStart(5)}%`);
  }
}

// 현재 + 시뮬레이션 옵션들
distribute({ S: 86, A: 80, B: 69, C: 45 }, "현재 (S86/A80/B69/C45)");
distribute({ S: 85, A: 77, B: 65, C: 45 }, "옵션1: S85/A77/B65/C45 (경계 약간 낮춤)");
distribute({ S: 84, A: 75, B: 63, C: 45 }, "옵션2: S84/A75/B63/C45 (B 더 넓게)");
distribute({ S: 83, A: 73, B: 62, C: 45 }, "옵션3: S83/A73/B62/C45 (B>C 만들기)");
distribute({ S: 82, A: 72, B: 60, C: 45 }, "옵션4: S82/A72/B60/C45 (가장 후하게)");
