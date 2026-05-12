/**
 * 자형 fix 실데이터 영향 측정 — saju_text에서 8글자 파싱
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

const FALSE_POS_TARGETS = ["辰", "午", "酉", "亥"];

const { data: rows } = await sb
  .from("saju_results")
  .select("saju_text, full_json, name, created_at")
  .not("saju_text", "is", null)
  .limit(3000);

const N = (rows ?? []).length;
console.log(`\n분석 대상: ${N}건\n`);

let fpCount = 0; // 잘못된 자형 발동 받은 사용자
let realCount = 0; // 진짜 자형 받은 사용자
let cleanCount = 0;
let displayedJahyung = 0; // saju_text에 자형 글자가 적힌 사용자

const fpDetail: Record<string, number> = {};
const realDetail: Record<string, number> = {};

const composites: number[] = [];
const compositesAfter: number[] = [];
const COMPOSITE_GRADE = (c: number) => c >= 86 ? "S" : c >= 80 ? "A" : c >= 69 ? "B" : c >= 45 ? "C" : "D";
const gradeShifts: Record<string, number> = {};

for (const r of rows ?? []) {
  const t = (r as any).saju_text as string;
  // "년주: 甲子(갑자) / 월주: ..." 패턴에서 한자 두 글자씩 4기둥 추출
  const m = t.match(/년주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[^/]+\/\s*월주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[^/]+\/\s*일주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[^/]+\/\s*시주:\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/);
  if (!m) continue;
  const [, y, mo, d, h] = m;
  const branches = [y[1], mo[1], d[1], h[1]];

  const cnt: Record<string, number> = {};
  for (const b of branches) cnt[b] = (cnt[b] ?? 0) + 1;

  const fps: string[] = [];
  const reals: string[] = [];
  for (const tt of FALSE_POS_TARGETS) {
    const c = cnt[tt] ?? 0;
    if (c >= 2) reals.push(tt);
    else if (c === 1) fps.push(tt);
  }

  if (fps.length > 0) {
    fpCount++;
    for (const tt of fps) fpDetail[tt] = (fpDetail[tt] ?? 0) + 1;
  }
  if (reals.length > 0) {
    realCount++;
    for (const tt of reals) realDetail[tt] = (realDetail[tt] ?? 0) + 1;
  }
  if (fps.length === 0 && reals.length === 0) cleanCount++;

  // saju_text에 "자형" 단어 등장 = 결과 텍스트에 실제 자형이 표시됨
  if (/[辰午酉亥][辰午酉亥]?\s*자형/.test(t) || t.includes("자형")) {
    displayedJahyung++;
  }

  // 등급 시뮬레이션 (false positive 있고 real 없으면 -8 → 0 회복, composite +1.6)
  const composite = (r as any).full_json?.tier?.composite;
  if (typeof composite === "number") {
    composites.push(composite);
    if (fps.length > 0 && reals.length === 0) {
      const after = composite + 1.6;
      compositesAfter.push(after);
      const gb = COMPOSITE_GRADE(composite);
      const ga = COMPOSITE_GRADE(after);
      if (gb !== ga) {
        const k = `${gb} → ${ga}`;
        gradeShifts[k] = (gradeShifts[k] ?? 0) + 1;
      }
    } else {
      compositesAfter.push(composite);
    }
  }
}

console.log("━━━ 자형 false positive 영향 ━━━");
console.log(`자형 false positive (잘못 발동): ${fpCount}건  (${(fpCount/N*100).toFixed(1)}%)`);
console.log(`진짜 자형 (실제 발동):           ${realCount}건  (${(realCount/N*100).toFixed(1)}%)`);
console.log(`자형 영향 없음:                  ${cleanCount}건  (${(cleanCount/N*100).toFixed(1)}%)`);
console.log(`saju_text에 "자형" 단어 등장:    ${displayedJahyung}건  (${(displayedJahyung/N*100).toFixed(1)}%)`);

console.log("\n━━━ 글자별 분포 ━━━");
for (const t of FALSE_POS_TARGETS) {
  const fp = fpDetail[t] ?? 0;
  const real = realDetail[t] ?? 0;
  console.log(`  ${t}  잘못 발동 ${fp.toString().padStart(4)}건 / 진짜 자형 ${real.toString().padStart(3)}건`);
}

console.log("\n━━━ 등급 분포 변화 (composite +1.6 추정, 보수적) ━━━");
const distBefore: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
const distAfter: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
for (const c of composites) distBefore[COMPOSITE_GRADE(c)]++;
for (const c of compositesAfter) distAfter[COMPOSITE_GRADE(c)]++;
const total = composites.length;
console.log(`(점수 데이터 ${total}건 기준)`);
console.log("등급   v12(현재)         v13(예상)        변화");
for (const g of ["S", "A", "B", "C", "D"]) {
  const b = distBefore[g];
  const a = distAfter[g];
  const bp = (b/total*100).toFixed(1);
  const ap = (a/total*100).toFixed(1);
  console.log(`  ${g}    ${String(b).padStart(3)}건 (${bp}%)   ${String(a).padStart(3)}건 (${ap}%)   ${a-b > 0 ? "+" : ""}${a-b}`);
}

console.log("\n━━━ 등급 상승 사용자 ━━━");
let totalUp = 0;
for (const [k, v] of Object.entries(gradeShifts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}  ${v}건`);
  totalUp += v;
}
if (totalUp === 0) console.log("  (없음)");

console.log("\n━━━ 최종 결론 ━━━");
console.log(`전체 ${N}건 중 ${fpCount}건(${(fpCount/N*100).toFixed(1)}%)가 자형 false positive로 부당 감점 받았던 상태.`);
console.log(`재분석 시 이 사용자들의 카테고리 합산 점수 +8, composite 약 +1.6 회복.`);
console.log(`등급 상승 예상 ${totalUp}건.`);
