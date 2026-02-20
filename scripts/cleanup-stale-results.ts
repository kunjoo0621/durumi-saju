/**
 * 구버전 스코어링 결과 정리 스크립트
 * scoringVersion이 없거나 SCORING_VERSION(2) 미만인 결과를 삭제
 *
 * 사용법:
 *   npx tsx scripts/cleanup-stale-results.ts          # dry-run (카운트만)
 *   npx tsx scripts/cleanup-stale-results.ts --delete  # 실제 삭제
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// .env.local 수동 파싱 (dotenv 미설치 대응)
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const CURRENT_SCORING_VERSION = 2;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function main() {
  const dryRun = !process.argv.includes("--delete");

  // 1. 전체 saju_results에서 구버전 찾기
  const { data: allResults, error: fetchErr } = await supabase
    .from("saju_results")
    .select("id, name, full_json, created_at")
    .order("created_at", { ascending: false });

  if (fetchErr) {
    console.error("saju_results 조회 실패:", fetchErr.message);
    process.exit(1);
  }

  const staleResults = (allResults || []).filter((r) => {
    const ver = (r.full_json as any)?.scoringVersion;
    return ver == null || ver < CURRENT_SCORING_VERSION;
  });

  const freshResults = (allResults || []).filter((r) => {
    const ver = (r.full_json as any)?.scoringVersion;
    return ver != null && ver >= CURRENT_SCORING_VERSION;
  });

  console.log(`\n=== 구버전 결과 정리 ===`);
  console.log(`전체 saju_results: ${allResults?.length ?? 0}건`);
  console.log(`구버전 (삭제 대상): ${staleResults.length}건`);
  console.log(`현재 버전 (유지): ${freshResults.length}건`);

  if (staleResults.length > 0) {
    console.log(`\n삭제 대상 목록:`);
    for (const r of staleResults) {
      const ver = (r.full_json as any)?.scoringVersion ?? "없음";
      const grade = (r.full_json as any)?.tier?.grade ?? "?";
      console.log(`  - id=${r.id}  name=${r.name}  grade=${grade}  scoringVersion=${ver}  created=${r.created_at}`);
    }
  }

  // 2. 관련 result_unlocks 카운트
  const staleIds = staleResults.map((r) => r.id);
  if (staleIds.length > 0) {
    const { count: unlockCount } = await supabase
      .from("result_unlocks")
      .select("id", { count: "exact", head: true })
      .in("result_id", staleIds);

    console.log(`관련 result_unlocks: ${unlockCount ?? 0}건`);
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] 삭제하려면: npx tsx scripts/cleanup-stale-results.ts --delete`);
    return;
  }

  // 3. 삭제 실행
  if (staleIds.length === 0) {
    console.log("\n삭제할 항목 없음.");
    return;
  }

  console.log(`\n삭제 시작...`);

  // result_unlocks 먼저 삭제 (FK)
  const { error: unlockDelErr, count: unlockDeleted } = await supabase
    .from("result_unlocks")
    .delete({ count: "exact" })
    .in("result_id", staleIds);

  if (unlockDelErr) {
    console.error("result_unlocks 삭제 실패:", unlockDelErr.message);
    process.exit(1);
  }
  console.log(`result_unlocks 삭제: ${unlockDeleted}건`);

  // saju_results 삭제
  const { error: resultDelErr, count: resultDeleted } = await supabase
    .from("saju_results")
    .delete({ count: "exact" })
    .in("id", staleIds);

  if (resultDelErr) {
    console.error("saju_results 삭제 실패:", resultDelErr.message);
    process.exit(1);
  }
  console.log(`saju_results 삭제: ${resultDeleted}건`);

  console.log(`\n완료.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
