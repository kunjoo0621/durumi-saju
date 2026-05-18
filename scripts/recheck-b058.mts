import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const REF = "b058e3fc-8fad-448c-8af2-2238992119c4";
const USER = "9e8d1e96-784c-4f5b-a40e-e1606ecdbd81";

// count + 정확한 row 수, 페이지네이션 없이
const { count: chargeCount } = await sb
  .from("coin_transactions")
  .select("id", { count: "exact", head: true })
  .eq("reference_id", REF)
  .eq("type", "charge");

const { count: bonusCount } = await sb
  .from("coin_transactions")
  .select("id", { count: "exact", head: true })
  .eq("reference_id", REF)
  .eq("type", "bonus");

console.log(`b058 charge 행 수: ${chargeCount}`);
console.log(`b058 bonus  행 수: ${bonusCount}`);

// 전체 ledger fetch, range로 1000개 이상도 가져옴
let allTxs: any[] = [];
let from = 0;
const PAGE = 1000;
while (true) {
  const { data, error } = await sb
    .from("coin_transactions")
    .select("id, type, amount, balance_after, reference_id, created_at")
    .eq("user_id", USER)
    .order("created_at", { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) throw error;
  if (!data || data.length === 0) break;
  allTxs = allTxs.concat(data);
  if (data.length < PAGE) break;
  from += PAGE;
}

console.log(`\n장혜진 ledger 전체 행 수: ${allTxs.length}`);
const sum = allTxs.reduce((s, t) => s + (t.amount ?? 0), 0);
console.log(`ledger SUM(amount) = ${sum}`);

const { data: prof } = await sb
  .from("profiles")
  .select("coin_balance")
  .eq("user_id", USER)
  .single();
console.log(`profile coin_balance = ${prof?.coin_balance}`);

// 마지막 5개 행 (시점 확인)
console.log(`\n마지막 5개 행:`);
for (const t of allTxs.slice(-5)) {
  const utc = new Date(t.created_at);
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  console.log(`  ${utc.toISOString().slice(0, 19)}Z  (KST ${kst.toISOString().slice(11, 19)})  type=${t.type.padEnd(6)} amount=${String(t.amount).padStart(4)} bal_after=${String(t.balance_after).padStart(4)} ref=${(t.reference_id ?? "-").slice(0, 12)}`);
}
