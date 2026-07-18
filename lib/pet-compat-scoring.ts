// 펫 궁합 점수 매핑 (v1)
// LLM이 점수 매기지 못하게 분리 — 서버에서 결정론적 계산.
// 사주 분석의 SCORING_VERSION 패턴 따름.
//
// v1 (2026-05-03): 첫 버전. 사주 신호를 받아 4지표 + composite 계산.
// v2 (2026-05-13): computeSync 페널티 diminishing returns 적용
//   — 충+극 동시 발생 시 sync 18까지 추락하던 문제 완화.
//   — 일지 페널티는 페어상 mutually exclusive (else-if), 일간 극과만 누적될 때 50% 적용.
// v3 (2026-07-11): 등급 컷 사주 마스터 컷 동기화 (2026-05-24 결정 이행).
//   — 펫 자체 컷(80/65/45/25) 폐기, COMPOSITE_GRADE_CUTOFFS(85/80/70/52) 단일 소스.
//   — composite는 경계 보존 piecewise remap으로 사주 스케일에 사상 → v2 등급 인구 분포 그대로 유지.
// 추후 실제 사주 enrichment 결과와 매핑 (현재는 minimal signals만 사용).

import type { LabelGrade, PetSpecies } from "./pet-compat";
import { COMPOSITE_GRADE_CUTOFFS } from "./gradeSystem"; // 상대경로: tsx 스크립트가 alias 없이 실행 가능해야 함

// v4: 신살 검출 버그 수정 — 도화·홍염·역마·천을귀인이 항상 false로 잡히던 것을 교정
//     (hasShinsalKey가 shinsal.matches[].label + pillar12Shinsal[*].name을 훑도록).
//     영향: 해당 신살 보유 펫의 ruler/lover 보정이 이제 반영됨. 400건 시뮬 분포 이동 경미(D 0% 유지).
// v5 (2026-07-18): 격자 실측(보호자 36×펫 40, 1,440쌍) 기반 리밸런스.
//   — N1: tier3(추정 생일) 일주 파생 신호 중화 (진짜 생일 대비 등급 61% 뒤바뀜 제거).
//     · WS2(F2, 2026-07): tier4(가족 된 날)도 동일하게 중화(중화는 lib/pet-compat-saju.ts extractPetCompatSignals에서). VERSION 5 유지(배포 전·캐시 없음).
//   — N3: isSpeciesIncompat를 신호로 승격 (conflict 점수와 LLM 근거 블록이 같은 신호를 봄).
//   — computeRuler/Lover/Loyalty 계수 리밸런스 (ruler mean 60.7→51.3, affectionGap +16.6→+6.1).
//   — pickLabelAndArchetype 재설계 (라벨 top1 편중 완화, 아키타입 8종 전부 발생).
//   — raw composite 분위수 재산정: REMAP_OLD [0,47,61,71,79,100] (p3/p25/p70/p92).
export const PET_COMPAT_SCORING_VERSION = 5;

// v5 raw composite 분위수(p3/p25/p70/p92 = 47/61/71/79)를
// 사주 마스터 컷(52/70/80/85) 스케일로 경계 보존 사상.
// 목표 등급 인구(S8~10/A20~25/B40~45/C20~25/D2~3)로 매핑되고, 점수 의미는 사주와 통일된다.
const REMAP_OLD = [0, 47, 61, 71, 79, 100];
const REMAP_NEW = [
  0,
  COMPOSITE_GRADE_CUTOFFS.C,
  COMPOSITE_GRADE_CUTOFFS.B,
  COMPOSITE_GRADE_CUTOFFS.A,
  COMPOSITE_GRADE_CUTOFFS.S,
  100,
];

export function remapComposite(raw: number): number {
  const r = Math.max(0, Math.min(100, raw));
  for (let i = 1; i < REMAP_OLD.length; i++) {
    if (r <= REMAP_OLD[i]) {
      const t = (r - REMAP_OLD[i - 1]) / (REMAP_OLD[i] - REMAP_OLD[i - 1]);
      const mapped = REMAP_NEW[i - 1] + t * (REMAP_NEW[i] - REMAP_NEW[i - 1]);
      // 경계 보존: 구 경계 "미만"은 반올림 후에도 신 경계 미만이어야 한다
      // (예: raw 79 → 84.x가 85로 반올림되면 A가 S로 넘어가는 버그)
      return r < REMAP_OLD[i] ? Math.min(Math.round(mapped), REMAP_NEW[i] - 1) : Math.round(mapped);
    }
  }
  return 100;
}

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
  isSpeciesIncompat: boolean;   // v5(N3): 종별 상극(보호자 일지 申子辰 등) — conflict와 LLM 근거 블록이 같은 신호를 보게
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
  archetype: PetArchetype; // v0.4(Track B): 관계 일러스트 장면 선택용 (라벨 분기와 동일 결정)
  scoringVersion: number;
}

// ────────────────────────────────────────────────────────
// 12지 상극 매트릭스 (세종의소리 칼럼 기반)
// ────────────────────────────────────────────────────────

const SPECIES_INCOMPAT: Record<"dog" | "cat", string[]> = {
  dog: ["申", "子", "辰"],   // 개 ↔ 원숭이/쥐/용
  cat: ["申", "子", "辰"],   // 고양이 ↔ 원숭이/쥐/용
};

export function isSpeciesIncompat(species: "dog" | "cat", ownerDayBranch: string): boolean {
  return SPECIES_INCOMPAT[species].includes(ownerDayBranch);
}

// ────────────────────────────────────────────────────────
// 등급 컷 — 사주 마스터 컷(COMPOSITE_GRADE_CUTOFFS) 단일 소스 (v3)
// ────────────────────────────────────────────────────────

function compositeToGrade(composite: number, signals: PetCompatSignals): LabelGrade {
  // fallback (tier 3·4)이면 D 부여 금지 (최저 C까지)
  const minGrade = signals.petBirthTier >= 3 ? "C" : "D";

  if (composite >= COMPOSITE_GRADE_CUTOFFS.S) return "S";
  if (composite >= COMPOSITE_GRADE_CUTOFFS.A) return "A";
  if (composite >= COMPOSITE_GRADE_CUTOFFS.B) return "B";
  if (composite >= COMPOSITE_GRADE_CUTOFFS.C) return "C";
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

  // 일지 보너스 — 합·삼합·방합 (페어 다르므로 누적 거의 없음, 안전하게 합산)
  if (s.dayBranchHap) score += 25;           // 6합 (자축·인해 등) — 강한 끌림
  if (s.dayBranchSamhap) score += 20;        // 삼합 (수국·목국 등) — 같은 의지
  if (s.dayBranchBanghap) score += 12;       // 방합 (동방·남방 등) — 같은 계절

  // 일지 페널티 — 충/형/원진은 페어 매트릭스상 mutually exclusive (else-if 명시)
  // 일간 극과 동시 발생 가능 → diminishing returns로 누적 충격 완화
  // (충 -25 + 극 -12 풀반영 시 base 55에서 sync 18까지 추락 → 사용자 충격)
  const penalties: number[] = [];
  if (s.dayBranchChung) penalties.push(25);             // 6충 — 정면 충돌
  else if (s.dayBranchHyeong) penalties.push(15);       // 형 — 스트레스 누적
  else if (s.dayBranchWonjin) penalties.push(12);       // 원진 — 미운 정

  if (s.dayMasterRelation === "geuk_to_pet" || s.dayMasterRelation === "geuk_to_owner") {
    penalties.push(12);                                  // 일간 오행 극
  }

  penalties.sort((a, b) => b - a);
  for (let i = 0; i < penalties.length; i++) {
    score -= penalties[i] * (i === 0 ? 1 : 0.5);         // 첫 번째 100%, 두 번째부터 50%
  }

  // 일간 오행 보너스 (극은 위 페널티에서 처리)
  switch (s.dayMasterRelation) {
    case "saeng_to_pet": score += 12; break;     // 보호자가 펫에게 에너지 줌
    case "saeng_to_owner": score += 12; break;   // 펫이 보호자에게 에너지 줌
    case "bihwa": score += 8; break;             // 같은 오행 (비화) — 친근
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

  // 신강신약 비교 (가장 큰 영향) — v5: 신강약 비대칭 교정 (편중 주범)
  if (s.petStrength === "strong" && s.ownerStrength === "weak") score += 28;       // 30→28
  else if (s.petStrength === "strong") score += 16;                                 // 18→16
  else if (s.petStrength === "weak" && s.ownerStrength === "strong") score -= 28;   // 25→28 (대칭화)
  else if (s.petStrength === "weak") score -= 16;                                   // 12→16 (대칭화)

  // 일간 오행 극 관계 — 펫이 보호자를 극하면 펫 우위
  if (s.dayMasterRelation === "geuk_to_owner") score += 15;   // v5: 18→15
  if (s.dayMasterRelation === "geuk_to_pet") score -= 15;     // 유지

  // 펫 신살 — 귀여움/매력으로 권력 (v5: prevalence 감안해 완화)
  if (s.petHasDohwa) score += 12;             // 15→12 도화·홍염 — 귀여움 권력
  if (s.petHasCheonEulGwiin) score += 8;      // 10→8 천을귀인 — 모셔지는 운

  // 보호자 인성 — 보호 본능으로 휘둘림
  score += Math.min(s.ownerInseong * 5, 15);  // v5: 6/18→5/15

  // 보호자 비겁 — 자기 우선 (펫에 안 휘둘림)
  score -= Math.min(s.ownerBigeob * 5, 15);   // 유지

  // 펫 관성 — 규율·복종 (펫이 우위 안 함)
  score -= Math.min(s.petGwanseong * 4, 12);  // 유지

  // 종별 본성: 고양이는 기본 +7 (시니컬·황제 톤, 펫 도메인 표준)
  if (s.petSpecies === "cat") score += 7;      // v5: 8→7

  return clamp(score);
}

// ────────────────────────────────────────────────────────
// 🐶 랜선집사 지수 (lover) — 보호자가 펫에 매달리는 정도
// ────────────────────────────────────────────────────────
function computeLover(s: PetCompatSignals): number {
  let score = 50;

  // 보호자 십성 신호 — v5: 가산 3종 부풀림 완화 (mean 70.8→감소, gap 정상화)
  score += Math.min(s.ownerInseong * 8, 20);      // 10/25→8/20 인성 = 보호 본능
  score += Math.min(s.ownerSikSang * 5, 12);      // 7/18→5/12 식상 = 베풀기
  score += Math.min(s.ownerJaeseong * 4, 10);     // 5/12→4/10 편재·정재 — 펫에 돈 씀
  score -= Math.min(s.ownerBigeob * 7, 18);       // 유지 비겁 = 자기 우선

  // 보호자가 펫을 생함 — 일방적으로 에너지 줌
  if (s.dayMasterRelation === "saeng_to_pet") score += 15;

  // 펫에 도화·홍염 — 보호자가 더 빠짐
  if (s.petHasDohwa) score += 8;                   // v5: 10→8

  // 보호자 신약 + 펫 신강 — 보호자가 의지·매달림
  if (s.ownerStrength === "weak" && s.petStrength === "strong") score += 10;  // v5: 12→10

  return clamp(score);
}

// ────────────────────────────────────────────────────────
// 🐾 펫 충성 지수 (loyalty) — 펫이 보호자를 따르고 의지하는 정도
// "반려동물이 더 좋아하는가" 잡아냄. lover (보호자 → 펫)와 대비.
// ────────────────────────────────────────────────────────
function computeLoyalty(s: PetCompatSignals): number {
  let score = 48;  // v5: 45→48 (affectionGap 대칭화 — lover 부풀림 상쇄)

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

  // 종 본성: 고양이는 기본 -8 (시니컬 베이스)
  if (s.petSpecies === "cat") score -= 8;   // v5: 10→8

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

  // 종별 상극 (세종의소리 매트릭스: 개/고양이 ↔ 申子辰) — v5(N3): 추출부에서 계산된 신호 사용
  if (s.isSpeciesIncompat) score += 18;

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

// v0.4(Track B): 라벨을 정하는 같은 분기에서 일러스트 아키타입도 동시 결정 → 타이틀↔그림 일치 보장.
// 라벨 문자열·분기 조건 무변경(점수 회귀 0). archetype은 관계 일러스트 장면(SCENE_BLOCKS) 선택에만 사용.
export type PetArchetype =
  | "HARMONY" | "OWNER_DEVOTION" | "PET_DEVOTION" | "PET_THRONE"
  | "OWNER_MANAGER" | "OFFBEAT" | "ROOMMATE" | "DISTANT_FATE";

function pickLabelAndArchetype(
  grade: LabelGrade,
  scores: { ruler: number; conflict: number; sync: number; lover: number; loyalty: number },
  species: PetSpecies,
): { text: string; archetype: PetArchetype } {
  const { ruler, conflict, sync, lover, loyalty } = scores;
  const affectionGap = lover - loyalty;  // 양수 = 보호자 일방, 음수 = 펫 일방

  // v5: 격자 실측 기반 재설계 — 임계 재조정으로 라벨 top1 편중 완화 + 아키타입 8종 전부 발생.
  //     분기 구조·아키타입 집합 불변(SCENE_BLOCKS 무변경), 문구·임계만 조정.
  if (grade === "S") {
    if (sync >= 85 && Math.abs(affectionGap) <= 15) return { text: "전생에 한 이불 쓰던 인연", archetype: "HARMONY" };
    if (ruler >= 70) return { text: "귀하신 몸과 복 받은 집사", archetype: "PET_THRONE" };
    if (affectionGap >= 20) return { text: "찰떡인데 더 빠진 쪽은 너", archetype: "OWNER_DEVOTION" };
    if (affectionGap <= -20) return { text: "공식 인증 껌딱지 인연", archetype: "PET_DEVOTION" };
    return { text: "팔자가 먼저 알아본 인연", archetype: "HARMONY" };
  }
  if (grade === "A") {
    if (ruler >= 66 && affectionGap >= 8) return { text: "행복한 시종과 흡족한 상전", archetype: "PET_THRONE" };
    if (ruler <= 32) return { text: "믿고 따르는 전담 매니저", archetype: "OWNER_MANAGER" };
    if (affectionGap >= 22) return { text: "애정 지분은 네가 51%", archetype: "OWNER_DEVOTION" };
    if (affectionGap <= -22) return { text: "너에게 올인한 순정파", archetype: "PET_DEVOTION" };
    if (conflict >= 30) return { text: "서로 좋아 죽는데 둘 다 유난함", archetype: "OFFBEAT" };
    if (sync >= 80) return { text: "손발 척척 환상의 복식조", archetype: "HARMONY" };
    return { text: "합 잘 맞는 단짝 콤비", archetype: "HARMONY" };
  }
  if (grade === "B") {
    if (ruler >= 66 && affectionGap >= 10) return { text: "간식 셔틀과 네 발 상전", archetype: "PET_THRONE" };
    if (ruler <= 30) return { text: "이 집 결재권자는 너", archetype: "OWNER_MANAGER" };
    if (affectionGap >= 20) return { text: "너만 애가 타는 짝사랑", archetype: "OWNER_DEVOTION" };
    if (affectionGap <= -20) return { text: "현관 소리만 기다리는 순애보", archetype: "PET_DEVOTION" };
    if (conflict >= 38) return { text: "투닥대며 정드는 애증 콤비", archetype: "OFFBEAT" };
    if (sync >= 70) return { text: "티격태격해도 합은 찰떡", archetype: "HARMONY" };
    return { text: "츤데레 룸메이트", archetype: "ROOMMATE" };
  }
  if (grade === "C") {
    if (ruler >= 63 && affectionGap >= 10) return { text: "무급인데 평생직장", archetype: "PET_THRONE" };
    if (ruler <= 32) return { text: "네 계획표대로 크는 아이", archetype: "OWNER_MANAGER" };
    if (conflict >= 50) return { text: "투닥거려도 결국 한솥밥", archetype: "OFFBEAT" };
    if (affectionGap >= 25) return { text: "들이대는 너, 한 발 빼는 얘", archetype: "OWNER_DEVOTION" };
    if (affectionGap <= -25) return { text: "무뚝뚝한 너만 바라기", archetype: "PET_DEVOTION" };
    return { text: "극과 극인데 한 지붕 아래", archetype: "ROOMMATE" };
  }
  // D — "묘연(猫緣)"은 고양이 전용 → 강아지는 "인연"
  return { text: species === "cat" ? "천천히 스며드는 묘연" : "천천히 스며드는 인연", archetype: "DISTANT_FATE" };
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

  const composite = remapComposite(computeComposite({ sync, ruler, lover, loyalty, conflict }));
  const grade = compositeToGrade(composite, signals);
  const { text: labelText, archetype } = pickLabelAndArchetype(grade, { ruler, conflict, sync, lover, loyalty }, signals.petSpecies);

  return {
    composite,
    sync,
    ruler,
    lover,
    loyalty,
    conflict,
    grade,
    labelText,
    archetype,
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
    isSpeciesIncompat: false,
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
