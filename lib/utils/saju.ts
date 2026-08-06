import crypto from "crypto";
import { createDateFnsAdapter } from "@gracefullight/saju/adapters/date-fns";
import { getFourPillars, analyzeTwelveStages } from "@gracefullight/saju";
import {
  BRANCH_INFO as ENRICH_BRANCH_INFO,
  STEM_ELEMENT as ENRICH_STEM_ELEMENT,
  analyzeElementBalance,
  calculateElementDistribution,
  calculateTenStars,
  calculateTenStarsFull,
  findRelationships,
  findShinsal,
  formatEnrichedSajuText,
  getPillar12Shinsal,
  judgeStrength,
  determineYongshin,
  type EnrichedSajuData,
  type TwelveStageEntry,
} from "./saju-enrichment";

export { formatEnrichedSajuText } from "./saju-enrichment";

// 어댑터 싱글톤 캐시 - 매번 생성하지 않음
let cachedAdapter: Awaited<ReturnType<typeof createDateFnsAdapter>> | null = null;
let adapterPromise: Promise<Awaited<ReturnType<typeof createDateFnsAdapter>>> | null = null;

/**
 * 이 엔진은 프로세스 TZ가 **UTC** 여야 절기가 맞는다(직관과 반대 — instrumentation.ts 참조).
 * 서버는 instrumentation 이 보장하지만 **scripts/*.mts 는 그 훅을 안 거친다.**
 * `lib/utils/saju` 를 import 하는 스크립트가 23개인데, KST 맥에서 `TZ=UTC` 를 빼먹고
 * 돌리면 **조용히 틀린 값**이 나온다(월주 ~1.2%/인, 대운수 ~12.5%/인).
 * 조용히 틀리는 게 최악이라 여기서 자가치유한다. 프로덕션(UTC)에선 no-op.
 * throw 가 아니라 교정인 이유: 배포 환경이 어떤 이유로든 UTC가 아닐 때 서비스를
 * 죽이는 것보다 맞는 값을 내는 게 낫다.
 */
function ensureUtcProcess() {
  if (new Date().getTimezoneOffset() === 0) return;
  const before = process.env.TZ ?? "(미설정)";
  process.env.TZ = "UTC";
  if (new Date().getTimezoneOffset() === 0) {
    console.warn(`[saju] 프로세스 TZ를 UTC로 교정했다(이전: ${before}). 절기 계산은 UTC 전제다.`);
  } else {
    console.error(`[saju] ★TZ를 UTC로 못 바꿨다(현재 offset ${-new Date().getTimezoneOffset() / 60}h). 절기·월주가 틀릴 수 있다.`);
  }
}

export async function getAdapter() {
  ensureUtcProcess();
  if (cachedAdapter) return cachedAdapter;
  if (adapterPromise) return adapterPromise;

  adapterPromise = createDateFnsAdapter()
    .then((adapter) => {
      cachedAdapter = adapter;
      return adapter;
    })
    .catch((err) => {
      adapterPromise = null;
      cachedAdapter = null;
      throw err;
    });

  return adapterPromise;
}

export type SajuPillar = {
  heavenlyStem: string;
  earthlyBranch: string;
  hiddenStems: string[];
};

export type SajuData = {
  year: SajuPillar;
  month: SajuPillar;
  day: SajuPillar;
  hour: SajuPillar;
  meta?: {
    isSummerTimeCorrected?: boolean;
    birthLongitudeDeg?: number;
    equationOfTimeMinutes?: number;
  };
};

export type ElementType = "wood" | "fire" | "earth" | "metal" | "water";
export type YinYang = "yang" | "yin";

// 천간 -> 오행 매핑
const HEAVENLY_STEM_TO_ELEMENT: Record<string, ElementType> = {
  甲: "wood",
  乙: "wood",
  丙: "fire",
  丁: "fire",
  戊: "earth",
  己: "earth",
  庚: "metal",
  辛: "metal",
  壬: "water",
  癸: "water",
};

// 지지 -> 오행 매핑
const EARTHLY_BRANCH_TO_ELEMENT: Record<string, ElementType> = {
  子: "water",
  丑: "earth",
  寅: "wood",
  卯: "wood",
  辰: "earth",
  巳: "fire",
  午: "fire",
  未: "earth",
  申: "metal",
  酉: "metal",
  戌: "earth",
  亥: "water",
};

// 천간 한글 표기
const HEAVENLY_STEM_TO_KOREAN: Record<string, string> = {
  甲: "갑",
  乙: "을",
  丙: "병",
  丁: "정",
  戊: "무",
  己: "기",
  庚: "경",
  辛: "신",
  壬: "임",
  癸: "계",
};

// 지지 한글 표기
const EARTHLY_BRANCH_TO_KOREAN: Record<string, string> = {
  子: "자",
  丑: "축",
  寅: "인",
  卯: "묘",
  辰: "진",
  巳: "사",
  午: "오",
  未: "미",
  申: "신",
  酉: "유",
  戌: "술",
  亥: "해",
};

// 음양
const STEM_POLARITY: Record<string, YinYang> = {
  甲: "yang",
  乙: "yin",
  丙: "yang",
  丁: "yin",
  戊: "yang",
  己: "yin",
  庚: "yang",
  辛: "yin",
  壬: "yang",
  癸: "yin",
};

const BRANCH_POLARITY: Record<string, YinYang> = {
  子: "yang",
  丑: "yin",
  寅: "yang",
  卯: "yin",
  辰: "yang",
  巳: "yin",
  午: "yang",
  未: "yin",
  申: "yang",
  酉: "yin",
  戌: "yang",
  亥: "yin",
};

// 지지 속장간 (첫 번째가 정기)
const EARTHLY_BRANCH_HIDDEN_STEMS: Record<string, string[]> = {
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  // 巳 순서 교정(2026-08-03): 정본 BRANCH_INFO(saju-enrichment.ts)와 같은 丙·庚·戊 로 통일.
  // 월률분야 서열상 중기 庚 > 여기 戊 이므로 enrichment 쪽이 옳다.
  // 산출 무영향 확인: 이 표의 소비처는 (a) getMainHiddenStem = [0]=丙 (변화 없음),
  // (b) career/wealth/marriage-facts의 pillar.hiddenStems 순회 — 무게·랭크는 전부
  // BRANCH_INFO에서 다시 뽑고, 순회 결과가 배열 순서로 노출되는 곳(spouseStars·jaeseong·
  // gwanseong 목록)은 단일 오행의 십성으로 필터하는데 丙(화)·庚(금)·戊(토)는 오행이 전부
  // 달라 한 필터에 둘 이상 걸릴 수 없다. (c) getHiddenStems는 소비처 0.
  巳: ["丙", "庚", "戊"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"],
};

const ELEMENT_TO_KOREAN: Record<ElementType, string> = {
  wood: "목",
  fire: "화",
  earth: "토",
  metal: "금",
  water: "수",
};

const ELEMENT_GENERATES: Record<ElementType, ElementType> = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
};

const ELEMENT_CONTROLS: Record<ElementType, ElementType> = {
  wood: "earth",
  fire: "metal",
  earth: "water",
  metal: "wood",
  water: "fire",
};

// 오행별 Tailwind 클래스 — muted 톤 (다크 UI 조화)
export const ELEMENT_TEXT_CLASSES: Record<ElementType, string> = {
  wood: "text-saju-wood-muted",
  fire: "text-saju-fire-muted",
  earth: "text-saju-earth-muted",
  metal: "text-saju-metal-muted",
  water: "text-saju-water-muted",
};

export const ELEMENT_BG_CLASSES: Record<ElementType, string> = {
  wood: "bg-saju-wood/8",
  fire: "bg-saju-fire/8",
  earth: "bg-saju-earth/8",
  metal: "bg-saju-metal/8",
  water: "bg-saju-water/8",
};

export const ELEMENT_BORDER_CLASSES: Record<ElementType, string> = {
  wood: "border border-saju-wood/15",
  fire: "border border-saju-fire/15",
  earth: "border border-saju-earth/15",
  metal: "border border-saju-metal/15",
  water: "border border-saju-water/15",
};

export function getElementTextClass(element?: ElementType | null) {
  if (!element) return "text-saju-metal-muted";
  return ELEMENT_TEXT_CLASSES[element];
}

export function getElementBgClass(element?: ElementType | null) {
  if (!element) return "bg-background-tertiary";
  return ELEMENT_BG_CLASSES[element];
}

export function getElementBorderClass(element?: ElementType | null) {
  if (!element) return "border border-white/5";
  return ELEMENT_BORDER_CLASSES[element];
}

// ── 패치 1: 한국 서머타임(DST) 기간 ──
// [시작년, 시작월, 시작일, 종료년, 종료월, 종료일]  (+1시간)
const KOREA_DST_PERIODS: readonly [number, number, number, number, number, number][] = [
  [1948, 6, 1, 1948, 9, 12],
  [1949, 4, 3, 1949, 9, 10],
  [1950, 4, 1, 1950, 9, 9],
  [1951, 5, 6, 1951, 9, 8],
  [1955, 5, 5, 1955, 9, 8],
  [1956, 5, 20, 1956, 9, 29],
  [1957, 5, 5, 1957, 9, 21],
  [1958, 5, 4, 1958, 9, 20],
  [1959, 5, 3, 1959, 9, 19],
  [1960, 5, 1, 1960, 9, 17],
  [1987, 5, 10, 1987, 10, 10],
  [1988, 5, 8, 1988, 10, 8],
];

export function isInKoreaDST(year: number, month: number, day: number): boolean {
  const v = year * 10000 + month * 100 + day;
  for (const [sy, sm, sd, ey, em, ed] of KOREA_DST_PERIODS) {
    if (year !== sy) continue;
    if (v >= sy * 10000 + sm * 100 + sd && v <= ey * 10000 + em * 100 + ed) return true;
  }
  return false;
}

// ── 패치 2: 지역별 대표 경도 매핑 ──
const REGION_LONGITUDE: Record<string, number> = {
  "서울": 126.9778,
  "경기": 127.0094,
  "인천": 126.7052,
  "강원": 127.7296,
  "충북": 127.4913,
  "충남": 126.8000,
  "대전": 127.3845,
  "세종": 127.0090,
  "전북": 127.1480,
  "전남": 126.9910,
  "광주": 126.8526,
  "경북": 128.5055,
  "경남": 128.6811,
  "대구": 128.6014,
  "울산": 129.3114,
  "부산": 129.0756,
  "제주": 126.5312,
  "해외": 126.9778,
};
const DEFAULT_LONGITUDE = 126.9778;

export function getRegionLongitude(region?: string): number {
  return REGION_LONGITUDE[region ?? ""] ?? DEFAULT_LONGITUDE;
}

// ── 패치 3: 균시차(Equation of Time) ──
export function calculateEquationOfTime(year: number, month: number, day: number): number {
  const start = new Date(year, 0, 1).getTime();
  const current = new Date(year, month - 1, day).getTime();
  const N = Math.floor((current - start) / 86_400_000) + 1;
  const Brad = ((360 / 365) * (N - 81) * Math.PI) / 180;
  return 9.87 * Math.sin(2 * Brad) - 7.53 * Math.cos(Brad) - 1.5 * Math.sin(Brad);
}

/**
 * 사주팔자 계산
 */
export async function calculateSaju(
  year: number,
  month: number,
  day: number,
  hour?: number,
  minute?: number,
  options?: { birthLocation?: string },
): Promise<SajuData | null> {
  try {
    const birthHour = hour ?? 12;
    const birthMinute = minute ?? 0;

    // ── 패치 1: 서머타임 보정 ──
    // DST 기간이면 시계가 1시간 빠르므로 1시간 차감하여 실제 KST 복원
    const isDST = isInKoreaDST(year, month, day);
    let birthDate = new Date(year, month - 1, day, birthHour, birthMinute);
    if (isDST) {
      birthDate = new Date(birthDate.getTime() - 60 * 60 * 1000);
    }

    // ── 패치 2: 출생지 경도 ──
    const longitudeDeg = getRegionLongitude(options?.birthLocation);

    // ── 패치 3: 균시차(EoT)를 경도에 합산 ──
    // 라이브러리 내부 균태양시 보정: Δmin = 4 × (lon - 135)
    // EoT를 경도에 환산(lon + EoT/4)하면 시주에만 진태양시 반영
    // 최종: Δmin = 4 × (lon - 135) + EoT
    const eotMinutes = calculateEquationOfTime(year, month, day);
    const adjustedLongitude = longitudeDeg + eotMinutes / 4;

    const adapter = await getAdapter();

    const dateFnsDate = {
      date: birthDate,
      timeZone: "Asia/Seoul",
    };

    const result = getFourPillars(dateFnsDate, {
      adapter,
      longitudeDeg: adjustedLongitude,
    });

    return {
      year: {
        heavenlyStem: result.year[0],
        earthlyBranch: result.year[1],
        hiddenStems: EARTHLY_BRANCH_HIDDEN_STEMS[result.year[1]] || [],
      },
      month: {
        heavenlyStem: result.month[0],
        earthlyBranch: result.month[1],
        hiddenStems: EARTHLY_BRANCH_HIDDEN_STEMS[result.month[1]] || [],
      },
      day: {
        heavenlyStem: result.day[0],
        earthlyBranch: result.day[1],
        hiddenStems: EARTHLY_BRANCH_HIDDEN_STEMS[result.day[1]] || [],
      },
      hour: {
        heavenlyStem: result.hour[0],
        earthlyBranch: result.hour[1],
        hiddenStems: EARTHLY_BRANCH_HIDDEN_STEMS[result.hour[1]] || [],
      },
      meta: {
        isSummerTimeCorrected: isDST,
        birthLongitudeDeg: longitudeDeg,
        equationOfTimeMinutes: Math.round(eotMinutes * 100) / 100,
      },
    };
  } catch (error) {
    console.error("사주 계산 오류:", {
      hash: crypto.createHash("sha256").update(`${year}-${month}-${day}-${hour ?? ""}-${minute ?? ""}`).digest("hex").slice(0, 12),
      error,
    });
    return null;
  }
}

/**
 * 천간의 오행 가져오기
 */
export function getHeavenlyStemElement(stem: string): ElementType | null {
  return HEAVENLY_STEM_TO_ELEMENT[stem] || null;
}

/**
 * 지지의 오행 가져오기
 */
export function getEarthlyBranchElement(branch: string): ElementType | null {
  return EARTHLY_BRANCH_TO_ELEMENT[branch] || null;
}

export function getHiddenStems(branch: string): string[] {
  return EARTHLY_BRANCH_HIDDEN_STEMS[branch] || [];
}

export function getMainHiddenStem(branch: string): string | null {
  const stems = EARTHLY_BRANCH_HIDDEN_STEMS[branch];
  return stems && stems.length > 0 ? stems[0] : null;
}

export function getStemLabel(stem: string): string {
  const korean = HEAVENLY_STEM_TO_KOREAN[stem] || "";
  return `${korean}${stem}`;
}

export function getBranchLabel(branch: string): string {
  const korean = EARTHLY_BRANCH_TO_KOREAN[branch] || "";
  return `${korean}${branch}`;
}

export function getElementLabel(element: ElementType, polarity: YinYang): string {
  const sign = polarity === "yang" ? "+" : "-";
  return `${sign}${ELEMENT_TO_KOREAN[element]}`;
}

export function getElementName(element: ElementType): string {
  return ELEMENT_TO_KOREAN[element];
}

export function getStemPolarity(stem: string): YinYang | null {
  return STEM_POLARITY[stem] || null;
}

export function getBranchPolarity(branch: string): YinYang | null {
  return BRANCH_POLARITY[branch] || null;
}

export function getTenGod(dayStem: string, targetStem: string): string | null {
  const dayElement = getHeavenlyStemElement(dayStem);
  const targetElement = getHeavenlyStemElement(targetStem);
  const dayPolarity = getStemPolarity(dayStem);
  const targetPolarity = getStemPolarity(targetStem);

  if (!dayElement || !targetElement || !dayPolarity || !targetPolarity) {
    return null;
  }

  const samePolarity = dayPolarity === targetPolarity;

  if (dayElement === targetElement) {
    return samePolarity ? "비견" : "겁재";
  }

  if (ELEMENT_GENERATES[dayElement] === targetElement) {
    return samePolarity ? "식신" : "상관";
  }

  if (ELEMENT_GENERATES[targetElement] === dayElement) {
    return samePolarity ? "편인" : "정인";
  }

  if (ELEMENT_CONTROLS[dayElement] === targetElement) {
    return samePolarity ? "편재" : "정재";
  }

  if (ELEMENT_CONTROLS[targetElement] === dayElement) {
    return samePolarity ? "편관" : "정관";
  }

  return null;
}

/**
 * 사주팔자를 텍스트 형식으로 변환
 */
export function enrichSajuData(saju: SajuData, opts?: { isTimeUnknown?: boolean }): EnrichedSajuData {
  const isTimeUnknown = Boolean(opts?.isTimeUnknown);

  const yearStem = saju.year.heavenlyStem;
  const yearBranch = saju.year.earthlyBranch;
  const monthStem = saju.month.heavenlyStem;
  const monthBranch = saju.month.earthlyBranch;
  const dayStem = saju.day.heavenlyStem;
  const dayBranch = saju.day.earthlyBranch;
  const hourStem = saju.hour.heavenlyStem;
  const hourBranch = saju.hour.earthlyBranch;

  const formatPillar = (stem: string, branch: string) => {
    const stemK = ENRICH_STEM_ELEMENT[stem]?.korean || "";
    const branchK = ENRICH_BRANCH_INFO[branch]?.korean || "";
    return `${stem}${branch}(${stemK}${branchK})`;
  };

  const stems = [yearStem, monthStem, dayStem];
  const branches = [yearBranch, monthBranch, dayBranch];
  if (!isTimeUnknown) {
    stems.push(hourStem);
    branches.push(hourBranch);
  }

  const dayMaster = ENRICH_STEM_ELEMENT[dayStem];
  const elementDist = calculateElementDistribution(stems, branches);
  const elementAnalysis = analyzeElementBalance(elementDist);
  const strength = judgeStrength(dayMaster.element, elementDist, stems.length + branches.length, isTimeUnknown, {
    monthBranch,
    dayBranch,
    hourBranch: isTimeUnknown ? undefined : hourBranch,
    allBranches: branches,
    allStems: stems,
    dayStem,
  });
  const tenStars = calculateTenStars(stems, branches);
  const tenStarsFull = calculateTenStarsFull(stems, branches);
  const relationships = findRelationships(branches);
  const shinsal = findShinsal(dayBranch, dayStem, monthBranch, branches, isTimeUnknown, stems);

  // 12운성 계산
  const yearPillarStr = yearStem + yearBranch;
  const monthPillarStr = monthStem + monthBranch;
  const dayPillarStr = dayStem + dayBranch;
  const hourPillarStr = hourStem + hourBranch;

  const rawStages = analyzeTwelveStages(yearPillarStr, monthPillarStr, dayPillarStr, hourPillarStr);

  const toStageEntry = (s: { korean: string; hanja: string; meaning: string; strength: "strong" | "neutral" | "weak" }): TwelveStageEntry => ({
    korean: s.korean,
    hanja: s.hanja,
    meaning: s.meaning,
    strength: s.strength,
  });

  // 용신 판정
  const yongshin = determineYongshin(dayMaster.element, strength, elementDist, monthBranch);

  // 12신살 위치별 매핑
  const pillar12Shinsal = getPillar12Shinsal(branches, isTimeUnknown);

  return {
    pillars: {
      year: formatPillar(yearStem, yearBranch),
      month: formatPillar(monthStem, monthBranch),
      day: formatPillar(dayStem, dayBranch),
      hour: isTimeUnknown ? null : formatPillar(hourStem, hourBranch),
    },
    dayMaster: {
      stem: dayStem,
      element: dayMaster.element,
      yinYang: dayMaster.yin_yang,
      korean: dayMaster.korean,
    },
    elementDist,
    elementAnalysis,
    strength,
    tenStars,
    tenStarsFull,
    relationships,
    shinsal,
    twelveStages: {
      year: toStageEntry(rawStages.year),
      month: toStageEntry(rawStages.month),
      day: toStageEntry(rawStages.day),
      hour: isTimeUnknown ? null : toStageEntry(rawStages.hour),
    },
    yongshin,
    pillar12Shinsal,
    isTimeUnknown,
  };
}

/**
 * 사주팔자를 텍스트 형식으로 변환 (enriched 포맷)
 */
export function formatSajuText(saju: SajuData, opts?: { isTimeUnknown?: boolean }): string {
  return formatEnrichedSajuText(enrichSajuData(saju, opts));
}

/**
 * 사주 데이터에서 모든 십성/오행 정보를 한번에 계산 (캐싱용)
 */
export type PillarDisplayData = {
  key: string;
  label: string;
  stem: string;
  branch: string;
  stemElement: ElementType | null;
  branchElement: ElementType | null;
  stemLabel: string;
  branchLabel: string;
  stemTenGod: string | null;
  branchTenGod: string | null;
};

export function computePillarDisplayData(sajuData: SajuData): PillarDisplayData[] {
  const dayStem = sajuData.day.heavenlyStem;
  const pillarsRaw = [
    { key: "hour", label: "생시", data: sajuData.hour },
    { key: "day", label: "생일", data: sajuData.day },
    { key: "month", label: "생월", data: sajuData.month },
    { key: "year", label: "생년", data: sajuData.year },
  ];

  return pillarsRaw.map(({ key, label, data }) => {
    const mainHiddenStem = getMainHiddenStem(data.earthlyBranch);
    return {
      key,
      label,
      stem: data.heavenlyStem,
      branch: data.earthlyBranch,
      stemElement: getHeavenlyStemElement(data.heavenlyStem),
      branchElement: getEarthlyBranchElement(data.earthlyBranch),
      stemLabel: getStemLabel(data.heavenlyStem),
      branchLabel: getBranchLabel(data.earthlyBranch),
      stemTenGod: getTenGod(dayStem, data.heavenlyStem),
      branchTenGod: mainHiddenStem ? getTenGod(dayStem, mainHiddenStem) : null,
    };
  });
}
