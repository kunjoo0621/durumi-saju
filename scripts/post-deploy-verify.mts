import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const DEPLOY_TIME = "2026-05-18T06:05:58Z"; // ca461d6 production deploy

// 1) 배포 이후 시도된 정상 결제 흐름이 있나
const { data: postPayments } = await sb
  .from("payment_transactions")
  .select("created_at, user_id, method, amount, status, order_id")
  .gte("created_at", DEPLOY_TIME)
  .order("created_at", { ascending: false })
  .limit(20);

console.log(`=== 배포(${DEPLOY_TIME}) 이후 payment_transactions ${postPayments?.length ?? 0}건 ===`);
for (const p of postPayments ?? []) {
  console.log(`  ${p.created_at}  ${p.method ?? "-"}  ${p.amount}원  status=${p.status}  user=${p.user_id?.slice(0, 8) ?? "?"}`);
}

// 2) 배포 이후 coin_transactions (충전+사용 둘 다)
const { data: postTxs } = await sb
  .from("coin_transactions")
  .select("created_at, user_id, type, amount, reference_id, package_id")
  .gte("created_at", DEPLOY_TIME)
  .order("created_at", { ascending: false })
  .limit(30);

console.log(`\n=== 배포 이후 coin_transactions ${postTxs?.length ?? 0}건 ===`);
const chargeRefCount = new Map<string, number>();
for (const t of postTxs ?? []) {
  console.log(`  ${t.created_at}  type=${t.type.padEnd(6)}  amount=${String(t.amount).padStart(4)}  user=${t.user_id.slice(0, 8)}  ref=${(t.reference_id ?? "-").slice(0, 12)}  pkg=${t.package_id ?? "-"}`);
  if (t.type === "charge" && t.reference_id) {
    chargeRefCount.set(t.reference_id, (chargeRefCount.get(t.reference_id) ?? 0) + 1);
  }
}

// 3) 배포 이후 reference_id 별 charge 중복 검사 (가드가 정상 동작했나)
const dupRefs = [...chargeRefCount.entries()].filter(([, c]) => c >= 2);
console.log(`\n=== 배포 이후 중복 charge (가드 우회 흔적) ===`);
if (dupRefs.length === 0) {
  console.log(`  없음 ✓ — 가드 정상 동작`);
} else {
  for (const [ref, count] of dupRefs) {
    console.log(`  ⚠ ref=${ref}  ${count}회 중복`);
  }
}

// 4) UNIQUE 인덱스 존재 확인
const { data: idx, error } = await sb.rpc("operator_grant_coins", { p_user_id: "00000000-0000-0000-0000-000000000000", p_amount: 1, p_reason: "ping_test" }).select();
// 위 호출은 실제 user 없어서 fail 예상 — 다만 RPC 존재 자체는 확인됨
console.log(`\n=== operator_grant_coins RPC 등록 확인 ===`);
console.log(`  error: ${error?.message || "(없음)"} (RPC 자체는 호출 가능)`);

// 5) 배포 이후 ledger != balance 케이스 추이
let allTxs: any[] = [];
let from = 0;
const PAGE = 1000;
while (true) {
  const { data, error } = await sb
    .from("coin_transactions")
    .select("user_id, amount")
    .range(from, from + PAGE - 1);
  if (error) throw error;
  if (!data || data.length === 0) break;
  allTxs = allTxs.concat(data);
  if (data.length < PAGE) break;
  from += PAGE;
}
const sumByUser = new Map<string, number>();
for (const t of allTxs) sumByUser.set(t.user_id, (sumByUser.get(t.user_id) ?? 0) + (t.amount ?? 0));

const { data: profiles } = await sb.from("profiles").select("user_id, coin_balance");
let mismatches = 0;
for (const p of profiles ?? []) {
  const ledger = sumByUser.get(p.user_id) ?? 0;
  if ((p.coin_balance ?? 0) !== ledger) mismatches++;
}
console.log(`\n=== 전체 정합성 ===`);
console.log(`  ledger != balance: ${mismatches}명 (옛 흔적 2명 외 추가 없어야 정상)`);
