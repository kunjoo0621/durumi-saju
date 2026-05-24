/**
 * 특정 user_id에 알 충전/차감.
 *   usage: npx tsx scripts/grant-coins-to-user.mts <user_id> <amount> [reason]
 *   - amount 양수: 충전 (bonus 기록)
 *   - amount 음수: 차감 (spend 기록)
 *
 * profiles 잔액 변경 + coin_transactions ledger 기록을 한 RPC 호출로 묶어
 * atomic 보장 (operator_grant_coins). 기존 분리 호출 방식은 INSERT 실패 시
 * 잔액만 변경되는 사고가 발생했음 — 그 패턴 영구 차단.
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

const USER_ID = process.argv[2];
const AMOUNT = parseInt(process.argv[3] ?? "0", 10);
const REASON = process.argv[4] ?? "manual_grant";

if (!USER_ID || !AMOUNT) {
  console.log("usage: npx tsx scripts/grant-coins-to-user.mts <user_id> <amount> [reason]");
  process.exit(1);
}

const { data: user } = await sb.from("users").select("id, name, kakao_id").eq("id", USER_ID).single();
if (!user) {
  console.log("user not found");
  process.exit(1);
}
console.log(`대상: ${user.name ?? "(이름 없음)"} (kakao_id=${user.kakao_id})`);

const { data: before } = await sb.from("profiles").select("coin_balance").eq("user_id", USER_ID).maybeSingle();
console.log(`현재 잔고: ${before?.coin_balance ?? 0}알`);

const { data, error } = await sb.rpc("operator_grant_coins", {
  p_user_id: USER_ID,
  p_amount: AMOUNT,
  p_reason: REASON,
});

if (error) {
  console.error("❌ 처리 실패:", error.message);
  process.exit(1);
}

const newBalance = Array.isArray(data) ? data[0]?.new_balance : (data as any)?.new_balance;
const delta = AMOUNT > 0 ? `+${AMOUNT}` : `${AMOUNT}`;
console.log(`\n✓ 처리 완료. ${before?.coin_balance ?? 0} → ${newBalance}알 (${delta}, reason=${REASON})`);
