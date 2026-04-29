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
  // KAKAOPAY 결제자 user_id 수집
  const { data: payments } = await sb
    .from("payment_transactions")
    .select("user_id, amount, order_id, created_at")
    .eq("method", "KAKAOPAY")
    .order("created_at", { ascending: true });

  const payerIds = [...new Set((payments ?? []).map((p: any) => p.user_id).filter(Boolean))] as string[];

  // 해당 사용자 정보
  const { data: users } = await sb.from("users").select("id, kakao_id, nickname, created_at, primary_result_id");
  const userById = new Map<string, any>();
  for (const u of users ?? []) userById.set(u.id, u);

  // 해당 사용자가 분석한 saju_results
  const { data: results } = await sb
    .from("saju_results")
    .select("id, user_id, name, birth_date, birth_time, region, gender, relationship_status, employment_status, created_at")
    .in("user_id", payerIds)
    .order("created_at", { ascending: false });

  console.log("============================================================");
  console.log("  KAKAOPAY 결제자 식별 (본인 사주 분석 기록으로 역추적)");
  console.log("============================================================\n");

  for (const uid of payerIds) {
    const u = userById.get(uid);
    if (!u) {
      console.log(`\n── user_id=${uid} → users 테이블에 없음 (삭제?) ──`);
      continue;
    }

    const myResults = (results ?? []).filter((r: any) => r.user_id === uid);
    const myPayments = (payments ?? []).filter((p: any) => p.user_id === uid);
    const paidTotal = myPayments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);

    console.log(`\n──────────────────────────────────────────────────────`);
    console.log(`카카오ID: ${u.kakao_id}`);
    console.log(`닉네임:   ${u.nickname ?? "(없음)"}`);
    console.log(`가입일:   ${fmt(u.created_at)}`);
    console.log(`결제:     ${myPayments.length}건 / ${paidTotal.toLocaleString()}원`);

    if (u.primary_result_id) {
      const primary = myResults.find((r: any) => r.id === u.primary_result_id);
      if (primary) {
        console.log(`대표 사주: ${primary.name} | ${primary.birth_date} ${primary.birth_time ?? ""} | ${primary.gender} | ${primary.region}`);
      }
    }

    if (myResults.length > 0) {
      console.log(`\n분석한 사주 ${myResults.length}건:`);
      for (const r of myResults) {
        const isPrimary = r.id === u.primary_result_id ? "★" : " ";
        console.log(
          `  ${isPrimary} ${fmt(r.created_at)}  ${(r.name ?? "?").padEnd(6)}  ${r.birth_date ?? "?"}  ${(r.birth_time ?? "모름").padEnd(8)}  ${r.gender ?? "?"}  ${r.region ?? "?"}  [${r.relationship_status ?? "?"}/${r.employment_status ?? "?"}]`,
        );
      }
    } else {
      console.log(`\n분석한 사주 없음 (결제만 하고 분석 안 함?)`);
    }
  }

  // user_id null인 결제 건들도 보기 — order_id로 saju_results 교차
  console.log("\n\n============================================================");
  console.log("  user_id=null 결제 건 (order_id로 saju_results 조회)");
  console.log("============================================================\n");

  const nullPayments = (payments ?? []).filter((p: any) => !p.user_id);
  if (nullPayments.length > 0) {
    const orderIds = nullPayments.map((p: any) => p.order_id);
    const { data: orphanResults } = await sb
      .from("saju_results")
      .select("order_id, name, birth_date, gender, region, created_at")
      .in("order_id", orderIds);

    const byOrder = new Map<string, any>();
    for (const r of orphanResults ?? []) byOrder.set(r.order_id, r);

    for (const p of nullPayments) {
      const r = byOrder.get(p.order_id);
      if (r) {
        console.log(`  ${fmt(p.created_at)}  ${p.amount.toLocaleString().padStart(5)}원  → ${r.name} | ${r.birth_date} | ${r.gender} | ${r.region}`);
      } else {
        console.log(`  ${fmt(p.created_at)}  ${p.amount.toLocaleString().padStart(5)}원  → 사주 결과 없음 (${p.order_id.slice(0, 12)}...)`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
