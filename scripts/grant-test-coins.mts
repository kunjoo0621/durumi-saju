/**
 * 신건주(운영자) 본인 계정에 알 30개 테스트용 충전.
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

const KAKAO_ID = "4722556140";
const AMOUNT = 30;

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

const { data: prof } = await sb.from("profiles").select("coin_balance").eq("user_id", user.id).maybeSingle();
console.log(`현재 잔고: ${prof?.coin_balance ?? 0}알`);

const { data, error } = await sb.rpc("operator_grant_coins", {
  p_user_id: user.id,
  p_amount: AMOUNT,
  p_reason: "test_v1.4_battle",
});

if (error) {
  console.log("처리 실패:", error.message);
  process.exit(1);
}

const newBalance = Array.isArray(data) ? data[0]?.new_balance : (data as any)?.new_balance;
console.log(`\n✓ 충전 완료. 새 잔고: ${newBalance}알`);
