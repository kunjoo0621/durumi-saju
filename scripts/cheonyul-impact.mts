/**
 * 천을귀인 庚 매핑 — 코드 vs 자평 정통 영향 측정.
 * 코드: 庚 → 寅·午 (이허중)
 * 자평 정통: 庚 → 丑·未
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

const { data: rows } = await sb
  .from("saju_results")
  .select("saju_text")
  .not("saju_text", "is", null)
  .limit(3000);

const N = (rows ?? []).length;
let gyeongDayMaster = 0;     // 일간 庚 사주
let codeChuneulHits = 0;     // 코드(이허중) 발동
let stdChuneulHits = 0;      // 표준(자평) 발동
let codeOnly = 0;
let stdOnly = 0;
let bothMatch = 0;

for (const r of rows ?? []) {
  const t = (r as any).saju_text as string;
  const m = t.match(/년주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[^/]+\/\s*월주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[^/]+\/\s*일주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[^/]+\/\s*시주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/);
  if (!m) continue;
  const [, y, mo, d, h] = m;
  const dayStem = d[0];
  if (dayStem !== "庚") continue;
  gyeongDayMaster++;

  const otherBranches = [y[1], mo[1], h[1]]; // 일지 제외
  const codeTargets = ["寅", "午"];
  const stdTargets = ["丑", "未"];

  const codeFires = codeTargets.some((t) => otherBranches.includes(t));
  const stdFires = stdTargets.some((t) => otherBranches.includes(t));

  if (codeFires) codeChuneulHits++;
  if (stdFires) stdChuneulHits++;
  if (codeFires && stdFires) bothMatch++;
  if (codeFires && !stdFires) codeOnly++;
  if (!codeFires && stdFires) stdOnly++;
}

console.log(`\n전체 ${N}건 중 庚 일간: ${gyeongDayMaster}건 (${(gyeongDayMaster/N*100).toFixed(1)}%)\n`);
console.log("━━━ 천을귀인 庚 매핑 비교 (庚 일간 사주만) ━━━");
console.log(`코드(寅·午) 발동:           ${codeChuneulHits}건`);
console.log(`자평 정통(丑·未) 발동:      ${stdChuneulHits}건`);
console.log(`둘 다 발동(우연 일치):      ${bothMatch}건`);
console.log(`코드만 발동 (이허중 식):    ${codeOnly}건  ← 잘못 표시되던 천을귀인`);
console.log(`표준만 발동 (자평 정통):    ${stdOnly}건  ← 코드가 놓치던 진짜 귀인`);

console.log("\n━━━ 점수 영향 ━━━");
console.log("hasShinsal('천을귀인') → 연애운 +3, 건강운 +2, 대인운 +5 (총 +10)");
console.log(`  코드만 받던 사용자 → -10점: ${codeOnly}건`);
console.log(`  새로 받게 될 사용자 → +10점: ${stdOnly}건`);
console.log(`  순 변동: 庚 일간 ${gyeongDayMaster}명 중 영향 받는 사람 = ${codeOnly + stdOnly}명`);
