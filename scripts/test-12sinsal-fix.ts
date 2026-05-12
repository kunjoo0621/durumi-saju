// 신건주 사주 12신살 — 수정 전 vs 수정 후 비교

const STANDARD: Record<string, Record<string, string>> = {
  "해묘미": {
    "申": "겁살", "酉": "재살", "戌": "천살", "亥": "지살",
    "子": "년살(도화)", "丑": "월살", "寅": "망신", "卯": "장성",
    "辰": "반안", "巳": "역마", "午": "육해", "未": "화개",
  },
};

// 신건주: 해묘미 그룹 (년지 亥), 지지 [亥, 午, 未, 申]
const branches = ["亥", "午", "未", "申"];
const positions = ["년지", "월지", "일지", "시지"];
const group = "해묘미";

console.log("=== 신건주 사주 12신살 ===\n");

console.log("표준 알고리즘 기준 (정확):");
for (let i = 0; i < 4; i++) {
  const b = branches[i];
  const sinsal = STANDARD[group][b];
  console.log(`  ${positions[i]}  ${b}  →  ${sinsal}`);
}

console.log("\n버그 상태 (수정 전):");
const BUGGY_SAMHAP_JISAL = "申";    // 잘못된 매핑
const BUGGY_SAMHAP_MANGSIN = "巳";  // 잘못된 매핑
const SAMHAP_GYEOPSAL = "申";
const SAMHAP_YEOKMA = "巳";

const buggyDetected: Array<{ pos: string; branch: string; sinsal: string }> = [];
for (let i = 0; i < 4; i++) {
  const b = branches[i];
  const found: string[] = [];
  if (b === SAMHAP_GYEOPSAL) found.push("겁살");
  if (b === BUGGY_SAMHAP_JISAL) found.push("지살(잘못)");
  if (b === SAMHAP_YEOKMA) found.push("역마");
  if (b === BUGGY_SAMHAP_MANGSIN) found.push("망신(잘못)");
  if (b === "未") found.push("화개"); // SAMHAP_HWAGAE[해묘미]
  if (found.length > 0) {
    found.forEach((s) => buggyDetected.push({ pos: positions[i], branch: b, sinsal: s }));
  }
}
buggyDetected.forEach((d) => console.log(`  ${d.pos}  ${d.branch}  →  ${d.sinsal}`));
console.log(`  (시지 申에 ${buggyDetected.filter(d=>d.pos==="시지").length}개 신살 동시)`);

console.log("\n수정 후 (배포됨):");
const FIXED_SAMHAP_JISAL = "亥";    // 해묘미 → 亥 (생지)
const FIXED_SAMHAP_MANGSIN = "寅";  // 해묘미 → 寅 (록)
const fixedDetected: Array<{ pos: string; branch: string; sinsal: string }> = [];
for (let i = 0; i < 4; i++) {
  const b = branches[i];
  const found: string[] = [];
  if (b === SAMHAP_GYEOPSAL) found.push("겁살");
  if (b === FIXED_SAMHAP_JISAL) found.push("지살");
  if (b === SAMHAP_YEOKMA) found.push("역마");
  if (b === FIXED_SAMHAP_MANGSIN) found.push("망신");
  if (b === "未") found.push("화개");
  if (found.length > 0) {
    found.forEach((s) => fixedDetected.push({ pos: positions[i], branch: b, sinsal: s }));
  }
}
fixedDetected.forEach((d) => console.log(`  ${d.pos}  ${d.branch}  →  ${d.sinsal}`));

console.log("\n=== 차이 ===");
console.log("- 시지 申: 겁살+지살 동시 → 겁살만");
console.log("- 년지 亥: (없음) → 지살 새로 표시");
console.log("- 망신/역마는 신건주 사주에 매핑 글자 없어 미발동 (전후 동일)");
