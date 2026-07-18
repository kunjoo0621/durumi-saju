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
import { isSpeciesIncompat } from "./pet-compat-scoring";
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

// v0.3: manual.spec 서버 결정론화 — 연지→오행/동물을 서버가 매핑 (LLM "子띠 金" 오류 차단)
const BRANCH_ELEMENT: Record<string, string> = {
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
};
const BRANCH_ANIMAL: Record<string, string> = {
  子: "쥐", 丑: "소", 寅: "범", 卯: "토끼", 辰: "용", 巳: "뱀",
  午: "말", 未: "양", 申: "원숭이", 酉: "닭", 戌: "개", 亥: "돼지",
};

/** 사용설명서 spec 문자열을 서버가 조립. 형식 "[나이], [품종], [연지](동물)띠 [오행] 기운" */
export function buildPetSpec(pet: PetInput, petEnriched: EnrichedSajuData | null): string {
  const nowYear = new Date().getFullYear();
  let ageStr = "나이 미상";
  if ((pet.birthTier === 1 || pet.birthTier === 2) && pet.birthDate) {
    const y = parseInt(pet.birthDate.slice(0, 4), 10);
    if (y) ageStr = `${Math.max(0, nowYear - y)}세`;
  } else if (pet.birthTier === 3 && pet.birthYearEstimated) {
    ageStr = `약 ${Math.max(0, nowYear - pet.birthYearEstimated)}세`;
  }
  const breed = pet.breed || "믹스";
  // F1(WS2): tier 4(가족 된 날)는 연지가 펫의 '실제 띠'가 아니라 입양연도 지지 → 띠·오행을 확정처럼 쓰지 않는다.
  //          (tier 4 사주 신호는 extractPetCompatSignals에서도 중화됨.)
  if (pet.birthTier === 4) {
    return `${ageStr}, ${breed} (가족 된 날 기준 · 정확한 띠 미상)`;
  }
  const yb = petEnriched ? getYearBranchHanja(petEnriched.pillars) : "";
  if (yb && BRANCH_ANIMAL[yb]) {
    const suffix = pet.birthTier === 3 ? " (추정)" : "";
    return `${ageStr}, ${breed}, ${yb}(${BRANCH_ANIMAL[yb]})띠 ${BRANCH_ELEMENT[yb]} 기운${suffix}`;
  }
  return `${ageStr}, ${breed}, (띠 미상, 가족 된 날 기준)`;
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

// enriched의 신살을 keyword(한글)로 검사한다.
// 신살은 두 필드에 나뉘어 있음 → 둘 다 훑어야 한다 (dual-field):
//   ① 일반신살  enriched.shinsal.matches[].label  ("도화살(桃花殺)" 등)  ─ labels 배열도 동일
//   ② 12신살    enriched.pillar12Shinsal.{year,month,day,hour}.name    ("역마살" 등)
// (과거 버그: Object.keys(shinsal)="matches"만 검사 → 배열 안 label에 도달 못 해
//  도화·홍염·역마·천을귀인이 전부 false로 검출됨. 홍염살 있는 펫도 petHasDohwa=false였음.)
function hasShinsalKey(enriched: any, keyword: string): boolean {
  if (!enriched) return false;
  const labels: string[] = [];

  const shinsal = enriched.shinsal;
  if (shinsal) {
    if (Array.isArray(shinsal.labels)) {
      labels.push(...shinsal.labels);
    } else if (Array.isArray(shinsal.matches)) {
      for (const m of shinsal.matches) if (m?.label) labels.push(m.label);
    }
  }

  const p12 = enriched.pillar12Shinsal;
  if (p12) {
    for (const p of [p12.year, p12.month, p12.day, p12.hour]) {
      if (p?.name) labels.push(p.name);
    }
  }

  return labels.some((l) => typeof l === "string" && l.includes(keyword));
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
      isSpeciesIncompat: isSpeciesIncompat(pet.species, ownerDayBranch),
    };
  }

  const petCounts = countTenStarGroups(petEnriched.tenStars);
  const petStrength = strengthToTier(petEnriched.strength?.result || "중화신강");
  const petDayBranch = getDayBranchHanja(petEnriched.pillars);
  const petYearBranch = getYearBranchHanja(petEnriched.pillars);
  const petDayMasterElement = petEnriched.dayMaster?.element || "";

  const ownerYearBranch = getYearBranchHanja(ownerEnriched.pillars);

  const signals: PetCompatSignals = {
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
    petHasDohwa: hasShinsalKey(petEnriched, "도화") || hasShinsalKey(petEnriched, "홍염"),
    petHasYeokma: hasShinsalKey(petEnriched, "역마"),
    petHasCheonEulGwiin: hasShinsalKey(petEnriched, "천을"),
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
    isSpeciesIncompat: isSpeciesIncompat(pet.species, ownerDayBranch),
  };

  // v5(N1)→WS2(F2): tier 3(추정 생일=그 달 15일 정오 근사)·tier 4(가족 된 날 대체)는
  // 일주가 근사치라 일주 파생 신호가 허구. 두 티어 모두 연주(띠)·종·isSpeciesIncompat만 남기고 중화한다.
  // 실측(tier3): 유지 시 진짜 생일 대비 등급 61% 뒤바뀜, |Δruler| 평균 19. tier4는 그 연장(가족 된 날≠생일).
  // 중화 결과 petDayMasterElement/petTwelveStage가 ""가 되어 pet-compat.ts lowReliability=true → 프롬프트 가드 자동 작동.
  if (pet.birthTier === 3 || pet.birthTier === 4) {
    return {
      ...signals,
      petStrength: "balanced",
      petInseong: 0, petSikSang: 0, petBigeob: 0, petJaeseong: 0, petGwanseong: 0,
      petDayBranch: "", petDayMasterElement: "",
      petHasDohwa: false, petHasYeokma: false, petHasCheonEulGwiin: false, petTwelveStage: "",
      dayBranchHap: false, dayBranchSamhap: false, dayBranchBanghap: false,
      dayBranchChung: false, dayBranchHyeong: false, dayBranchWonjin: false,
      dayMasterRelation: "none",
    };
  }

  return signals;
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

  // F3(WS2): tier 3(추정 생일=그 달 15일 정오 근사)·tier 4(가족 된 날)은 일주가 근사치라
  // 일주 파생(일간·일지·신살·12운성)과 그에 오염된 전체 집계(오행분포·신강·십성·합충형)가 허구다.
  // 지시-only 가드로는 LLM이 fabricated 사주블록을 그대로 읽어 새어나가므로, 서버에서
  // 사주블록을 연주·월주만 남기고 실제 절삭한다(종 본성은 아래 [종/품종 본성]에서 유지).
  const isLowTier = pet.birthTier === 3 || pet.birthTier === 4;
  const sajuBlock = isLowTier
    ? [
        `년주: ${enriched.pillars.year} / 월주: ${enriched.pillars.month}`,
        "※ 일주(일간·일지)는 추정 근사치라 제외됨 — 연주(띠)·월주의 큰 흐름만 담백하게 서술하고, 일지 합충·신살·12운성·일간 오행은 지어내지 마라.",
      ].join("\n")
    : formatEnrichedSajuText(enriched);

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
