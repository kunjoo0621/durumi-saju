/**
 * production DB의 gender 컬럼 분포 점검.
 *
 * 목적: normalizeGender 변경(female fallback → male fallback)이 기존 데이터에 영향 있는지 확인.
 * - saju_results: 개인 사주 결과 (단일 gender)
 * - saju_battles: 배틀 결과 (player_a / player_b 두 명)
 * - prepayment_sessions.payload.gender: 결제 진입 단계 (잠재적 비표준 값 흔적)
 *
 * 사용:
 *   NODE_OPTIONS="--conditions=import" npx tsx scripts/check-gender-distribution.mts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(import.meta.dirname!, "../.env.local");
const envText = readFileSync(envPath, "utf-8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const key = m[1].trim();
  const value = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("✗ Supabase env 없음");
  process.exit(1);
}
const supa = createClient(url, key);

// 정통 입력 정의
const MALE_TOKENS = new Set(["남", "남자", "남성", "male", "m", "남아", "사내"]);
const FEMALE_TOKENS = new Set(["여", "여자", "여성", "female", "f", "여아", "girl"]);

function classify(raw: string | null | undefined): "male" | "female" | "unknown_empty" | "unknown_other" {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "unknown_empty";
  if (MALE_TOKENS.has(v)) return "male";
  if (FEMALE_TOKENS.has(v)) return "female";
  return "unknown_other";
}

// 이전 normalizeGender 결과 (변경 전 코드 그대로)
function oldNormalize(raw: string | null | undefined): "male" | "female" {
  if (raw === "남" || raw === "남성" || raw === "male") return "male";
  return "female";
}

interface Row {
  table: string;
  raw: string | null;
  oldResult: "male" | "female";
  classified: ReturnType<typeof classify>;
}

async function main() {
  const allRows: Row[] = [];

  // 1) saju_results.gender
  console.log("\n[saju_results.gender 조회]");
  const sr = await supa.from("saju_results").select("gender");
  if (sr.error) {
    console.error("  ✗ 조회 실패:", sr.error.message);
  } else {
    console.log(`  총 ${sr.data?.length ?? 0}건`);
    for (const row of sr.data ?? []) {
      allRows.push({
        table: "saju_results",
        raw: row.gender,
        oldResult: oldNormalize(row.gender),
        classified: classify(row.gender),
      });
    }
  }

  // 2) saju_battles.player_a / player_b — full_result 안에 gender 있을 듯. 단순화: 통합 jsonb 안 보지 말고 직접 컬럼 있는지 확인
  // saju_battles는 player_a_name / player_b_name만 컬럼이고 gender는 full_result jsonb 안에 묻혀 있을 수 있음. 일단 jsonb 안 안 봄.

  // 3) prepayment_sessions.payload.gender
  console.log("\n[prepayment_sessions.payload.gender 조회]");
  const ps = await supa
    .from("prepayment_sessions")
    .select("payload")
    .limit(50_000);
  if (ps.error) {
    console.error("  ✗ 조회 실패:", ps.error.message);
  } else {
    console.log(`  총 ${ps.data?.length ?? 0}건`);
    for (const row of ps.data ?? []) {
      const payload = row.payload as any;
      const g = payload?.gender ?? null;
      allRows.push({
        table: "prepayment_sessions",
        raw: g,
        oldResult: oldNormalize(g),
        classified: classify(g),
      });
    }
  }

  // 집계
  console.log("\n\n========== 집계 ==========");
  const byTable: Record<string, Map<string, number>> = {};
  for (const r of allRows) {
    if (!byTable[r.table]) byTable[r.table] = new Map();
    const key = r.raw ?? "(null)";
    byTable[r.table].set(key, (byTable[r.table].get(key) ?? 0) + 1);
  }
  for (const [table, distrib] of Object.entries(byTable)) {
    console.log(`\n[${table}] distinct values:`);
    const entries = [...distrib.entries()].sort((a, b) => b[1] - a[1]);
    for (const [val, count] of entries) {
      const cls = classify(val === "(null)" ? null : val);
      const old = oldNormalize(val === "(null)" ? null : val);
      console.log(`  ${count.toString().padStart(5)}건  "${val}"  →  분류: ${cls}  /  이전 normalize: ${old}`);
    }
  }

  // 영향 평가 — 변경 전후 결과가 달라지는 케이스
  console.log("\n\n========== 변경 영향 평가 ==========");
  let affected = 0;
  const impacted: Map<string, { count: number; raw: string }> = new Map();
  for (const r of allRows) {
    // 이전: female fallback / 신규: classify가 male/female 명확하면 일치, unknown은 male로
    let newResult: "male" | "female";
    if (r.classified === "male") newResult = "male";
    else if (r.classified === "female") newResult = "female";
    else newResult = "male"; // 신규 디폴트
    if (newResult !== r.oldResult) {
      affected += 1;
      const key = r.raw ?? "(null)";
      const entry = impacted.get(key);
      if (entry) entry.count += 1;
      else impacted.set(key, { count: 1, raw: key });
    }
  }
  console.log(`총 ${affected}건 결과 달라짐 (이전 → 신규)`);
  if (impacted.size > 0) {
    for (const [key, e] of [...impacted.entries()].sort((a, b) => b[1].count - a[1].count)) {
      console.log(`  ${e.count}건  "${key}"  →  ${oldNormalize(key === "(null)" ? null : key)} → male`);
    }
  } else {
    console.log("  ✓ 영향 없음 — 모든 기존 데이터가 변경 전후 동일 결과");
  }
}

main().catch((err) => {
  console.error("✗ 실패:", err?.stack || err);
  process.exit(1);
});
