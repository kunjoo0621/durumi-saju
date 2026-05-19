/**
 * 등급별 재결제율 분석 v2
 * - payment_transactions.order_id ↔ saju_results.order_id 로 정확 매칭
 * - 한 사용자가 가족 사주 여러 개 분석한 경우도 정확히 그 결제에 연결된 분석만 사용
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

// 1. 성공 결제
const { data: payments } = await sb
  .from("payment_transactions")
  .select("id, order_id, user_id, amount, status, created_at")
  .eq("method", "KAKAOPAY")
  .eq("status", "success")
  .order("created_at", { ascending: true });

console.log(`성공 결제: ${payments?.length}건`);
const noOrderId = (payments ?? []).filter((p: any) => !p.order_id).length;
console.log(`그중 order_id 없음: ${noOrderId}건\n`);

// 2. 결제 order_id 들에 해당하는 saju_results 통째로 가져오기
const orderIds = (payments ?? []).map((p: any) => p.order_id).filter(Boolean);
const { data: results } = await sb
  .from("saju_results")
  .select("id, order_id, user_id, name, created_at, unlocked_at, full_json")
  .in("order_id", orderIds)
  .not("full_json", "is", null);

console.log(`order_id로 매칭된 saju_results: ${results?.length}건`);
console.log(`결제수 ${payments?.length} 대비 매칭률: ${((results?.length ?? 0) / (payments?.length ?? 1) * 100).toFixed(1)}%\n`);

// order_id → result 맵
const resultByOrderId = new Map<string, any>();
for (const r of results ?? []) {
  // 한 order_id에 여러 row 가능? — 확인
  if (resultByOrderId.has(r.order_id)) {
    console.warn(`  ⚠ order_id 중복: ${r.order_id} (n=${r.name})`);
  }
  resultByOrderId.set(r.order_id, r);
}

function extractGrade(fj: any): string | null {
  if (!fj) return null;
  return fj.tier?.grade ?? fj.grade ?? null;
}

// 3. 각 결제에 등급 부여 + 사용자별 결제 순서
const byUser = new Map<string, Array<{ payment: any; grade: string | null; resultName: string | null }>>();
let unmatched = 0;
for (const p of payments ?? []) {
  if (!p.user_id) continue;
  const r = p.order_id ? resultByOrderId.get(p.order_id) : null;
  const grade = extractGrade(r?.full_json);
  if (!r) unmatched++;
  const arr = byUser.get(p.user_id) ?? [];
  arr.push({ payment: p, grade, resultName: r?.name ?? null });
  byUser.set(p.user_id, arr);
}
console.log(`결제 중 saju_result 매칭 실패: ${unmatched}건\n`);

console.log(`결제한 unique 사용자: ${byUser.size}명`);
const repeatUserCount = [...byUser.values()].filter(arr => arr.length >= 2).length;
console.log(`재결제(2건+) 사용자: ${repeatUserCount}명\n`);

// 4. 분석
const grades = ["S", "A", "B", "C", "D"];

// View A: 첫 결제 등급 → 재결제율
const firstPayerByGrade: Record<string, number> = {};
const repurchaserByGrade: Record<string, number> = {};

// View B: 결제 시점 등급 분포 (첫결제 vs 재결제)
const firstPayGradeDist: Record<string, number> = {};
const repurchaseGradeDist: Record<string, number> = {};

for (const g of grades) {
  firstPayerByGrade[g] = 0;
  repurchaserByGrade[g] = 0;
  firstPayGradeDist[g] = 0;
  repurchaseGradeDist[g] = 0;
}

let unknownFirst = 0;
let unknownRepurchase = 0;

// 재결제 trigger 등급 raw 로그 (사용자 확인용)
const repurchaseRawList: string[] = [];

for (const [uid, paymentsArr] of byUser) {
  const first = paymentsArr[0];
  if (first.grade && grades.includes(first.grade)) {
    firstPayerByGrade[first.grade]++;
    firstPayGradeDist[first.grade]++;
    if (paymentsArr.length >= 2) repurchaserByGrade[first.grade]++;
  } else {
    unknownFirst++;
  }

  for (let i = 1; i < paymentsArr.length; i++) {
    const p = paymentsArr[i];
    if (p.grade && grades.includes(p.grade)) {
      repurchaseGradeDist[p.grade]++;
      repurchaseRawList.push(`  ${p.payment.created_at.slice(0, 10)}  ${p.grade}등급  ${p.resultName ?? "?"}  ${p.payment.amount}원`);
    } else {
      unknownRepurchase++;
      repurchaseRawList.push(`  ${p.payment.created_at.slice(0, 10)}  ??등급  ${p.resultName ?? "?(매칭실패)"}  ${p.payment.amount}원`);
    }
  }
}

// 출력
console.log("## View A — 첫 결제 등급 기준 재결제율\n");
console.log("  등급 | 첫결제자 | 재결제자 | 재결제율");
console.log("  -----|----------|----------|---------");
for (const g of grades) {
  const total = firstPayerByGrade[g];
  const repeat = repurchaserByGrade[g];
  const rate = total > 0 ? (repeat / total * 100).toFixed(1) : "-";
  console.log(`  ${g.padEnd(4)} |   ${String(total).padStart(4)}   |   ${String(repeat).padStart(4)}   |  ${rate}%`);
}
const totalFirst = Object.values(firstPayerByGrade).reduce((a, b) => a + b, 0);
const totalRepeat = Object.values(repurchaserByGrade).reduce((a, b) => a + b, 0);
console.log(`  전체 |   ${String(totalFirst).padStart(4)}   |   ${String(totalRepeat).padStart(4)}   |  ${(totalRepeat / totalFirst * 100).toFixed(1)}%`);
console.log(`  (첫결제 grade unknown: ${unknownFirst}명)`);

console.log("\n## View B — 결제 시점 등급 분포 (첫결제 vs 재결제 trigger)\n");
console.log("  등급 | 첫결제 분포       | 재결제 분포       | lift");
console.log("  -----|--------------------|--------------------|------");
const firstTotal = Object.values(firstPayGradeDist).reduce((a, b) => a + b, 0);
const repTotal = Object.values(repurchaseGradeDist).reduce((a, b) => a + b, 0);
for (const g of grades) {
  const fPct = firstTotal > 0 ? (firstPayGradeDist[g] / firstTotal * 100) : 0;
  const rPct = repTotal > 0 ? (repurchaseGradeDist[g] / repTotal * 100) : 0;
  const lift = fPct > 0 ? ((rPct - fPct) / fPct * 100).toFixed(0) + "%" : "-";
  console.log(`  ${g.padEnd(4)} | ${String(firstPayGradeDist[g]).padStart(2)}건 ${fPct.toFixed(1).padStart(5)}%   | ${String(repurchaseGradeDist[g]).padStart(2)}건 ${rPct.toFixed(1).padStart(5)}%   |  ${lift}`);
}
console.log(`  (재결제 grade unknown: ${unknownRepurchase}건)`);

console.log(`\n## 재결제 raw 목록 (${repurchaseRawList.length}건)\n`);
console.log(repurchaseRawList.join("\n"));
