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
if (!url || !key) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}
const sb = createClient(url, key);

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "-";

async function main() {
  console.log("============================================================");
  console.log("  두루미사주 사용 리포트 (Supabase)");
  console.log("  기준 시각:", new Date().toISOString());
  console.log("============================================================\n");

  const [users, results, battles, payments, coins, profiles] = await Promise.all([
    sb.from("users").select("id, kakao_id, nickname, email, created_at, primary_result_id", { count: "exact" }),
    sb.from("saju_results").select("id, user_id, guest_token_hash, created_at", { count: "exact" }),
    sb.from("saju_battles").select("id, user_id, guest_token_hash, created_at", { count: "exact" }),
    sb.from("payment_transactions").select("id, user_id, amount, status, order_id, created_at"),
    sb.from("coin_transactions").select("id, user_id, type, amount, created_at"),
    sb.from("profiles").select("user_id, coin_balance"),
  ]);

  if (users.error) {
    console.log("users 조회 실패:", users.error.message);
    if (users.error.message.includes("email")) {
      console.log("→ email 컬럼 없음. 재시도합니다.\n");
      const retry = await sb.from("users").select("id, kakao_id, nickname, created_at, primary_result_id", { count: "exact" });
      if (retry.error) {
        console.log("재시도 실패:", retry.error.message);
        process.exit(1);
      }
      users.data = retry.data?.map((u) => ({ ...u, email: null })) as any;
      users.count = retry.count;
      users.error = null;
    } else {
      process.exit(1);
    }
  }

  const userList = users.data ?? [];
  const resultList = results.data ?? [];
  const battleList = battles.data ?? [];
  const paymentList = (payments.data ?? []).filter((p: any) => p.status === "PAID");
  const coinList = coins.data ?? [];
  const profileList = profiles.data ?? [];

  const balanceByUser = new Map<string, number>();
  for (const p of profileList) balanceByUser.set(p.user_id, p.coin_balance ?? 0);

  // Funnel
  const memberResults = resultList.filter((r: any) => r.user_id);
  const guestResults = resultList.filter((r: any) => !r.user_id);
  const memberBattles = battleList.filter((b: any) => b.user_id);
  const guestBattles = battleList.filter((b: any) => !b.user_id);

  const uniqueResultUsers = new Set(memberResults.map((r: any) => r.user_id)).size;
  const uniqueBattleUsers = new Set(memberBattles.map((b: any) => b.user_id)).size;
  const uniquePayers = new Set(paymentList.map((p: any) => p.user_id)).size;
  const totalPaid = paymentList.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);

  const uniqueGuestResultTokens = new Set(guestResults.map((r: any) => r.guest_token_hash).filter(Boolean)).size;
  const uniqueGuestBattleTokens = new Set(guestBattles.map((b: any) => b.guest_token_hash).filter(Boolean)).size;

  console.log("## 가입/사용 Funnel (로그인 회원 기준)");
  console.log(`  가입자:          ${userList.length}명`);
  console.log(`  분석 실행자:     ${uniqueResultUsers}명 (총 ${memberResults.length}건)`);
  console.log(`  배틀 실행자:     ${uniqueBattleUsers}명 (총 ${memberBattles.length}건)`);
  console.log(`  결제자:          ${uniquePayers}명 (총 ${paymentList.length}건, ${totalPaid.toLocaleString()}원)\n`);

  console.log("## 비회원(게스트) 활동");
  console.log(`  게스트 분석:    ${guestResults.length}건 (고유 토큰 ${uniqueGuestResultTokens}개)`);
  console.log(`  게스트 배틀:    ${guestBattles.length}건 (고유 토큰 ${uniqueGuestBattleTokens}개)\n`);

  // 사용자별 요약
  const resultsByUser = new Map<string, number>();
  for (const r of memberResults) resultsByUser.set(r.user_id, (resultsByUser.get(r.user_id) ?? 0) + 1);
  const battlesByUser = new Map<string, number>();
  for (const b of memberBattles) battlesByUser.set(b.user_id, (battlesByUser.get(b.user_id) ?? 0) + 1);
  const paidByUser = new Map<string, number>();
  for (const p of paymentList) paidByUser.set(p.user_id, (paidByUser.get(p.user_id) ?? 0) + (p.amount ?? 0));

  // 코인 타입 요약
  const chargeCount = coinList.filter((c: any) => c.type === "charge").length;
  const spendCount = coinList.filter((c: any) => c.type === "spend").length;
  const bonusCount = coinList.filter((c: any) => c.type === "bonus").length;
  const refundCount = coinList.filter((c: any) => c.type === "refund").length;

  console.log("## 코인 트랜잭션 (누적)");
  console.log(`  충전(charge): ${chargeCount}  사용(spend): ${spendCount}  보너스(bonus): ${bonusCount}  환불(refund): ${refundCount}\n`);

  // 가입자 상세 (최근순)
  console.log("## 가입자 상세 (최근 가입순)");
  console.log("-".repeat(120));
  console.log(
    ["닉네임".padEnd(14), "카카오ID".padEnd(14), "이메일".padEnd(30), "가입일".padEnd(18), "분석", "배틀", "결제(원)", "잔고"]
      .join("  "),
  );
  console.log("-".repeat(120));
  const sortedUsers = [...userList].sort((a: any, b: any) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );
  for (const u of sortedUsers) {
    const nick = (u.nickname ?? "(없음)").toString().padEnd(14);
    const kakao = (u.kakao_id ?? "").toString().slice(0, 12).padEnd(14);
    const email = (u.email ?? "-").toString().padEnd(30);
    const joined = fmt(u.created_at).padEnd(18);
    const rn = (resultsByUser.get(u.id) ?? 0).toString().padStart(4);
    const bn = (battlesByUser.get(u.id) ?? 0).toString().padStart(4);
    const paid = (paidByUser.get(u.id) ?? 0).toLocaleString().padStart(8);
    const bal = (balanceByUser.get(u.id) ?? 0).toString().padStart(4);
    console.log(`  ${nick}  ${kakao}  ${email}  ${joined}  ${rn}  ${bn}  ${paid}  ${bal}`);
  }

  // 결제 상세
  if (paymentList.length > 0) {
    console.log("\n## 실결제 내역 (PAID만)");
    console.log("-".repeat(100));
    for (const p of paymentList.sort((a: any, b: any) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))) {
      const user = userList.find((u: any) => u.id === p.user_id);
      const nick = user?.nickname ?? "(탈퇴?)";
      console.log(`  ${fmt(p.created_at)}  ${nick.padEnd(14)}  ${p.amount.toLocaleString().padStart(8)}원  ${p.order_id}`);
    }
  }

  console.log("\n============================================================");
  console.log("완료");
  console.log("============================================================");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
