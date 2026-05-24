/**
 * 운영자(신건주) user_id 기반 모든 saju_results 전수 — name 다른 row 포함
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

// 1. 신건주 이름으로 적힌 row의 user_id 모두 수집
const { data: byName } = await sb
  .from("saju_results")
  .select("user_id")
  .eq("name", "신건주");
const userIds = new Set<string>();
for (const r of byName ?? []) if (r.user_id) userIds.add(r.user_id);

// 2. users 테이블에서 본인 user_id 찾기 (kunjoo)
const { data: usersByKakao } = await sb
  .from("users")
  .select("id, nickname, name, kakao_id, email")
  .or("nickname.ilike.%신건주%,name.ilike.%신건주%,email.ilike.%kunjoo%");
for (const u of usersByKakao ?? []) userIds.add(u.id);

console.log(`운영자 후보 user_id ${userIds.size}개:`);
for (const u of usersByKakao ?? []) console.log(`  ${u.id?.slice(0, 8)}  nickname=${u.nickname}  name=${u.name}  email=${u.email}  kakao=${u.kakao_id?.slice(0, 12)}`);

// 3. 이 user_id 의 모든 saju_results — 이름 무관
const { data: all } = await sb
  .from("saju_results")
  .select("id, user_id, name, birth_date, birth_time, created_at, full_json")
  .in("user_id", [...userIds])
  .order("created_at", { ascending: true });

console.log(`\n총 saju_results ${all?.length}건:\n`);
for (const r of all ?? []) {
  const fj = r.full_json as any;
  const sv = fj?.scoringVersion;
  const tier = fj?.tier ?? {};
  console.log(`  ${r.created_at?.slice(0, 16)}  name=${r.name?.padEnd(8)}  birth=${r.birth_date} ${r.birth_time}  v${sv}  ${tier.grade}등급 ${tier.composite}점  user=${r.user_id?.slice(0, 8)}`);
}

// 4. 본인 결제 history
console.log("\n## 운영자 결제 history\n");
const { data: pays } = await sb
  .from("payment_transactions")
  .select("created_at, amount, method, status, order_id")
  .in("user_id", [...userIds])
  .order("created_at", { ascending: true });
for (const p of pays ?? []) {
  console.log(`  ${p.created_at?.slice(0, 16)}  ${p.method}  ${p.amount}원  ${p.status}  order=${p.order_id?.slice(0, 8)}`);
}
