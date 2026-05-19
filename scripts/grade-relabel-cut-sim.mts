/**
 * 라벨 격상 (SS/S/A/B/C) + 컷 조정 동시 시뮬
 *
 * 사용자 의도:
 * - 새 B(=옛 C) 47% → 30~40%로 줄이고 싶음
 * - 새 SS/S/A(=옛 S/A/B) → 살짝 늘리고 싶음
 * - 새 C(=옛 D) → 살짝 줄이고 싶음 (4% → 2~3%)
 *
 * 옛 컷의 S/A/B 낮추면 → 새 SS/S/A 늘어남
 * 옛 컷의 C 낮추면 → 새 C(=옛 D) 줄어듦
 *
 * tsx scripts/grade-relabel-cut-sim.mts
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

const { data } = await sb
  .from("saju_results")
  .select("user_id, guest_token_hash, full_json, created_at")
  .not("full_json", "is", null)
  .order("created_at", { ascending: true });

const valid = (data ?? []).filter((r: any) => !r.full_json?._error && typeof r.full_json?.tier?.composite === "number");
const seen = new Set<string>();
const composites: number[] = [];
for (const r of valid) {
  const key = (r as any).user_id || (r as any).guest_token_hash || (r as any).created_at;
  if (seen.has(key)) continue;
  seen.add(key);
  composites.push((r as any).full_json.tier.composite);
}

const N = composites.length;
console.log(`\n전체 unique 표본: ${N}명\n`);

// 옛 → 새 라벨 매핑
const RELABEL = { S: "SS", A: "S", B: "A", C: "B", D: "C" } as const;

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
  const pct = (g: string) => ((dist[g] / N) * 100).toFixed(1);
  console.log(`\n━━━ ${label} ━━━`);
  console.log(`컷 (옛 라벨): S≥${cuts.S}  A≥${cuts.A}  B≥${cuts.B}  C≥${cuts.C}`);
  console.log("");
  console.log(`옛라벨   새라벨   건수     비중      bar`);
  console.log(`─────────────────────────────────────────────`);
  for (const g of ["S", "A", "B", "C", "D"] as const) {
    const newLabel = RELABEL[g];
    const n = dist[g];
    const p = parseFloat(pct(g));
    const bar = "█".repeat(Math.round(p / 2));
    console.log(`  ${g.padEnd(4)}  →  ${newLabel.padEnd(4)}  ${String(n).padStart(3)}건   ${pct(g).padStart(5)}%   ${bar}`);
  }
}

// 현재 (라벨 격상만 적용)
distribute({ S: 86, A: 80, B: 69, C: 45 }, "현재 v16 (컷 변경 0, 라벨 격상만)");

// 사용자 의도 시뮬 — B(=옛 C) 줄이는 방향
console.log(`\n\n════════════════════════════════════════════════════════`);
console.log(`사용자 의도 시뮬 — 새 B 줄이기, 새 SS/S/A 살짝 늘리기`);
console.log(`════════════════════════════════════════════════════════`);

distribute({ S: 85, A: 78, B: 66, C: 45 }, "옵션 1 (보수안) — 옛 S/A/B 컷 각 1~3↓, 옛 C 그대로");
distribute({ S: 84, A: 76, B: 64, C: 45 }, "옵션 2 (균형안) — 옛 S/A/B 컷 각 2~5↓, 옛 C 그대로");
distribute({ S: 83, A: 74, B: 62, C: 45 }, "옵션 3 (적극안) — 옛 S/A/B 컷 각 3~7↓, 옛 C 그대로");

console.log(`\n\n════════════════════════════════════════════════════════`);
console.log(`옛 C 컷도 살짝 낮춤 — 새 C(=옛 D) 줄이는 방향`);
console.log(`════════════════════════════════════════════════════════`);

distribute({ S: 84, A: 76, B: 64, C: 42 }, "옵션 2-A — 균형안 + C 42 (새 C 4→2.6%)");
distribute({ S: 84, A: 76, B: 64, C: 40 }, "옵션 2-B — 균형안 + C 40 (새 C 4→1.9%)");
distribute({ S: 83, A: 74, B: 62, C: 42 }, "옵션 3-A — 적극안 + C 42 (새 C 4→2.6%)");

console.log(`\n\n════════════════════════════════════════════════════════`);
console.log(`사용자 정정 — A 줄이고 C 늘리기 (B 컷 올림 + C 컷 올림)`);
console.log(`════════════════════════════════════════════════════════`);

distribute({ S: 84, A: 76, B: 66, C: 48 }, "옵션 4 — A 줄임 (B 컷 66) + C 컷 48");
distribute({ S: 84, A: 76, B: 67, C: 50 }, "옵션 5 — A 더 줄임 (B 컷 67) + C 컷 50");
distribute({ S: 84, A: 76, B: 68, C: 52 }, "옵션 6 — A 많이 줄임 (B 컷 68) + C 컷 52");
distribute({ S: 85, A: 77, B: 67, C: 50 }, "옵션 7 — SS 살짝 줄임 + 위 조합");
distribute({ S: 84, A: 76, B: 67, C: 53 }, "옵션 8 — A 줄임 + C 더 늘림 (C 컷 53)");
distribute({ S: 84, A: 77, B: 68, C: 52 }, "옵션 9 — S도 살짝 줄임 + A 줄임 + C 늘림");

console.log(`\n\n════════════════════════════════════════════════════════`);
console.log(`사용자 추가 정정 — SS 8% / A 더 줄임`);
console.log(`════════════════════════════════════════════════════════`);

distribute({ S: 85, A: 78, B: 68, C: 50 }, "옵션 10 — SS 컷 85 (SS 8% 근처) + A 컷 78 + B 컷 68");
distribute({ S: 85, A: 78, B: 69, C: 50 }, "옵션 11 — 위 + B 컷 69 (A 더 줄임)");
distribute({ S: 85, A: 78, B: 68, C: 52 }, "옵션 12 — 옵션 10 + C 컷 52 (C 더 늘림)");
distribute({ S: 85, A: 78, B: 69, C: 52 }, "옵션 13 — A 더 줄임 + C 더 늘림");
distribute({ S: 86, A: 79, B: 68, C: 50 }, "옵션 14 — SS 컷 86 (SS 6.3%) + A 컷 79");
distribute({ S: 85, A: 79, B: 69, C: 50 }, "옵션 15 — SS 85 + A 79 + B 69");

console.log(`\n\n════════════════════════════════════════════════════════`);
console.log(`사용자 정정 — S도 줄임 (A 컷 올림 방향)`);
console.log(`════════════════════════════════════════════════════════`);

distribute({ S: 85, A: 79, B: 69, C: 52 }, "옵션 16 — 옵션 13에서 A 컷 78→79 (S 살짝 줄임)");
distribute({ S: 85, A: 80, B: 69, C: 52 }, "옵션 17 — A 컷 80 (S 더 줄임)");
distribute({ S: 85, A: 80, B: 70, C: 52 }, "옵션 18 — A 컷 80 + B 컷 70 (A도 살짝 줄임)");
distribute({ S: 86, A: 80, B: 69, C: 52 }, "옵션 19 — SS 컷 86 (SS 6.3%) + 위 조합");
distribute({ S: 85, A: 80, B: 70, C: 50 }, "옵션 20 — 옵션 18 + C 컷 50 (C 살짝 줄임)");

console.log(`\n\n════════════════════════════════════════════════════════`);
console.log(`목표 분포 (재재정정)`);
console.log(`════════════════════════════════════════════════════════`);
console.log(`  SS   7~8%    ███`);
console.log(`  S   13~15%   ███████`);
console.log(`  A   22~26%   ███████████`);
console.log(`  B   38~42%   ██████████████████`);
console.log(`  C    8~10%   ████`);
