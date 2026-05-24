import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL!, envVars.SUPABASE_SERVICE_ROLE_KEY!);

// 1. coin_transactions 구조
const { data: ct } = await sb
  .from("coin_transactions")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(10);
console.log("=== coin_transactions 샘플 10건 ===");
for (const t of ct ?? []) {
  console.log(`  ${t.created_at.slice(0, 19)}  type=${t.type}  amt=${t.amount}  ref=${t.reference_id?.slice(0, 12)}...  pkg=${t.package_id}  bal=${t.balance_after}`);
}

const { data: ctTypes } = await sb.from("coin_transactions").select("type");
const typeSet = new Set((ctTypes ?? []).map((t: any) => t.type));
console.log("\ncoin_transactions.type 종류:", [...typeSet].join(", "));

// 2. saju_results.unlocked_at 채워진 비율 + order_id 채워진 비율
const { data: rs } = await sb
  .from("saju_results")
  .select("id, user_id, order_id, unlocked_at, created_at")
  .not("full_json", "is", null);
const withUnlock = (rs ?? []).filter((r: any) => r.unlocked_at).length;
const withOrder = (rs ?? []).filter((r: any) => r.order_id).length;
console.log(`\n=== saju_results 채움률 (전체 ${rs?.length}) ===`);
console.log(`unlocked_at: ${withUnlock} (${((withUnlock / (rs?.length ?? 1)) * 100).toFixed(1)}%)`);
console.log(`order_id: ${withOrder} (${((withOrder / (rs?.length ?? 1)) * 100).toFixed(1)}%)`);

// 3. coin_transactions.reference_id 가 payment_transactions.id 와 매칭되는지 시험
const { data: payments } = await sb
  .from("payment_transactions")
  .select("id, order_id")
  .eq("status", "success")
  .eq("method", "KAKAOPAY");
const paymentIds = new Set((payments ?? []).map((p: any) => p.id));
const orderIds = new Set((payments ?? []).map((p: any) => p.order_id));

const { data: chargeTx } = await sb
  .from("coin_transactions")
  .select("reference_id")
  .eq("type", "charge");
const chargeRefs = (chargeTx ?? []).map((t: any) => t.reference_id).filter(Boolean);
const matchPaymentId = chargeRefs.filter((r: string) => paymentIds.has(r)).length;
const matchOrderId = chargeRefs.filter((r: string) => orderIds.has(r)).length;
console.log(`\n=== coin_transactions.reference_id (type=charge, n=${chargeRefs.length}) 매칭 ===`);
console.log(`payment.id 매칭: ${matchPaymentId}`);
console.log(`payment.order_id 매칭: ${matchOrderId}`);

// 4. coin_transactions type=spend 의 reference_id → saju_results.id 매칭?
const { data: spendTx } = await sb
  .from("coin_transactions")
  .select("reference_id")
  .eq("type", "spend");
const spendRefs = (spendTx ?? []).map((t: any) => t.reference_id).filter(Boolean);
const { data: allResultIds } = await sb.from("saju_results").select("id");
const resultIdSet = new Set((allResultIds ?? []).map((r: any) => r.id));
const matchSpendToResult = spendRefs.filter((r: string) => resultIdSet.has(r)).length;
console.log(`\n=== coin_transactions.reference_id (type=spend, n=${spendRefs.length}) → saju_results.id 매칭: ${matchSpendToResult} ===`);
