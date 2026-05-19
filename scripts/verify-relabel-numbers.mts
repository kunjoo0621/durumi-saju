/**
 * 라벨 변경 결정용 숫자 검증
 * - 2026-04-01 이후 가입자, 사주, 결제, 매출
 * - 등급 분포
 * - 운영자(신건주) 제외 영향
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

const SINCE = "2026-04-01T00:00:00Z";

// 운영자 user_id
const { data: ownerResults } = await sb.from("saju_results").select("user_id").eq("name", "신건주");
const ownerUids = new Set<string>();
for (const r of ownerResults ?? []) if (r.user_id) ownerUids.add(r.user_id);
console.log(`운영자 user_id: ${ownerUids.size}개`);

// 가입자 (2026-04-01 이후)
const { data: users, count: usersCount } = await sb
  .from("users")
  .select("id, created_at", { count: "exact" })
  .gte("created_at", SINCE);
console.log(`\n가입자 (2026-04-01~): ${usersCount}명`);

// saju_results — full_json 있는 것 = 분석 완료
const { data: results, count: resultsCount } = await sb
  .from("saju_results")
  .select("id, user_id, name, created_at, full_json", { count: "exact" })
  .gte("created_at", SINCE);
console.log(`saju_results (2026-04-01~): ${resultsCount}건`);
const completed = (results ?? []).filter((r: any) => r.full_json);
const missing = (results ?? []).filter((r: any) => !r.full_json);
console.log(`  완료: ${completed.length}, 미완/누락: ${missing.length}`);

// 등급 분포 (전체)
const gradeAll = new Map<string, number>();
for (const r of completed) {
  const g = r.full_json?.tier?.grade ?? "(없음)";
  gradeAll.set(g, (gradeAll.get(g) ?? 0) + 1);
}
console.log(`\n## 등급 분포 (전체, 2026-04-01~)`);
for (const g of ["S", "A", "B", "C", "D", "(없음)"]) {
  const n = gradeAll.get(g) ?? 0;
  const pct = n / completed.length * 100;
  console.log(`  ${g.padEnd(6)}  ${String(n).padStart(4)}건  ${pct.toFixed(1)}%`);
}

// 운영자 제외
const noOp = completed.filter((r: any) => !ownerUids.has(r.user_id) && r.name !== "신건주");
const gradeNoOp = new Map<string, number>();
for (const r of noOp) {
  const g = r.full_json?.tier?.grade ?? "(없음)";
  gradeNoOp.set(g, (gradeNoOp.get(g) ?? 0) + 1);
}
console.log(`\n## 등급 분포 (운영자 제외, n=${noOp.length})`);
for (const g of ["S", "A", "B", "C", "D", "(없음)"]) {
  const n = gradeNoOp.get(g) ?? 0;
  const pct = n / noOp.length * 100;
  console.log(`  ${g.padEnd(6)}  ${String(n).padStart(4)}건  ${pct.toFixed(1)}%`);
}

// 라벨 변경 시뮬 (운영자 제외)
console.log(`\n## 라벨 변경 후 분포 (운영자 제외)`);
const rename: Record<string, string> = { S: "SS", A: "S", B: "A", C: "B", D: "C" };
for (const oldG of ["S", "A", "B", "C", "D"]) {
  const newG = rename[oldG];
  const n = gradeNoOp.get(oldG) ?? 0;
  const pct = n / noOp.length * 100;
  console.log(`  ${oldG} → ${newG.padEnd(4)} ${String(n).padStart(4)}건  ${pct.toFixed(1)}%`);
}

// 결제 (2026-04-01 이후, KAKAOPAY success)
const { data: paymentsAll } = await sb
  .from("payment_transactions")
  .select("id, user_id, amount, method, status, created_at")
  .eq("status", "success")
  .gte("created_at", SINCE);
const kakao = (paymentsAll ?? []).filter((p: any) => p.method === "KAKAOPAY");
const kakaoNoOp = kakao.filter((p: any) => !ownerUids.has(p.user_id));
console.log(`\n## 결제 (2026-04-01~)`);
console.log(`  KAKAOPAY success 전체: ${kakao.length}건, 매출 ${kakao.reduce((s: number, p: any) => s + p.amount, 0).toLocaleString()}원`);
console.log(`  운영자 제외:          ${kakaoNoOp.length}건, 매출 ${kakaoNoOp.reduce((s: number, p: any) => s + p.amount, 0).toLocaleString()}원`);

// status 종류 확인 (혹시 다른 status도 있나)
const { data: allStatus } = await sb
  .from("payment_transactions")
  .select("status")
  .gte("created_at", SINCE);
const statusSet = new Map<string, number>();
for (const p of allStatus ?? []) statusSet.set(p.status, (statusSet.get(p.status) ?? 0) + 1);
console.log(`\npayment status 종류 (2026-04-01~):`, [...statusSet.entries()].map(([k, v]) => `${k}=${v}`).join(", "));

// 올해운세, 배틀 류 — 다른 테이블 있나 추측
console.log(`\n## 기타 테이블 추정`);
for (const t of ["yearly_results", "yearly_weather", "battle_results", "battles", "saju_battles", "yearly"]) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  if (error) console.log(`  ${t}: ${error.message.slice(0, 50)}`);
  else console.log(`  ${t}: ${count}건`);
}
