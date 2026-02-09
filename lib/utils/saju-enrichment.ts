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

export const DOHWA: Record<string, string> = {
  子: "酉",
  丑: "午",
  寅: "卯",
  卯: "子",
  辰: "酉",
  巳: "午",
  午: "卯",
  未: "子",
  申: "酉",
  酉: "午",
  戌: "卯",
  亥: "子",
} as const;

export const YEOKMA: Record<string, string> = {
  子: "寅",
  丑: "亥",
  寅: "申",
  卯: "巳",
  辰: "寅",
  巳: "亥",
  午: "申",
  未: "巳",
  申: "寅",
  酉: "亥",
  戌: "申",
  亥: "巳",
} as const;

export const HWAGAE: Record<string, string> = {
  子: "辰",
  丑: "丑",
  寅: "戌",
  卯: "未",
  辰: "辰",
  巳: "丑",
  午: "戌",
  未: "未",
  申: "辰",
  酉: "丑",
  戌: "戌",
  亥: "未",
} as const;

export const HYUNCHIM_STEMS = ["甲", "辛"] as const;

export function findShinsal(dayBranch: string, dayMasterStem: string, allBranches: string[]): string[] {
  const result: string[] = [];
  const otherBranches = allBranches.filter((_, i) => i !== 2); // 일지 제외

  if (otherBranches.includes(DOHWA[dayBranch])) result.push("도화살(桃花殺)");
  if (otherBranches.includes(YEOKMA[dayBranch])) result.push("역마살(驛馬殺)");
  if (otherBranches.includes(HWAGAE[dayBranch])) result.push("화개살(華蓋殺)");
  if ((HYUNCHIM_STEMS as readonly string[]).includes(dayMasterStem)) result.push("현침살(懸針殺)");

  return result;
}

export interface EnrichedSajuData {
  pillars: { year: string; month: string; day: string; hour: string | null };
  dayMaster: { stem: string; element: KoreanElement; yinYang: KoreanYinYang; korean: string };
  elementDist: Record<KoreanElement, number>;
  elementAnalysis: { deficient: KoreanElement[]; dominant: KoreanElement[] };
  strength: { result: string; helpCount: number; resistCount: number };
  tenStars: string[];
  relationships: { hap: string[]; chung: string[]; hyung: string[] };
  shinsal: string[];
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
  lines.push(`신살: ${data.shinsal.length > 0 ? data.shinsal.join(" ") : "없음"}${ssNote}`);

  return lines.join("\n");
}
