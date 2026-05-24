import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "-";

async function main() {
  // 1) 전체 coin_transactions 로드
  const { data: txs, error: txErr } = await sb
    .from("coin_transactions")
    .select("id, user_id, type, amount, balance_after, reference_id, package_id, created_at")
    .order("created_at", { ascending: true });
  if (txErr) throw txErr;

  // 2) 사용자 매핑
  const { data: users } = await sb.from("users").select("id, kakao_id, nickname");
  const userById = new Map<string, any>();
  for (const u of users ?? []) userById.set(u.id, u);

  // 3) 같은 reference_id에 charge가 2건 이상인 케이스
  const chargeByRef = new Map<string, any[]>();
  for (const t of txs ?? []) {
    if (t.type !== "charge" || !t.reference_id) continue;
    const arr = chargeByRef.get(t.reference_id) ?? [];
    arr.push(t);
    chargeByRef.set(t.reference_id, arr);
  }
  const dupRefs = [...chargeByRef.entries()].filter(([, arr]) => arr.length >= 2);

  console.log("=== 중복 충전 감지 ===\n");
  if (dupRefs.length === 0) {
    console.log("(중복 충전 없음)");
  }
  for (const [ref, arr] of dupRefs) {
    const u = userById.get(arr[0].user_id);
    console.log(`reference_id=${ref}`);
    console.log(`  user=${u?.nickname ?? "?"} [kakao:${u?.kakao_id?.slice(0, 12) ?? "?"}]  user_id=${arr[0].user_id}`);
    console.log(`  charge 행 ${arr.length}개:`);
    for (const t of arr) {
      console.log(`    ${fmt(t.created_at)}  amount=${t.amount}  balance_after=${t.balance_after}  pkg=${t.package_id}  tx_id=${t.id}`);
    }
  }

  // 4) 영향 user별 상세 dump
  const affectedUserIds = new Set(dupRefs.map(([, arr]) => arr[0].user_id));
  console.log("\n=== 영향 사용자 상세 ===\n");

  for (const uid of affectedUserIds) {
    const u = userById.get(uid);
    const userTxs = (txs ?? []).filter((t: any) => t.user_id === uid);

    // 결제 내역
    const { data: payments } = await sb
      .from("payment_transactions")
      .select("order_id, method, amount, status, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    // 현재 잔액
    const { data: profile } = await sb
      .from("profiles")
      .select("coin_balance, signup_bonus_granted_at")
      .eq("user_id", uid)
      .maybeSingle();

    console.log(`────────────────────────────────────────────────────────`);
    console.log(`${u?.nickname ?? "?"} [kakao:${u?.kakao_id ?? "?"}]`);
    console.log(`user_id: ${uid}`);
    console.log(`현재 coin_balance: ${profile?.coin_balance ?? "-"}`);
    console.log(`signup_bonus_granted_at: ${fmt(profile?.signup_bonus_granted_at)}`);

    console.log(`\n실결제 (payment_transactions):`);
    for (const p of payments ?? []) {
      console.log(`  ${fmt(p.created_at)}  ${p.method ?? "-"}  ${p.amount}원  status=${p.status}  order_id=${p.order_id}`);
    }
    const realPaid = (payments ?? [])
      .filter((p: any) => p.method && p.method !== "egg" && p.method !== "mock" && p.status === "success")
      .reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
    console.log(`  실결제 총액: ${realPaid.toLocaleString()}원`);

    console.log(`\ncoin_transactions 전체:`);
    let chargeSum = 0, bonusSum = 0, spendSum = 0, refundSum = 0;
    for (const t of userTxs) {
      console.log(`  ${fmt(t.created_at)}  type=${t.type.padEnd(6)}  amount=${String(t.amount).padStart(5)}  bal_after=${String(t.balance_after).padStart(4)}  ref=${t.reference_id ?? "-"}  pkg=${t.package_id ?? "-"}`);
      if (t.type === "charge") chargeSum += t.amount;
      else if (t.type === "bonus") bonusSum += t.amount;
      else if (t.type === "spend") spendSum += t.amount;
      else if (t.type === "refund") refundSum += t.amount;
    }
    const ledgerSum = chargeSum + bonusSum + spendSum + refundSum;
    console.log(`\n  합계: charge=${chargeSum}  bonus=${bonusSum}  spend=${spendSum}  refund=${refundSum}`);
    console.log(`  ledger SUM(amount) = ${ledgerSum}`);
    console.log(`  profile coin_balance = ${profile?.coin_balance ?? "?"}`);
    console.log(`  ledger == balance? ${ledgerSum === profile?.coin_balance ? "OK" : "MISMATCH"}`);

    // 정상 시나리오 계산
    // 가입 보너스(10) + 실결제별 정상 패키지 금액 합
    const PKG_BY_PRICE: Record<number, number> = {
      1000: 10,
      3000: 35,
      5000: 62,
      10000: 120, // 참고
    };
    const expectedFromPayments = (payments ?? [])
      .filter((p: any) => p.method && p.method !== "egg" && p.method !== "mock" && p.status === "success")
      .reduce((s: number, p: any) => s + (PKG_BY_PRICE[p.amount] ?? 0), 0);
    const expectedSignup = profile?.signup_bonus_granted_at ? 10 : 0;
    const expectedSpend = spendSum; // 음수
    const expectedRefund = refundSum;
    const expectedBalance = expectedSignup + expectedFromPayments + expectedSpend + expectedRefund;

    console.log(`\n  정상 시나리오 (가입${expectedSignup} + 결제기반패키지${expectedFromPayments} + spend${spendSum} + refund${refundSum}):`);
    console.log(`  expected_balance = ${expectedBalance}`);
    console.log(`  과지급 추정 = ${(profile?.coin_balance ?? 0) - expectedBalance}`);
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
