import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const TARGET_KAKAO = "4722556140";
const DRY_RUN = process.env.CONFIRM !== "yes";

async function main() {
  // 활성 + archived 본인 계정들
  const { data: candidates, error } = await sb
    .from("users")
    .select("id, kakao_id, nickname, created_at")
    .or(`kakao_id.eq.${TARGET_KAKAO},kakao_id.ilike.${TARGET_KAKAO}\\_archived\\_%`);

  if (error) {
    console.error("조회 실패:", error.message);
    process.exit(1);
  }

  if (!candidates || candidates.length === 0) {
    console.log(`kakao_id=${TARGET_KAKAO}(archived 포함) 대상 없음`);
    return;
  }

  console.log(`== 본인 계정 후보 (${candidates.length}건) ==\n`);

  let totalResults = 0;
  let totalBattles = 0;
  let totalPayments = 0;
  let totalPaidAmount = 0;
  let totalCoins = 0;

  for (const u of candidates) {
    const [{ count: rc }, { count: bc }, { data: payments }, { count: cc }] = await Promise.all([
      sb.from("saju_results").select("id", { count: "exact", head: true }).eq("user_id", u.id),
      sb.from("saju_battles").select("id", { count: "exact", head: true }).eq("user_id", u.id),
      sb.from("payment_transactions").select("amount, method").eq("user_id", u.id),
      sb.from("coin_transactions").select("id", { count: "exact", head: true }).eq("user_id", u.id),
    ]);

    const paidAmount = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
    const kakaoPayAmount = (payments ?? []).filter((p) => p.method === "KAKAOPAY").reduce((s, p) => s + (p.amount ?? 0), 0);

    console.log(`user_id=${u.id}`);
    console.log(`  kakao_id:  ${u.kakao_id}`);
    console.log(`  nickname:  ${u.nickname ?? "(없음)"}`);
    console.log(`  가입일:     ${u.created_at?.slice(0, 10)}`);
    console.log(`  saju_results:         ${rc ?? 0}건`);
    console.log(`  saju_battles:         ${bc ?? 0}건`);
    console.log(`  payment_transactions: ${payments?.length ?? 0}건 / ${paidAmount.toLocaleString()}원 (KAKAOPAY: ${kakaoPayAmount.toLocaleString()}원)`);
    console.log(`  coin_transactions:    ${cc ?? 0}건\n`);

    totalResults += rc ?? 0;
    totalBattles += bc ?? 0;
    totalPayments += payments?.length ?? 0;
    totalPaidAmount += paidAmount;
    totalCoins += cc ?? 0;
  }

  console.log(`== 총합 ==`);
  console.log(`  users:                ${candidates.length}건`);
  console.log(`  saju_results:         ${totalResults}건`);
  console.log(`  saju_battles:         ${totalBattles}건`);
  console.log(`  payment_transactions: ${totalPayments}건 / ${totalPaidAmount.toLocaleString()}원`);
  console.log(`  coin_transactions:    ${totalCoins}건`);
  console.log(`  profiles:             (각 user 당 1건, CASCADE)\n`);

  if (DRY_RUN) {
    console.log("⚠️  DRY RUN — 실제 삭제 안 함");
    console.log("실제 삭제 실행: CONFIRM=yes npx tsx scripts/delete-my-account.mts");
    return;
  }

  // 실제 삭제 (CASCADE)
  console.log("실제 삭제 진행...\n");
  for (const u of candidates) {
    const { error: delErr } = await sb.from("users").delete().eq("id", u.id);
    if (delErr) {
      console.error(`❌ user_id=${u.id} 삭제 실패:`, delErr.message);
    } else {
      console.log(`✅ user_id=${u.id} (${u.kakao_id}) CASCADE 삭제 완료`);
    }
  }

  console.log("\n== 최종 확인 ==");
  const { data: remaining } = await sb
    .from("users")
    .select("id, kakao_id")
    .or(`kakao_id.eq.${TARGET_KAKAO},kakao_id.ilike.${TARGET_KAKAO}\\_archived\\_%`);
  console.log(`남은 레코드: ${remaining?.length ?? 0}건`);
}

main();
