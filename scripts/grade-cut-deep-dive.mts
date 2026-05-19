/**
 * 등급 컷 조정 deep-dive
 *
 * 1. 14일·30일·전체 누적 raw 분포 비교
 * 2. C 컷 변경 시뮬 (D 비중 조정)
 * 3. 점수대별 unique 사용자 (재분석 제외)
 *
 * tsx scripts/grade-cut-deep-dive.mts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL!, envVars.SUPABASE_SERVICE_ROLE_KEY!);

const NOW = Date.now();
const D14 = new Date(NOW - 14 * 24 * 3600_000).toISOString();
const D30 = new Date(NOW - 30 * 24 * 3600_000).toISOString();

async function fetchComposites(sinceIso: string | null, uniqueOnly: boolean): Promise<number[]> {
  let q = sb.from("saju_results")
    .select("user_id, guest_token_hash, full_json, created_at")
    .not("full_json", "is", null)
    .order("created_at", { ascending: true });
  if (sinceIso) q = q.gte("created_at", sinceIso);
  const { data } = await q;
  const valid = (data ?? []).filter((r: any) => !r.full_json?._error && typeof r.full_json?.tier?.composite === "number");
  if (!uniqueOnly) return valid.map((r: any) => r.full_json.tier.composite);
  const seen = new Set<string>();
  const out: number[] = [];
  for (const r of valid) {
    const key = r.user_id || r.guest_token_hash || r.created_at;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r.full_json.tier.composite);
  }
  return out;
}

function classify(c: number, cuts: { S: number; A: number; B: number; C: number }) {
  if (c >= cuts.S) return "S";
  if (c >= cuts.A) return "A";
  if (c >= cuts.B) return "B";
  if (c >= cuts.C) return "C";
  return "D";
}

function distribute(composites: number[], cuts: { S: number; A: number; B: number; C: number }, label: string) {
  const dist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const c of composites) dist[classify(c, cuts)]++;
  const N = composites.length;
  console.log(`\n${label} (S≥${cuts.S} A≥${cuts.A} B≥${cuts.B} C≥${cuts.C}):`);
  for (const g of ["S", "A", "B", "C", "D"]) {
    const n = dist[g];
    const pct = ((n / N) * 100).toFixed(1);
    const bar = "█".repeat(Math.round(parseFloat(pct) / 2));
    console.log(`  ${g}  ${String(n).padStart(3)}건  ${pct.padStart(5)}%  ${bar}`);
  }
}

const c14 = await fetchComposites(D14, false);
const c14u = await fetchComposites(D14, true);
const c30 = await fetchComposites(D30, false);
const c30u = await fetchComposites(D30, true);
const cAll = await fetchComposites(null, false);
const cAllU = await fetchComposites(null, true);

console.log(`\n════════════════════════════════════════════════════════`);
console.log(`표본 크기 (raw / unique)`);
console.log(`════════════════════════════════════════════════════════`);
console.log(`  14일:  raw ${c14.length} / unique ${c14u.length}`);
console.log(`  30일:  raw ${c30.length} / unique ${c30u.length}`);
console.log(`  전체:  raw ${cAll.length} / unique ${cAllU.length}`);

const CURRENT = { S: 86, A: 80, B: 69, C: 45 };

console.log(`\n════════════════════════════════════════════════════════`);
console.log(`현재 v16 컷 — 기간별 비교`);
console.log(`════════════════════════════════════════════════════════`);
distribute(c14u, CURRENT, "14일 unique");
distribute(c30u, CURRENT, "30일 unique");
distribute(cAllU, CURRENT, "전체 unique");

console.log(`\n════════════════════════════════════════════════════════`);
console.log(`C 컷 조정 시뮬 — 전체 unique 기준 (D 비중 변화)`);
console.log(`════════════════════════════════════════════════════════`);
distribute(cAllU, { S: 86, A: 80, B: 69, C: 45 }, "현재 (D~4%)");
distribute(cAllU, { S: 86, A: 80, B: 69, C: 48 }, "C 48 (D 약간↑)");
distribute(cAllU, { S: 86, A: 80, B: 69, C: 50 }, "C 50 (D ~7%)");
distribute(cAllU, { S: 86, A: 80, B: 69, C: 53 }, "C 53 (D ~10%)");
distribute(cAllU, { S: 86, A: 80, B: 69, C: 55 }, "C 55 (D ~12%)");

console.log(`\n════════════════════════════════════════════════════════`);
console.log(`종합 컷 조정 — D 늘리면서 C 자연스럽게 균형`);
console.log(`════════════════════════════════════════════════════════`);
distribute(cAllU, { S: 86, A: 80, B: 69, C: 50 }, "옵션 A: C 50 (D 7%, S/A 그대로)");
distribute(cAllU, { S: 85, A: 78, B: 67, C: 50 }, "옵션 B: B 컷도 살짝 (B 더 넓게)");
distribute(cAllU, { S: 85, A: 78, B: 66, C: 52 }, "옵션 C: D 8~9% 목표");

// 점수 구간별 분포 (전체 unique)
console.log(`\n════════════════════════════════════════════════════════`);
console.log(`전체 unique 점수 히스토그램 (5점 단위)`);
console.log(`════════════════════════════════════════════════════════`);
const buckets = new Map<number, number>();
for (const c of cAllU) {
  const b = Math.floor(c / 5) * 5;
  buckets.set(b, (buckets.get(b) ?? 0) + 1);
}
const maxB = Math.max(...buckets.values());
for (let b = 30; b <= 95; b += 5) {
  const n = buckets.get(b) ?? 0;
  const bar = "█".repeat(Math.round((n / maxB) * 40));
  console.log(`  ${String(b).padStart(2)}~${b + 4}  ${String(n).padStart(3)}건  ${bar}`);
}

// 백분위
console.log(`\n백분위 (전체 unique ${cAllU.length}건):`);
const sorted = [...cAllU].sort((a, b) => a - b);
for (const p of [5, 10, 25, 50, 75, 90, 95]) {
  const idx = Math.min(Math.floor(((p / 100) * sorted.length)), sorted.length - 1);
  console.log(`  ${String(p).padStart(2)}%:  ${sorted[idx]}점`);
}
