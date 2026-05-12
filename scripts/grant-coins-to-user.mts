/**
 * 특정 user_id에 알 충전. 인자: user_id amount
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

if (!USER_ID || !AMOUNT) {
  console.log("usage: npx tsx scripts/grant-coins-to-user.mts <user_id> <amount>");
  process.exit(1);
}

const { data: user } = await sb.from("users").select("id, name, kakao_id").eq("id", USER_ID).single();
if (!user) {
  console.log("user not found");
  process.exit(1);
}
console.log(`대상: ${user.name ?? "(이름 없음)"} (kakao_id=${user.kakao_id})`);

const { data: prof } = await sb.from("profiles").select("coin_balance").eq("user_id", USER_ID).single();
const before = prof?.coin_balance ?? 0;
console.log(`현재 잔고: ${before}알`);

const newBalance = before + AMOUNT;
const { error: updErr } = await sb
  .from("profiles")
  .upsert({ user_id: USER_ID, coin_balance: newBalance }, { onConflict: "user_id" });
if (updErr) {
  console.log("profile update 실패:", updErr);
  process.exit(1);
}

const { error: txErr } = await sb.from("coin_transactions").insert({
  user_id: USER_ID,
  type: "bonus",
  amount: AMOUNT,
  balance_after: newBalance,
  reason: "operator manual grant",
});
if (txErr) console.warn("transaction log 실패 (잔고는 갱신됨):", txErr);

console.log(`\n✓ 충전 완료. ${before} → ${newBalance}알 (+${AMOUNT})`);
