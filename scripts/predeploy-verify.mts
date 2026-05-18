import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

console.log("═══ yearly v1.5 배포 전 검증 ═══\n");

const userId = "f39ccecb-fc39-4ef9-a262-d8ab2b85c317"; // 운영자 신건주

// [A] 본인 모든 coin transactions
const { data: allTx } = await sb
  .from("coin_transactions")
  .select("type, amount, balance_after, reference_id, package_id, created_at")
  .eq("user_id", userId)
  .order("created_at", { ascending: false })
  .limit(50);

console.log(`[A] 본인 coin_transactions ${allTx?.length ?? 0}건 (최근 50건)`);
let balByTx = 0;
const txTypes: Record<string, { count: number; total: number }> = {};
for (const t of (allTx ?? []).slice().reverse()) {
  balByTx += t.amount;
  txTypes[t.type] = txTypes[t.type] || { count: 0, total: 0 };
  txTypes[t.type].count++;
  txTypes[t.type].total += t.amount;
}
console.log("  type별 합계:");
for (const [k, v] of Object.entries(txTypes)) {
  console.log(`    ${k}: ${v.count}건 / ${v.total}알`);
}
console.log(`  거래합산: ${balByTx}알 (시간순 reverse 합산)`);
console.log(`  최근 balance_after: ${allTx?.[0]?.balance_after}`);
console.log(`  ${balByTx === allTx?.[0]?.balance_after ? "✅ 거래합산 == 마지막 balance_after" : "⚠️ 불일치"}`);

// [B] yearly_result_unlocks 6건과 spend transaction 매칭 (timestamp 기준 5초 윈도)
const { data: yUnlocks } = await sb
  .from("yearly_result_unlocks")
  .select("result_id, order_id, input_hash, created_at")
  .eq("user_id", userId)
  .order("created_at", { ascending: false });

const spendTxs = (allTx ?? []).filter((t) => t.type === "spend" && t.amount === -10);
console.log(`\n[B] yearly unlock ${yUnlocks?.length}건 vs 10알 spend ${spendTxs.length}건 timestamp 매칭`);

const matched: Array<{ unlock: string; tx: string; deltaMs: number }> = [];
for (const u of yUnlocks ?? []) {
  const uTime = new Date(u.created_at!).getTime();
  let bestTx: any = null;
  let bestDelta = Infinity;
  for (const t of spendTxs) {
    const tTime = new Date(t.created_at!).getTime();
    const delta = Math.abs(tTime - uTime);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestTx = t;
    }
  }
  if (bestTx && bestDelta < 10_000) {
    matched.push({ unlock: u.order_id!, tx: bestTx.reference_id, deltaMs: bestDelta });
    console.log(`  ✅ unlock=${u.order_id?.slice(0, 24)}... ↔ spend(ref=${bestTx.reference_id?.slice(0, 8)}...) Δ=${bestDelta}ms`);
  } else {
    console.log(`  ❌ unlock=${u.order_id?.slice(0, 24)}... — 매칭 spend 없음 (closest Δ=${bestDelta}ms)`);
  }
}
console.log(`  매칭률: ${matched.length}/${yUnlocks?.length}`);

// [C] yearly_results 6건 상태 정합
const { data: yResults } = await sb
  .from("yearly_results")
  .select("id, full_json, scoringVersion: full_json, target_year, input_hash, created_at")
  .eq("user_id", userId)
  .order("created_at", { ascending: false });

console.log(`\n[C] yearly_results ${yResults?.length}건 상태`);
let okCount = 0;
let errCount = 0;
let pendingCount = 0;
for (const r of yResults ?? []) {
  const fj = r.full_json as any;
  if (fj?._error) errCount++;
  else if (fj?.tier?.grade) okCount++;
  else pendingCount++;
}
console.log(`  완료: ${okCount} / 실패: ${errCount} / pending: ${pendingCount}`);

// [D] 게스트 yearly_results 존재 확인
const { data: guestY } = await sb
  .from("yearly_results")
  .select("id, guest_token_hash, created_at")
  .is("user_id", null)
  .limit(5);
console.log(`\n[D] 게스트 yearly_results: ${guestY?.length ?? 0}건 (비로그인 흐름 사용 흔적)`);

// [E] _error 분포 (전체)
const { data: errAll } = await sb
  .from("yearly_results")
  .select("id, user_id, created_at")
  .filter("full_json->>_error", "eq", "true")
  .limit(10);
console.log(`\n[E] 전체 _error row: ${errAll?.length ?? 0}건 (재시도 hotfix 영향 받는 row)`);
for (const e of errAll ?? []) {
  console.log(`  ${e.id?.slice(0, 8)} user=${e.user_id?.slice(0, 8)} ${e.created_at}`);
}

// [F] yearly_results schema 컬럼
if (yResults?.[0]) {
  console.log(`\n[F] yearly_results 컬럼: ${Object.keys(yResults[0]).join(", ")}`);
}

// [G] middleware의 yearly 차단 분기 — 코드에 남아있는지
import { readFileSync as rf } from "fs";
const mw = rf("middleware.ts", "utf-8");
const blockedYearly = /\/pet|\/api\/pet-compat/.test(mw) && /yearly/.test(mw);
console.log(`\n[G] middleware.ts yearly 분기:`);
console.log(`  pet 봉인 분기 존재: ${/\/pet/.test(mw)} (yearly는 봉인 X)`);
console.log(`  yearly 차단 코드 있는지: ${/redirect.*yearly|yearly.*notFound/.test(mw)}`);

// [H] 분석 모델 / 토큰 사용 빈도 (recent)
const recentY = yResults?.[0];
if (recentY) {
  const fj = recentY.full_json as any;
  console.log(`\n[H] 최근 분석 row (${(recentY as any).id.slice(0, 8)}) — scoringVersion: ${fj?.scoringVersion}, tier: ${fj?.tier?.grade} ${fj?.tier?.composite}, sections: ${fj?.sections?.length}, monthlyFlow: ${fj?.monthlyFlow?.length}, keywords: ${(fj?.yearlyKeywords ?? []).length}, bigEvents: ${(fj?.yearlyBigEvents ?? []).length}`);
}

console.log("\n═══ 검증 완료 ═══");
