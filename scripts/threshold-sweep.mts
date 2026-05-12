import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const CATS = ["재물운", "연애운", "직장운", "건강운", "대인운"];
const W: Record<string, number> = { 압승: 3, 승리: 2, 신승: 1, 무승부: 0 };

function catInt(d: number): string {
  const a = Math.abs(d);
  if (a >= 15) return "압승";
  if (a >= 8) return "승리";
  if (a >= 1) return "신승";
  return "무승부";
}

const { data: rows } = await sb.from("saju_battles").select("full_result").limit(200);
const diffs: number[] = [];
for (const r of (rows ?? []) as any[]) {
  const sA = r.full_result?.playerA?.scores;
  const sB = r.full_result?.playerB?.scores;
  if (!sA || !sB) continue;
  let pA = 0, pB = 0;
  for (const c of CATS) {
    const d = sA[c] - sB[c];
    const w = W[catInt(d)];
    if (d > 0) pA += w;
    else if (d < 0) pB += w;
  }
  diffs.push(Math.abs(pA - pB));
}

console.log(`가중 승점 차이 분포 (${diffs.length}건):`);
const histo: Record<number, number> = {};
for (const d of diffs) histo[d] = (histo[d] ?? 0) + 1;
for (let k = 0; k <= 12; k++) {
  if (histo[k]) console.log(`  차이 ${k}: ${histo[k]}건`);
}
console.log();

console.log("임계값별 강도 분포 시뮬:");
for (const [t1, t2] of [[5,3],[6,3],[7,3],[7,4],[8,4]]) {
  let upset = 0, win = 0, nar = 0, draw = 0;
  for (const d of diffs) {
    if (d >= t1) upset++;
    else if (d >= t2) win++;
    else if (d >= 1) nar++;
    else draw++;
  }
  const pct = (n: number) => (n/diffs.length*100).toFixed(1);
  console.log(`  압승${t1}+ / 승리${t2}+:  압승 ${upset}(${pct(upset)}%) | 승리 ${win}(${pct(win)}%) | 신승 ${nar}(${pct(nar)}%) | 무승부 ${draw}`);
}
