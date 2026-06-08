// 펫 궁합 등급 컷 옵션 비교 — C/D 비중 줄이기 방향
// 동일 시그널 샘플에서 컷만 바꿔 분포 차이 확인

const mod = await import("../lib/pet-compat-scoring");
const m: typeof import("../lib/pet-compat-scoring") = ((mod as any).default ?? mod) as any;
const { computePetCompatScores } = m;
type Signals = import("../lib/pet-compat-scoring").PetCompatSignals;
type Strength = import("../lib/pet-compat-scoring").Strength;
type OhaengRelation = import("../lib/pet-compat-scoring").OhaengRelation;

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randBool(p: number): boolean { return Math.random() < p; }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }

function sampleSignals(): Signals {
  const strengths: Strength[] = ["strong", "weak", "balanced"];
  const ohaeng: OhaengRelation[] = ["saeng_to_pet", "saeng_to_owner", "geuk_to_pet", "geuk_to_owner", "bihwa", "none"];
  const r = Math.random();
  const dayHap = r < 1 / 6;
  const dayChung = r >= 1 / 6 && r < 2 / 6;
  const dayHyeong = r >= 2 / 6 && r < 3 / 6;
  const dayWonjin = r >= 3 / 6 && r < 4 / 6;
  return {
    ownerStrength: rand(strengths),
    ownerInseong: randInt(0, 3), ownerSikSang: randInt(0, 3), ownerBigeob: randInt(0, 3),
    ownerJaeseong: randInt(0, 3), ownerGwanseong: randInt(0, 3),
    ownerDayBranch: "", ownerDayMasterElement: "",
    petStrength: rand(strengths),
    petInseong: randInt(0, 3), petSikSang: randInt(0, 3), petBigeob: randInt(0, 3),
    petJaeseong: randInt(0, 3), petGwanseong: randInt(0, 3),
    petDayBranch: "", petYearBranch: "", petDayMasterElement: "",
    petHasDohwa: randBool(0.3), petHasYeokma: randBool(0.2), petHasCheonEulGwiin: randBool(0.15),
    petTwelveStage: "",
    petBirthTier: rand([1, 1, 1, 2, 3, 4] as (1 | 2 | 3 | 4)[]),
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

type Cuts = { S: number; A: number; B: number; C: number };
function gradeWithCuts(composite: number, tier: number, cuts: Cuts): "S" | "A" | "B" | "C" | "D" {
  const minGrade = tier >= 3 ? "C" : "D";
  if (composite >= cuts.S) return "S";
  if (composite >= cuts.A) return "A";
  if (composite >= cuts.B) return "B";
  if (composite >= cuts.C) return "C";
  return minGrade;
}

const N = 5000;
// 동일 샘플 풀에 대해 각 옵션 분포 계산
const samples: Array<{ composite: number; tier: number }> = [];
for (let i = 0; i < N; i++) {
  const s = sampleSignals();
  const r = computePetCompatScores(s);
  samples.push({ composite: r.composite, tier: s.petBirthTier });
}

const options: Array<{ name: string; cuts: Cuts }> = [
  { name: "현재 v2 (S≥80/A≥65/B≥45/C≥25/D<25)",   cuts: { S: 80, A: 65, B: 45, C: 25 } },
  { name: "옵션 1 약하게 (S≥80/A≥65/B≥40/C≥20/D<20)", cuts: { S: 80, A: 65, B: 40, C: 20 } },
  { name: "옵션 2 중간   (S≥75/A≥60/B≥40/C≥20/D<20)", cuts: { S: 75, A: 60, B: 40, C: 20 } },
  { name: "옵션 3 강하게 (S≥75/A≥55/B≥35/C≥15/D<15)", cuts: { S: 75, A: 55, B: 35, C: 15 } },
  { name: "옵션 4 매우유함 (S≥70/A≥55/B≥35/C≥18/D<18)", cuts: { S: 70, A: 55, B: 35, C: 18 } },
];

console.log(`\n━━ N=${N} 동일 샘플 풀에서 컷 옵션별 분포 비교 ━━\n`);
console.log("옵션".padEnd(58) + "  S      A      B      C      D");
console.log("─".repeat(95));

for (const opt of options) {
  const dist = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const { composite, tier } of samples) {
    const g = gradeWithCuts(composite, tier, opt.cuts);
    dist[g]++;
  }
  const pct = (k: keyof typeof dist) => (dist[k] / N * 100).toFixed(1).padStart(4) + "%";
  console.log(opt.name.padEnd(58) + `  ${pct("S")}  ${pct("A")}  ${pct("B")}  ${pct("C")}  ${pct("D")}`);
}

console.log("\n메모리 목표: S 5% / A 20% / B 45% / C 27% / D 3%");
console.log("사용자 방향: C/D 비중을 줄임 (= B/A로 끌어올림)");
console.log("");
