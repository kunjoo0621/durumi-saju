/**
 * payment_transactions ↔ saju_results 연결 컬럼 탐색
 * - 결제와 분석을 직접 연결하는 컬럼 찾기 (paid_at / payment_id / result_id 등)
 * - unknown 9명 케이스 확인
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

// 1. payment row 전체 컬럼
const { data: p1 } = await sb.from("payment_transactions").select("*").limit(1);
console.log("=== payment_transactions 컬럼 ===");
console.log(p1?.[0] ? Object.keys(p1[0]).join(", ") : "no row");
console.log("\nsample:");
console.log(JSON.stringify(p1?.[0], null, 2));

// 2. saju_results 전체 컬럼
const { data: r1 } = await sb.from("saju_results").select("*").limit(1);
console.log("\n=== saju_results 컬럼 ===");
console.log(r1?.[0] ? Object.keys(r1[0]).join(", ") : "no row");

// 3. coin/transaction 류 테이블 있나? (이름 추측)
const tableCandidates = ["coin_transactions", "coin_history", "user_coins", "coins", "purchases", "saju_unlocks"];
console.log("\n=== 기타 테이블 존재 확인 ===");
for (const t of tableCandidates) {
  const { data, error } = await sb.from(t).select("*").limit(1);
  if (error) {
    console.log(`  ${t}: ${error.message.slice(0, 60)}`);
  } else {
    console.log(`  ${t}: OK (sample keys: ${Object.keys(data?.[0] ?? {}).join(", ")})`);
  }
}

// 4. 한 사용자에 saju_results 몇 개씩 있는지
const { data: payments } = await sb
  .from("payment_transactions")
  .select("user_id")
  .eq("method", "KAKAOPAY")
  .eq("status", "success");
const userIds = [...new Set((payments ?? []).map((p: any) => p.user_id).filter(Boolean))];

const { data: allR } = await sb
  .from("saju_results")
  .select("user_id, guest_token_hash, name, created_at, full_json")
  .in("user_id", userIds)
  .not("full_json", "is", null);

const countByUser = new Map<string, number>();
for (const r of allR ?? []) countByUser.set(r.user_id, (countByUser.get(r.user_id) ?? 0) + 1);
const multi = [...countByUser.entries()].filter(([_, n]) => n > 1);
console.log(`\n=== 결제자 ${userIds.length}명 중 saju_results 다중 보유 ===`);
console.log(`다중 보유자: ${multi.length}명, 최대 ${Math.max(...countByUser.values(), 0)}건`);
console.log(`상위 5명:`);
for (const [uid, n] of multi.slice(0, 5)) console.log(`  ${uid.slice(0, 8)}... = ${n}건`);

// 5. unknown 9명 — payment 있으나 saju_results 없음
const haveResults = new Set([...countByUser.keys()]);
const noResultUsers = userIds.filter(u => !haveResults.has(u));
console.log(`\n=== payment 있으나 saju_results 없음: ${noResultUsers.length}명 ===`);

// 이들의 guest_token으로 매칭 시도 (users 테이블에 guest_token 컬럼 있는지)
const { data: usersSample } = await sb.from("users").select("*").limit(1);
console.log("users 컬럼:", Object.keys(usersSample?.[0] ?? {}).join(", "));
