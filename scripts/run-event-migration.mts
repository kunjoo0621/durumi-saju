import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const sql = readFileSync("supabase/migrations/20260424_event_signup_bonus_and_hardening.sql", "utf-8");
  // Supabase client는 DDL 여러 개를 직접 실행 못 하므로 exec_sql RPC가 필요.
  // 없으면 수동 분할 실행.
  const { error } = await sb.rpc("exec_sql", { sql_text: sql });
  if (error) {
    console.error("exec_sql RPC 실패:", error.message);
    console.error("→ Supabase 대시보드 SQL Editor에서 직접 실행하세요:");
    console.error("  파일: supabase/migrations/20260424_event_signup_bonus_and_hardening.sql");
    process.exit(1);
  }
  console.log("✅ 마이그레이션 적용 완료");
}

main();
