/**
 * saju_results 테이블 커버리지 확인 — v16 재계산 대상 범위 검증
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

const { data: all } = await sb.from("saju_results").select("user_id, guest_token_hash, name, birth_date, full_json, created_at").limit(5000);
const total = all?.length ?? 0;
const withFullJson = (all ?? []).filter((r: any) => r.full_json !== null);
const withBirthDate = withFullJson.filter((r: any) => r.birth_date);
const userRows = withFullJson.filter((r: any) => r.user_id);
const guestRows = withFullJson.filter((r: any) => !r.user_id && r.guest_token_hash);
const orphanRows = withFullJson.filter((r: any) => !r.user_id && !r.guest_token_hash);

const uniqueUserIds = new Set(userRows.map((r: any) => r.user_id)).size;

console.log(`saju_results 전체: ${total}건`);
console.log(`  full_json 있는 row: ${withFullJson.length}건`);
console.log(`  birth_date도 있는 row (v16 재계산 대상): ${withBirthDate.length}건`);
console.log();
console.log(`소유자별:`);
console.log(`  가입자 분석 (user_id 있음): ${userRows.length}건 (unique 사용자 ${uniqueUserIds}명)`);
console.log(`  게스트 분석 (guest_token_hash): ${guestRows.length}건`);
console.log(`  고아 row (둘 다 없음): ${orphanRows.length}건`);
console.log();

// 한 사용자가 여러 번 분석한 경우
const userCounts: Record<string, number> = {};
for (const r of userRows) userCounts[(r as any).user_id] = (userCounts[(r as any).user_id] ?? 0) + 1;
const multiAnalysisUsers = Object.entries(userCounts).filter(([_, n]) => n >= 2);
console.log(`2건 이상 분석한 사용자: ${multiAnalysisUsers.length}명`);
const top5 = multiAnalysisUsers.sort((a, b) => b[1] - a[1]).slice(0, 5);
for (const [uid, n] of top5) {
  const sample = userRows.find((r: any) => r.user_id === uid);
  console.log(`  ${(sample as any)?.name ?? "?"} (${uid.slice(0, 8)}): ${n}건`);
}

// 최근 v16 배포 (2026-05-10) 이후 신규 분석
const v16DeployTime = new Date("2026-05-10T00:00:00Z").toISOString();
const newAfterV16 = withFullJson.filter((r: any) => r.created_at > v16DeployTime);
console.log();
console.log(`v16 배포(2026-05-10) 이후 신규 분석: ${newAfterV16.length}건`);
