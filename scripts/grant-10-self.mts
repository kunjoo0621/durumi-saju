/**
 * 운영자 신건주 본인 계정에 10알 충전 (sanity check).
 * profiles + coin_transactions 를 atomic 으로 묶는 operator_grant_coins RPC 사용.
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

const userId = "f39ccecb-fc39-4ef9-a262-d8ab2b85c317"; // 운영자 신건주
const AMOUNT = 10;

const { data: profile } = await sb
  .from("profiles")
  .select("coin_balance")
  .eq("user_id", userId)
  .maybeSingle();

const oldBalance = profile?.coin_balance ?? 0;
console.log(`현재 잔고: ${oldBalance}알 → 충전 시도: +${AMOUNT}알`);

const { data, error } = await sb.rpc("operator_grant_coins", {
  p_user_id: userId,
  p_amount: AMOUNT,
  p_reason: "self_sanity_check",
});

if (error) {
  console.error("❌ 처리 실패:", error.message);
  process.exit(1);
}

const newBalance = Array.isArray(data) ? data[0]?.new_balance : (data as any)?.new_balance;
console.log(`✅ 최종 잔고: ${newBalance}알`);
