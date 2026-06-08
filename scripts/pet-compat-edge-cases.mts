// 펫 궁합 v2 — D/S/tier 2/4 등 엣지 케이스 점수 검증 (LLM 미호출, 결정론만)
// 목적: sync 룰 v2 적용 후 양 극단 + fallback 케이스의 등급/지표가 의도대로 나오는지 sanity check

const mod = await import("../lib/pet-compat-scoring");
const m: typeof import("../lib/pet-compat-scoring") = ((mod as any).default ?? mod) as any;
const { computePetCompatScores, mockSignalsForTest } = m;
type Signals = import("../lib/pet-compat-scoring").PetCompatSignals;

function base(): Signals {
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

const cases: Array<{ name: string; expect: string; s: Signals }> = [
  // 1. S 권역 — 모든 신호 최대치
  {
    name: "S — 완벽 매칭(개)",
    expect: "S 등급, sync 85+, lover/loyalty 균형",
    s: {
      ...base(),
      ownerStrength: "balanced", ownerInseong: 2, ownerSikSang: 2, ownerJaeseong: 1, ownerBigeob: 0,
      ownerDayBranch: "寅", ownerDayMasterElement: "목",
      petStrength: "balanced", petGwanseong: 2, petInseong: 2, petSikSang: 0, petBigeob: 0,
      petDayBranch: "亥", petYearBranch: "卯", petDayMasterElement: "수",
      petHasCheonEulGwiin: true,
      dayBranchHap: true,       // 寅亥 합
      dayBranchSamhap: false,
      dayMasterRelation: "saeng_to_owner",  // 수→목
      yearBranchHap: true,
      petSpecies: "dog",
    },
  },
  // 2. mockSignalsForTest "good" 그대로 — A/S 경계
  { name: "good 프리셋(기존 mock)", expect: "A~S, 일지합+생", s: mockSignalsForTest("good") },

  // 3. D 권역 — 충+극+연지충 + 펫 역마살 + 종 상극
  {
    name: "D — 최악 충돌(고양이)",
    expect: "D 등급, conflict 60+, sync 30 미만",
    s: {
      ...base(),
      ownerStrength: "strong", ownerInseong: 0, ownerSikSang: 0, ownerJaeseong: 3, ownerGwanseong: 2, ownerBigeob: 3,
      ownerDayBranch: "申", ownerDayMasterElement: "금",
      petStrength: "weak", petGwanseong: 0, petInseong: 0, petSikSang: 3, petBigeob: 3,
      petDayBranch: "寅", petYearBranch: "申", petDayMasterElement: "목",
      petHasDohwa: false, petHasYeokma: true, petHasCheonEulGwiin: false,
      dayBranchChung: true,     // 寅申 충
      dayMasterRelation: "geuk_to_pet",  // 금→목 (보호자가 펫 극)
      yearBranchChung: true,
      petSpecies: "cat",
    },
  },
  // 4. mockSignalsForTest "rebel" — B 권역 예상
  { name: "rebel 프리셋(기존 mock)", expect: "B, 펫 압도", s: mockSignalsForTest("rebel") },

  // 5. tier 2 fallback — 시 미상 (사주 데이터는 있지만 신호 약함)
  {
    name: "tier 2 fallback (시 미상)",
    expect: "C~B, D 부여 가능",
    s: {
      ...base(),
      ownerStrength: "balanced", ownerInseong: 1, ownerSikSang: 1,
      ownerDayBranch: "辰", ownerDayMasterElement: "토",
      petStrength: "balanced", petGwanseong: 1, petInseong: 0,
      petDayBranch: "戌", petYearBranch: "丑", petDayMasterElement: "토",
      petBirthTier: 2,
      dayBranchChung: true,     // 辰戌 충
      dayMasterRelation: "bihwa",  // 토-토
      petSpecies: "dog",
    },
  },
  // 6. mockSignalsForTest "fallback" — tier 4, D 부여 불가
  { name: "fallback 프리셋(기존 mock, tier 4)", expect: "C 이상, D 불가", s: mockSignalsForTest("fallback") },

  // 7. tier 4 + 충 — D 컷이라도 fallback이라 최저 C
  {
    name: "tier 4 + 충 (D 가드 작동)",
    expect: "C가 최저",
    s: {
      ...base(),
      ownerDayBranch: "辰", ownerDayMasterElement: "토",
      petStrength: "weak", petBigeob: 3, petSikSang: 3,
      petDayBranch: "戌", petYearBranch: "未", petDayMasterElement: "수",
      petBirthTier: 4,
      dayBranchChung: true,     // 辰戌 충
      dayMasterRelation: "geuk_to_pet",  // 토→수
      yearBranchChung: false,
      petSpecies: "cat",
    },
  },

  // 8. sync 룰 v2 효과 직접 케이스 — 충+극 동시
  {
    name: "[v2 효과] 충+극 동시 발생",
    expect: "sync 29 (v1 23 → +6)",
    s: { ...base(), dayBranchChung: true, dayMasterRelation: "geuk_to_pet", petSpecies: "dog" },
  },
];

console.log("\n━━ 펫 궁합 v2 엣지 케이스 검증 ━━\n");
for (const c of cases) {
  const r = computePetCompatScores(c.s);
  console.log(`■ ${c.name}`);
  console.log(`  기대: ${c.expect}`);
  console.log(`  결과: ${r.grade}등급 (composite ${r.composite}) / 🐾sync ${r.sync} 👑ruler ${r.ruler} 🐶lover ${r.lover} 💞loyalty ${r.loyalty} ⚡conflict ${r.conflict}`);
  console.log(`  라벨: "${r.labelText}"`);
  console.log("");
}
