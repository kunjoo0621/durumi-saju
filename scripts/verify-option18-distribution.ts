/**
 * 옵션 18 컷 + 라벨 격상 통합 검증
 *
 * 1. 새 컷 (S85/A80/B70/C52) 적용 시 production raw 분포
 * 2. 운영자 본인·신문교·김채현 등급 변화 확인
 * 3. percentileRankFromComposite 값 검증
 */
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  if (!process.env[key]) process.env[key] = val;
}

import { register } from "tsconfig-paths";
import * as tsconfig from "../tsconfig.json";
register({ baseUrl: path.resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths as Record<string, string[]> });

import { createClient } from "@supabase/supabase-js";
import { COMPOSITE_GRADE_CUTOFFS, gradeFromComposite, percentileRankFromComposite, displayGrade } from "@/lib/gradeSystem";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log(`현재 컷: S${COMPOSITE_GRADE_CUTOFFS.S} / A${COMPOSITE_GRADE_CUTOFFS.A} / B${COMPOSITE_GRADE_CUTOFFS.B} / C${COMPOSITE_GRADE_CUTOFFS.C}\n`);

  // 전체 unique — 가장 최근 분석 기준 (산식 변경 영향 정확히 측정)
  const { data } = await sb
    .from("saju_results")
    .select("user_id, guest_token_hash, full_json, name, birth_date, created_at")
    .not("full_json", "is", null)
    .order("created_at", { ascending: false });

  const valid = (data ?? []).filter((r: any) => !r.full_json?._error && typeof r.full_json?.tier?.composite === "number");
  const seen = new Set<string>();
  const uniqueRows: any[] = [];
  for (const r of valid) {
    const key = r.user_id || r.guest_token_hash || r.created_at;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(r);
  }

  // 새 컷 적용
  const dist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  const distDisplay: Record<string, number> = { SS: 0, S: 0, A: 0, B: 0, C: 0 };
  for (const r of uniqueRows) {
    const composite = r.full_json.tier.composite;
    const newGrade = gradeFromComposite(composite);
    dist[newGrade]++;
    distDisplay[displayGrade(newGrade)]++;
  }

  const N = uniqueRows.length;
  console.log(`표본: ${N}명 unique\n`);
  console.log(`옵션 18 컷 적용 (DB 저장 라벨):`);
  for (const g of ["S", "A", "B", "C", "D"]) {
    const n = dist[g];
    const pct = ((n / N) * 100).toFixed(1);
    console.log(`  ${g}  ${String(n).padStart(3)}명  ${pct.padStart(5)}%`);
  }

  console.log(`\n라벨 격상 후 (화면 표시 라벨):`);
  for (const g of ["SS", "S", "A", "B", "C"]) {
    const n = distDisplay[g];
    const pct = ((n / N) * 100).toFixed(1);
    const bar = "█".repeat(Math.round(parseFloat(pct) / 2));
    console.log(`  ${g.padEnd(3)}  ${String(n).padStart(3)}명  ${pct.padStart(5)}%  ${bar}`);
  }

  // 주요 사용자 검증
  console.log(`\n\n주요 사용자 등급 변화 (옛 → 옵션 18):`);
  console.log(`${"이름".padEnd(10)} ${"생일".padEnd(12)} ${"점수".padStart(5)}  ${"옛 등급".padEnd(8)} → ${"새 등급".padEnd(8)} (화면 표시)`);
  console.log("─".repeat(80));

  const targets = ["신건주", "신문교", "김채현", "양미선", "양미현"];
  for (const name of targets) {
    // 이름 매칭 후 가장 최근 1건만 (uniqueRows는 이미 created_at desc 정렬)
    const matches = uniqueRows.filter((r) => r.name === name);
    for (const r of matches.slice(0, 1)) {
      const composite = r.full_json.tier.composite;
      const oldGrade = r.full_json.tier.grade;
      const newGrade = gradeFromComposite(composite);
      const displayed = displayGrade(newGrade);
      const arrow = oldGrade === newGrade ? " 그대로" : ` 변동!`;
      console.log(
        `${(r.name || "").padEnd(10)} ${r.birth_date?.padEnd(12) || "?".padEnd(12)} ${String(composite).padStart(5)}  ${oldGrade.padEnd(8)} → ${newGrade.padEnd(8)} (${displayed})${arrow}`
      );
    }
  }

  // 등급 변동 사용자 수
  console.log(`\n\n등급 변동 사용자 (옵션 18 컷 적용 시):`);
  const changeCount: Record<string, number> = {};
  for (const r of uniqueRows) {
    const oldG = r.full_json.tier.grade;
    const newG = gradeFromComposite(r.full_json.tier.composite);
    if (oldG !== newG) {
      const key = `${oldG} → ${newG}`;
      changeCount[key] = (changeCount[key] || 0) + 1;
    }
  }
  let totalChanged = 0;
  for (const [k, v] of Object.entries(changeCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}명`);
    totalChanged += v;
  }
  console.log(`  ─────`);
  console.log(`  총 ${totalChanged}명 변동 (${((totalChanged / N) * 100).toFixed(1)}%)`);

  // percentile 검증
  console.log(`\n\npercentileRank·topPercent 샘플 검증:`);
  const samples = [40, 52, 60, 70, 80, 85, 90, 95];
  console.log(`${"점수".padStart(4)}  ${"등급".padEnd(4)}  ${"백분위".padStart(6)}  ${"상위%".padStart(5)}`);
  for (const c of samples) {
    const g = gradeFromComposite(c);
    const p = percentileRankFromComposite(c);
    const top = 100 - p;
    console.log(`${String(c).padStart(4)}  ${g.padEnd(4)}  ${String(p).padStart(6)}  ${String(top).padStart(5)}%`);
  }
}

main().catch(e => { console.error("❌", e); process.exit(1); });
