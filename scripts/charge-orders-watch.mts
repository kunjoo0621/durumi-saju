/**
 * charge_orders 운영 감시 스크립트.
 *
 * 1차 PR 시점에는 이 테이블에 데이터가 없어 모든 섹션이 0건으로 나옴.
 * 후속 PR (intent endpoint / webhook / charge route 변경) 들어가면
 * 이 스크립트가 사고 조기 감지 채널이 됨.
 *
 * 보는 것:
 *   1) 오래된 pending — intent 생성 후 N분 지나도 paid 안 됨 (사용자 이탈/redirect 끊김 의심)
 *   2) paid but not charged — PortOne PAID 인데 코인 충전 미완료 (충전 RPC 실패/race 의심)
 *   3) 최근 1시간 status 분포 — 통계
 *
 * 사용:
 *   npx tsx scripts/charge-orders-watch.mts
 *   npx tsx scripts/charge-orders-watch.mts 30   # pending 임계값 30분 (기본 10분)
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

const PENDING_THRESHOLD_MIN = Number(process.argv[2] ?? 10);
const pendingCutoff = new Date(Date.now() - PENDING_THRESHOLD_MIN * 60 * 1000).toISOString();
const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();

const kst = (iso: string | null | undefined) =>
  iso ? new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ") : "-";

console.log(`=== 1) 오래된 pending (${PENDING_THRESHOLD_MIN}분 이상 paid 안 됨) ===`);
const { data: stale, error: e1 } = await sb
  .from("charge_orders")
  .select("order_id, user_id, package_id, amount, created_at")
  .eq("status", "pending")
  .lt("created_at", pendingCutoff)
  .order("created_at", { ascending: true })
  .limit(50);
if (e1) console.log("ERR:", e1.message);
for (const r of stale ?? []) {
  console.log(`  KST ${kst(r.created_at)}  order=${r.order_id?.slice(0, 12)}  uid=${r.user_id?.slice(0, 8)}  ${r.package_id}  ${r.amount}원`);
}
console.log(`  → ${stale?.length ?? 0}건\n`);

console.log("=== 2) paid but not charged (결제됐는데 코인 충전 안 됨) ===");
const { data: paidNotCharged, error: e2 } = await sb
  .from("charge_orders")
  .select("order_id, user_id, package_id, amount, paid_at, payment_id")
  .eq("status", "paid")
  .order("paid_at", { ascending: true })
  .limit(50);
if (e2) console.log("ERR:", e2.message);
for (const r of paidNotCharged ?? []) {
  console.log(`  paid KST ${kst(r.paid_at)}  order=${r.order_id?.slice(0, 12)}  uid=${r.user_id?.slice(0, 8)}  ${r.amount}원  paymentId=${r.payment_id?.slice(0, 12) ?? "-"}`);
}
console.log(`  → ${paidNotCharged?.length ?? 0}건\n`);

console.log("=== 3) 최근 1시간 status 분포 ===");
const { data: recent, error: e3 } = await sb
  .from("charge_orders")
  .select("status")
  .gte("created_at", hourAgo);
if (e3) console.log("ERR:", e3.message);
const dist = new Map<string, number>();
for (const r of recent ?? []) dist.set(r.status, (dist.get(r.status) ?? 0) + 1);
for (const [s, n] of dist) console.log(`  ${s.padEnd(10)} ${n}건`);
console.log(`  → 총 ${recent?.length ?? 0}건\n`);

if ((stale?.length ?? 0) === 0 && (paidNotCharged?.length ?? 0) === 0) {
  console.log("✓ 이상 없음");
} else {
  console.log("⚠ 위 항목 점검 필요");
  process.exit(1);
}
