// 펫 사주 계산 + 보호자-펫 신호 추출
// v1 (2026-05-03)
//
// 흐름: PetInput → calculatePetEnrichedSaju → EnrichedSajuData
//      Owner enriched + Pet enriched → extractPetCompatSignals → PetCompatSignals
//      → computePetCompatScores (점수 계산)

import { calculateSaju, enrichSajuData, type SajuData } from "./utils/saju";
import { convertLunarToSolar } from "./utils/lunar";
import type { EnrichedSajuData } from "./utils/saju-enrichment";
import type { PetInput, PetSpecies } from "./pet-compat";
import type { PetCompatSignals, Strength } from "./pet-compat-scoring";

// ────────────────────────────────────────────────────────
// 펫 사주 계산 (4티어 fallback)
// ────────────────────────────────────────────────────────

interface CalculatedPetSaju {
  enriched: EnrichedSajuData | null;        // null = 계산 불가
  reliability: "full" | "high" | "medium" | "low";
  note: string;                              // tier별 신뢰도 메모
}

export async function calculatePetEnrichedSaju(pet: PetInput): Promise<CalculatedPetSaju> {
  // tier 1: 정확 생일+시
  if (pet.birthTier === 1 && pet.birthDate && pet.birthTime) {
    return await tryCalc(pet.birthDate, pet.birthTime, pet.calendarType, false, "full", "정확한 생일+시 — 풀 해석");
  }

  // tier 2: 생일만
  if (pet.birthTier === 2 && pet.birthDate) {
    return await tryCalc(pet.birthDate, undefined, pet.calendarType, true, "high", "생일만 — 시주 미상, 일주·월주·연주 해석");
  }

  // tier 3: 추정 월·년 → 해당 월의 15일 정오로 근사
  if (pet.birthTier === 3 && pet.birthYearEstimated) {
    const month = pet.birthMonthEstimated || 6;  // 모르면 6월
    const dateStr = `${pet.birthYearEstimated}-${String(month).padStart(2, "0")}-15`;
    return await tryCalc(dateStr, undefined, "solar", true, "medium", "추정 생일 — 큰 흐름만 해석 가능");
  }

  // tier 4: 가족 된 날 대체
  if (pet.birthTier === 4 && pet.adoptionDate) {
    return await tryCalc(pet.adoptionDate, undefined, "solar", true, "low", "가족 된 날 기준 (참고용) — 정식 생일 알면 더 정확");
  }

  return { enriched: null, reliability: "low", note: "생일 정보 부족" };
}

async function tryCalc(
  dateStr: string,
  timeStr: string | undefined,
  calendar: "solar" | "lunar" | undefined,
  isTimeUnknown: boolean,
  reliability: CalculatedPetSaju["reliability"],
  note: string,
): Promise<CalculatedPetSaju> {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { enriched: null, reliability, note: `${note} (날짜 형식 오류)` };

  let year = Number(m[1]);
  let month = Number(m[2]);
  let day = Number(m[3]);

  if (calendar === "lunar") {
    const conv = convertLunarToSolar(year, month, day);
    if (!conv) return { enriched: null, reliability, note: `${note} (음양 변환 실패)` };
    year = conv.year;
    month = conv.month;
    day = conv.day;
  }

  let hour: number | undefined;
  let minute: number | undefined;
  if (timeStr && !isTimeUnknown) {
    const tm = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (tm) {
      hour = Number(tm[1]);
      minute = Number(tm[2]);
    }
  }

  const saju = await calculateSaju(year, month, day, hour, minute);
  if (!saju) return { enriched: null, reliability, note: `${note} (계산 실패)` };

  const enriched = enrichSajuData(saju, { isTimeUnknown });
  return { enriched, reliability, note };
}

// ────────────────────────────────────────────────────────
// 신호 추출 (보호자 + 펫 → PetCompatSignals)
// ────────────────────────────────────────────────────────

// 신강 레벨을 strong/weak/balanced 3단계로 단순화
function strengthToTier(level: string): Strength {
  if (level === "극왕" || level === "태강" || level === "신강") return "strong";
  if (level === "신약" || level === "태약" || level === "극약") return "weak";
  return "balanced";  // 중화신강, 중화신약
}

// 십성 배열에서 그룹별 개수 집계
// tenStars 요소 형식: "정인(正印)", "식신(食神)" 같이 한자 병기 — startsWith로 매칭
function countTenStarGroups(tenStars: string[]): {
  inseong: number;     // 정인 + 편인
  sikSang: number;     // 식신 + 상관
  bigeob: number;      // 비견 + 겁재
  jaesong: number;     // 정재 + 편재
  gwanseong: number;   // 정관 + 편관
} {
  const counts = { inseong: 0, sikSang: 0, bigeob: 0, jaesong: 0, gwanseong: 0 };
  for (const ts of tenStars) {
    if (ts.startsWith("정인") || ts.startsWith("편인")) counts.inseong++;
    else if (ts.startsWith("식신") || ts.startsWith("상관")) counts.sikSang++;
    else if (ts.startsWith("비견") || ts.startsWith("겁재")) counts.bigeob++;
    else if (ts.startsWith("정재") || ts.startsWith("편재")) counts.jaesong++;
    else if (ts.startsWith("정관") || ts.startsWith("편관")) counts.gwanseong++;
  }
  return counts;
}

// 일지 한자 추출 (예: "甲寅" → "寅")
function getDayBranchHanja(pillars: { day: string }): string {
  return pillars.day.length >= 2 ? pillars.day.slice(1, 2) : "";
}

// 연지 한자 추출
function getYearBranchHanja(pillars: { year: string }): string {
  return pillars.year.length >= 2 ? pillars.year.slice(1, 2) : "";
}

// ────────────────────────────────────────────────────────
// 12지 관계 매트릭스 (정통 명리)
// ────────────────────────────────────────────────────────

const HAP_PAIRS: [string, string][] = [
  ["子", "丑"], ["寅", "亥"], ["卯", "戌"], ["辰", "酉"], ["巳", "申"], ["午", "未"],
];
const CHUNG_PAIRS: [string, string][] = [
  ["子", "午"], ["丑", "未"], ["寅", "申"], ["卯", "酉"], ["辰", "戌"], ["巳", "亥"],
];
const HYUNG_GROUPS: string[][] = [
  ["寅", "巳", "申"],   // 인사신 삼형
  ["丑", "戌", "未"],   // 축술미 삼형
  ["子", "卯"],         // 자묘 무례지형
  ["辰"], ["午"], ["酉"], ["亥"],  // 자형 (같은 글자)
];
const WONJIN_PAIRS: [string, string][] = [
  ["子", "未"], ["丑", "午"], ["寅", "酉"], ["卯", "申"], ["辰", "亥"], ["巳", "戌"],
];
const SAMHAP_GROUPS: string[][] = [
  ["申", "子", "辰"],   // 수국
  ["亥", "卯", "未"],   // 목국
  ["寅", "午", "戌"],   // 화국
  ["巳", "酉", "丑"],   // 금국
];
const BANGHAP_GROUPS: string[][] = [
  ["寅", "卯", "辰"],   // 동방 목
  ["巳", "午", "未"],   // 남방 화
  ["申", "酉", "戌"],   // 서방 금
  ["亥", "子", "丑"],   // 북방 수
];

function pairIn(pairs: [string, string][], a: string, b: string): boolean {
  return pairs.some(([x, y]) => (x === a && y === b) || (y === a && x === b));
}
function inSameGroup(groups: string[][], a: string, b: string): boolean {
  if (!a || !b || a === b) return false;
  return groups.some((g) => g.includes(a) && g.includes(b));
}
function isHyung(a: string, b: string): boolean {
  if (!a || !b) return false;
  for (const group of HYUNG_GROUPS) {
    if (group.length === 1 && a === b && a === group[0]) return true;
    if (group.length > 1 && group.includes(a) && group.includes(b) && a !== b) return true;
  }
  return false;
}

// ────────────────────────────────────────────────────────
// 일간 오행 관계 (생조·상극·비화)
// 목→화, 화→토, 토→금, 금→수, 수→목 (生)
// 목↔토, 토↔수, 수↔화, 화↔금, 금↔목 (剋)
// ────────────────────────────────────────────────────────

const SAENG_MAP: Record<string, string> = {
  목: "화", 화: "토", 토: "금", 금: "수", 수: "목",
};
const GEUK_MAP: Record<string, string> = {
  목: "토", 토: "수", 수: "화", 화: "금", 금: "목",
};

import type { OhaengRelation } from "./pet-compat-scoring";

function getOhaengRelation(ownerElement: string, petElement: string): OhaengRelation {
  if (!ownerElement || !petElement) return "none";
  if (ownerElement === petElement) return "bihwa";
  if (SAENG_MAP[ownerElement] === petElement) return "saeng_to_pet";   // 보호자가 펫을 생함
  if (SAENG_MAP[petElement] === ownerElement) return "saeng_to_owner"; // 펫이 보호자를 생함
  if (GEUK_MAP[ownerElement] === petElement) return "geuk_to_pet";     // 보호자가 펫을 극함
  if (GEUK_MAP[petElement] === ownerElement) return "geuk_to_owner";   // 펫이 보호자를 극함
  return "none";
}

// ────────────────────────────────────────────────────────
// 신살 검출 (도화·홍염·역마·천을귀인)
// ────────────────────────────────────────────────────────

function hasShinsalKey(shinsal: any, keyword: string): boolean {
  if (!shinsal) return false;
  const keys = Object.keys(shinsal);
  return keys.some((k) =>
    k.includes(keyword) ||
    (typeof shinsal[k] === "string" && shinsal[k].includes(keyword))
  );
}

// ────────────────────────────────────────────────────────
// 메인 신호 추출 함수
// ────────────────────────────────────────────────────────

export function extractPetCompatSignals(
  ownerEnriched: EnrichedSajuData,
  petEnriched: EnrichedSajuData | null,
  pet: PetInput,
): PetCompatSignals {
  const ownerCounts = countTenStarGroups(ownerEnriched.tenStars);
  const ownerStrength = strengthToTier(ownerEnriched.strength?.result || "중화신강");
  const ownerDayBranch = getDayBranchHanja(ownerEnriched.pillars);
  const ownerDayMasterElement = ownerEnriched.dayMaster?.element || "";

  // 펫 사주 미계산 시 — fallback (균형 + 일반 기본값)
  if (!petEnriched) {
    return {
      ownerStrength,
      ownerInseong: ownerCounts.inseong,
      ownerSikSang: ownerCounts.sikSang,
      ownerBigeob: ownerCounts.bigeob,
      ownerJaeseong: ownerCounts.jaesong,
      ownerGwanseong: ownerCounts.gwanseong,
      ownerDayBranch,
      ownerDayMasterElement,
      petStrength: "balanced",
      petInseong: 0,
      petSikSang: 0,
      petBigeob: 0,
      petJaeseong: 0,
      petGwanseong: 0,
      petDayBranch: "",
      petYearBranch: "",
      petDayMasterElement: "",
      petHasDohwa: false,
      petHasYeokma: false,
      petHasCheonEulGwiin: false,
      petTwelveStage: "",
      petBirthTier: pet.birthTier,
      dayBranchHap: false,
      dayBranchSamhap: false,
      dayBranchBanghap: false,
      dayBranchChung: false,
      dayBranchHyeong: false,
      dayBranchWonjin: false,
      dayMasterRelation: "none",
      yearBranchHap: false,
      yearBranchChung: false,
      petSpecies: pet.species,
    };
  }

  const petCounts = countTenStarGroups(petEnriched.tenStars);
  const petStrength = strengthToTier(petEnriched.strength?.result || "중화신강");
  const petDayBranch = getDayBranchHanja(petEnriched.pillars);
  const petYearBranch = getYearBranchHanja(petEnriched.pillars);
  const petDayMasterElement = petEnriched.dayMaster?.element || "";

  const ownerYearBranch = getYearBranchHanja(ownerEnriched.pillars);

  return {
    ownerStrength,
    ownerInseong: ownerCounts.inseong,
    ownerSikSang: ownerCounts.sikSang,
    ownerBigeob: ownerCounts.bigeob,
    ownerJaeseong: ownerCounts.jaesong,
    ownerGwanseong: ownerCounts.gwanseong,
    ownerDayBranch,
    ownerDayMasterElement,

    petStrength,
    petInseong: petCounts.inseong,
    petSikSang: petCounts.sikSang,
    petBigeob: petCounts.bigeob,
    petJaeseong: petCounts.jaesong,
    petGwanseong: petCounts.gwanseong,
    petDayBranch,
    petYearBranch,
    petDayMasterElement,
    petHasDohwa: hasShinsalKey(petEnriched.shinsal, "도화") || hasShinsalKey(petEnriched.shinsal, "홍염"),
    petHasYeokma: hasShinsalKey(petEnriched.shinsal, "역마"),
    petHasCheonEulGwiin: hasShinsalKey(petEnriched.shinsal, "천을"),
    petTwelveStage: petEnriched.twelveStages?.day?.korean || "",
    petBirthTier: pet.birthTier,

    // 관계 신호 — 일지 기준
    dayBranchHap: pairIn(HAP_PAIRS, ownerDayBranch, petDayBranch),
    dayBranchSamhap: inSameGroup(SAMHAP_GROUPS, ownerDayBranch, petDayBranch),
    dayBranchBanghap: inSameGroup(BANGHAP_GROUPS, ownerDayBranch, petDayBranch),
    dayBranchChung: pairIn(CHUNG_PAIRS, ownerDayBranch, petDayBranch),
    dayBranchHyeong: isHyung(ownerDayBranch, petDayBranch),
    dayBranchWonjin: pairIn(WONJIN_PAIRS, ownerDayBranch, petDayBranch),
    dayMasterRelation: getOhaengRelation(ownerDayMasterElement, petDayMasterElement),

    // 연지(띠) 신호
    yearBranchHap: pairIn(HAP_PAIRS, ownerYearBranch, petYearBranch),
    yearBranchChung: pairIn(CHUNG_PAIRS, ownerYearBranch, petYearBranch),

    petSpecies: pet.species,
  };
}

// ────────────────────────────────────────────────────────
// 펫 사주 텍스트 빌더 (LLM 프롬프트용)
// ────────────────────────────────────────────────────────

import { formatEnrichedSajuText } from "./utils/saju-enrichment";

export function buildPetSajuText(
  pet: PetInput,
  enriched: EnrichedSajuData | null,
  reliability: CalculatedPetSaju["reliability"],
  note: string,
): string {
  const speciesNature = pet.species === "dog"
    ? "戌(土) — 중화의 성격, 어디든 잘 어울림, 심성 안 변함 (세종의소리 칼럼)"
    : "寅(木) — 상향 의지, 천진난만, 정 끌어들임 (세종의소리 칼럼)";

  // v0.7: 중성화 신호 제거 (명리학적 정당성 약함)
  const extras: string[] = [];

  if (!enriched) {
    return `
[펫 사주 — ${pet.name} (계산 불가)]
${note}
종 본성: ${speciesNature}
견종/묘종: ${pet.breed || "(미상/믹스)"}
${extras.length > 0 ? extras.join("\n") + "\n" : ""}※ 사주 데이터 없음 — 종 본성과 보조 신호만 참고
`.trim();
  }

  const reliabilityLabel = {
    full: "정확 (풀 해석)",
    high: "양호 (시주 빼고)",
    medium: "보통 (큰 흐름만)",
    low: "낮음 (참고용)",
  }[reliability];

  const sajuBlock = formatEnrichedSajuText(enriched);

  return `
[펫 사주 — ${pet.name}]
신뢰도: ${reliabilityLabel} — ${note}

${sajuBlock}

[종/품종 본성]
종 본성: ${speciesNature}
${pet.species === "dog" ? "견종" : "묘종"}: ${pet.breed || "(미상/믹스)"}
${extras.length > 0 ? "\n[보조 신호]\n" + extras.join("\n") : ""}
`.trim();
}
