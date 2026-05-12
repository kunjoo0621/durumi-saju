/**
 * 카테고리별 평균/분포 비교 — 건강운이 정말 다른 카테고리보다 엄격한지 검증
 */
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
  .select("full_json")
  .not("full_json", "is", null)
  .limit(5000);

const cats = ["재물운", "연애운", "직장운", "건강운", "대인운"];
const stats: Record<string, number[]> = {};
for (const c of cats) stats[c] = [];

for (const r of rows ?? []) {
  const scores = (r as any).full_json?.scores ?? {};
  for (const c of cats) {
    if (typeof scores[c] === "number") stats[c].push(scores[c]);
  }
}

console.log(`전체: ${rows?.length ?? 0}건\n`);
console.log("카테고리       평균   중앙   min   max   ≤39   ≤44   ≤50   80+");
for (const c of cats) {
  const arr = stats[c].slice().sort((a, b) => a - b);
  if (!arr.length) continue;
  const avg = (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
  const med = arr[Math.floor(arr.length / 2)];
  const min = arr[0];
  const max = arr[arr.length - 1];
  const u39 = arr.filter((v) => v <= 39).length;
  const u44 = arr.filter((v) => v <= 44).length;
  const u50 = arr.filter((v) => v <= 50).length;
  const o80 = arr.filter((v) => v >= 80).length;
  console.log(`${c}  ${avg}  ${med}  ${String(min).padStart(3)}  ${String(max).padStart(3)}  ${String(u39).padStart(3)}  ${String(u44).padStart(3)}  ${String(u50).padStart(3)}  ${String(o80).padStart(3)}`);
}

// 건강운 극저점 사용자 (≤39) 발생 비율
console.log(`\n건강운 ≤39 사용자: ${stats["건강운"].filter((v) => v <= 39).length} / ${stats["건강운"].length} (${(stats["건강운"].filter((v) => v <= 39).length / stats["건강운"].length * 100).toFixed(1)}%)`);
console.log(`건강운 ≤44 사용자: ${stats["건강운"].filter((v) => v <= 44).length} / ${stats["건강운"].length} (${(stats["건강운"].filter((v) => v <= 44).length / stats["건강운"].length * 100).toFixed(1)}%)`);
