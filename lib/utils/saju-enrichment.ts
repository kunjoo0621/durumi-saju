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

export function judgeStrength(
  dayMasterElement: KoreanElement,
  elementDist: Record<KoreanElement, number>,
  totalCount: number,
  isTimeUnknown: boolean
): {
  result: "신강" | "신약" | "추정 신강" | "추정 신약";
  helpCount: number;
  resistCount: number;
} {
  const generatesMe = findElementThatGenerates(dayMasterElement);

  const helpCount =
    (elementDist[dayMasterElement] || 0) + (generatesMe ? elementDist[generatesMe] || 0 : 0);
  const resistCount = Math.max(0, totalCount - helpCount);

  const base: "신강" | "신약" = helpCount >= resistCount ? "신강" : "신약";
  const result: "신강" | "신약" | "추정 신강" | "추정 신약" = isTimeUnknown
    ? base === "신강"
      ? "추정 신강"
      : "추정 신약"
    : base;
  return { result, helpCount, resistCount };
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

export interface ShinsalMatch {
  key: string;
  label: string;
  type: ShinsalType;
  evidence: string[];
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
  monthBranch: string;
  allBranches: string[];
  otherBranches: string[];
  otherBranchSet: Set<string>;
  isTimeUnknown: boolean;
  samhapGroup: SamhapGroup;
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

function branchKorean(branch: string): string {
  return BRANCH_INFO[branch]?.korean ?? branch;
}

function makeSamhapMatch(
  key: string, label: string, type: ShinsalType,
  ctx: ShinsalContext, table: Record<SamhapGroup, string>, shinsalName: string
): ShinsalMatch | null {
  const target = table[ctx.samhapGroup];
  if (!target || !ctx.otherBranchSet.has(target)) return null;
  return {
    key, label, type,
    evidence: [
      `일지 ${ctx.dayBranch}(${branchKorean(ctx.dayBranch)}) → 삼합 ${ctx.samhapGroup} → ${shinsalName} ${target}(${branchKorean(target)})`,
    ],
  };
}

const SHINSAL_DEFS: ShinsalDef[] = [
  // ── 삼합 기반 (dayBranch-samhap) ──
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
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [
          `일간 ${ctx.dayStem} → 천을귀인 ${targets.map((t) => `${t}(${branchKorean(t)})`).join("·")}`,
          ...found.map((t) => `${branchKorean(t)}지에 ${t} 존재`),
        ],
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
): ShinsalResult {
  const otherBranches = allBranches.filter((_, i) => i !== 2);
  const ctx: ShinsalContext = {
    dayStem, dayBranch, monthBranch, allBranches, otherBranches,
    otherBranchSet: new Set(otherBranches),
    isTimeUnknown,
    samhapGroup: BRANCH_TO_SAMHAP_GROUP[dayBranch],
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

export interface EnrichedSajuData {
  pillars: { year: string; month: string; day: string; hour: string | null };
  dayMaster: { stem: string; element: KoreanElement; yinYang: KoreanYinYang; korean: string };
  elementDist: Record<KoreanElement, number>;
  elementAnalysis: { deficient: KoreanElement[]; dominant: KoreanElement[] };
  strength: { result: string; helpCount: number; resistCount: number };
  tenStars: string[];
  relationships: { hap: string[]; chung: string[]; hyung: string[] };
  shinsal: ShinsalResult;
  isTimeUnknown: boolean;
}

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
  lines.push(
    `신강/신약: ${data.strength.result} (일간 도움 세력 ${data.strength.helpCount} vs 억제 세력 ${data.strength.resistCount})${strengthNote}`
  );

  const starNote = data.isTimeUnknown ? " (시주 제외)" : "";
  lines.push(`십성: ${data.tenStars.join(" ")}${starNote}`);

  const rels: string[] = [];
  if (data.relationships.hap.length > 0) rels.push(data.relationships.hap.join(", "));
  if (data.relationships.chung.length > 0) rels.push(data.relationships.chung.join(", "));
  if (data.relationships.hyung.length > 0) rels.push(data.relationships.hyung.join(", "));
  const relNote = data.isTimeUnknown ? " (시주 제외)" : "";
  lines.push(`합충형: ${rels.length > 0 ? rels.join(" / ") : "없음"}${relNote}`);

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

  return lines.join("\n");
}
