/**
 * 등급별 재결제율 v3 — 결제↔분석 정확 매칭
 *
 * 매칭 규칙: payment.created_at 이후 2분 이내, 같은 user_id의 첫 saju_results
 * 흐름: payment → coin charge → spend → saju_results (1~5초 간격)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL!, envVars.SUPABASE_SERVICE_ROLE_KEY!);

// 운영자(신건주) 본인 user_id 식별 → 제외
const { data: operatorRows } = await sb
  .from("users")
  .select("id, nickname, name, kakao_id")
  .or("name.eq.신건주,nickname.eq.신건주");
const excludeUserIds = new Set((operatorRows ?? []).map((u: any) => u.id));

// saju_results.name == "신건주" 인 row의 user_id도 추가
const { data: ownerResults } = await sb
  .from("saju_results")
  .select("user_id")
  .eq("name", "신건주");
for (const r of ownerResults ?? []) if (r.user_id) excludeUserIds.add(r.user_id);

console.log(`운영자 본인 user_id 제외: ${excludeUserIds.size}개\n`);

const { data: allPayments } = await sb
  .from("payment_transactions")
  .select("id, order_id, user_id, amount, created_at")
  .eq("method", "KAKAOPAY")
  .eq("status", "success")
  .order("created_at", { ascending: true });
const payments = (allPayments ?? []).filter((p: any) => !excludeUserIds.has(p.user_id));
console.log(`전체 ${allPayments?.length}건 → 운영자 제외 ${payments.length}건\n`);

const userIds = [...new Set((payments ?? []).map((p: any) => p.user_id).filter(Boolean))];

// 한 번에 user 별 results
const allResults: any[] = [];
const CHUNK = 100;
for (let i = 0; i < userIds.length; i += CHUNK) {
  const chunk = userIds.slice(i, i + CHUNK);
  const { data } = await sb
    .from("saju_results")
    .select("id, user_id, name, created_at, full_json")
    .in("user_id", chunk)
    .not("full_json", "is", null)
    .order("created_at", { ascending: true });
  allResults.push(...(data ?? []));
}

const resultsByUser = new Map<string, any[]>();
for (const r of allResults) {
  const arr = resultsByUser.get(r.user_id) ?? [];
  arr.push(r);
  resultsByUser.set(r.user_id, arr);
}

const extractGrade = (fj: any): string | null => fj?.tier?.grade ?? fj?.grade ?? null;

// 매칭 전략 (계층):
// (a) payment 후 ±5분 이내 같은 user의 saju_results → 가장 가까운 것 (한 결제로 새 분석한 케이스)
// (b) 없으면 → 그 사용자의 모든 saju_results 중 결제 시점에 시간상 가장 가까운 것
//     (같은 사주를 다시 보거나 추가 충전한 케이스. 같은 result가 여러 결제에 multi-map 허용)
const WINDOW_MS = 5 * 60 * 1000;

type Tagged = { payment: any; result: any | null; grade: string | null; matchType: string };
const taggedPayments: Tagged[] = [];

const usedResultIds = new Set<string>();

for (const p of payments ?? []) {
  if (!p.user_id) {
    taggedPayments.push({ payment: p, result: null, grade: null, matchType: "no_user" });
    continue;
  }
  const userResults = resultsByUser.get(p.user_id) ?? [];
  if (userResults.length === 0) {
    taggedPayments.push({ payment: p, result: null, grade: null, matchType: "no_results" });
    continue;
  }
  const pTime = new Date(p.created_at).getTime();

  // (a) 결제 후 5분 이내 미사용 첫 result
  let match: any = null;
  let matchType = "fallback_nearest";
  for (const r of userResults) {
    const rTime = new Date(r.created_at).getTime();
    if (rTime < pTime) continue;
    if (rTime > pTime + WINDOW_MS) break;
    if (usedResultIds.has(r.id)) continue;
    match = r;
    matchType = "fresh_analysis";
    break;
  }

  // (b) fallback: 시간 차 절대값 최소 (multi-map 허용)
  if (!match) {
    let minDiff = Infinity;
    for (const r of userResults) {
      const diff = Math.abs(new Date(r.created_at).getTime() - pTime);
      if (diff < minDiff) {
        minDiff = diff;
        match = r;
      }
    }
  }

  if (match && matchType === "fresh_analysis") usedResultIds.add(match.id);
  taggedPayments.push({ payment: p, result: match, grade: extractGrade(match?.full_json), matchType });
}

const matchTypeCount = new Map<string, number>();
for (const t of taggedPayments) matchTypeCount.set(t.matchType, (matchTypeCount.get(t.matchType) ?? 0) + 1);
console.log("매칭 타입 분포:", [...matchTypeCount.entries()].map(([k, v]) => `${k}=${v}`).join(", "));

const matched = taggedPayments.filter(t => t.result).length;
console.log(`총 결제: ${taggedPayments.length}건, 분석 매칭: ${matched}건 (${(matched / taggedPayments.length * 100).toFixed(1)}%)\n`);

// 사용자별 결제 순서 부여
const byUser = new Map<string, Tagged[]>();
for (const t of taggedPayments) {
  if (!t.payment.user_id) continue;
  const arr = byUser.get(t.payment.user_id) ?? [];
  arr.push(t);
  byUser.set(t.payment.user_id, arr);
}

const grades = ["S", "A", "B", "C", "D"];

// View A: 첫 결제 등급 기준 재결제율
const firstPayerByGrade: Record<string, number> = Object.fromEntries(grades.map(g => [g, 0]));
const repurchaserByGrade: Record<string, number> = Object.fromEntries(grades.map(g => [g, 0]));

// View B: 결제 시점 등급 분포 (첫결제 vs 재결제)
const firstPayGradeDist: Record<string, number> = Object.fromEntries(grades.map(g => [g, 0]));
const repurchaseGradeDist: Record<string, number> = Object.fromEntries(grades.map(g => [g, 0]));

let unknownFirst = 0;
let unknownRepurchase = 0;

const repurchaseDetails: string[] = [];

for (const [uid, payArr] of byUser) {
  const first = payArr[0];
  if (first.grade && grades.includes(first.grade)) {
    firstPayerByGrade[first.grade]++;
    firstPayGradeDist[first.grade]++;
    if (payArr.length >= 2) repurchaserByGrade[first.grade]++;
  } else {
    unknownFirst++;
  }
  for (let i = 1; i < payArr.length; i++) {
    const t = payArr[i];
    if (t.grade && grades.includes(t.grade)) {
      repurchaseGradeDist[t.grade]++;
      repurchaseDetails.push(`  ${t.payment.created_at.slice(0, 16)}  ${t.grade}  ${t.result?.name ?? "?"}  ${t.payment.amount}원`);
    } else {
      unknownRepurchase++;
      repurchaseDetails.push(`  ${t.payment.created_at.slice(0, 16)}  ??  ?  ${t.payment.amount}원`);
    }
  }
}

// 출력
console.log("## View A — 첫 결제 시점 등급 기준 재결제율\n");
console.log("  등급 | 첫결제자 | 재결제자 | 재결제율");
console.log("  -----|----------|----------|---------");
for (const g of grades) {
  const total = firstPayerByGrade[g];
  const repeat = repurchaserByGrade[g];
  const rate = total > 0 ? (repeat / total * 100).toFixed(1) : "-";
  console.log(`  ${g.padEnd(4)} |   ${String(total).padStart(4)}   |   ${String(repeat).padStart(4)}   |  ${rate}%`);
}
const tF = Object.values(firstPayerByGrade).reduce((a, b) => a + b, 0);
const tR = Object.values(repurchaserByGrade).reduce((a, b) => a + b, 0);
console.log(`  전체 |   ${String(tF).padStart(4)}   |   ${String(tR).padStart(4)}   |  ${tF ? (tR / tF * 100).toFixed(1) : "-"}%`);
console.log(`  (unknown: ${unknownFirst}명)`);

console.log("\n## View B — 결제 시점 등급 분포 (첫결제 vs 재결제 trigger)\n");
console.log("  등급 | 첫결제 분포        | 재결제 분포        | lift");
console.log("  -----|---------------------|---------------------|------");
const firstTotal = Object.values(firstPayGradeDist).reduce((a, b) => a + b, 0);
const repTotal = Object.values(repurchaseGradeDist).reduce((a, b) => a + b, 0);
for (const g of grades) {
  const fPct = firstTotal > 0 ? (firstPayGradeDist[g] / firstTotal * 100) : 0;
  const rPct = repTotal > 0 ? (repurchaseGradeDist[g] / repTotal * 100) : 0;
  const lift = fPct > 0 ? ((rPct - fPct) / fPct * 100).toFixed(0) + "%" : "-";
  console.log(`  ${g.padEnd(4)} | ${String(firstPayGradeDist[g]).padStart(2)}건 ${fPct.toFixed(1).padStart(5)}%    | ${String(repurchaseGradeDist[g]).padStart(2)}건 ${rPct.toFixed(1).padStart(5)}%    |  ${lift}`);
}
console.log(`  (unknown: ${unknownRepurchase}건)`);

console.log(`\n## 재결제 ${repurchaseDetails.length}건 raw (시점/등급/이름/금액)`);
console.log(repurchaseDetails.join("\n"));
