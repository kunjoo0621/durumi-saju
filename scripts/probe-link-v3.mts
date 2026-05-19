import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL!, envVars.SUPABASE_SERVICE_ROLE_KEY!);

// 재결제자 한 명 골라서 흐름 추적
const { data: payments } = await sb
  .from("payment_transactions")
  .select("*")
  .eq("status", "success")
  .eq("method", "KAKAOPAY")
  .order("created_at", { ascending: true });

const byUser = new Map<string, any[]>();
for (const p of payments ?? []) {
  if (!p.user_id) continue;
  const arr = byUser.get(p.user_id) ?? [];
  arr.push(p);
  byUser.set(p.user_id, arr);
}
const repeaters = [...byUser.entries()].filter(([_, v]) => v.length >= 2);
console.log(`재결제자 ${repeaters.length}명 중 첫 3명 추적\n`);

for (const [uid, pays] of repeaters.slice(0, 3)) {
  console.log(`\n========== user ${uid.slice(0, 8)} ==========`);
  // payment 흐름
  console.log("\n[payments]");
  for (const p of pays) {
    console.log(`  ${p.created_at}  ${p.amount}원  order_id=${p.order_id?.slice(0, 12)}...`);
  }

  // coin_transactions
  const { data: ct } = await sb
    .from("coin_transactions")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });
  console.log(`\n[coin_transactions (${ct?.length})]`);
  for (const t of ct ?? []) {
    const ref = t.reference_id ? `${String(t.reference_id).slice(0, 14)}...` : "null";
    console.log(`  ${t.created_at.slice(0, 19)}  ${t.type.padEnd(7)} ${String(t.amount).padStart(4)} ref=${ref}  pkg=${t.package_id ?? "-"}  bal=${t.balance_after}`);
  }

  // saju_results
  const { data: rs } = await sb
    .from("saju_results")
    .select("id, name, created_at, unlocked_at, order_id, full_json")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });
  console.log(`\n[saju_results (${rs?.length})]`);
  for (const r of rs ?? []) {
    const grade = r.full_json?.tier?.grade ?? "?";
    console.log(`  ${r.created_at.slice(0, 19)}  ${(r.name ?? "?").padEnd(8)}  grade=${grade}  unlock=${r.unlocked_at?.slice(0, 19) ?? "-"}  order=${r.order_id?.slice(0, 12) ?? "-"}  id=${r.id.slice(0, 12)}`);
  }
}
