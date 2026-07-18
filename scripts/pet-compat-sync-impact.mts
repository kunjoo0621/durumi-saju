// pet-compat sync 룰 v2 영향 분석
// v1: 페널티 단순 합산 / v2: diminishing returns
// 1) 케이스 표로 sync 차이 확인
// 2) 1000개 랜덤 샘플로 등급 분포 변화 확인

const scoringModule = await import("../lib/pet-compat-scoring");
const scoring: typeof import("../lib/pet-compat-scoring") =
  ((scoringModule as any).default ?? scoringModule) as any;
const { computePetCompatScores } = scoring;
type PetCompatSignals = import("../lib/pet-compat-scoring").PetCompatSignals;
type Strength = import("../lib/pet-compat-scoring").Strength;
type OhaengRelation = import("../lib/pet-compat-scoring").OhaengRelation;

// v1 로직 재현 (비교 기준)
function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}
function computeSyncV1(s: PetCompatSignals): number {
  let score = 55;
  if (s.dayBranchHap) score += 25;
  if (s.dayBranchSamhap) score += 20;
  if (s.dayBranchBanghap) score += 12;
  if (s.dayBranchChung) score -= 25;
  if (s.dayBranchHyeong) score -= 15;
  if (s.dayBranchWonjin) score -= 12;
  switch (s.dayMasterRelation) {
    case "saeng_to_pet": score += 12; break;
    case "saeng_to_owner": score += 12; break;
    case "bihwa": score += 8; break;
    case "geuk_to_pet": score -= 12; break;
    case "geuk_to_owner": score -= 12; break;
  }
  if (s.ownerStrength === "balanced" && s.petStrength === "balanced") score += 5;
  if (s.yearBranchHap) score += 4;
  if (s.yearBranchChung) score -= 4;
  return clamp(score);
}
function computeSyncV2(s: PetCompatSignals): number {
  let score = 55;
  if (s.dayBranchHap) score += 25;
  if (s.dayBranchSamhap) score += 20;
  if (s.dayBranchBanghap) score += 12;
  const penalties: number[] = [];
  if (s.dayBranchChung) penalties.push(25);
  else if (s.dayBranchHyeong) penalties.push(15);
  else if (s.dayBranchWonjin) penalties.push(12);
  if (s.dayMasterRelation === "geuk_to_pet" || s.dayMasterRelation === "geuk_to_owner") {
    penalties.push(12);
  }
  penalties.sort((a, b) => b - a);
  for (let i = 0; i < penalties.length; i++) {
    score -= penalties[i] * (i === 0 ? 1 : 0.5);
  }
  switch (s.dayMasterRelation) {
    case "saeng_to_pet": score += 12; break;
    case "saeng_to_owner": score += 12; break;
    case "bihwa": score += 8; break;
  }
  if (s.ownerStrength === "balanced" && s.petStrength === "balanced") score += 5;
  if (s.yearBranchHap) score += 4;
  if (s.yearBranchChung) score -= 4;
  return clamp(score);
}

function base(): PetCompatSignals {
  return {
    ownerStrength: "balanced",
    ownerInseong: 1, ownerSikSang: 1, ownerBigeob: 1, ownerJaeseong: 1, ownerGwanseong: 1,
    ownerDayBranch: "", ownerDayMasterElement: "",
    petStrength: "balanced",
    petInseong: 0, petSikSang: 0, petBigeob: 0, petJaeseong: 0, petGwanseong: 0,
    petDayBranch: "", petYearBranch: "", petDayMasterElement: "",
    petHasDohwa: false, petHasYeokma: false, petHasCheonEulGwiin: false, petTwelveStage: "",
    petBirthTier: 1,
    dayBranchHap: false, dayBranchSamhap: false, dayBranchBanghap: false,
    dayBranchChung: false, dayBranchHyeong: false, dayBranchWonjin: false,
    dayMasterRelation: "none",
    yearBranchHap: false, yearBranchChung: false,
    petSpecies: "dog",
  };
}

// ─── 1) 케이스 표 ───
console.log("\n━━ sync 룰 변경 임팩트 (v1 → v2) ━━\n");
console.log("케이스".padEnd(40) + "  v1   v2   diff");
console.log("─".repeat(60));

const cases: Array<[string, Partial<PetCompatSignals>]> = [
  ["페널티 없음 (중립)", {}],
  ["충 단독", { dayBranchChung: true }],
  ["형 단독", { dayBranchHyeong: true }],
  ["원진 단독", { dayBranchWonjin: true }],
  ["극(geuk_to_pet) 단독", { dayMasterRelation: "geuk_to_pet" }],
  ["충 + 극", { dayBranchChung: true, dayMasterRelation: "geuk_to_pet" }],
  ["형 + 극", { dayBranchHyeong: true, dayMasterRelation: "geuk_to_pet" }],
  ["원진 + 극", { dayBranchWonjin: true, dayMasterRelation: "geuk_to_pet" }],
  ["충 + 극 + 연지충", { dayBranchChung: true, dayMasterRelation: "geuk_to_owner", yearBranchChung: true }],
  ["6합 단독 (보너스)", { dayBranchHap: true }],
  ["6합 + 생(saeng_to_pet)", { dayBranchHap: true, dayMasterRelation: "saeng_to_pet" }],
];

for (const [name, patch] of cases) {
  const s = { ...base(), ...patch };
  const v1 = computeSyncV1(s);
  const v2 = computeSyncV2(s);
  const diff = v2 - v1;
  const diffStr = diff === 0 ? "  -  " : (diff > 0 ? `+${diff}` : `${diff}`).padStart(5);
  console.log(name.padEnd(40) + `  ${String(v1).padStart(3)}  ${String(v2).padStart(3)}  ${diffStr}`);
}

// ─── 2) 랜덤 샘플 1000개 등급 분포 비교 ───
console.log("\n\n━━ 1000개 랜덤 샘플 등급 분포 (composite 기준) ━━\n");

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randBool(p: number): boolean { return Math.random() < p; }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }

function sampleSignals(): PetCompatSignals {
  const strengths: Strength[] = ["strong", "weak", "balanced"];
  const ohaeng: OhaengRelation[] = ["saeng_to_pet", "saeng_to_owner", "geuk_to_pet", "geuk_to_owner", "bihwa", "none"];
  // 일지 페어 합/충/형/원진은 mutually exclusive (확률 분배)
  const r = Math.random();
  const dayHap = r < 1 / 6;
  const dayChung = r >= 1 / 6 && r < 2 / 6;
  const dayHyeong = r >= 2 / 6 && r < 3 / 6;
  const dayWonjin = r >= 3 / 6 && r < 4 / 6;
  // 4/6~6/6는 페어 없음 (3분의1) — 12지 매트릭스에서 합/충/형/원진 외 페어가 다수
  return {
    ownerStrength: rand(strengths),
    ownerInseong: randInt(0, 3), ownerSikSang: randInt(0, 3), ownerBigeob: randInt(0, 3),
    ownerJaeseong: randInt(0, 3), ownerGwanseong: randInt(0, 3),
    ownerDayBranch: "", ownerDayMasterElement: "",
    petStrength: rand(strengths),
    petInseong: randInt(0, 3), petSikSang: randInt(0, 3), petBigeob: randInt(0, 3),
    petJaeseong: randInt(0, 3), petGwanseong: randInt(0, 3),
    petDayBranch: "", petYearBranch: "", petDayMasterElement: "",
    petHasDohwa: randBool(0.3),
    petHasYeokma: randBool(0.2),
    petHasCheonEulGwiin: randBool(0.15),
    petTwelveStage: "",
    petBirthTier: rand([1, 1, 1, 2, 3, 4] as (1 | 2 | 3 | 4)[]),  // tier 1 비중 높게
    dayBranchHap: dayHap,
    dayBranchSamhap: !dayHap && !dayChung && !dayHyeong && !dayWonjin && randBool(0.15),
    dayBranchBanghap: !dayHap && !dayChung && !dayHyeong && !dayWonjin && randBool(0.15),
    dayBranchChung: dayChung,
    dayBranchHyeong: dayHyeong,
    dayBranchWonjin: dayWonjin,
    dayMasterRelation: rand(ohaeng),
    yearBranchHap: randBool(0.15),
    yearBranchChung: randBool(0.15),
    petSpecies: rand(["dog", "cat"] as ("dog" | "cat")[]),
  };
}

const N = 1000;
const distV2 = { S: 0, A: 0, B: 0, C: 0, D: 0 };
const syncDiffs: number[] = [];
const compositeDiffs: number[] = [];
const samples: PetCompatSignals[] = [];

for (let i = 0; i < N; i++) {
  const s = sampleSignals();
  samples.push(s);
  const r = computePetCompatScores(s);  // v2 결과
  distV2[r.grade]++;
  const syncV1 = computeSyncV1(s);
  const syncV2 = computeSyncV2(s);
  syncDiffs.push(syncV2 - syncV1);
  // composite 차이: sync 가중치 0.35
  compositeDiffs.push((syncV2 - syncV1) * 0.35);
}

console.log("v2 등급 분포:", distV2);
console.log(`  S ${(distV2.S/10).toFixed(1)}% / A ${(distV2.A/10).toFixed(1)}% / B ${(distV2.B/10).toFixed(1)}% / C ${(distV2.C/10).toFixed(1)}% / D ${(distV2.D/10).toFixed(1)}%`);

const positiveSyncDiff = syncDiffs.filter(d => d > 0);
console.log(`\nsync 점수 변화:`);
console.log(`  영향받은 케이스: ${positiveSyncDiff.length}/${N} (${(positiveSyncDiff.length/N*100).toFixed(1)}%)`);
if (positiveSyncDiff.length > 0) {
  const avgDiff = positiveSyncDiff.reduce((a,b) => a+b, 0) / positiveSyncDiff.length;
  const maxDiff = Math.max(...positiveSyncDiff);
  console.log(`  영향받은 케이스 평균 +${avgDiff.toFixed(1)}점, 최대 +${maxDiff}점`);
}

// 등급 컷 경계 케이스: composite 차이로 인해 등급 변동 가능성 추정
let gradeShifts = 0;
for (let i = 0; i < N; i++) {
  const compositeDiff = compositeDiffs[i];
  if (compositeDiff === 0) continue;
  // v2 composite와 v1 composite의 차이가 등급 컷을 넘는지 추정 (근사)
  const v2Composite = computePetCompatScores(samples[i]).composite;
  const v1Composite = v2Composite - compositeDiff;
  const gradeOf = (c: number, tier: number) => {
    const min = tier >= 3 ? "C" : "D";
    if (c >= 80) return "S"; if (c >= 65) return "A"; if (c >= 45) return "B"; if (c >= 25) return "C"; return min;
  };
  if (gradeOf(v1Composite, samples[i].petBirthTier) !== gradeOf(v2Composite, samples[i].petBirthTier)) {
    gradeShifts++;
  }
}
console.log(`  등급 변동: ${gradeShifts}/${N} (${(gradeShifts/N*100).toFixed(1)}%) — v1 vs v2`);
