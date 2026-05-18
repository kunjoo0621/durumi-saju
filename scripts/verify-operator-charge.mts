import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const OPERATOR = "f39ccecb-fc39-4ef9-a262-d8ab2b85c317";

// 오늘 결제 흔적
const { data: payments } = await sb
  .from("payment_transactions")
  .select("created_at, method, amount, status, order_id, user_id")
  .gte("created_at", "2026-05-18T00:00:00Z")
  .order("created_at", { ascending: false })
  .limit(10);

console.log("=== 오늘 payment_transactions 최근 ===");
for (const p of payments ?? []) {
  const me = p.user_id === OPERATOR ? " ← 운영자" : "";
  console.log(`  ${p.created_at}  ${p.method ?? "-"}  ${p.amount}원  status=${p.status}  order=${(p.order_id ?? "-").slice(0, 12)}${me}`);
}

// 운영자 본인 오늘 coin_transactions
const { data: ops } = await sb
  .from("coin_transactions")
  .select("created_at, type, amount, balance_after, reference_id, package_id")
  .eq("user_id", OPERATOR)
  .gte("created_at", "2026-05-18T00:00:00Z")
  .order("created_at", { ascending: false })
  .limit(15);

console.log(`\n=== 운영자 본인 오늘 ledger ===`);
for (const t of ops ?? []) {
  console.log(`  ${t.created_at}  type=${t.type.padEnd(6)} amount=${String(t.amount).padStart(4)} bal_after=${String(t.balance_after).padStart(4)} ref=${(t.reference_id ?? "-").slice(0, 20)} pkg=${t.package_id ?? "-"}`);
}

// 같은 reference_id 로 charge 가 중복된 흔적?
const chargeByRef = new Map<string, number>();
for (const t of ops ?? []) {
  if (t.type === "charge" && t.reference_id) {
    chargeByRef.set(t.reference_id, (chargeByRef.get(t.reference_id) ?? 0) + 1);
  }
}
const dup = [...chargeByRef.entries()].filter(([, c]) => c >= 2);
console.log(`\n=== 운영자 오늘 중복 charge ===`);
if (dup.length === 0) console.log("  없음 ✓ (멱등 가드 정상 동작 또는 새로고침 안 함)");
else for (const [ref, c] of dup) console.log(`  ⚠ ${ref}: ${c}회`);

// 현재 운영자 잔액
const { data: prof } = await sb.from("profiles").select("coin_balance").eq("user_id", OPERATOR).maybeSingle();
console.log(`\n현재 운영자 잔액: ${prof?.coin_balance ?? 0}알`);
