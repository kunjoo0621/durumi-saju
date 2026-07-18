// 반려동물 궁합 v5 — 보호자 격자 × 펫 격자 실측 (LLM 미호출, 실제 사주계산 파이프라인)
// 목적: 단일 보호자 착시를 걷어낸 v5 실제 등급/라벨/실세 분포 + 아키타입 커버리지 확인.
// (pet-grid-measure.mts[v4 측정] + pet-grid-v5-sim.mts[v5 시뮬]을 승격 — 이제 lib 자체가 v5라 시뮬 재구현 불필요.)
//
// 실행(반드시 esbuild 우회 — tsx/dynamic import + .ts 확장자 문제 회피):
//   node_modules/.bin/esbuild scripts/pet-compat-owner-grid.mts --bundle --platform=node --format=esm \
//     --outfile=/tmp/pet-grid-v5.mjs \
//     --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
//     && node /tmp/pet-grid-v5.mjs

import { calculatePetEnrichedSaju, extractPetCompatSignals } from "../lib/pet-compat-saju";
import { computePetCompatScores } from "../lib/pet-compat-scoring";
import { calculateSaju, enrichSajuData } from "../lib/utils/saju";

// 결정론적 PRNG (재현 가능)
let seed = 20260718;
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function randInt(min: number, max: number): number { return Math.floor(rnd() * (max - min + 1)) + min; }

// ── 1. 보호자 풀: 랜덤 생일 → enriched, 신강약 분류 ──
async function makeOwner(i: number) {
  const y = randInt(1960, 2004), m = randInt(1, 12), d = randInt(1, 28), h = randInt(0, 23);
  const saju = await calculateSaju(y, m, d, h, 30);
  if (!saju) return null;
  return { id: `O${i}`, enriched: enrichSajuData(saju, { isTimeUnknown: false }) };
}
function strengthTier(enriched: any): "strong" | "weak" | "balanced" {
  const lv = enriched.strength?.result || "중화신강";
  if (lv === "극왕" || lv === "태강" || lv === "신강") return "strong";
  if (lv === "신약" || lv === "태약" || lv === "극약") return "weak";
  return "balanced";
}

const ownersAll: any[] = [];
for (let i = 0; i < 120; i++) { const o = await makeOwner(i); if (o) ownersAll.push(o); }
const byTier: Record<string, any[]> = { strong: [], weak: [], balanced: [] };
for (const o of ownersAll) byTier[strengthTier(o.enriched)].push(o);
// 각 tier 12명 → 격자 보호자 36명 (인구 편중 없이 tier별로 보기 위함)
const owners = [
  ...byTier.strong.slice(0, 12),
  ...byTier.balanced.slice(0, 12),
  ...byTier.weak.slice(0, 12),
];
console.log(`보호자 풀 ${ownersAll.length}명 → 격자 ${owners.length}명 (strong ${byTier.strong.length}/balanced ${byTier.balanced.length}/weak ${byTier.weak.length} 중 12씩)`);

// ── 2. 펫 풀: tier1 60% / tier2 20% / tier3 20%, 개/고양이 반반 ──
const pets: any[] = [];
for (let i = 0; i < 40; i++) {
  const y = randInt(2012, 2025), m = randInt(1, 12), d = randInt(1, 28);
  const species = i % 2 === 0 ? "dog" : "cat";
  const mod5 = i % 5;
  if (mod5 === 4) {
    pets.push({ name: `P${i}`, species, breed: "믹스", birthTier: 3, birthYearEstimated: y, birthMonthEstimated: m });
  } else {
    const tier = mod5 === 3 ? 2 : 1;
    pets.push({
      name: `P${i}`, species, breed: "믹스", birthTier: tier,
      birthDate: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      birthTime: tier === 1 ? `${String(randInt(0, 23)).padStart(2, "0")}:00` : undefined,
      calendarType: "solar",
    });
  }
}
const petCalcs: any[] = [];
for (const p of pets) petCalcs.push({ pet: p, calc: await calculatePetEnrichedSaju(p) });
const tierCounts: Record<number, number> = {};
for (const p of pets) tierCounts[p.birthTier] = (tierCounts[p.birthTier] || 0) + 1;
console.log(`펫 풀 40마리 — tier: ${Object.entries(tierCounts).map(([k, v]) => `t${k}:${v}`).join(" / ")}`);

// ── 3. 격자 실행 (실제 v5 lib) ──
type Row = {
  ownerTier: string; tier: number; grade: string; label: string; archetype: string;
  ruler: number; sync: number; lover: number; loyalty: number; conflict: number; composite: number;
};
const rows: Row[] = [];
for (const o of owners) {
  const ot = strengthTier(o.enriched);
  for (const { pet, calc } of petCalcs) {
    if (!calc.enriched) continue;
    const sig = extractPetCompatSignals(o.enriched, calc.enriched, pet);
    const r = computePetCompatScores(sig);
    rows.push({
      ownerTier: ot, tier: pet.birthTier, grade: r.grade, label: r.labelText, archetype: r.archetype,
      ruler: r.ruler, sync: r.sync, lover: r.lover, loyalty: r.loyalty, conflict: r.conflict, composite: r.composite,
    });
  }
}
console.log(`격자 rows = ${rows.length} (${owners.length} owners × ~${petCalcs.length} pets)\n`);

// ── 헬퍼 ──
function mean(nums: number[]): number { return nums.reduce((a, b) => a + b, 0) / nums.length; }
function stats(nums: number[]): string {
  const s = [...nums].sort((a, b) => a - b);
  const q = (p: number) => s[Math.floor(p * (s.length - 1))];
  return `mean ${mean(nums).toFixed(1)} · p10 ${q(0.1)} · p50 ${q(0.5)} · p90 ${q(0.9)}`;
}
function pctDist(items: string[], order?: string[]): string {
  const d: Record<string, number> = {};
  for (const x of items) d[x] = (d[x] || 0) + 1;
  const entries = order
    ? order.map((k) => [k, d[k] || 0] as [string, number])
    : Object.entries(d).sort((a, b) => b[1] - a[1]);
  return entries.map(([k, v]) => `${k} ${(v / items.length * 100).toFixed(1)}%`).join(" / ");
}

// ── 등급 분포 ──
console.log("━━ 등급 분포 (목표: S8~10/A20~25/B40~45/C20~25/D2~3) ━━");
console.log(pctDist(rows.map((r) => r.grade), ["S", "A", "B", "C", "D"]));
console.log("\n보호자 신강약별:");
for (const t of ["strong", "balanced", "weak"]) {
  const sub = rows.filter((r) => r.ownerTier === t);
  console.log(`  ${t.padEnd(9)}: ${pctDist(sub.map((r) => r.grade), ["S", "A", "B", "C", "D"])}`);
}
console.log(`  tier3 펫만 : ${pctDist(rows.filter((r) => r.tier === 3).map((r) => r.grade), ["S", "A", "B", "C", "D"])}`);

// ── ruler ──
const rulers = rows.map((r) => r.ruler);
const petGap = rulers.filter((n) => n >= 70).length / rulers.length * 100;
const ownerGap = rulers.filter((n) => n <= 30).length / rulers.length * 100;
console.log(`\n━━ ruler (목표: mean 50~53, 펫갑≥70 15~20%, 주인갑≤30 12~16%) ━━`);
console.log(`${stats(rulers)}  |  펫갑(≥70) ${petGap.toFixed(1)}%  주인갑(≤30) ${ownerGap.toFixed(1)}%`);

// ── affectionGap ──
const gaps = rows.map((r) => r.lover - r.loyalty);
console.log(`\n━━ affectionGap = lover − loyalty (목표: mean +5 내외) ━━`);
console.log(`${stats(gaps)}`);
console.log(`  lover  : ${stats(rows.map((r) => r.lover))}`);
console.log(`  loyalty: ${stats(rows.map((r) => r.loyalty))}`);
console.log(`  sync   : ${stats(rows.map((r) => r.sync))}`);
console.log(`  conflict: ${stats(rows.map((r) => r.conflict))}`);

// ── 라벨 분포 ──
const labelDist: Record<string, number> = {};
for (const r of rows) labelDist[r.label] = (labelDist[r.label] || 0) + 1;
const sortedLabels = Object.entries(labelDist).sort((a, b) => b[1] - a[1]);
const top1 = sortedLabels[0][1] / rows.length * 100;
const top3 = sortedLabels.slice(0, 3).reduce((a, [, v]) => a + v, 0) / rows.length * 100;
console.log(`\n━━ 라벨 (목표: top1 ≤25%, top3 ≤45%, 발생 라벨 다수) ━━`);
console.log(`발생 라벨 수: ${sortedLabels.length}종  |  top1 ${top1.toFixed(1)}%  top3 ${top3.toFixed(1)}%`);
for (const [k, v] of sortedLabels) console.log(`  ${(v / rows.length * 100).toFixed(1).padStart(5)}%  ${k}`);

// ── 아키타입 분포 ──
const ARCHS = ["HARMONY", "OWNER_DEVOTION", "PET_DEVOTION", "PET_THRONE", "OWNER_MANAGER", "OFFBEAT", "ROOMMATE", "DISTANT_FATE"];
console.log(`\n━━ 아키타입 (목표: 8종 전부 ≥2%) ━━`);
const archDist: Record<string, number> = {};
for (const r of rows) archDist[r.archetype] = (archDist[r.archetype] || 0) + 1;
for (const a of ARCHS) {
  const pct = (archDist[a] || 0) / rows.length * 100;
  console.log(`  ${a.padEnd(14)} ${pct.toFixed(1).padStart(5)}%  ${pct >= 2 ? "✓" : "✗ 미달"}`);
}
const missing = ARCHS.filter((a) => !archDist[a]);
if (missing.length) console.log(`  ⚠ 미발생: ${missing.join(", ")}`);
