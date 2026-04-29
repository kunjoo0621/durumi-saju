import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const TARGET_KAKAO = "4722556140";
const TS = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
const ARCHIVED = `${TARGET_KAKAO}_archived_${TS}`;

async function main() {
  const { data: target } = await sb
    .from("users")
    .select("id, kakao_id, nickname, email, created_at")
    .eq("kakao_id", TARGET_KAKAO)
    .maybeSingle();

  if (!target) {
    console.log(`❌ kakao_id=${TARGET_KAKAO} 없음. 이미 처리되었거나 잘못된 ID`);
    return;
  }

  console.log(`대상: user_id=${target.id}`);
  console.log(`  nickname: ${target.nickname ?? "(null)"}`);
  console.log(`  email:    ${target.email ?? "(null)"}`);
  console.log(`  가입:      ${target.created_at}`);

  // 잔고도 같이 확인
  const { data: profile } = await sb
    .from("profiles")
    .select("coin_balance, signup_bonus_granted_at")
    .eq("user_id", target.id)
    .maybeSingle();
  console.log(`  잔고:      ${profile?.coin_balance ?? 0}알`);
  console.log(`  보너스지급: ${profile?.signup_bonus_granted_at ?? "(없음)"}`);

  const { error } = await sb
    .from("users")
    .update({ kakao_id: ARCHIVED })
    .eq("id", target.id);

  if (error) {
    console.error("❌ UPDATE 실패:", error.message);
    process.exit(1);
  }

  console.log(`\n✅ kakao_id 변경 완료: ${TARGET_KAKAO} → ${ARCHIVED}`);
  console.log(`\n복구 필요 시:`);
  console.log(`  UPDATE users SET kakao_id='${TARGET_KAKAO}' WHERE id='${target.id}';`);
}
main();
