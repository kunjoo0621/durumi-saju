/**
 * 백호살 코드 vs 표준 — 실데이터 영향 측정.
 * 코드: BAEKHO_TABLE = 일지의 충 글자가 다른 자리에 있으면 발동
 * 표준: 7종 일주(戊辰·丁丑·丙戌·乙未·甲辰·癸丑·壬戌)일 때만 발동
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

const STANDARD_BAEKHO = new Set(["戊辰", "丁丑", "丙戌", "乙未", "甲辰", "癸丑", "壬戌"]);
const BAEKHO_TABLE: Record<string, string> = {
  "子": "午", "丑": "未", "寅": "申", "卯": "酉", "辰": "戌", "巳": "亥",
  "午": "子", "未": "丑", "申": "寅", "酉": "卯", "戌": "辰", "亥": "巳",
};

const { data: rows } = await sb
  .from("saju_results")
  .select("saju_text, name")
  .not("saju_text", "is", null)
  .limit(3000);

const N = (rows ?? []).length;
console.log(`\n분석 대상: ${N}건\n`);

let codeFp = 0;       // 현재 코드가 잡는 백호 (일지 충 발견)
let standardYes = 0;  // 표준 7종 일주에 해당
let bothMatch = 0;    // 둘 다 발동
let onlyCode = 0;     // 코드만 발동 (false positive)
let onlyStd = 0;      // 표준만 발동 (현재 코드가 놓침 — 다른 자리 백호)

const standardDayOnly: string[] = [];
const standardOtherPillar: string[] = [];

for (const r of rows ?? []) {
  const t = (r as any).saju_text as string;
  const m = t.match(/년주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[^/]+\/\s*월주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[^/]+\/\s*일주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[^/]+\/\s*시주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/);
  if (!m) continue;
  const [, y, mo, d, h] = m;
  const pillars = [y, mo, d, h];
  const branches = pillars.map((p) => p[1]);

  // 코드: 일지의 충 글자가 다른 자리 (year/month/hour)에 있으면 발동
  const dayBranch = branches[2];
  const target = BAEKHO_TABLE[dayBranch];
  const otherBranches = [branches[0], branches[1], branches[3]];
  const codeFires = otherBranches.includes(target);

  // 표준: 7종 일주 중 하나가 4기둥 어디에라도 있으면 발동
  const stdMatchedPillars = pillars.filter((p) => STANDARD_BAEKHO.has(p));
  const stdFires = stdMatchedPillars.length > 0;
  const stdDayOnly = stdMatchedPillars.includes(pillars[2]);

  if (codeFires) codeFp++;
  if (stdFires) {
    standardYes++;
    if (stdDayOnly) standardDayOnly.push(pillars[2]);
    else standardOtherPillar.push(stdMatchedPillars.join(","));
  }
  if (codeFires && stdFires) bothMatch++;
  if (codeFires && !stdFires) onlyCode++;
  if (!codeFires && stdFires) onlyStd++;
}

console.log("━━━ 백호살 코드 vs 표준 비교 ━━━");
console.log(`코드 발동 (현재 시스템):           ${codeFp}건  (${(codeFp/N*100).toFixed(1)}%)`);
console.log(`표준(7종 일주) 발동:                ${standardYes}건  (${(standardYes/N*100).toFixed(1)}%)`);
console.log(`  - 일주에 백호:                    ${standardDayOnly.length}건`);
console.log(`  - 다른 기둥에 백호:                ${standardOtherPillar.length}건`);
console.log();
console.log(`둘 다 발동(우연 일치):              ${bothMatch}건`);
console.log(`코드만 발동 (false positive):       ${onlyCode}건  ← 잘못 표시됨`);
console.log(`표준만 발동 (코드가 놓친 진짜):     ${onlyStd}건  ← 현재 코드가 안 잡음`);

console.log("\n━━━ 코드를 표준으로 수정 시 변화 ━━━");
console.log(`백호살 표시 사라지는 사용자: ${onlyCode}건 (잘못 표시되던 것 정정)`);
console.log(`백호살 표시 새로 생기는 사용자: ${onlyStd}건 (놓치던 진짜 백호 회복)`);
console.log(`그대로인 사용자: ${N - onlyCode - onlyStd}건`);

console.log("\n━━━ 점수 영향 ━━━");
console.log("hasShinsal('백호') → 건강운 -4점 분기");
console.log(`  현재 -4 받던 사용자 → 점수 회복: ${onlyCode}건  (+4)`);
console.log(`  현재 못 받던 백호 → 새로 -4: ${onlyStd}건  (-4)`);
console.log(`  순 변동: ${onlyCode - onlyStd}건 점수 상승, ${onlyStd}건 점수 하락 가능성`);
