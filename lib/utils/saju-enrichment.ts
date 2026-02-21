export type KoreanElement = "목" | "화" | "토" | "금" | "수";
export type KoreanYinYang = "양" | "음";

export const STEM_ELEMENT: Record<
  string,
  { element: KoreanElement; yin_yang: KoreanYinYang; korean: string }
> = {
  甲: { element: "목", yin_yang: "양", korean: "갑" },
  乙: { element: "목", yin_yang: "음", korean: "을" },
  丙: { element: "화", yin_yang: "양", korean: "병" },
  丁: { element: "화", yin_yang: "음", korean: "정" },
  戊: { element: "토", yin_yang: "양", korean: "무" },
  己: { element: "토", yin_yang: "음", korean: "기" },
  庚: { element: "금", yin_yang: "양", korean: "경" },
  辛: { element: "금", yin_yang: "음", korean: "신" },
  壬: { element: "수", yin_yang: "양", korean: "임" },
  癸: { element: "수", yin_yang: "음", korean: "계" },
} as const;

export interface BranchInfo {
  element: KoreanElement;
  yin_yang: KoreanYinYang;
  korean: string;
  jijanggan: { stem: string; weight: number }[];
}

export const BRANCH_INFO: Record<string, BranchInfo> = {
  子: { element: "수", yin_yang: "양", korean: "자", jijanggan: [{ stem: "癸", weight: 10 }] },
  丑: {
    element: "토",
    yin_yang: "음",
    korean: "축",
    jijanggan: [
      { stem: "己", weight: 5 },
      { stem: "癸", weight: 3 },
      { stem: "辛", weight: 2 },
    ],
  },
  寅: {
    element: "목",
    yin_yang: "양",
    korean: "인",
    jijanggan: [
      { stem: "甲", weight: 7 },
      { stem: "丙", weight: 3 },
      { stem: "戊", weight: 3 },
    ],
  },
  卯: { element: "목", yin_yang: "음", korean: "묘", jijanggan: [{ stem: "乙", weight: 10 }] },
  辰: {
    element: "토",
    yin_yang: "양",
    korean: "진",
    jijanggan: [
      { stem: "戊", weight: 5 },
      { stem: "乙", weight: 3 },
      { stem: "癸", weight: 2 },
    ],
  },
  巳: {
    element: "화",
    yin_yang: "음",
    korean: "사",
    jijanggan: [
      { stem: "丙", weight: 5 },
      { stem: "庚", weight: 3 },
      { stem: "戊", weight: 2 },
    ],
  },
  午: {
    element: "화",
    yin_yang: "양",
    korean: "오",
    jijanggan: [
      { stem: "丁", weight: 7 },
      { stem: "己", weight: 3 },
    ],
  },
  未: {
    element: "토",
    yin_yang: "음",
    korean: "미",
    jijanggan: [
      { stem: "己", weight: 5 },
      { stem: "丁", weight: 3 },
      { stem: "乙", weight: 2 },
    ],
  },
  申: {
    element: "금",
    yin_yang: "양",
    korean: "신",
    jijanggan: [
      { stem: "庚", weight: 5 },
      { stem: "壬", weight: 3 },
      { stem: "戊", weight: 2 },
    ],
  },
  酉: { element: "금", yin_yang: "음", korean: "유", jijanggan: [{ stem: "辛", weight: 10 }] },
  戌: {
    element: "토",
    yin_yang: "양",
    korean: "술",
    jijanggan: [
      { stem: "戊", weight: 5 },
      { stem: "辛", weight: 3 },
      { stem: "丁", weight: 2 },
    ],
  },
  亥: {
    element: "수",
    yin_yang: "음",
    korean: "해",
    jijanggan: [
      { stem: "壬", weight: 7 },
      { stem: "甲", weight: 3 },
    ],
  },
} as const;

export const GENERATES: Record<KoreanElement, KoreanElement> = {
  목: "화",
  화: "토",
  토: "금",
  금: "수",
  수: "목",
} as const;

export const CONTROLS: Record<KoreanElement, KoreanElement> = {
  목: "토",
  토: "수",
  수: "화",
  화: "금",
  금: "목",
} as const;

export const ELEMENT_TO_HANJA: Record<KoreanElement, string> = {
  목: "木",
  화: "火",
  토: "土",
  금: "金",
  수: "水",
} as const;

export function calculateElementDistribution(
  stems: string[],
  branches: string[]
): Record<KoreanElement, number> {
  const count: Record<KoreanElement, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };

  for (const stem of stems) {
    const meta = STEM_ELEMENT[stem];
    if (meta) count[meta.element] += 1;
  }

  for (const branch of branches) {
    const meta = BRANCH_INFO[branch];
    if (meta) count[meta.element] += 1;
  }

  return count;
}

export function analyzeElementBalance(dist: Record<KoreanElement, number>): {
  deficient: KoreanElement[];
  dominant: KoreanElement[];
} {
  const entries = Object.entries(dist) as [KoreanElement, number][];
  const deficient = entries.filter(([_, v]) => v === 0).map(([k]) => k);
  const maxVal = Math.max(...entries.map(([, v]) => v));
  const dominant =
    maxVal >= 3 ? entries.filter(([_, v]) => v === maxVal).map(([k]) => k) : [];
  return { deficient, dominant };
}

export function getTenStar(
  dayMasterElement: KoreanElement,
  dayMasterYinYang: KoreanYinYang,
  targetElement: KoreanElement,
  targetYinYang: KoreanYinYang
): string {
  const sameYY = dayMasterYinYang === targetYinYang;

  if (dayMasterElement === targetElement) {
    return sameYY ? "비견(比肩)" : "겁재(劫財)";
  }
  if (GENERATES[dayMasterElement] === targetElement) {
    return sameYY ? "식신(食神)" : "상관(傷官)";
  }
  if (CONTROLS[dayMasterElement] === targetElement) {
    return sameYY ? "편재(偏財)" : "정재(正財)";
  }
  if (CONTROLS[targetElement] === dayMasterElement) {
    return sameYY ? "편관(偏官)" : "정관(正官)";
  }
  if (GENERATES[targetElement] === dayMasterElement) {
    return sameYY ? "편인(偏印)" : "정인(正印)";
  }
  return "알수없음";
}

export function calculateTenStars(stems: string[], branches: string[]): string[] {
  const dayStem = stems[2];
  const dayMaster = STEM_ELEMENT[dayStem];
  if (!dayMaster) return [];

  const stars: Set<string> = new Set();

  // 년간, 월간, 시간 (시간은 없을 수 있음)
  [0, 1, 3].forEach((i) => {
    const targetStem = stems[i];
    if (!targetStem) return;
    const target = STEM_ELEMENT[targetStem];
    if (!target) return;
    stars.add(getTenStar(dayMaster.element, dayMaster.yin_yang, target.element, target.yin_yang));
  });

  // 지지 주기(지장간 중 weight 최대 = 첫 번째)
  branches.forEach((branch) => {
    const info = BRANCH_INFO[branch];
    const mainHidden = info?.jijanggan?.[0];
    const target = mainHidden ? STEM_ELEMENT[mainHidden.stem] : null;
    if (!target) return;
    stars.add(getTenStar(dayMaster.element, dayMaster.yin_yang, target.element, target.yin_yang));
  });

  return Array.from(stars);
}

function findElementThatGenerates(dayMasterElement: KoreanElement): KoreanElement | null {
  const found = (Object.entries(GENERATES) as [KoreanElement, KoreanElement][]).find(
    ([_, v]) => v === dayMasterElement
  );
  return found?.[0] ?? null;
}

/** target을 극하는 오행을 찾는다 (CONTROLS[X] === target인 X) */
function findElementThatControls(target: KoreanElement): KoreanElement | null {
  const found = (Object.entries(CONTROLS) as [KoreanElement, KoreanElement][]).find(
    ([_, v]) => v === target
  );
  return found?.[0] ?? null;
}

// ── 용신(用神) 판정 ──

export interface YongshinResult {
  eokbu: KoreanElement;        // 억부용신 (주 용신)
  eokbuReason: string;         // "중화신강 → 관성(금) 보강"
  johu: KoreanElement | null;  // 조후용신 (계절 기반, null=해당 없음)
  johuReason: string | null;   // "하절(여름) → 수(水)로 열기 조절"
  gisin: KoreanElement;        // 기신 (용신을 극하는 오행)
  heesin: KoreanElement;       // 희신 (용신을 생하는 오행)
}

const STRONG_LEVELS: Set<StrengthLevel> = new Set(["극왕", "태강", "신강", "중화신강"]);

const SEASON_BY_BRANCH: Record<string, "spring" | "summer" | "autumn" | "winter"> = {
  寅: "spring", 卯: "spring", 辰: "spring",
  巳: "summer", 午: "summer", 未: "summer",
  申: "autumn", 酉: "autumn", 戌: "autumn",
  亥: "winter", 子: "winter", 丑: "winter",
};

export function determineYongshin(
  dayMasterElement: KoreanElement,
  strength: StrengthResult,
  elementDist: Record<KoreanElement, number>,
  monthBranch: string,
): YongshinResult {
  const isStrong = STRONG_LEVELS.has(strength.result);

  // ── 억부용신 ──
  let eokbu: KoreanElement;
  let eokbuReason: string;

  if (isStrong) {
    // 신강: 관성(일간을 극하는 오행) / 식상(일간이 생하는 오행) / 재성(일간이 극하는 오행) 중 최저
    const gwansung = findElementThatControls(dayMasterElement)!;   // 금 for 목
    const siksang = GENERATES[dayMasterElement];                    // 화 for 목
    const jaesung = CONTROLS[dayMasterElement];                     // 토 for 목

    const candidates: { element: KoreanElement; label: string }[] = [
      { element: gwansung, label: "관성" },
      { element: siksang, label: "식상" },
      { element: jaesung, label: "재성" },
    ];

    // 오행분포에서 비율이 가장 낮은 것 선택 (동률 시 관성>식상>재성 — 배열 순서 유지)
    candidates.sort((a, b) => (elementDist[a.element] || 0) - (elementDist[b.element] || 0));
    const lowest = elementDist[candidates[0].element] || 0;
    // 동률인 후보들 중 우선순위(원래 배열 순서)가 가장 높은 것
    const priority = ["관성", "식상", "재성"];
    const tied = candidates.filter(c => (elementDist[c.element] || 0) === lowest);
    tied.sort((a, b) => priority.indexOf(a.label) - priority.indexOf(b.label));

    eokbu = tied[0].element;
    eokbuReason = `${strength.result} → ${tied[0].label}(${eokbu}) 보강`;
  } else {
    // 신약: 인성(일간을 생하는 오행) / 비겁(같은 오행) 중 최저
    const insung = findElementThatGenerates(dayMasterElement)!;   // 수 for 목
    const bigeop = dayMasterElement;                               // 목 for 목

    const candidates: { element: KoreanElement; label: string }[] = [
      { element: insung, label: "인성" },
      { element: bigeop, label: "비겁" },
    ];

    candidates.sort((a, b) => (elementDist[a.element] || 0) - (elementDist[b.element] || 0));
    const lowest = elementDist[candidates[0].element] || 0;
    const priority = ["인성", "비겁"];
    const tied = candidates.filter(c => (elementDist[c.element] || 0) === lowest);
    tied.sort((a, b) => priority.indexOf(a.label) - priority.indexOf(b.label));

    eokbu = tied[0].element;
    eokbuReason = `${strength.result} → ${tied[0].label}(${eokbu}) 보강`;
  }

  // ── 조후용신 ──
  const season = SEASON_BY_BRANCH[monthBranch] ?? null;
  let johu: KoreanElement | null = null;
  let johuReason: string | null = null;

  if (season === "summer") {
    johu = "수";
    johuReason = "하절(여름) → 수(水)로 열기 조절";
  } else if (season === "winter") {
    johu = "화";
    johuReason = "동절(겨울) → 화(火)로 한기 보충";
  }

  // ── 기신 / 희신 ──
  const gisin = findElementThatControls(eokbu)!;
  const heesin = findElementThatGenerates(eokbu)!;

  return { eokbu, eokbuReason, johu, johuReason, gisin, heesin };
}

// ── 12운성 기반 생왕지 판정 유틸 ──

const TWELVE_STAGE_NAMES = ["장생","목욕","관대","건록","제왕","쇠","병","사","묘","절","태","양"] as const;
const BRANCHES_SEQ = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"] as const;
const YANG_STEMS_SET = new Set(["甲","丙","戊","庚","壬"]);

const YANG_BIRTH_BRANCH: Record<string, string> = { "甲": "亥", "丙": "寅", "戊": "寅", "庚": "巳", "壬": "申" };
const YIN_BIRTH_BRANCH: Record<string, string> = { "乙": "午", "丁": "酉", "己": "酉", "辛": "子", "癸": "卯" };

const LIFE_PROSPERITY_STAGES = new Set(["장생", "관대", "건록", "제왕"]);

/** 일간 기준 특정 지지의 12운성 한글명을 반환 */
function getTwelveStageForBranch(dayStem: string, branch: string): string {
  const isYang = YANG_STEMS_SET.has(dayStem);
  const birthBranch = isYang ? YANG_BIRTH_BRANCH[dayStem] : YIN_BIRTH_BRANCH[dayStem];
  if (!birthBranch) return "알수없음";
  const birthIdx = BRANCHES_SEQ.indexOf(birthBranch as typeof BRANCHES_SEQ[number]);
  const targetIdx = BRANCHES_SEQ.indexOf(branch as typeof BRANCHES_SEQ[number]);
  if (birthIdx < 0 || targetIdx < 0) return "알수없음";
  const stageIdx = isYang
    ? (targetIdx - birthIdx + 12) % 12
    : (birthIdx - targetIdx + 12) % 12;
  return TWELVE_STAGE_NAMES[stageIdx];
}

/** 일간 기준 해당 지지가 생왕지(장생/관대/건록/제왕)인지 */
function isLifeProsperityStage(dayStem: string, branch: string): boolean {
  return LIFE_PROSPERITY_STAGES.has(getTwelveStageForBranch(dayStem, branch));
}

export type StrengthLevel = "극왕" | "태강" | "신강" | "중화신강" | "중화신약" | "신약" | "태약" | "극약";

export interface StrengthDetails {
  deukryeong: boolean;  // 득령 — 월지 12운성이 생왕지
  deukji: boolean;      // 득지 — 일지 12운성이 생왕지
  deuksi: boolean;      // 득시 — 시지 12운성이 생왕지
  deukse: boolean;      // 득세 — 천간(일간 제외) 비겁/인성 2개 이상
}

export interface StrengthResult {
  result: StrengthLevel;
  helpCount: number;
  resistCount: number;
  details: StrengthDetails;
  legacy: "신강" | "신약" | "추정 신강" | "추정 신약";
}

export interface StrengthContext {
  monthBranch: string;
  dayBranch: string;
  hourBranch?: string;    // 시주 미상 시 undefined
  allBranches: string[];
  allStems: string[];
  dayStem: string;
}

export function judgeStrength(
  dayMasterElement: KoreanElement,
  elementDist: Record<KoreanElement, number>,
  totalCount: number,
  isTimeUnknown: boolean,
  context?: StrengthContext,
): StrengthResult {
  const generatesMe = findElementThatGenerates(dayMasterElement);

  const helpCount =
    (elementDist[dayMasterElement] || 0) + (generatesMe ? elementDist[generatesMe] || 0 : 0);
  const resistCount = Math.max(0, totalCount - helpCount);

  const baseLegacy: "신강" | "신약" = helpCount >= resistCount ? "신강" : "신약";

  // context 없으면 레거시 결과만 반환 (하위 호환)
  if (!context) {
    const legacy: StrengthResult["legacy"] = isTimeUnknown
      ? baseLegacy === "신강" ? "추정 신강" : "추정 신약"
      : baseLegacy;
    return {
      result: baseLegacy === "신강" ? "신강" : "신약",
      helpCount,
      resistCount,
      details: { deukryeong: false, deukji: false, deuksi: false, deukse: false },
      legacy,
    };
  }

  // ── 4가지 세부 판정 (12운성 기반) ──

  // 득령: 월지의 12운성이 생왕지인지
  const deukryeong = isLifeProsperityStage(context.dayStem, context.monthBranch);

  // 득지: 일지의 12운성이 생왕지인지
  const deukji = isLifeProsperityStage(context.dayStem, context.dayBranch);

  // 득시: 시지의 12운성이 생왕지인지 (시주 미상 시 false)
  const deuksi = context.hourBranch
    ? isLifeProsperityStage(context.dayStem, context.hourBranch)
    : false;

  // 득세: 천간(일간 제외) 중 비겁(같은 오행) 또는 인성(일간을 생하는 오행)이 2개 이상
  let helpStemCount = 0;
  for (let i = 0; i < context.allStems.length; i++) {
    if (i === 2) continue; // 일간 자신 제외
    const stemInfo = STEM_ELEMENT[context.allStems[i]];
    if (!stemInfo) continue;
    if (stemInfo.element === dayMasterElement) helpStemCount++;
    else if (generatesMe && stemInfo.element === generatesMe) helpStemCount++;
  }
  const deukse = helpStemCount >= 2;

  const details: StrengthDetails = { deukryeong, deukji, deuksi, deukse };

  // ── 8단계 종합 판정 ──
  const trueCount = [deukryeong, deukji, deuksi, deukse].filter(Boolean).length;
  const helpRatio = totalCount > 0 ? helpCount / totalCount : 0;
  const dayMasterCount = elementDist[dayMasterElement] || 0;

  let result: StrengthLevel;
  if (trueCount === 4) {
    result = "극왕";
  } else if (trueCount === 3 && helpRatio > 0.6) {
    result = "태강";
  } else if (trueCount === 3) {
    result = "신강";
  } else if (trueCount === 2 && helpCount >= resistCount) {
    result = "중화신강";
  } else if (trueCount === 2) {
    result = "중화신약";
  } else if (trueCount === 1) {
    result = "신약";
  } else if (trueCount <= 1 && dayMasterCount === 0) {
    // 일간 오행이 사주에 전혀 없음 → 극약
    result = "극약";
  } else if (trueCount <= 1) {
    // deficiency check: 결핍 오행 2개 이상이면 태약
    const deficientCount = (Object.values(elementDist) as number[]).filter(v => v === 0).length;
    result = deficientCount >= 2 ? "태약" : "신약";
  } else {
    result = "신약";
  }

  // legacy: 8단계 → 이진 매핑
  const isStrong = ["극왕", "태강", "신강", "중화신강"].includes(result);
  const legacy: StrengthResult["legacy"] = isTimeUnknown
    ? isStrong ? "추정 신강" : "추정 신약"
    : isStrong ? "신강" : "신약";

  return { result, helpCount, resistCount, details, legacy };
}

export const YUKAP: [string, string, KoreanElement][] = [
  ["子", "丑", "토"], // 자축합토
  ["寅", "亥", "목"], // 인해합목
  ["卯", "戌", "화"], // 묘술합화
  ["辰", "酉", "금"], // 진유합금
  ["巳", "申", "수"], // 사신합수
  ["午", "未", "화"], // 오미합화(토)
];

export const SAMHAP: [string, string, string, KoreanElement][] = [
  ["申", "子", "辰", "수"], // 신자진 수국
  ["寅", "午", "戌", "화"], // 인오술 화국
  ["巳", "酉", "丑", "금"], // 사유축 금국
  ["亥", "卯", "未", "목"], // 해묘미 목국
];

export const YUKCHUNG: [string, string][] = [
  ["子", "午"],
  ["丑", "未"],
  ["寅", "申"],
  ["卯", "酉"],
  ["辰", "戌"],
  ["巳", "亥"],
];

export const HYUNG: [string[], string][] = [
  [["寅", "巳", "申"], "무은지형(無恩之刑)"],
  [["丑", "戌", "未"], "지세지형(持勢之刑)"],
  [["子", "卯"], "무례지형(無禮之刑)"],
  [["辰", "辰"], "자형(自刑)"],
  [["午", "午"], "자형(自刑)"],
  [["酉", "酉"], "자형(自刑)"],
  [["亥", "亥"], "자형(自刑)"],
];

export function findRelationships(branches: string[]): {
  hap: string[];
  chung: string[];
  hyung: string[];
} {
  const result = { hap: [] as string[], chung: [] as string[], hyung: [] as string[] };
  const branchSet = new Set(branches);

  for (const [a, b, elem] of YUKAP) {
    if (branchSet.has(a) && branchSet.has(b)) {
      const label = `${BRANCH_INFO[a].korean}${BRANCH_INFO[b].korean}합${elem}`;
      const hanja = ELEMENT_TO_HANJA[elem];
      result.hap.push(`${label}(${a}${b}合${hanja})`);
    }
  }

  for (const [a, b, c, elem] of SAMHAP) {
    const count = [a, b, c].filter((x) => branchSet.has(x)).length;
    if (count === 3) {
      result.hap.push(
        `${BRANCH_INFO[a].korean}${BRANCH_INFO[b].korean}${BRANCH_INFO[c].korean} 삼합${elem}국(三合)`
      );
    }
  }

  for (const [a, b] of YUKCHUNG) {
    if (branchSet.has(a) && branchSet.has(b)) {
      result.chung.push(`${BRANCH_INFO[a].korean}${BRANCH_INFO[b].korean}충(${a}${b}沖)`);
    }
  }

  for (const [group, name] of HYUNG) {
    if (group.length <= 2) {
      if (group.every((x) => branchSet.has(x))) {
        const label = group.map((x) => BRANCH_INFO[x].korean).join("");
        result.hyung.push(`${label}형(${group.join("")}刑) ${name}`);
      }
    } else {
      const matches = group.filter((x) => branchSet.has(x));
      if (matches.length >= 2) {
        const label = matches.map((x) => BRANCH_INFO[x].korean).join("");
        result.hyung.push(`${label}형(${matches.join("")}刑) ${name}`);
      }
    }
  }

  return result;
}

/** @deprecated 내부 로직은 SHINSAL_DEFS 사용. 외부 참조용으로만 유지. */
export const DOHWA: Record<string, string> = {
  子: "酉", 丑: "午", 寅: "卯", 卯: "子", 辰: "酉", 巳: "午",
  午: "卯", 未: "子", 申: "酉", 酉: "午", 戌: "卯", 亥: "子",
} as const;

/** @deprecated 내부 로직은 SHINSAL_DEFS 사용. 외부 참조용으로만 유지. */
export const YEOKMA: Record<string, string> = {
  子: "寅", 丑: "亥", 寅: "申", 卯: "巳", 辰: "寅", 巳: "亥",
  午: "申", 未: "巳", 申: "寅", 酉: "亥", 戌: "申", 亥: "巳",
} as const;

/** @deprecated 내부 로직은 SHINSAL_DEFS 사용. 외부 참조용으로만 유지. */
export const HWAGAE: Record<string, string> = {
  子: "辰", 丑: "丑", 寅: "戌", 卯: "未", 辰: "辰", 巳: "丑",
  午: "戌", 未: "未", 申: "辰", 酉: "丑", 戌: "戌", 亥: "未",
} as const;

/** @deprecated 내부 로직은 SHINSAL_DEFS 사용. 외부 참조용으로만 유지. */
export const HYUNCHIM_STEMS = ["甲", "辛"] as const;

// ── 신살 시스템 KR_COMMON_V1 ──

export const SHINSAL_RULESET = "KR_COMMON_V1" as const;

export type SamhapGroup = "인오술" | "사유축" | "신자진" | "해묘미";
export type ShinsalType = "good" | "bad" | "neutral";

export type PillarPosition = "year" | "month" | "day" | "hour";

export interface ShinsalMatch {
  key: string;
  label: string;
  type: ShinsalType;
  evidence: string[];
  detectedAt: PillarPosition[];
}

export interface ShinsalResult {
  ruleset: typeof SHINSAL_RULESET;
  matches: ShinsalMatch[];
  labels: string[];
  meta: { note?: string };
}

interface ShinsalContext {
  dayStem: string;
  dayBranch: string;
  yearBranch: string;
  monthBranch: string;
  allBranches: string[];
  otherBranches: string[];       // 일지(index 2) 제외 — 일간/백호 등
  otherBranchSet: Set<string>;
  samhapOtherBranches: string[]; // 년지(index 0) 제외 — 삼합 기반 신살
  samhapOtherBranchSet: Set<string>;
  allStems: string[];
  otherStems: string[];          // stems에서 index 2(일간) 제외
  otherStemSet: Set<string>;
  isTimeUnknown: boolean;
  samhapGroup: SamhapGroup;      // 년지 기반 삼합그룹
  sexagenaryIndex: number;       // 일주 60갑자 인덱스
}

interface ShinsalDef {
  key: string;
  label: string;
  type: ShinsalType;
  requiredPillars: 3 | 4;
  detect: (ctx: ShinsalContext) => ShinsalMatch | null;
}

const BRANCH_TO_SAMHAP_GROUP: Record<string, SamhapGroup> = {
  寅: "인오술", 午: "인오술", 戌: "인오술",
  巳: "사유축", 酉: "사유축", 丑: "사유축",
  申: "신자진", 子: "신자진", 辰: "신자진",
  亥: "해묘미", 卯: "해묘미", 未: "해묘미",
};

// 삼합 기반 룩업 (4-entry)
const SAMHAP_DOHWA: Record<SamhapGroup, string> = {
  "인오술": "卯", "사유축": "午", "신자진": "酉", "해묘미": "子",
};
const SAMHAP_YEOKMA: Record<SamhapGroup, string> = {
  "인오술": "申", "사유축": "亥", "신자진": "寅", "해묘미": "巳",
};
const SAMHAP_HWAGAE: Record<SamhapGroup, string> = {
  "인오술": "戌", "사유축": "丑", "신자진": "辰", "해묘미": "未",
};
// KR_COMMON_V1 겁살 — 삼합 그룹의 역마 대충(對沖) 지지.
// 근거: 연해자평·명리정의 계열 표 기준, 학파 간 일치도 높음.
const SAMHAP_GYEOPSAL: Record<SamhapGroup, string> = {
  "인오술": "亥", "사유축": "寅", "신자진": "巳", "해묘미": "申",
};

// 일간 기반 룩업
const YANGIN_STEMS: Record<string, string> = {
  "甲": "卯", "丙": "午", "戊": "午", "庚": "酉", "壬": "子",
};
const CHUNEUL_STEMS: Record<string, string[]> = {
  "甲": ["丑", "未"], "戊": ["丑", "未"],
  "乙": ["子", "申"], "己": ["子", "申"],
  "丙": ["亥", "酉"], "丁": ["亥", "酉"],
  "庚": ["寅", "午"], "辛": ["寅", "午"],
  "壬": ["卯", "巳"], "癸": ["卯", "巳"],
};
const MUNCHANG_STEMS: Record<string, string> = {
  "甲": "巳", "乙": "午", "丙": "申", "丁": "酉", "戊": "申",
  "己": "酉", "庚": "亥", "辛": "子", "壬": "寅", "癸": "卯",
};
const HONGRYEOM_STEMS: Record<string, string> = {
  "甲": "午", "乙": "申", "丙": "寅", "丁": "未", "戊": "辰",
  "己": "辰", "庚": "戌", "辛": "酉", "壬": "子", "癸": "申",
};

// ── 신규 삼합 기반 룩업 ──
const SAMHAP_JANGSEONG: Record<SamhapGroup, string> = {
  "인오술": "午", "사유축": "酉", "신자진": "子", "해묘미": "卯",
};
const SAMHAP_JAESAL: Record<SamhapGroup, string> = {
  "인오술": "子", "사유축": "卯", "신자진": "午", "해묘미": "酉",
};
const SAMHAP_CHEONSAL: Record<SamhapGroup, string> = {
  "인오술": "丑", "사유축": "辰", "신자진": "未", "해묘미": "戌",
};
const SAMHAP_JISAL: Record<SamhapGroup, string> = {
  "인오술": "亥", "사유축": "寅", "신자진": "巳", "해묘미": "申",
};
const SAMHAP_MANGSIN: Record<SamhapGroup, string> = {
  "인오술": "申", "사유축": "亥", "신자진": "寅", "해묘미": "巳",
};

// ── 백호살 (육충 매핑) ──
const BAEKHO_TABLE: Record<string, string> = {
  "子": "午", "丑": "未", "寅": "申", "卯": "酉", "辰": "戌", "巳": "亥",
  "午": "子", "未": "丑", "申": "寅", "酉": "卯", "戌": "辰", "亥": "巳",
};

// ── 괴강살 — 일주 조합 ──
const GOEGANG_PILLARS = new Set(["庚辰", "庚戌", "壬辰", "壬戌"]);

// ── 천덕귀인 — 월지 기준 ──
const CHEONDEOK_TABLE: Record<string, string> = {
  "寅": "丁", "卯": "申", "辰": "壬", "巳": "辛", "午": "亥", "未": "甲",
  "申": "癸", "酉": "寅", "戌": "丙", "亥": "乙", "子": "巳", "丑": "庚",
};

// ── 월덕귀인 — 월지 그룹 기준 (천간 타겟) ──
const WOLDEOK_TABLE: Record<string, string> = {
  "寅": "丙", "午": "丙", "戌": "丙",
  "申": "壬", "子": "壬", "辰": "壬",
  "巳": "庚", "酉": "庚", "丑": "庚",
  "亥": "甲", "卯": "甲", "未": "甲",
};

// ── 학당귀인 — 일간 기준 ──
const HAKDANG_STEMS: Record<string, string> = {
  "甲": "亥", "乙": "午", "丙": "寅", "戊": "寅",
  "丁": "酉", "己": "酉", "庚": "巳", "辛": "子",
  "壬": "申", "癸": "卯",
};

// ── 60갑자 인덱스 계산 ──
const STEMS_SEQ = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const BRANCHES_SEQ_SHINSAL = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

function getSexagenaryIndex(stem: string, branch: string): number {
  const s = STEMS_SEQ.indexOf(stem);
  const b = BRANCHES_SEQ_SHINSAL.indexOf(branch);
  if (s < 0 || b < 0) return -1;
  return (6 * s - 5 * b + 60) % 60;
}

// ── 공망 지지 계산 ──
function getGongmangBranches(sexagenaryIndex: number): [string, string] {
  const group = Math.floor(sexagenaryIndex / 10);
  const idx1 = 10 - 2 * group;
  const idx2 = 11 - 2 * group;
  return [BRANCHES_SEQ_SHINSAL[idx1], BRANCHES_SEQ_SHINSAL[idx2]];
}

const PILLAR_NAMES = ["년지", "월지", "일지", "시지"];
const PILLAR_POSITIONS: PillarPosition[] = ["year", "month", "day", "hour"];

function branchKorean(branch: string): string {
  return BRANCH_INFO[branch]?.korean ?? branch;
}

function stemKorean(stem: string): string {
  return STEM_ELEMENT[stem]?.korean ?? stem;
}

/** allBranches에서 target과 일치하는 모든 pillar position 반환 (skipIndex 위치 제외) */
function findBranchPositions(allBranches: string[], target: string, skipIndex?: number): PillarPosition[] {
  const positions: PillarPosition[] = [];
  for (let i = 0; i < allBranches.length; i++) {
    if (skipIndex !== undefined && i === skipIndex) continue;
    if (allBranches[i] === target) positions.push(PILLAR_POSITIONS[i]);
  }
  return positions;
}

function makeSamhapMatch(
  key: string, label: string, type: ShinsalType,
  ctx: ShinsalContext, table: Record<SamhapGroup, string>, shinsalName: string
): ShinsalMatch | null {
  const target = table[ctx.samhapGroup];
  if (!target || !ctx.samhapOtherBranchSet.has(target)) return null;
  // 삼합 기반: 년지(index 0) 제외한 위치에서 감지
  const detectedAt = findBranchPositions(ctx.allBranches, target, 0);
  return {
    key, label, type,
    evidence: [
      `년지 ${ctx.yearBranch}(${branchKorean(ctx.yearBranch)}) → 삼합 ${ctx.samhapGroup} → ${shinsalName} ${target}(${branchKorean(target)})`,
    ],
    detectedAt,
  };
}

const SHINSAL_DEFS: ShinsalDef[] = [
  // ── 삼합 기반 (yearBranch-samhap) ──
  {
    key: "dohwa", label: "도화살(桃花殺)", type: "neutral", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_DOHWA, "도화"); },
  },
  {
    key: "yeokma", label: "역마살(驛馬殺)", type: "neutral", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_YEOKMA, "역마"); },
  },
  {
    key: "hwagae", label: "화개살(華蓋殺)", type: "neutral", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_HWAGAE, "화개"); },
  },
  {
    key: "gyeopsal", label: "겁살(劫殺)", type: "bad", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_GYEOPSAL, "겁살"); },
  },
  // ── 일간 기반 (dayStem) ──
  {
    key: "yangin", label: "양인살(羊刃殺)", type: "bad", requiredPillars: 3,
    detect(ctx) {
      const target = YANGIN_STEMS[ctx.dayStem];
      if (!target || !ctx.otherBranchSet.has(target)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일간 ${ctx.dayStem}(양간) → 양인 ${target}(${branchKorean(target)})`],
        detectedAt: findBranchPositions(ctx.allBranches, target, 2),
      };
    },
  },
  {
    key: "chuneul", label: "천을귀인(天乙貴人)", type: "good", requiredPillars: 3,
    detect(ctx) {
      const targets = CHUNEUL_STEMS[ctx.dayStem];
      if (!targets) return null;
      const found = targets.filter((t) => ctx.otherBranchSet.has(t));
      if (found.length === 0) return null;
      const detectedAt: PillarPosition[] = [];
      for (const t of found) {
        for (const p of findBranchPositions(ctx.allBranches, t, 2)) {
          if (!detectedAt.includes(p)) detectedAt.push(p);
        }
      }
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [
          `일간 ${ctx.dayStem} → 천을귀인 ${targets.map((t) => `${t}(${branchKorean(t)})`).join("·")}`,
          ...found.map((t) => `${branchKorean(t)}지에 ${t} 존재`),
        ],
        detectedAt,
      };
    },
  },
  {
    key: "munchang", label: "문창귀인(文昌貴人)", type: "good", requiredPillars: 3,
    detect(ctx) {
      const target = MUNCHANG_STEMS[ctx.dayStem];
      if (!target || !ctx.otherBranchSet.has(target)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일간 ${ctx.dayStem} → 문창 ${target}(${branchKorean(target)})`],
        detectedAt: findBranchPositions(ctx.allBranches, target, 2),
      };
    },
  },
  {
    key: "hongryeom", label: "홍염살(紅艶殺)", type: "neutral", requiredPillars: 3,
    detect(ctx) {
      const target = HONGRYEOM_STEMS[ctx.dayStem];
      if (!target || !ctx.otherBranchSet.has(target)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일간 ${ctx.dayStem} → 홍염 ${target}(${branchKorean(target)})`],
        detectedAt: findBranchPositions(ctx.allBranches, target, 2),
      };
    },
  },
  // ── 일간 형태 (dayStem-shape) ──
  {
    key: "hyunchim", label: "현침살(懸針殺)", type: "bad", requiredPillars: 3,
    detect(ctx) {
      if (!(HYUNCHIM_STEMS as readonly string[]).includes(ctx.dayStem)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일간 ${ctx.dayStem} 자형(字形)이 현침에 해당`],
        detectedAt: ["day"],
      };
    },
  },
  // ── 신규 삼합 기반 ──
  {
    key: "jangseong", label: "장성살(將星殺)", type: "good", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_JANGSEONG, "장성"); },
  },
  {
    key: "jaesal", label: "재살(災殺)", type: "bad", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_JAESAL, "재살"); },
  },
  {
    key: "cheonsal", label: "천살(天殺)", type: "bad", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_CHEONSAL, "천살"); },
  },
  {
    key: "jisal", label: "지살(地殺)", type: "bad", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_JISAL, "지살"); },
  },
  {
    key: "mangsin", label: "망신살(亡身殺)", type: "bad", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_MANGSIN, "망신"); },
  },
  // ── 백호살 (일지 육충) ──
  {
    key: "baekho", label: "백호살(白虎殺)", type: "bad", requiredPillars: 3,
    detect(ctx) {
      const target = BAEKHO_TABLE[ctx.dayBranch];
      if (!target || !ctx.otherBranchSet.has(target)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일지 ${ctx.dayBranch}(${branchKorean(ctx.dayBranch)}) → 백호 ${target}(${branchKorean(target)})`],
        detectedAt: findBranchPositions(ctx.allBranches, target, 2),
      };
    },
  },
  // ── 괴강살 (일주 조합) ──
  {
    key: "goegang", label: "괴강살(魁罡殺)", type: "neutral", requiredPillars: 3,
    detect(ctx) {
      const dayPillar = ctx.dayStem + ctx.dayBranch;
      if (!GOEGANG_PILLARS.has(dayPillar)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일주 ${dayPillar}(${stemKorean(ctx.dayStem)}${branchKorean(ctx.dayBranch)})이 괴강에 해당`],
        detectedAt: ["day"],
      };
    },
  },
  // ── 공망 (일주 60갑자 기반) ──
  {
    key: "gongmang", label: "공망(空亡)", type: "neutral", requiredPillars: 3,
    detect(ctx) {
      if (ctx.sexagenaryIndex < 0) return null;
      const [gm1, gm2] = getGongmangBranches(ctx.sexagenaryIndex);
      const matchNames: string[] = [];
      const detectedAt: PillarPosition[] = [];
      for (let i = 0; i < ctx.allBranches.length; i++) {
        if (i === 2) continue;
        if (ctx.allBranches[i] === gm1 || ctx.allBranches[i] === gm2) {
          matchNames.push(PILLAR_NAMES[i]);
          detectedAt.push(PILLAR_POSITIONS[i]);
        }
      }
      if (matchNames.length === 0) return null;
      return {
        key: this.key,
        label: matchNames.map(pos => `공망(空亡)-${pos}`).join(", "),
        type: this.type,
        evidence: [
          `일주 60갑자 → 공망 ${gm1}(${branchKorean(gm1)})·${gm2}(${branchKorean(gm2)})`,
          ...matchNames.map(pos => `${pos}에 공망 해당`),
        ],
        detectedAt,
      };
    },
  },
  // ── 천덕귀인 (월지 기준) ──
  {
    key: "cheondeok", label: "천덕귀인(天德貴人)", type: "good", requiredPillars: 3,
    detect(ctx) {
      const target = CHEONDEOK_TABLE[ctx.monthBranch];
      if (!target) return null;
      const isBranch = BRANCHES_SEQ_SHINSAL.includes(target);
      const found = isBranch
        ? ctx.otherBranchSet.has(target)
        : ctx.otherStemSet.has(target);
      if (!found) {
        const foundOther = isBranch
          ? ctx.otherStemSet.has(target)
          : ctx.otherBranchSet.has(target);
        if (!foundOther) return null;
      }
      // 천덕은 천간/지지 모두 가능하므로 지지에서 감지된 위치만 기록
      const detectedAt = isBranch ? findBranchPositions(ctx.allBranches, target, 2) : [];
      // 천간에서 발견된 경우 해당 천간의 주 위치
      if (!isBranch && ctx.allStems) {
        for (let i = 0; i < ctx.allStems.length; i++) {
          if (i === 2) continue;
          if (ctx.allStems[i] === target && !detectedAt.includes(PILLAR_POSITIONS[i])) {
            detectedAt.push(PILLAR_POSITIONS[i]);
          }
        }
      }
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`월지 ${ctx.monthBranch}(${branchKorean(ctx.monthBranch)}) → 천덕 ${target}`],
        detectedAt: detectedAt.length > 0 ? detectedAt : ["month"],
      };
    },
  },
  // ── 월덕귀인 (월지 그룹 → 천간) ──
  {
    key: "woldeok", label: "월덕귀인(月德貴人)", type: "good", requiredPillars: 3,
    detect(ctx) {
      const target = WOLDEOK_TABLE[ctx.monthBranch];
      if (!target || !ctx.otherStemSet.has(target)) return null;
      const detectedAt: PillarPosition[] = [];
      if (ctx.allStems) {
        for (let i = 0; i < ctx.allStems.length; i++) {
          if (i === 2) continue;
          if (ctx.allStems[i] === target) detectedAt.push(PILLAR_POSITIONS[i]);
        }
      }
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`월지 ${ctx.monthBranch}(${branchKorean(ctx.monthBranch)}) → 월덕 ${target}(${stemKorean(target)})`],
        detectedAt: detectedAt.length > 0 ? detectedAt : ["month"],
      };
    },
  },
  // ── 학당귀인 (일간 → 지지) ──
  {
    key: "hakdang", label: "학당귀인(學堂貴人)", type: "good", requiredPillars: 3,
    detect(ctx) {
      const target = HAKDANG_STEMS[ctx.dayStem];
      if (!target || !ctx.otherBranchSet.has(target)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일간 ${ctx.dayStem}(${stemKorean(ctx.dayStem)}) → 학당 ${target}(${branchKorean(target)})`],
        detectedAt: findBranchPositions(ctx.allBranches, target, 2),
      };
    },
  },
];

export function findShinsal(
  dayBranch: string,
  dayStem: string,
  monthBranch: string,
  allBranches: string[],
  isTimeUnknown: boolean,
  allStems?: string[],
): ShinsalResult {
  const yearBranch = allBranches[0] ?? "";
  const otherBranches = allBranches.filter((_, i) => i !== 2);       // 일지 제외 (일간 기반 신살용)
  const samhapOtherBranches = allBranches.filter((_, i) => i !== 0); // 년지 제외 (삼합 기반 신살용)
  const stems = allStems ?? [];
  const otherStems = stems.filter((_, i) => i !== 2);
  const ctx: ShinsalContext = {
    dayStem, dayBranch, yearBranch, monthBranch, allBranches, otherBranches,
    otherBranchSet: new Set(otherBranches),
    samhapOtherBranches,
    samhapOtherBranchSet: new Set(samhapOtherBranches),
    allStems: stems,
    otherStems,
    otherStemSet: new Set(otherStems),
    isTimeUnknown,
    samhapGroup: BRANCH_TO_SAMHAP_GROUP[yearBranch],
    sexagenaryIndex: getSexagenaryIndex(dayStem, dayBranch),
  };

  const matches: ShinsalMatch[] = [];
  for (const def of SHINSAL_DEFS) {
    if (def.requiredPillars === 4 && isTimeUnknown) continue;
    const match = def.detect(ctx);
    if (match) matches.push(match);
  }

  const meta: ShinsalResult["meta"] = {};
  if (isTimeUnknown) {
    meta.note = "시주 미상으로 일부 변동 가능";
  }

  return { ruleset: SHINSAL_RULESET, matches, labels: matches.map((m) => m.label), meta };
}

export interface TwelveStageEntry {
  korean: string;    // "장생", "목욕", ...
  hanja: string;     // "長生", "沐浴", ...
  meaning: string;   // "새로운 시작, 성장의 기운"
  strength: "strong" | "neutral" | "weak";
}

export interface EnrichedSajuData {
  pillars: { year: string; month: string; day: string; hour: string | null };
  dayMaster: { stem: string; element: KoreanElement; yinYang: KoreanYinYang; korean: string };
  elementDist: Record<KoreanElement, number>;
  elementAnalysis: { deficient: KoreanElement[]; dominant: KoreanElement[] };
  strength: StrengthResult;
  tenStars: string[];
  relationships: { hap: string[]; chung: string[]; hyung: string[] };
  shinsal: ShinsalResult;
  twelveStages: {
    year: TwelveStageEntry;
    month: TwelveStageEntry;
    day: TwelveStageEntry;
    hour: TwelveStageEntry | null;
  };
  yongshin: YongshinResult;
  pillar12Shinsal: Pillar12ShinsalResult;
  isTimeUnknown: boolean;
}

// ── 12신살 위치별 매핑 (방법B: 이중 테이블) ──

const TWELVE_SHINSAL_NAMES = [
  "겁살", "재살", "천살", "지살", "년살", "월살",
  "망신살", "장성살", "반안살", "역마살", "육해살", "화개살",
] as const;

export type TwelveShinsalName = (typeof TWELVE_SHINSAL_NAMES)[number];

const GEOBSAL_START: Record<SamhapGroup, number> = {
  "인오술": 11, // 亥
  "사유축": 2,  // 寅
  "신자진": 5,  // 巳
  "해묘미": 8,  // 申
};

const TWELVE_SHINSAL_TYPE: Record<TwelveShinsalName, ShinsalType> = {
  "겁살": "bad", "재살": "bad", "천살": "bad", "지살": "bad",
  "년살": "neutral", "월살": "neutral", "망신살": "bad",
  "장성살": "good", "반안살": "neutral", "역마살": "neutral",
  "육해살": "bad", "화개살": "neutral",
};

export interface Pillar12ShinsalEntry {
  name: TwelveShinsalName;
  type: ShinsalType;
  branch: string;        // 해당 주의 지지 한자
  branchKorean: string;  // 해당 주의 지지 한글
}

export interface Pillar12ShinsalResult {
  year: Pillar12ShinsalEntry;
  month: Pillar12ShinsalEntry;
  day: Pillar12ShinsalEntry;
  hour: Pillar12ShinsalEntry | null;
}

/**
 * 12신살 위치별 매핑 (방법B: 이중 테이블)
 * - 년주: 일지의 삼합 그룹 사용
 * - 월/일/시주: 년지의 삼합 그룹 사용
 */
export function getPillar12Shinsal(
  allBranches: string[],
  isTimeUnknown: boolean,
): Pillar12ShinsalResult {
  const yearBranch = allBranches[0];
  const dayBranch = allBranches[2];

  const yearGroup = BRANCH_TO_SAMHAP_GROUP[yearBranch]; // 년지 삼합 → 월/일/시에 사용
  const dayGroup = BRANCH_TO_SAMHAP_GROUP[dayBranch];   // 일지 삼합 → 년에 사용

  function getShinsalForBranch(branch: string, group: SamhapGroup): Pillar12ShinsalEntry {
    const branchIdx = BRANCHES_SEQ_SHINSAL.indexOf(branch);
    const startIdx = GEOBSAL_START[group];
    const stageIdx = (branchIdx - startIdx + 12) % 12;
    const name = TWELVE_SHINSAL_NAMES[stageIdx];
    return {
      name,
      type: TWELVE_SHINSAL_TYPE[name],
      branch,
      branchKorean: BRANCH_INFO[branch]?.korean ?? branch,
    };
  }

  return {
    year: getShinsalForBranch(yearBranch, dayGroup),     // 년주 ← 일지 삼합
    month: getShinsalForBranch(allBranches[1], yearGroup), // 월주 ← 년지 삼합
    day: getShinsalForBranch(dayBranch, yearGroup),        // 일주 ← 년지 삼합
    hour: isTimeUnknown ? null : getShinsalForBranch(allBranches[3], yearGroup),
  };
}

// ── 신살 설명 ──

export const SHINSAL_DESCRIPTIONS: Record<string, string> = {
  // 삼합 기반
  dohwa: "매력과 인기가 많으나 색정의 유혹에 주의",
  yeokma: "이동·변동이 많고 활동적인 기운",
  hwagae: "예술·학문에 뛰어난 재능, 고독할 수 있음",
  gyeopsal: "예상치 못한 재물 손실이나 도난 주의",
  jangseong: "리더십과 통솔력이 뛰어남",
  jaesal: "갑작스러운 재난·사고에 주의",
  cheonsal: "하늘이 내린 시련, 정신적 고통",
  jisal: "땅에서 오는 어려움, 주거 변동",
  mangsin: "체면 손상이나 명예 실추에 주의",
  // 일간 기반
  yangin: "강한 추진력이 있으나 다혈질적 성향 주의",
  chuneul: "귀인의 도움이 있어 위기를 넘김",
  munchang: "문서·학업 운이 뛰어남",
  hongryeom: "이성 매력이 강하나 감정 기복 주의",
  hyunchim: "날카로운 판단력, 의료·기술 분야 적성",
  // 기타
  baekho: "급격한 사고·수술·혈광 주의",
  goegang: "강인한 의지와 결단력, 타협 어려움",
  gongmang: "해당 주의 기운이 비어 허무감이 올 수 있음",
  cheondeok: "하늘의 덕으로 재앙을 면함",
  woldeok: "월덕의 보호로 흉사를 피함",
  hakdang: "학업·연구에 두각을 나타냄",
  // 12신살 (위치별)
  "겁살": "예상치 못한 재물 손실이나 도난 주의",
  "재살": "갑작스러운 재난·사고에 주의",
  "천살": "하늘이 내린 시련, 정신적 고통",
  "지살": "땅에서 오는 어려움, 주거 변동",
  "년살": "이성 관련 구설이나 시비 주의",
  "월살": "건강과 가정사에 변동이 올 수 있음",
  "망신살": "체면 손상이나 명예 실추에 주의",
  "장성살": "리더십과 통솔력이 뛰어남",
  "반안살": "안정과 권위를 얻는 길한 기운",
  "역마살": "이동·변동이 많고 활동적인 기운",
  "육해살": "가까운 사람과의 갈등·배신 주의",
  "화개살": "예술·학문에 뛰어난 재능, 고독할 수 있음",
};

// ── 신강/신약 8단계 설명 ──

export const STRENGTH_DESCRIPTIONS: Record<string, string> = {
  "극신강": "일간의 힘이 매우 강해 오히려 종격에 가까운 특수 사주",
  "대신강": "일간의 세력이 압도적으로 강함. 자기 주장이 매우 강함",
  "신강": "일간의 힘이 강함. 리더십과 추진력이 있음",
  "약신강": "일간이 약간 강한 편. 균형에 가까우나 자기 주도적",
  "약신약": "일간이 약간 약한 편. 균형에 가까우나 유연한 성향",
  "신약": "일간의 힘이 약함. 협력과 지원이 중요함",
  "대신약": "일간의 세력이 매우 약함. 주변 환경에 크게 영향받음",
  "극신약": "일간의 힘이 극도로 약해 종격에 가까운 특수 사주",
};

export function formatEnrichedSajuText(data: EnrichedSajuData): string {
  const lines: string[] = [];

  const hourPart = data.isTimeUnknown ? "미상" : `${data.pillars.hour}`;
  lines.push(
    `년주: ${data.pillars.year} / 월주: ${data.pillars.month} / 일주: ${data.pillars.day} / 시주: ${hourPart}`
  );

  lines.push(
    `일간: ${data.dayMaster.stem}(${data.dayMaster.korean}${data.dayMaster.element}, ${data.dayMaster.yinYang}${data.dayMaster.element})`
  );

  const distStr = (["목", "화", "토", "금", "수"] as KoreanElement[])
    .map((e) => `${e}(${data.elementDist[e]})`)
    .join(" ");

  const defStr =
    data.elementAnalysis.deficient.length > 0
      ? ` → ${data.elementAnalysis.deficient.join(",")} 결핍`
      : "";
  const domStr =
    data.elementAnalysis.dominant.length > 0
      ? ` / ${data.elementAnalysis.dominant.join(",")} 과다`
      : "";
  const timeNote = data.isTimeUnknown ? " (시주 미상으로 불완전)" : "";
  lines.push(`오행분포: ${distStr}${defStr}${domStr}${timeNote}`);

  const strengthNote = data.isTimeUnknown ? " (시주 미상)" : "";
  const d = data.strength.details;
  const detailStr = d
    ? ` [득령${d.deukryeong ? "✅" : "❌"} 득지${d.deukji ? "✅" : "❌"} 득시${d.deuksi ? "✅" : "❌"} 득세${d.deukse ? "✅" : "❌"}]`
    : "";
  lines.push(
    `신강/신약: ${data.strength.result}${detailStr} (일간 도움 세력 ${data.strength.helpCount} vs 억제 세력 ${data.strength.resistCount})${strengthNote}`
  );

  const starNote = data.isTimeUnknown ? " (시주 제외)" : "";
  lines.push(`십성: ${data.tenStars.join(" ")}${starNote}`);

  const rels: string[] = [];
  if (data.relationships.hap.length > 0) rels.push(data.relationships.hap.join(", "));
  if (data.relationships.chung.length > 0) rels.push(data.relationships.chung.join(", "));
  if (data.relationships.hyung.length > 0) rels.push(data.relationships.hyung.join(", "));
  const relNote = data.isTimeUnknown ? " (시주 제외)" : "";
  lines.push(`합충형: ${rels.length > 0 ? rels.join(" / ") : "없음"}${relNote}`);

  if (data.twelveStages) {
    const ts = data.twelveStages;
    const parts = [
      `년-${ts.year.korean}(${ts.year.hanja})`,
      `월-${ts.month.korean}(${ts.month.hanja})`,
      `일-${ts.day.korean}(${ts.day.hanja})`,
      ts.hour ? `시-${ts.hour.korean}(${ts.hour.hanja})` : "시-미상",
    ];
    lines.push(`12운성: ${parts.join(" / ")}`);
  }

  const ssNote = data.isTimeUnknown ? " (시주 제외)" : "";
  const shinsalLabels = data.shinsal?.labels ?? [];
  if (shinsalLabels.length > 0) {
    const parts = data.shinsal.matches.map((m) =>
      `${m.label} [${m.evidence.join(", ")}]`
    );
    lines.push(`신살: ${parts.join(", ")}${ssNote}`);
  } else {
    lines.push(`신살: 없음${ssNote}`);
  }

  // 용신
  if (data.yongshin) {
    const y = data.yongshin;
    const eokbuHanja = ELEMENT_TO_HANJA[y.eokbu];
    let yongLine = `용신: 억부용신-${y.eokbu}(${eokbuHanja}) [${y.eokbuReason}]`;
    if (y.johu) {
      const johuHanja = ELEMENT_TO_HANJA[y.johu];
      yongLine += ` / 조후용신-${y.johu}(${johuHanja}) [${y.johuReason}]`;
    }
    lines.push(yongLine);
    const gisinHanja = ELEMENT_TO_HANJA[y.gisin];
    const heesinHanja = ELEMENT_TO_HANJA[y.heesin];
    lines.push(`기신: ${y.gisin}(${gisinHanja}) / 희신: ${y.heesin}(${heesinHanja})`);
  }

  return lines.join("\n");
}
