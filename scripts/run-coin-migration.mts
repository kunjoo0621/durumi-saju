import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}

const url = envVars.NEXT_PUBLIC_SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key);

async function run() {
  // 1. first 패키지 참조 해제
  const r1 = await sb.from("coin_transactions").update({ package_id: null }).eq("package_id", "first");
  console.log("1. clear first refs:", r1.error?.message || "ok");

  // 2. first 패키지 삭제
  const r2 = await sb.from("coin_packages").delete().eq("id", "first");
  console.log("2. delete first:", r2.error?.message || "ok");

  // 3. basic 업데이트
  const r3 = await sb.from("coin_packages").update({ price: 1000, coin_amount: 10, bonus_amount: 0, highlight: false }).eq("id", "basic");
  console.log("3. update basic:", r3.error?.message || "ok");

  // 4. popular 업데이트
  const r4 = await sb.from("coin_packages").update({ price: 3000, coin_amount: 30, bonus_amount: 5, highlight: true }).eq("id", "popular");
  console.log("4. update popular:", r4.error?.message || "ok");

  // 5. value 업데이트
  const r5 = await sb.from("coin_packages").update({ price: 5000, coin_amount: 50, bonus_amount: 12, highlight: false }).eq("id", "value");
  console.log("5. update value:", r5.error?.message || "ok");

  // 검증
  const { data } = await sb.from("coin_packages").select("id, label, price, coin_amount, bonus_amount, total_eggs, highlight").order("price");
  console.log("\n=== 최종 coin_packages ===");
  console.table(data);
}

run();
