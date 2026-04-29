import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const D7 = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  // user_id별 분석 건수 집계
  const { data: results } = await sb
    .from("saju_results")
    .select("user_id, name, birth_date, created_at")
    .gte("created_at", D7)
    .not("user_id", "is", null);

  const byUser = new Map<string, { count: number; names: string[]; firstAt: string }>();
  for (const r of results ?? []) {
    const u = r.user_id!;
    const prev = byUser.get(u) ?? { count: 0, names: [], firstAt: r.created_at };
    prev.count += 1;
    prev.names.push(`${r.name}(${r.birth_date?.slice(0, 4)})`);
    if (r.created_at < prev.firstAt) prev.firstAt = r.created_at;
    byUser.set(u, prev);
  }

  // 닉네임 lookup
  const userIds = [...byUser.keys()];
  const { data: users } = await sb.from("users").select("id, nickname, kakao_id").in("id", userIds);
  const nickMap = new Map((users ?? []).map((u) => [u.id, u]));

  // 결제 lookup
  const { data: payments } = await sb
    .from("payment_transactions")
    .select("user_id, amount, method, status")
    .gte("created_at", D7)
    .eq("status", "success")
    .eq("method", "KAKAOPAY");
  const paidByUser = new Map<string, number>();
  for (const p of payments ?? []) {
    if (p.user_id) paidByUser.set(p.user_id, (paidByUser.get(p.user_id) ?? 0) + (p.amount ?? 0));
  }

  console.log("\n=== 분석 건수별 사용자 (7일) ===\n");
  console.log("count  결제(원)   닉네임           분석 대상");
  console.log("─".repeat(90));
  const sorted = [...byUser.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [uid, info] of sorted) {
    const u = nickMap.get(uid);
    const nick = u?.nickname ?? "(없음)";
    const paid = paidByUser.get(uid) ?? 0;
    console.log(
      `  ${String(info.count).padStart(2)}건  ${String(paid).padStart(6).toLocaleString()}   ${nick.padEnd(14)}  ${info.names.join(", ")}`,
    );
  }

  // 다중 분석한 사람만 필터
  console.log("\n=== 2건 이상 분석한 사용자 (결제 매칭) ===\n");
  const multi = sorted.filter(([_, v]) => v.count >= 2);
  for (const [uid, info] of multi) {
    const u = nickMap.get(uid);
    const nick = u?.nickname ?? "(없음)";
    const paid = paidByUser.get(uid) ?? 0;
    const expectedCost = (info.count - 1) * 10; // 첫 1건은 가입 보너스, 나머지는 10알/1000원
    console.log(`닉네임: ${nick} (kakao=${u?.kakao_id})`);
    console.log(`  분석 ${info.count}건: ${info.names.join(", ")}`);
    console.log(`  실결제: ${paid.toLocaleString()}원`);
    console.log(`  필요 결제(추정): ${expectedCost * 100}원 (보너스 10알 제외 시)`);
    console.log("");
  }

  // 04-19 이우진 케이스도 별도로
  console.log("\n=== 04-19 데이터 검증 ===\n");
  const { data: oldResults } = await sb
    .from("saju_results")
    .select("user_id, name, birth_date, created_at")
    .gte("created_at", "2026-04-19")
    .lte("created_at", "2026-04-20")
    .not("user_id", "is", null);
  console.log(`04-19 분석: ${oldResults?.length ?? 0}건`);
  const userIdsOld = [...new Set((oldResults ?? []).map((r) => r.user_id))];
  for (const uid of userIdsOld) {
    const u = nickMap.get(uid as string);
    const cnt = oldResults?.filter((r) => r.user_id === uid).length ?? 0;
    const paid = paidByUser.get(uid as string) ?? 0;
    console.log(`  ${u?.nickname ?? "(없음)"} [kakao=${u?.kakao_id}]: ${cnt}건 / 결제 ${paid.toLocaleString()}원`);
  }
}
main();
