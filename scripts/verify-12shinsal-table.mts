/**
 * 12신살 조견표 기계 대조 — 엔진 상수(getPillar12Shinsal) vs 사주사전(lib/dict/data/sipisinsal/).
 *
 * 왜: 매거진 12신살 글이 실을 조견표가 엔진·사전 어느 쪽과도 어긋나면
 *     독자가 결과 화면을 열었을 때 글과 다른 별이 찍힌다.
 *     48셀(4 삼합그룹 × 12신살)을 사람 눈이 아니라 기계로 대조한다.
 *
 * 역검증: --inject 로 엔진 쪽 한 셀을 일부러 틀리게 만들어 FAIL 이 나오는지 확인한다.
 *         (검사기 ✓ 는 그 자체로 증거가 아니다)
 *
 * 실행: npx tsx scripts/_verify-12shinsal-table.mts [--inject]
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const INJECT = process.argv.includes("--inject");

// ── 엔진 상수 사본 (lib/utils/saju-enrichment.ts) ──
const BRANCHES_SEQ_SHINSAL = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const TWELVE_SHINSAL_NAMES = [
  "겁살", "재살", "천살", "지살", "년살", "월살",
  "망신살", "장성살", "반안살", "역마살", "육해살", "화개살",
];
const GEOBSAL_START: Record<string, number> = {
  "인오술": 11, // 亥
  "사유축": 2,  // 寅
  "신자진": 5,  // 巳
  "해묘미": 8,  // 申
};
const GROUPS = ["신자진", "사유축", "인오술", "해묘미"];

/** 엔진 로직 그대로: 그룹 + 신살명 → 해당 지지 */
function engineBranch(group: string, shinsalName: string): string {
  const stageIdx = TWELVE_SHINSAL_NAMES.indexOf(shinsalName);
  const startIdx = GEOBSAL_START[group];
  let branchIdx = (stageIdx + startIdx) % 12;
  if (INJECT && group === "신자진" && shinsalName === "장성살") branchIdx = (branchIdx + 1) % 12; // 심은 오류
  return BRANCHES_SEQ_SHINSAL[branchIdx];
}

// ── 사전 파싱 ──
const DIR = join(process.cwd(), "lib/dict/data/sipisinsal");
/** 파일명 → 신살명은 사전의 name 필드에서 읽는다(추측 금지). */
type DictRow = { file: string; name: string; order: number | null; table: Record<string, string> };

const rows: DictRow[] = [];
for (const f of readdirSync(DIR)) {
  if (!f.endsWith(".ts") || f === "intro.ts") continue;
  const src = readFileSync(join(DIR, f), "utf-8");
  const name = src.match(/^\s*name:\s*"([^"]+)"/m)?.[1] ?? "";
  const orderRaw = src.match(/"12신살 순번",\s*value:\s*"(\d+)번"/)?.[1];
  const table: Record<string, string> = {};
  // "신자진(申子辰) → 子(자)" 와 "신자진(申子辰) → 유(酉)" 두 표기를 모두 받는다
  // (dohwa.ts 만 한글-한자 순서가 뒤집혀 있어 한자만 훑으면 통째로 누락된다)
  const HANJA = "子丑寅卯辰巳午未申酉戌亥";
  const KOR = "자축인묘진사오미신유술해";
  for (const m of src.matchAll(
    /(신자진|사유축|인오술|해묘미)\([^)]*\)\s*→\s*([子丑寅卯辰巳午未申酉戌亥자축인묘진사오미신유술해])/g,
  )) {
    const ch = m[2];
    table[m[1]] = KOR.includes(ch) ? HANJA[KOR.indexOf(ch)] : ch;
  }
  rows.push({ file: f, name, order: orderRaw ? Number(orderRaw) : null, table });
}

// ── 대조 ──
let checked = 0, failed = 0;
const problems: string[] = [];

console.log(`사전 파일 ${rows.length}개 파싱${INJECT ? "  ★INJECT 모드(오류 1셀 주입)" : ""}\n`);

/** 사전과 엔진이 같은 자리를 다른 이름으로 부르는 경우(표기 차이). 근거=사전 순번 표기. */
const DICT_ALIAS: Record<string, string> = { "도화": "년살" };

for (const r of rows) {
  const engName = DICT_ALIAS[r.name] ?? r.name;
  if (DICT_ALIAS[r.name]) {
    problems.push(`[표기] 사전 "${r.name}"(${r.file}) = 엔진 "${engName}" — 같은 자리, 다른 이름`);
  }
  // 사전이 표기한 순번이 엔진 배열 순서와 맞는가 (1-indexed)
  const engineOrder = TWELVE_SHINSAL_NAMES.indexOf(engName) + 1;
  if (r.order !== null) {
    checked++;
    if (engineOrder !== r.order) {
      failed++;
      problems.push(`[순번] ${r.name}: 사전 ${r.order}번 vs 엔진 ${engineOrder}번`);
    }
  }
  if (TWELVE_SHINSAL_NAMES.indexOf(engName) < 0) {
    problems.push(`[이름] 사전 "${r.name}"(${r.file})이 엔진 12신살 배열에 없음`);
    failed++;
    continue;
  }
  const cells = Object.keys(r.table);
  if (cells.length === 0) {
    problems.push(`[표없음] ${r.name}(${r.file}): 삼합 그룹별 조견 문장을 못 찾음 — 수동 확인 필요`);
    continue;
  }
  for (const g of GROUPS) {
    const dictVal = r.table[g];
    if (!dictVal) { problems.push(`[누락] ${r.name}: ${g} 그룹 표기 없음`); continue; }
    checked++;
    const eng = engineBranch(g, engName);
    if (dictVal !== eng) {
      failed++;
      problems.push(`[셀] ${r.name} / ${g}: 사전 ${dictVal} vs 엔진 ${eng}`);
    }
  }
}

// ── 전체 조견표 출력 (글에 실을 표의 원본) ──
console.log("년지 그룹 | " + TWELVE_SHINSAL_NAMES.join(" "));
for (const g of GROUPS) {
  console.log(`${g}    | ` + TWELVE_SHINSAL_NAMES.map((n) => engineBranch(g, n)).join("   "));
}

console.log(`\n대조 ${checked}건 / 불일치 ${failed}건`);
for (const p of problems) console.log("  ✗ " + p);
if (failed === 0 && problems.length === 0) console.log("  ✓ 전부 일치");
process.exit(failed > 0 ? 1 : 0);
