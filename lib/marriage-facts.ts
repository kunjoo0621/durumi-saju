import {
  STEM_ELEMENT,
  BRANCH_INFO,
  getTenStar,
  getPairRelation,
  DOHWA,
  type EnrichedSajuData,
} from "./utils/saju-enrichment";
import type { SajuData } from "./utils/saju";
import type { FortuneResult } from "./utils/saju-fortune";

export type MaritalStatus = "솔로" | "연애중" | "기혼" | "다시 혼자";
export interface SpouseStarHit { pillar: "year"|"month"|"day"|"hour"; source: "천간"|"지장간"; star: "정관"|"편관"|"정재"|"편재"; }
export interface TimingWindow { year: number; age: number; triggers: Array<"세운합일지"|"배우자성투출"|"도화홍염">; isPast: boolean; }
export interface MarriageFacts {
  sex: "male"|"female"; maritalStatus: MaritalStatus;
  dayStem: string; dayBranch: string;
  spouseStarType: "관성"|"재성"; spouseStars: SpouseStarHit[]; spouseStarAbsent: boolean;
  gwansalHonjap: boolean; spousePalaceHiddenStars: string[];
  dayBranchHap: string[]; dayBranchChung: string[]; dayBranchGongmang: boolean;
  dohwa: boolean; hongyeom: boolean;
  timingWindows: TimingWindow[];
  daeunSpouseYears: Array<{ startAge: number; endAge: number; star: string }>;
}

// "정관(正官)" → "정관"
function bareStar(label: string): string { return label.replace(/\(.*\)/, ""); }

// 일간 기준 target 천간이 어떤 십성인지 (bare)
function tenStarOf(dayStem: string, targetStem: string): string | null {
  const dm = STEM_ELEMENT[dayStem]; const t = STEM_ELEMENT[targetStem];
  if (!dm || !t) return null;
  return bareStar(getTenStar(dm.element, dm.yin_yang, t.element, t.yin_yang));
}

const PILLARS = ["year","month","day","hour"] as const;

export function deriveMarriageFacts(
  enriched: EnrichedSajuData,
  fortune: FortuneResult | null,
  sajuData: SajuData,
  sex: "male"|"female",
  maritalStatus: MaritalStatus,
  currentYear: number,
): MarriageFacts {
  const dayStem = sajuData.day.heavenlyStem;
  const dayBranch = sajuData.day.earthlyBranch;
  const spouseSet = sex === "female"
    ? new Set(["정관","편관"]) : new Set(["정재","편재"]);
  const spouseStarType = sex === "female" ? "관성" : "재성";

  // 1) 배우자성 탐지 (천간 투출 + 지장간)
  const spouseStars: SpouseStarHit[] = [];
  for (const pos of PILLARS) {
    const pillar = sajuData[pos];
    if (!pillar?.heavenlyStem) continue;
    const st = tenStarOf(dayStem, pillar.heavenlyStem);
    if (st && spouseSet.has(st)) spouseStars.push({ pillar: pos, source: "천간", star: st as SpouseStarHit["star"] });
    for (const hidden of pillar.hiddenStems ?? []) {
      const hs = tenStarOf(dayStem, hidden);
      if (hs && spouseSet.has(hs)) spouseStars.push({ pillar: pos, source: "지장간", star: hs as SpouseStarHit["star"] });
    }
  }
  const spouseStarAbsent = spouseStars.length === 0;
  const jeong = sex === "female" ? "정관" : "정재";
  const pyeon = sex === "female" ? "편관" : "편재";
  const gwansalHonjap = spouseStars.some(s => s.star === jeong) && spouseStars.some(s => s.star === pyeon);

  // 2) 일지 지장간 십성 (배우자 숨은 성격)
  const dayHidden = BRANCH_INFO[dayBranch]?.jijanggan ?? [];
  const spousePalaceHiddenStars = dayHidden
    .map(h => tenStarOf(dayStem, h.stem))
    .filter((x): x is string => !!x);

  // 3) 일지 합/충
  // 실측(saju-enrichment.ts:644 PairRelation): type은 "hap"|"samhap"|"banghap"|"chung"|"hyung"|"wonjin"|"same"|"none"
  // (한글 라벨이 아닌 영문 리터럴) → 브리프의 /합/ /충/ 정규식은 매치되지 않아 정확한 리터럴 비교로 교체.
  const dayBranchHap: string[] = [];
  const dayBranchChung: string[] = [];
  for (const other of PILLARS) {
    if (other === "day") continue;
    const b = sajuData[other]?.earthlyBranch;
    if (!b) continue;
    const rel = getPairRelation(dayBranch, b);
    if (rel.type === "hap") dayBranchHap.push(dayBranch + b);
    if (rel.type === "chung") dayBranchChung.push(dayBranch + b);
  }

  // 4) 일지 공망 / 도화 / 홍염 (enriched.shinsal)
  const matches = enriched.shinsal?.matches ?? [];
  // 실측: gongmang 판정(saju-enrichment.ts:1104 이하)은 "일주 60갑자 기반"(일공망) —
  // 일지(index 2)는 detect() 내부에서 명시적으로 skip되며, 구조적으로도 일지 자신은
  // 절대 자기 자신의 공망 지지가 될 수 없다(같은 순旬 안에서 이미 간지 조합이 존재하므로).
  // 따라서 dayBranchGongmang은 이 엔진에서 항상 false로 평가된다 — 브리프가 가정한
  // "일지 자체 공망" 개념은 이 룰셋(일공망)에 존재하지 않음. 값어치가 없는 상수 필드지만
  // 명리학적으로 정확한 동작이라 그대로 둔다(허위로 true를 만들지 않음).
  const dayBranchGongmang = matches.some(m => m.key === "gongmang" && m.detectedAt?.includes("day"));
  const dohwa = matches.some(m => m.label.includes("도화"));
  const hongyeom = matches.some(m => m.label.includes("홍염"));

  // 5) 타이밍 — Task 2에서 채움
  const { timingWindows, daeunSpouseYears } = deriveTiming(
    fortune, dayStem, dayBranch, spouseSet, currentYear, spouseStarAbsent,
  );

  return {
    sex, maritalStatus, dayStem, dayBranch, spouseStarType,
    spouseStars, spouseStarAbsent, gwansalHonjap, spousePalaceHiddenStars,
    dayBranchHap, dayBranchChung, dayBranchGongmang, dohwa, hongyeom,
    timingWindows, daeunSpouseYears,
  };
}

// 세운 3트리거(세운합일지·배우자성투출·도화홍염) + 대운 배우자성 구간(무관/무재 폴백용) 산출.
// 실측: FortuneResult.seun[].tenStar / .daeun.pillars[].tenStar 는 @gracefullight/saju
// getTenGodForStem(...).korean 값으로 이미 bare("정관", 하니자 미포함) — bareStar()는 no-op이지만
// 브리프의 안전장치 의도를 살려 그대로 적용(형식이 바뀌어도 깨지지 않도록).
function deriveTiming(
  fortune: FortuneResult | null, _dayStem: string, dayBranch: string,
  spouseSet: Set<string>, currentYear: number, _absent: boolean,
): { timingWindows: TimingWindow[]; daeunSpouseYears: MarriageFacts["daeunSpouseYears"] } {
  const timingWindows: TimingWindow[] = [];
  const daeunSpouseYears: MarriageFacts["daeunSpouseYears"] = [];
  if (!fortune) return { timingWindows, daeunSpouseYears };

  const dohwaBranch = DOHWA[dayBranch]; // 일지 기준 도화 지지

  for (const s of fortune.seun ?? []) {
    const triggers: TimingWindow["triggers"] = [];
    const rel = getPairRelation(dayBranch, s.branch);
    if (rel.type === "hap") triggers.push("세운합일지");
    if (spouseSet.has(bareStar(s.tenStar))) triggers.push("배우자성투출");
    if (dohwaBranch && s.branch === dohwaBranch) triggers.push("도화홍염");
    if (triggers.length > 0) {
      timingWindows.push({ year: s.year, age: s.age, triggers, isPast: s.year < currentYear });
    }
  }

  for (const d of fortune.daeun?.pillars ?? []) {
    if (spouseSet.has(bareStar(d.tenStar))) {
      daeunSpouseYears.push({ startAge: d.startAge, endAge: d.endAge, star: bareStar(d.tenStar) });
    }
  }

  return { timingWindows, daeunSpouseYears };
}
