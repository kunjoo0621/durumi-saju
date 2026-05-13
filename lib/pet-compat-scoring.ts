// 펫 궁합 점수 매핑 (v1)
// LLM이 점수 매기지 못하게 분리 — 서버에서 결정론적 계산.
// 사주 분석의 SCORING_VERSION 패턴 따름.
//
// v1 (2026-05-03): 첫 버전. 사주 신호를 받아 4지표 + composite 계산.
// 추후 실제 사주 enrichment 결과와 매핑 (현재는 minimal signals만 사용).

import type { LabelGrade } from "./pet-compat";

export const PET_COMPAT_SCORING_VERSION = 1;

// ────────────────────────────────────────────────────────
// 입력 신호 (사주 분석 결과에서 추출)
// ────────────────────────────────────────────────────────

export type Strength = "strong" | "weak" | "balanced";

export type OhaengRelation = "saeng_to_pet" | "saeng_to_owner" | "geuk_to_pet" | "geuk_to_owner" | "bihwa" | "none";

export interface PetCompatSignals {
  // 보호자
  ownerStrength: Strength;             // 신강/신약/균형
  ownerInseong: number;                // 인성 (정인+편인)
  ownerSikSang: number;                // 식상 (식신+상관)
  ownerBigeob: number;                 // 비겁 (비견+겁재)
  ownerJaeseong: number;               // 재성 (정재+편재)
  ownerGwanseong: number;              // 관성 (정관+편관)
  ownerDayBranch: string;              // 일지
  ownerDayMasterElement: string;       // 일간 오행 ("목", "화", "토", "금", "수")

  // 펫
  petStrength: Strength;
  petInseong: number;                  // 펫 인성 (보호자에 의지)
  petSikSang: number;                  // 펫 식상 (자유 추구)
  petBigeob: number;                   // 펫 비겁 (자기 우선)
  petJaeseong: number;
  petGwanseong: number;                // 펫 관성 (규율·복종)
  petDayBranch: string;
  petYearBranch: string;               // 연지 (띠)
  petDayMasterElement: string;
  petHasDohwa: boolean;                // 도화·홍염
  petHasYeokma: boolean;               // 역마살 (정처없는 기운)
  petHasCheonEulGwiin: boolean;        // 천을귀인 (귀하게 모셔지는 운)
  petTwelveStage: string;              // 펫 일주의 12운성 ("장생","목욕","관대"...)
  petBirthTier: 1 | 2 | 3 | 4;

  // 관계 신호 (양쪽 비교)
  dayBranchHap: boolean;               // 6합 (子丑·寅亥·卯戌·辰酉·巳申·午未)
  dayBranchSamhap: boolean;            // 삼합 그룹 (申子辰·亥卯未·寅午戌·巳酉丑)
  dayBranchBanghap: boolean;           // 방합 (寅卯辰·巳午未·申酉戌·亥子丑)
  dayBranchChung: boolean;             // 6충
  dayBranchHyeong: boolean;            // 형
  dayBranchWonjin: boolean;            // 원진 (子未·丑午·寅酉·卯申·辰亥·巳戌)
  dayMasterRelation: OhaengRelation;   // 양쪽 일간 오행 관계
  yearBranchHap: boolean;              // 연지(띠) 간 합
  yearBranchChung: boolean;            // 연지(띠) 간 충

  // 종 정보
  petSpecies: "dog" | "cat";
}

// ────────────────────────────────────────────────────────
// 점수 출력
// ────────────────────────────────────────────────────────

export interface PetCompatComputedScores {
  composite: number;       // 0~100
  sync: number;            // 🐾 호흡 지수 (양방향)
  ruler: number;           // 👑 집안 실세 지수 (50 = 동등, 100 = 펫 압도)
  lover: number;           // 🐶 랜선집사 지수 (보호자 → 펫 사랑/매달림)
  loyalty: number;         // 🐾 펫 충성 지수 (펫 → 보호자 따름/의지) — v0.8 신규
  conflict: number;        // ⚡ 사주 어긋남 지수 (낮을수록 좋음)
  grade: LabelGrade;
  labelText: string;       // 서버 결정 라벨 (LLM과 일러스트가 병렬로 사용)
  scoringVersion: number;
}

// ────────────────────────────────────────────────────────
// 12지 상극 매트릭스 (세종의소리 칼럼 기반)
// ────────────────────────────────────────────────────────

const SPECIES_INCOMPAT: Record<"dog" | "cat", string[]> = {
  dog: ["申", "子", "辰"],   // 개 ↔ 원숭이/쥐/용
  cat: ["申", "子", "辰"],   // 고양이 ↔ 원숭이/쥐/용
};

function isSpeciesIncompat(species: "dog" | "cat", ownerDayBranch: string): boolean {
  return SPECIES_INCOMPAT[species].includes(ownerDayBranch);
}

// ────────────────────────────────────────────────────────
// 등급 컷 (S 5%, A 20%, B 45%, C 27%, D 3%)
// ────────────────────────────────────────────────────────

function compositeToGrade(composite: number, signals: PetCompatSignals): LabelGrade {
  // fallback (tier 3·4)이면 D 부여 금지 (최저 C까지)
  const minGrade = signals.petBirthTier >= 3 ? "C" : "D";

  if (composite >= 80) return "S";
  if (composite >= 65) return "A";
  if (composite >= 45) return "B";
  if (composite >= 25) return "C";
  return minGrade;
}

// ────────────────────────────────────────────────────────
// 4지표 계산
// ────────────────────────────────────────────────────────

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

// ────────────────────────────────────────────────────────
// 🐾 호흡 지수 (sync) — 둘이 얼마나 맞는가
// ────────────────────────────────────────────────────────
function computeSync(s: PetCompatSignals): number {
  let score = 55;  // 기본 (B 중간)

  // 일지 관계 (정통 명리 6합·삼합·방합·충·형·원진)
  if (s.dayBranchHap) score += 25;           // 6합 (자축·인해 등) — 강한 끌림
  if (s.dayBranchSamhap) score += 20;        // 삼합 (수국·목국 등) — 같은 의지
  if (s.dayBranchBanghap) score += 12;       // 방합 (동방·남방 등) — 같은 계절
  if (s.dayBranchChung) score -= 25;         // 6충 — 정면 충돌
  if (s.dayBranchHyeong) score -= 15;        // 형 — 스트레스 누적
  if (s.dayBranchWonjin) score -= 12;        // 원진 — 미운 정 (보이지 않는 충돌)

  // 일간 오행 관계
  switch (s.dayMasterRelation) {
    case "saeng_to_pet": score += 12; break;     // 보호자가 펫에게 에너지 줌
    case "saeng_to_owner": score += 12; break;   // 펫이 보호자에게 에너지 줌
    case "bihwa": score += 8; break;             // 같은 오행 (비화) — 친근
    case "geuk_to_pet": score -= 12; break;      // 보호자가 펫을 극함 (펫 스트레스)
    case "geuk_to_owner": score -= 12; break;    // 펫이 보호자를 극함 (보호자 부담)
    case "none": break;
  }

  // 신강신약 균형
  if (s.ownerStrength === "balanced" && s.petStrength === "balanced") score += 5;

  // 연지(띠) 관계 보너스 (약하게)
  if (s.yearBranchHap) score += 4;
  if (s.yearBranchChung) score -= 4;

  return clamp(score);
}

// ────────────────────────────────────────────────────────
// 👑 집안 실세 지수 (ruler) — 권력 분포 (50 동등 / >50 펫 압도)
// ────────────────────────────────────────────────────────
function computeRuler(s: PetCompatSignals): number {
  let score = 50;

  // 신강신약 비교 (가장 큰 영향)
  if (s.petStrength === "strong" && s.ownerStrength === "weak") score += 30;
  else if (s.petStrength === "strong") score += 18;
  else if (s.petStrength === "weak" && s.ownerStrength === "strong") score -= 25;
  else if (s.petStrength === "weak") score -= 12;

  // 일간 오행 극 관계 — 펫이 보호자를 극하면 펫 우위
  if (s.dayMasterRelation === "geuk_to_owner") score += 18;
  if (s.dayMasterRelation === "geuk_to_pet") score -= 15;

  // 펫 신살 — 귀여움/매력으로 권력
  if (s.petHasDohwa) score += 15;             // 도화·홍염 — 귀여움 권력
  if (s.petHasCheonEulGwiin) score += 10;     // 천을귀인 — 모셔지는 운

  // 보호자 인성 — 보호 본능으로 휘둘림
  score += Math.min(s.ownerInseong * 6, 18);

  // 보호자 비겁 — 자기 우선 (펫에 안 휘둘림)
  score -= Math.min(s.ownerBigeob * 5, 15);

  // 펫 관성 — 규율·복종 (펫이 우위 안 함)
  score -= Math.min(s.petGwanseong * 4, 12);

  // 종별 본성: 고양이는 기본 +8 (시니컬·황제 톤, 펫 도메인 표준)
  if (s.petSpecies === "cat") score += 8;

  return clamp(score);
}

// ────────────────────────────────────────────────────────
// 🐶 랜선집사 지수 (lover) — 보호자가 펫에 매달리는 정도
// ────────────────────────────────────────────────────────
function computeLover(s: PetCompatSignals): number {
  let score = 50;

  // 보호자 십성 신호
  score += Math.min(s.ownerInseong * 10, 25);     // 인성 = 보호 본능 (max +25)
  score += Math.min(s.ownerSikSang * 7, 18);      // 식상 = 베풀기
  score += Math.min(s.ownerJaeseong * 5, 12);     // 편재·정재 — 펫에 돈 씀
  score -= Math.min(s.ownerBigeob * 7, 18);       // 비겁 = 자기 우선

  // 보호자가 펫을 생함 — 일방적으로 에너지 줌
  if (s.dayMasterRelation === "saeng_to_pet") score += 15;

  // 펫에 도화·홍염 — 보호자가 더 빠짐
  if (s.petHasDohwa) score += 10;

  // 보호자 신약 + 펫 신강 — 보호자가 의지·매달림
  if (s.ownerStrength === "weak" && s.petStrength === "strong") score += 12;

  return clamp(score);
}

// ────────────────────────────────────────────────────────
// 🐾 펫 충성 지수 (loyalty) — 펫이 보호자를 따르고 의지하는 정도
// "반려동물이 더 좋아하는가" 잡아냄. lover (보호자 → 펫)와 대비.
// ────────────────────────────────────────────────────────
function computeLoyalty(s: PetCompatSignals): number {
  let score = 45;  // 기본 (펫은 본래 독립적, 충성도 평균 이하 시작)

  // 펫 십성 — 관성 (규율·복종)
  score += Math.min(s.petGwanseong * 10, 25);     // 정관·편관 = 보호자 복종
  // 펫 인성 (어머니 같은 보호자에 의지)
  score += Math.min(s.petInseong * 8, 18);
  // 펫 식상 (자유 추구) — 충성 약화
  score -= Math.min(s.petSikSang * 6, 15);
  // 펫 비겁 (자기 우선) — 충성 약화
  score -= Math.min(s.petBigeob * 7, 18);

  // 펫이 보호자를 생함 — 일방적으로 에너지 줌 (사랑·헌신)
  if (s.dayMasterRelation === "saeng_to_owner") score += 18;
  // 펫이 보호자에게 극당함 — 펫이 약자라 의지함
  if (s.dayMasterRelation === "geuk_to_pet") score += 10;

  // 펫 신약 + 보호자 신강 — 펫이 의지
  if (s.petStrength === "weak" && s.ownerStrength === "strong") score += 12;
  // 펫 신강 — 자기 우선
  if (s.petStrength === "strong") score -= 8;

  // 일지 합 — 끌림 (양방향이지만 펫도 끌림)
  if (s.dayBranchHap) score += 12;
  if (s.dayBranchSamhap) score += 8;

  // 종 본성: 고양이는 기본 -10 (시니컬 베이스)
  if (s.petSpecies === "cat") score -= 10;

  // 펫 천을귀인 — 보호자를 귀인으로 인식
  if (s.petHasCheonEulGwiin) score += 8;

  // 펫 역마살 — 정처없음 (충성 약화)
  if (s.petHasYeokma) score -= 6;

  return clamp(score);
}

// ────────────────────────────────────────────────────────
// ⚡ 사주 어긋남 지수 (conflict) — 갈등 (낮을수록 좋음)
// ────────────────────────────────────────────────────────
function computeConflict(s: PetCompatSignals): number {
  let score = 10;  // 기본 낮음 (대부분 큰 충돌 없음)

  // 일지 충/형/원진
  if (s.dayBranchChung) score += 30;
  if (s.dayBranchHyeong) score += 20;
  if (s.dayBranchWonjin) score += 15;

  // 일간 오행 상극
  if (s.dayMasterRelation === "geuk_to_pet") score += 12;
  if (s.dayMasterRelation === "geuk_to_owner") score += 12;

  // 종별 상극 (세종의소리 매트릭스: 개/고양이 ↔ 申子辰)
  if (isSpeciesIncompat(s.petSpecies, s.ownerDayBranch)) score += 18;

  // 양쪽 편관 강 (압박 vs 압박)
  if (s.ownerGwanseong >= 2 && s.petGwanseong >= 2) score += 12;

  // 펫 역마살 — 정처없는 기운 (관계 불안정)
  if (s.petHasYeokma) score += 8;

  // fallback 등급일수록 충돌 신호 모호 → 점수 낮춤
  if (s.petBirthTier >= 3) score = Math.max(0, score - 10);

  return clamp(score);
}

function computeComposite(scores: { sync: number; ruler: number; lover: number; loyalty: number; conflict: number }): number {
  // 가중치: sync 35%, ruler 균형도 15%, 정 흐름(lover+loyalty 평균) 30%, conflict 20%
  // ruler는 50에서 멀수록 페널티 (한쪽 압도 = 불균형)
  const rulerBalance = 100 - Math.abs(scores.ruler - 50) * 1.5;
  const affection = (scores.lover + scores.loyalty) / 2;   // 양방향 정 평균

  return clamp(
    0.35 * scores.sync +
    0.15 * rulerBalance +
    0.30 * affection +
    0.20 * (100 - scores.conflict)
  );
}

// ────────────────────────────────────────────────────────
// 라벨 결정론적 매핑 (점수 → label.text)
// LLM이 자유 생성하지 않고, 서버가 결정해서 일러스트와 LLM에 동시 전달.
// → LLM과 일러스트 병렬 처리 가능 (사주 단일 분석의 score → grade 패턴 응용)
// ────────────────────────────────────────────────────────

function pickLabelText(
  grade: LabelGrade,
  scores: { ruler: number; conflict: number; sync: number; lover: number; loyalty: number },
): string {
  const { ruler, conflict, sync, lover, loyalty } = scores;
  const affectionGap = lover - loyalty;  // 양수 = 보호자 일방, 음수 = 펫 일방

  if (grade === "S") {
    if (sync >= 85 && Math.abs(affectionGap) <= 15) return "사주가 맞춘 찰떡 인연";
    if (affectionGap >= 25) return "네가 더 매달리는 운명의 인연";
    if (affectionGap <= -25) return "쭈가 너 없으면 안 되는 인연";
    return "사주가 맞춘 인연";
  }
  if (grade === "A") {
    if (sync >= 75) return "찰떡 같은 콤비";
    if (affectionGap >= 30) return "네 사랑이 더 큰 콤비";
    if (affectionGap <= -30) return "이 아이가 너에게 헌신하는 콤비";
    if (conflict >= 30) return "서로 좋아하지만 둘 다 정상은 아님";
    return "찰떡 같은 콤비";
  }
  if (grade === "B") {
    if (ruler >= 70 && affectionGap >= 20) return "밥 주는 사람과 귀여운 갑";
    if (ruler <= 30) return "사랑인 줄 알았는데 운영 계약";
    if (affectionGap >= 35) return "혼자 일방통행하는 사랑";
    if (affectionGap <= -35) return "그 사이 더 많이 사랑하는 쪽은 아이야";
    return "까칠한 룸메이트";
  }
  if (grade === "C") {
    if (ruler >= 65 && affectionGap >= 20) return "집안 실세와 월급 없는 운영진";
    if (conflict >= 50) return "어긋난 박자, 그래도 가족";
    if (affectionGap >= 30) return "네 짝사랑이 그리는 관계";
    return "사주는 다르지만 팔자가 묶었어";
  }
  // D
  return "사주가 멀리 본 묘연";
}

// ────────────────────────────────────────────────────────
// 메인 함수
// ────────────────────────────────────────────────────────

export function computePetCompatScores(signals: PetCompatSignals): PetCompatComputedScores {
  const sync = computeSync(signals);
  const ruler = computeRuler(signals);
  const lover = computeLover(signals);
  const loyalty = computeLoyalty(signals);
  const conflict = computeConflict(signals);

  const composite = computeComposite({ sync, ruler, lover, loyalty, conflict });
  const grade = compositeToGrade(composite, signals);
  const labelText = pickLabelText(grade, { ruler, conflict, sync, lover, loyalty });

  return {
    composite,
    sync,
    ruler,
    lover,
    loyalty,
    conflict,
    grade,
    labelText,
    scoringVersion: PET_COMPAT_SCORING_VERSION,
  };
}

// ────────────────────────────────────────────────────────
// 테스트용 mock — dev 검증 전용 (extractPetCompatSignals 대체)
// ────────────────────────────────────────────────────────

function baseSignals(): PetCompatSignals {
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

export function mockSignalsForTest(preset: "good" | "rebel" | "fallback"): PetCompatSignals {
  const s = baseSignals();
  if (preset === "good") {
    return { ...s,
      ownerStrength: "weak", ownerInseong: 1, ownerSikSang: 2, ownerBigeob: 2,
      ownerDayBranch: "寅", ownerDayMasterElement: "목",
      petStrength: "strong", petGwanseong: 1, petInseong: 1, petSikSang: 1,
      petDayBranch: "亥", petYearBranch: "丑", petDayMasterElement: "수",
      dayBranchHap: true, dayMasterRelation: "saeng_to_owner",  // 수→목 (펫이 보호자 생함)
      petSpecies: "dog",
    };
  }
  if (preset === "rebel") {
    return { ...s,
      ownerStrength: "weak", ownerInseong: 1, ownerSikSang: 2, ownerBigeob: 2,
      ownerDayBranch: "寅", ownerDayMasterElement: "목",
      petStrength: "strong", petBigeob: 2, petSikSang: 2,
      petDayBranch: "子", petYearBranch: "寅", petDayMasterElement: "금",
      petHasDohwa: true,
      dayMasterRelation: "geuk_to_owner",  // 금→목 (펫이 보호자 극함)
      petSpecies: "cat",
    };
  }
  // fallback
  return { ...s,
    ownerStrength: "weak", ownerInseong: 1, ownerSikSang: 2, ownerBigeob: 2,
    ownerDayBranch: "寅", ownerDayMasterElement: "목",
    petStrength: "balanced",
    petDayBranch: "戌", petYearBranch: "辰", petDayMasterElement: "목",
    petBirthTier: 4,
    dayMasterRelation: "bihwa",
    petSpecies: "dog",
  };
}
