import { createDateFnsAdapter } from "@gracefullight/saju/adapters/date-fns";
import { getFourPillars } from "@gracefullight/saju";

// 어댑터 싱글톤 캐시 - 매번 생성하지 않음
let cachedAdapter: Awaited<ReturnType<typeof createDateFnsAdapter>> | null = null;
let adapterPromise: Promise<Awaited<ReturnType<typeof createDateFnsAdapter>>> | null = null;

async function getAdapter() {
  if (cachedAdapter) return cachedAdapter;
  if (adapterPromise) return adapterPromise;

  adapterPromise = createDateFnsAdapter().then((adapter) => {
    cachedAdapter = adapter;
    return adapter;
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
  巳: ["丙", "戊", "庚"],
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

// 오행별 Tailwind 클래스
export const ELEMENT_TEXT_CLASSES: Record<ElementType, string> = {
  wood: "text-saju-wood",
  fire: "text-saju-fire",
  earth: "text-saju-earth",
  metal: "text-saju-metal",
  water: "text-saju-water",
};

export const ELEMENT_BG_CLASSES: Record<ElementType, string> = {
  wood: "bg-saju-wood/12",
  fire: "bg-saju-fire/12",
  earth: "bg-saju-earth/12",
  metal: "bg-saju-metal/12",
  water: "bg-saju-water/12",
};

export function getElementTextClass(element?: ElementType | null) {
  if (!element) return "text-saju-metal";
  return ELEMENT_TEXT_CLASSES[element];
}

export function getElementBgClass(element?: ElementType | null) {
  if (!element) return "bg-background-tertiary";
  return ELEMENT_BG_CLASSES[element];
}

/**
 * 사주팔자 계산
 */
export async function calculateSaju(
  year: number,
  month: number,
  day: number,
  hour?: number,
  minute?: number
): Promise<SajuData | null> {
  try {
    // 시간이 없으면 기본값 사용 (12시)
    const birthHour = hour ?? 12;
    const birthMinute = minute ?? 0;

    // Date 객체 생성
    const birthDate = new Date(year, month - 1, day, birthHour, birthMinute);

    // 캐시된 어댑터 사용
    const adapter = await getAdapter();

    // DateFnsDate 형식으로 변환
    const dateFnsDate = {
      date: birthDate,
      timeZone: "Asia/Seoul",
    };

    // 사주팔자 계산
    const result = getFourPillars(dateFnsDate, {
      adapter,
      longitudeDeg: 126.9778, // 서울 경도
    });

    // 각 주(pillar)는 "甲子" 형태의 2글자 문자열
    // 첫 글자: 천간(heavenlyStem), 두번째 글자: 지지(earthlyBranch)
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
    };
  } catch (error) {
    console.error("사주 계산 오류:", error);
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
    return samePolarity ? "정인" : "편인";
  }

  if (ELEMENT_CONTROLS[dayElement] === targetElement) {
    return samePolarity ? "정재" : "편재";
  }

  if (ELEMENT_CONTROLS[targetElement] === dayElement) {
    return samePolarity ? "정관" : "편관";
  }

  return null;
}

/**
 * 사주팔자를 텍스트 형식으로 변환
 */
export function formatSajuText(saju: SajuData): string {
  return `년주: ${saju.year.heavenlyStem}${saju.year.earthlyBranch}(${saju.year.heavenlyStem}${saju.year.earthlyBranch}), 월주: ${saju.month.heavenlyStem}${saju.month.earthlyBranch}(${saju.month.heavenlyStem}${saju.month.earthlyBranch}), 일주: ${saju.day.heavenlyStem}${saju.day.earthlyBranch}(${saju.day.heavenlyStem}${saju.day.earthlyBranch}), 시주: ${saju.hour.heavenlyStem}${saju.hour.earthlyBranch}(${saju.hour.heavenlyStem}${saju.hour.earthlyBranch})`;
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
