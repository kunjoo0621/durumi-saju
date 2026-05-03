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

export interface PetCompatSignals {
  // 보호자
  ownerStrength: Strength;             // 신강/신약/균형
  ownerInseong: number;                // 인성 십성 개수 (정인+편인)
  ownerSikSang: number;                // 식상 십성 개수 (식신+상관)
  ownerBigeob: number;                 // 비겁 십성 개수 (비견+겁재)
  ownerDayBranch: string;              // 일지 (한자, 예: "寅")

  // 펫
  petStrength: Strength;
  petDayBranch: string;                // 일지
  petYearBranch: string;               // 연지 (띠)
  petHasDohwa: boolean;                // 도화살 또는 홍염살 보유
  petBirthTier: 1 | 2 | 3 | 4;         // fallback 등급

  // 관계 (양쪽 비교)
  dayBranchHap: boolean;               // 일지 간 합
  dayBranchChung: boolean;             // 일지 간 충
  dayBranchHyeong: boolean;            // 일지 간 형

  // 종 정보
  petSpecies: "dog" | "cat";
}

// ────────────────────────────────────────────────────────
// 점수 출력
// ────────────────────────────────────────────────────────

export interface PetCompatComputedScores {
  composite: number;       // 0~100
  sync: number;            // 🐾 호흡 지수
  ruler: number;           // 👑 집안 실세 지수 (50 = 동등, 100 = 펫 압도)
  lover: number;           // 🐶 랜선집사 지수
  conflict: number;        // ⚡ 사주 어긋남 지수 (낮을수록 좋음)
  grade: LabelGrade;
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

function computeSync(s: PetCompatSignals): number {
  let score = 60;  // 기본값 (B 중심으로 약간 높게)

  if (s.dayBranchHap) score += 20;
  if (s.dayBranchChung) score -= 15;
  if (s.dayBranchHyeong) score -= 10;

  // 신강·신약 극단 조합 → -10
  if ((s.ownerStrength === "strong" && s.petStrength === "weak") ||
      (s.ownerStrength === "weak" && s.petStrength === "strong")) {
    score -= 5;  // 극단이지만 보완 관계라 가벼운 페널티
  }

  // 양쪽 다 균형이면 +5
  if (s.ownerStrength === "balanced" && s.petStrength === "balanced") {
    score += 5;
  }

  return clamp(score);
}

function computeRuler(s: PetCompatSignals): number {
  // 50 = 동등, >50 = 펫 압도, <50 = 보호자 압도
  let score = 50;

  if (s.petStrength === "strong") score += 20;
  if (s.petStrength === "weak") score -= 15;

  if (s.petHasDohwa) score += 15;  // 귀여움 권력

  if (s.ownerStrength === "strong") score -= 15;
  if (s.ownerStrength === "weak") score += 15;

  // 종별 본성: 고양이는 기본 +10 (시니컬·황제 톤)
  if (s.petSpecies === "cat") score += 10;

  return clamp(score);
}

function computeLover(s: PetCompatSignals): number {
  let score = 55;  // 기본값

  score += s.ownerInseong * 8;        // 인성 = 보호 본능
  score += s.ownerSikSang * 5;        // 식상 = 베풀기
  score -= s.ownerBigeob * 5;         // 비겁 = 자기 우선

  // 인성·식상 둘 다 있으면 보너스
  if (s.ownerInseong >= 1 && s.ownerSikSang >= 1) score += 10;

  return clamp(score);
}

function computeConflict(s: PetCompatSignals): number {
  let score = 15;  // 기본 낮게 (대부분의 관계는 큰 충돌 없음)

  if (s.dayBranchChung) score += 25;
  if (s.dayBranchHyeong) score += 15;
  if (isSpeciesIncompat(s.petSpecies, s.ownerDayBranch)) score += 20;

  // fallback 등급일수록 충돌 신호 모호 → 점수 낮춤
  if (s.petBirthTier >= 3) score = Math.max(0, score - 10);

  return clamp(score);
}

function computeComposite(scores: Omit<PetCompatComputedScores, "composite" | "grade" | "scoringVersion">): number {
  // 가중치: sync 40%, ruler 균형도 20%, lover 25%, conflict 15%
  // ruler는 50에서 멀수록 페널티 (한쪽 압도 = 불균형)
  const rulerBalance = 100 - Math.abs(scores.ruler - 50) * 1.5;

  return clamp(
    0.40 * scores.sync +
    0.20 * rulerBalance +
    0.25 * scores.lover +
    0.15 * (100 - scores.conflict)
  );
}

// ────────────────────────────────────────────────────────
// 메인 함수
// ────────────────────────────────────────────────────────

export function computePetCompatScores(signals: PetCompatSignals): PetCompatComputedScores {
  const sync = computeSync(signals);
  const ruler = computeRuler(signals);
  const lover = computeLover(signals);
  const conflict = computeConflict(signals);

  const composite = computeComposite({ sync, ruler, lover, conflict });
  const grade = compositeToGrade(composite, signals);

  return {
    composite,
    sync,
    ruler,
    lover,
    conflict,
    grade,
    scoringVersion: PET_COMPAT_SCORING_VERSION,
  };
}

// ────────────────────────────────────────────────────────
// 테스트용 mock — 실제 사주 매핑 전까지 사용
// ────────────────────────────────────────────────────────

export function mockSignalsForTest(preset: "good" | "rebel" | "fallback"): PetCompatSignals {
  if (preset === "good") {
    return {
      ownerStrength: "weak",
      ownerInseong: 1,
      ownerSikSang: 2,
      ownerBigeob: 2,
      ownerDayBranch: "寅",
      petStrength: "strong",
      petDayBranch: "亥",
      petYearBranch: "丑",
      petHasDohwa: false,
      petBirthTier: 1,
      dayBranchHap: true,        // 寅亥 합
      dayBranchChung: false,
      dayBranchHyeong: false,
      petSpecies: "dog",
    };
  }
  if (preset === "rebel") {
    return {
      ownerStrength: "weak",
      ownerInseong: 1,
      ownerSikSang: 2,
      ownerBigeob: 2,
      ownerDayBranch: "寅",
      petStrength: "strong",
      petDayBranch: "子",
      petYearBranch: "寅",
      petHasDohwa: true,         // 도화 + 홍염
      petBirthTier: 1,
      dayBranchHap: false,
      dayBranchChung: false,
      dayBranchHyeong: false,
      petSpecies: "cat",
    };
  }
  // fallback
  return {
    ownerStrength: "weak",
    ownerInseong: 1,
    ownerSikSang: 2,
    ownerBigeob: 2,
    ownerDayBranch: "寅",
    petStrength: "balanced",
    petDayBranch: "戌",
    petYearBranch: "辰",
    petHasDohwa: false,
    petBirthTier: 4,
    dayBranchHap: false,
    dayBranchChung: false,
    dayBranchHyeong: false,
    petSpecies: "dog",
  };
}
