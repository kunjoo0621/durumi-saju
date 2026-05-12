/**
 * v12 → v15 누적 영향 — 사용자별 등급 변화 측정.
 * 적용 fix:
 * 1) 자형 false positive 제거 (v13): 진/오/유/해 단일 등장 시 -8점 부당 감점 해소
 * 2) 12신살 SAMHAP_JISAL/MANGSIN 매핑 fix (v14): 위치만 변동, 점수 영향 0~±2
 * 3) 백호살 60갑자 7종 기반 재구현 (v15): 코드만 잡던 사람 +4 회복, 표준만 발동 -4 신규
 * 4) 천을귀인 庚 자평 정통 정정 (v15): ±10
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const FALSE_POS_HYUNG = ["辰", "午", "酉", "亥"];
const STANDARD_BAEKHO = new Set(["戊辰", "丁丑", "丙戌", "乙未", "甲辰", "癸丑", "壬戌"]);
const BAEKHO_TABLE: Record<string, string> = {
  "子": "午", "丑": "未", "寅": "申", "卯": "酉", "辰": "戌", "巳": "亥",
  "午": "子", "未": "丑", "申": "寅", "酉": "卯", "戌": "辰", "亥": "巳",
};
const COMPOSITE_GRADE = (c: number) => c >= 86 ? "S" : c >= 80 ? "A" : c >= 69 ? "B" : c >= 45 ? "C" : "D";

const { data: rows } = await sb
  .from("saju_results")
  .select("saju_text, full_json, name")
  .not("saju_text", "is", null)
  .limit(3000);

let totalCount = 0;
let scoreShifts: { name: string; before: number; after: number; gb: string; ga: string; diff: number }[] = [];

for (const r of rows ?? []) {
  const t = (r as any).saju_text as string;
  const m = t.match(/년주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[^/]+\/\s*월주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[^/]+\/\s*일주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[^/]+\/\s*시주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/);
  if (!m) continue;
  const [, y, mo, d, h] = m;
  const pillars = [y, mo, d, h];
  const branches = pillars.map((p) => p[1]);
  const dayStem = d[0];
  const dayBranch = d[1];

  const composite = (r as any).full_json?.tier?.composite;
  if (typeof composite !== "number") continue;
  totalCount++;

  let scoreDelta = 0;

  // (1) 자형 false positive 제거 — 같은 글자 2개 이상 없는데 진/오/유/해 단일이면 hasHyung false 회복
  const cnt: Record<string, number> = {};
  for (const b of branches) cnt[b] = (cnt[b] ?? 0) + 1;
  const hasFalseHyung = FALSE_POS_HYUNG.some((g) => cnt[g] === 1);
  const hasRealHyung = FALSE_POS_HYUNG.some((g) => (cnt[g] ?? 0) >= 2);
  // 인사신/축술미/자묘 형도 발동되는지 확인
  const otherHyung =
    (branches.includes("寅") || branches.includes("巳") || branches.includes("申")) && [branches.includes("寅"), branches.includes("巳"), branches.includes("申")].filter(Boolean).length >= 2 ||
    (branches.includes("丑") || branches.includes("戌") || branches.includes("未")) && [branches.includes("丑"), branches.includes("戌"), branches.includes("未")].filter(Boolean).length >= 2 ||
    (branches.includes("子") && branches.includes("卯"));
  // hasHyung 변화: false positive만 있고 real hyung·other hyung 없으면 hasHyung true→false
  if (hasFalseHyung && !hasRealHyung && !otherHyung) {
    scoreDelta += 8; // 연애 +2 + 직장 +2 + 건강 +4
  }

  // (2) 12신살 fix는 위치 변동 위주로 점수 변화 거의 없음 (생략)

  // (3) 백호살 fix
  const target = BAEKHO_TABLE[dayBranch];
  const otherBranches = [branches[0], branches[1], branches[3]];
  const codeBaekho = otherBranches.includes(target);
  const stdBaekho = pillars.some((p) => STANDARD_BAEKHO.has(p));
  if (codeBaekho && !stdBaekho) scoreDelta += 4;  // false positive 해소 → 건강운 +4
  if (!codeBaekho && stdBaekho) scoreDelta -= 4;  // 코드가 놓쳤던 진짜 → 건강운 -4

  // (4) 천을귀인 庚 fix (해당 사주만)
  if (dayStem === "庚") {
    const codeTargets = ["寅", "午"];
    const stdTargets = ["丑", "未"];
    const codeChuneul = codeTargets.some((tg) => otherBranches.includes(tg) || branches[2] === tg);
    const stdChuneul = stdTargets.some((tg) => otherBranches.includes(tg) || branches[2] === tg);
    if (codeChuneul && !stdChuneul) scoreDelta -= 10; // 잘못 받던 +10 해소
    if (!codeChuneul && stdChuneul) scoreDelta += 10; // 새로 받게 됨
  }

  // composite 변화 = 카테고리 합산 변화 / 5
  const compositeAfter = composite + scoreDelta / 5;
  const gb = COMPOSITE_GRADE(composite);
  const ga = COMPOSITE_GRADE(compositeAfter);
  scoreShifts.push({ name: (r as any).name ?? "", before: composite, after: compositeAfter, gb, ga, diff: scoreDelta });
}

console.log(`\n분석 대상: ${totalCount}건 (composite 점수 있는 분석)\n`);

const distBefore: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
const distAfter: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
for (const s of scoreShifts) {
  distBefore[s.gb]++;
  distAfter[s.ga]++;
}

console.log("━━━ 등급 분포 변화 (v12 → v15 누적) ━━━");
console.log("등급   v12(이전)         v15(현재)        변화");
for (const g of ["S", "A", "B", "C", "D"]) {
  const b = distBefore[g];
  const a = distAfter[g];
  const bp = (b/totalCount*100).toFixed(1);
  const ap = (a/totalCount*100).toFixed(1);
  const diff = a - b;
  const sign = diff > 0 ? "+" : "";
  console.log(`  ${g}    ${String(b).padStart(3)}건 (${bp.padStart(4)}%)   ${String(a).padStart(3)}건 (${ap.padStart(4)}%)   ${sign}${diff}`);
}

console.log("\n━━━ 점수 변화 분포 ━━━");
const noChange = scoreShifts.filter((s) => s.diff === 0).length;
const upUsers = scoreShifts.filter((s) => s.diff > 0);
const downUsers = scoreShifts.filter((s) => s.diff < 0);
console.log(`변화 없음:   ${noChange}건 (${(noChange/totalCount*100).toFixed(1)}%)`);
console.log(`점수 상승:   ${upUsers.length}건 (${(upUsers.length/totalCount*100).toFixed(1)}%)`);
console.log(`점수 하락:   ${downUsers.length}건 (${(downUsers.length/totalCount*100).toFixed(1)}%)`);

console.log("\n상승 폭 분포:");
const upBuckets: Record<string, number> = {};
for (const u of upUsers) {
  const b = u.diff;
  upBuckets[`+${b}`] = (upBuckets[`+${b}`] ?? 0) + 1;
}
for (const [k, v] of Object.entries(upBuckets).sort((a, b) => parseInt(b[0]) - parseInt(a[0]))) {
  console.log(`  ${k}점:  ${v}건`);
}

console.log("\n하락 폭 분포:");
const downBuckets: Record<string, number> = {};
for (const u of downUsers) {
  const b = u.diff;
  downBuckets[`${b}`] = (downBuckets[`${b}`] ?? 0) + 1;
}
for (const [k, v] of Object.entries(downBuckets).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
  console.log(`  ${k}점:  ${v}건`);
}

console.log("\n━━━ 등급 변동 사용자 ━━━");
const gradeChanges = scoreShifts.filter((s) => s.gb !== s.ga);
console.log(`총 ${gradeChanges.length}건 등급 변동`);
const transitions: Record<string, number> = {};
for (const c of gradeChanges) {
  const k = `${c.gb} → ${c.ga}`;
  transitions[k] = (transitions[k] ?? 0) + 1;
}
for (const [k, v] of Object.entries(transitions).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}  ${v}건`);
}
