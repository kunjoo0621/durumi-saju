/**
 * 신건주(운영자) 본인 계정에 알 10개 테스트용 충전.
 * - profiles.coin_balance += 10
 * - coin_transactions에 bonus 기록 추가 (멱등 X, 매 실행 마다 추가)
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

const KAKAO_ID = "4722556140";

// 1) users 테이블에서 신건주 user_id 조회
const { data: user, error: userErr } = await sb
  .from("users")
  .select("id, name, kakao_id")
  .eq("kakao_id", KAKAO_ID)
  .single();

if (userErr || !user) {
  console.log("사용자 조회 실패:", userErr);
  process.exit(1);
}
console.log(`대상 사용자: ${user.name} (id=${user.id}, kakao_id=${KAKAO_ID})`);

// 2) 현재 coin_balance 조회
const { data: prof } = await sb.from("profiles").select("coin_balance").eq("user_id", user.id).single();
console.log(`현재 잔고: ${prof?.coin_balance ?? "없음"}알`);

// 3) profiles.coin_balance += 30
const newBalance = (prof?.coin_balance ?? 0) + 30;
const { error: updErr } = await sb
  .from("profiles")
  .upsert({ user_id: user.id, coin_balance: newBalance }, { onConflict: "user_id" });
if (updErr) { console.log("upsert 실패:", updErr); process.exit(1); }

// 4) coin_transactions에 bonus 기록
const { error: txErr } = await sb.from("coin_transactions").insert({
  user_id: user.id,
  type: "bonus",
  amount: 30,
  balance_after: newBalance,
  reference_id: "operator_test_v1.4_battle",
});
if (txErr) { console.log("transaction 기록 실패:", txErr); process.exit(1); }

console.log(`\n✓ 충전 완료. 새 잔고: ${newBalance}알`);
