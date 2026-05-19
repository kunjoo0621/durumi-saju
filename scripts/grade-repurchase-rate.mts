/**
 * 등급별 재결제율 분석
 * - 첫 결제 시점 등급 기준 재결제율 (그 등급으로 결제한 사람 중 다시 결제한 비율)
 * - 결제 시점별 등급 분포 (첫결제 vs 재결제 trigger 등급 비교)
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

// 1. KAKAOPAY 결제
const { data: payments, error: pErr } = await sb
  .from("payment_transactions")
  .select("id, user_id, amount, status, created_at")
  .eq("method", "KAKAOPAY")
  .order("created_at", { ascending: true });

if (pErr) { console.error(pErr); process.exit(1); }

// status 분포 확인
const statusSet = new Set((payments ?? []).map((p: any) => p.status));
console.log(`payment status 종류: ${[...statusSet].join(", ")}`);
console.log(`총 KAKAOPAY 결제 row: ${(payments ?? []).length}\n`);

// 성공한 결제만
const paid = (payments ?? []).filter((p: any) =>
  ["paid", "success", "PAID", "SUCCESS", "completed", "COMPLETED"].includes(p.status)
);
console.log(`성공 결제만: ${paid.length}건\n`);

// 2. 사용자별 결제 그룹화
const byUser = new Map<string, any[]>();
for (const p of paid) {
  if (!p.user_id) continue;
  const arr = byUser.get(p.user_id) ?? [];
  arr.push(p);
  byUser.set(p.user_id, arr);
}

console.log(`결제한 unique 사용자: ${byUser.size}명`);
const repeatUsers = [...byUser.values()].filter(arr => arr.length >= 2);
console.log(`재결제(2건+) 사용자: ${repeatUsers.length}명\n`);

// 3. saju_results 가져오기 (해당 user_ids만, 메모리 절약)
const userIds = [...byUser.keys()];
const allResults: any[] = [];
// IN 절 길이 제한 대비 chunk
const CHUNK = 100;
for (let i = 0; i < userIds.length; i += CHUNK) {
  const chunk = userIds.slice(i, i + CHUNK);
  const { data, error } = await sb
    .from("saju_results")
    .select("user_id, created_at, full_json")
    .in("user_id", chunk)
    .not("full_json", "is", null)
    .order("created_at", { ascending: true });
  if (error) { console.error(error); process.exit(1); }
  allResults.push(...(data ?? []));
}
console.log(`해당 사용자들의 saju_results: ${allResults.length}건\n`);

// 첫 row로 full_json 구조 검사
if (allResults.length > 0) {
  const fj = allResults[0].full_json;
  console.log("=== full_json 등급 후보 ===");
  const candidates = [
    "grade", "tier", "tier.grade", "scoring.grade",
    "serverScoring.grade", "scoringResult.grade",
    "result.grade", "rank", "letterGrade"
  ];
  for (const path of candidates) {
    const parts = path.split(".");
    let cur: any = fj;
    for (const p of parts) cur = cur?.[p];
    if (cur !== undefined) console.log(`  ${path} = ${typeof cur === "object" ? JSON.stringify(cur).slice(0, 100) : cur}`);
  }
  // 최상위 키만
  console.log("\n=== full_json 최상위 키 ===");
  console.log(Object.keys(fj).join(", "));
}

// 4. 등급 추출 — 여러 후보 시도
function extractGrade(fj: any): string | null {
  if (!fj) return null;
  return (
    fj.grade ??
    fj.tier?.grade ??
    fj.tier ??
    fj.scoring?.grade ??
    fj.serverScoring?.grade ??
    fj.scoringResult?.grade ??
    fj.result?.grade ??
    fj.rank ??
    fj.letterGrade ??
    null
  );
}

// 5. 사용자별 결과 그룹화 (시간순)
const resultsByUser = new Map<string, any[]>();
for (const r of allResults) {
  const arr = resultsByUser.get(r.user_id) ?? [];
  arr.push(r);
  resultsByUser.set(r.user_id, arr);
}

// 6. 각 결제 시점에 그 직전 가장 최근 result 찾기
function gradeAtPayment(uid: string, pTime: number): string | null {
  const arr = resultsByUser.get(uid) ?? [];
  let latest: any = null;
  for (const r of arr) {
    if (new Date(r.created_at).getTime() <= pTime) latest = r;
    else break;
  }
  return extractGrade(latest?.full_json);
}

const grades = ["S", "A", "B", "C", "D"];

// 첫 결제 시점 등급 기준 재결제율
const firstPayerByGrade: Record<string, number> = {};
const repurchaserByGrade: Record<string, number> = {};

// 모든 결제 시점 등급 분포 (첫결제 vs 재결제 trigger)
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

for (const [uid, userPayments] of byUser) {
  // 첫 결제 시점 등급
  const firstP = userPayments[0];
  const firstGrade = gradeAtPayment(uid, new Date(firstP.created_at).getTime());

  if (firstGrade && grades.includes(firstGrade)) {
    firstPayerByGrade[firstGrade]++;
    firstPayGradeDist[firstGrade]++;
    if (userPayments.length >= 2) repurchaserByGrade[firstGrade]++;
  } else {
    unknownFirst++;
  }

  // 2번째+ 결제 시점 등급
  for (let i = 1; i < userPayments.length; i++) {
    const p = userPayments[i];
    const g = gradeAtPayment(uid, new Date(p.created_at).getTime());
    if (g && grades.includes(g)) {
      repurchaseGradeDist[g]++;
    } else {
      unknownRepurchase++;
    }
  }
}

// 출력
console.log("\n## 등급별 재결제율 (첫 결제 시점 등급 기준)\n");
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
const overallRate = totalFirst > 0 ? (totalRepeat / totalFirst * 100).toFixed(1) : "-";
console.log(`  전체 |   ${String(totalFirst).padStart(4)}   |   ${String(totalRepeat).padStart(4)}   |  ${overallRate}%`);
console.log(`  (등급 unknown: ${unknownFirst}명)`);

console.log("\n## 결제 시점 등급 분포 비교 (첫결제 vs 재결제)\n");
console.log("  등급 | 첫결제 분포 | 재결제 분포 | 재결제 lift");
console.log("  -----|-------------|-------------|------------");
const firstTotal = Object.values(firstPayGradeDist).reduce((a, b) => a + b, 0);
const repTotal = Object.values(repurchaseGradeDist).reduce((a, b) => a + b, 0);
for (const g of grades) {
  const fPct = firstTotal > 0 ? (firstPayGradeDist[g] / firstTotal * 100) : 0;
  const rPct = repTotal > 0 ? (repurchaseGradeDist[g] / repTotal * 100) : 0;
  const lift = fPct > 0 ? ((rPct - fPct) / fPct * 100).toFixed(0) + "%" : "-";
  console.log(`  ${g.padEnd(4)} | ${firstPayGradeDist[g]}건 ${fPct.toFixed(1).padStart(5)}% | ${repurchaseGradeDist[g]}건 ${rPct.toFixed(1).padStart(5)}% |  ${lift.padStart(6)}`);
}
console.log(`  (재결제 시점 등급 unknown: ${unknownRepurchase}건)`);
