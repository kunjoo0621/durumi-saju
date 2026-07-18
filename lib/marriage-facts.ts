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
export type SpouseStarDamageReason = "비겁극재" | "상관견관" | "충거";

export interface MarriageFacts {
  sex: "male"|"female"; maritalStatus: MaritalStatus;
  dayStem: string; dayBranch: string;
  spouseStarType: "관성"|"재성"; spouseStars: SpouseStarHit[]; spouseStarAbsent: boolean;
  gwansalHonjap: boolean; spousePalaceHiddenStars: string[];
  dayBranchHap: string[]; dayBranchChung: string[]; dayBranchGongmang: boolean;
  spousePalaceStability: "안정" | "보통" | "불안정";
  // 배우자성 손상(위치 극/충) — spousePalaceStability(일지 합충)·spouseStars(존재/강도)와
  // 독립된 별도 축. "배우자성 또렷 + 배우자궁 안정"이어도 배우자성 자체가 극당하거나
  // 충으로 깨지면 별도로 발화한다(개인사주 메인 리포트가 극/충 구조로 읽는 경우와 정합
  // 맞추기 위함 — lib/wealth-facts.ts의 bigeopTaljae와 동일 클래스의 수정).
  spouseStarDamaged: boolean;
  spouseStarDamageReason: SpouseStarDamageReason[];
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

const BIGEOP_SET = new Set(["비견", "겁재"]); // 남명 배우자성(재성) 공격자
const SIKSSANG_SET = new Set(["식신", "상관"]); // 여명 배우자성(관성) 공격자 — 브리프상 식신도 포함, 라벨은 "상관견관"으로 통일

// 인접 기둥 정의 — lib/wealth-facts.ts의 ADJACENT_PILLARS와 동일 구조(개두·인접만 보는
// 순수 위치 판정 — 비겁/식상 오행은 정의상 배우자성 오행을 그대로 극하므로 같은/인접
// 기둥에 있다는 사실 자체가 이미 "극이 실제로 부딪힌다"는 뜻).
const ADJACENT_PILLARS: Record<
  (typeof PILLARS)[number],
  (typeof PILLARS)[number][]
> = {
  year: ["month"],
  month: ["year", "day"],
  day: ["month", "hour"],
  hour: ["day"],
};

// 지지의 배우자성 판정 — 정기(index0)·중기(index1)만 "극이 실제로 부딪히는" 신호로 인정.
// 여기(index2, 가장 약한 지장간)만 스쳐가는 경우는 제외 — wealth-facts.ts의
// branchHasStrongJae와 동일 철학(과발화 방지).
function branchHasStrongSpouseStar(
  dayStem: string,
  branch: string | undefined,
  spouseSet: Set<string>,
): boolean {
  if (!branch) return false;
  const info = BRANCH_INFO[branch];
  if (!info) return false;
  return info.jijanggan.slice(0, 2).some((j) => {
    const st = tenStarOf(dayStem, j.stem);
    return st ? spouseSet.has(st) : false;
  });
}

// 공격자(비겁/식상) 천간 존재 여부 — day 천간(일간 자기 자신)은 제외
// (wealth-facts.ts의 isBigeopStem과 동일 정책: 자기 자신과 비교하면 항상 비견/식신급이
// 잡혀 허위 발화하는 것을 방지).
function isAttackerStem(
  dayStem: string,
  pos: (typeof PILLARS)[number],
  sajuData: SajuData,
  attackerSet: Set<string>,
): boolean {
  if (pos === "day") return false;
  const stem = sajuData[pos]?.heavenlyStem;
  if (!stem) return false;
  const st = tenStarOf(dayStem, stem);
  return st ? attackerSet.has(st) : false;
}

// 극(剋) 감지 — 공격자 천간이 배우자성 지지 바로 위(개두) 또는 인접 기둥에 앉아 있는지.
function detectSpouseStarKeuk(
  dayStem: string,
  sajuData: SajuData,
  attackerSet: Set<string>,
  spouseSet: Set<string>,
): boolean {
  for (const pos of PILLARS) {
    if (!isAttackerStem(dayStem, pos, sajuData, attackerSet)) continue;
    if (branchHasStrongSpouseStar(dayStem, sajuData[pos]?.earthlyBranch, spouseSet)) return true;
    for (const adj of ADJACENT_PILLARS[pos]) {
      if (branchHasStrongSpouseStar(dayStem, sajuData[adj]?.earthlyBranch, spouseSet)) return true;
    }
  }
  return false;
}

// 충거(沖去) 감지 — 배우자성을 "정기(본기)로 담은" 지지가 다른 지지와 충 관계인 경우만
// 인정한다(일지 포함 — 일지 정기가 배우자성이면서 그 일지가 충당하는 경우도 여기서 자연히
// 잡힌다). 배우자성을 담지 않은 지지의 "bare 일지충"은 여기서 제외한다 — 그건 이미
// spousePalaceStability("불안정")가 별도로 표현하는 신호라, 여기서도 카운트하면 배우자궁
// 불안정을 배우자성 손상으로 이중계상하게 되어 발화율이 부풀려진다(실측 MC: 이중계상 제거
// 전 남/여 각 ~50% → 제거 후 극 감지기가 주도하는 수준으로 정상화, marriage-v1.md 참조).
function detectChungeo(
  dayStem: string,
  sajuData: SajuData,
  spouseSet: Set<string>,
): boolean {
  const branches = PILLARS.map((pos) => sajuData[pos]?.earthlyBranch).filter(
    (b): b is string => !!b,
  );
  for (let i = 0; i < branches.length; i++) {
    const a = branches[i];
    const jeonggi = BRANCH_INFO[a]?.jijanggan[0];
    if (!jeonggi) continue;
    const st = tenStarOf(dayStem, jeonggi.stem);
    if (!st || !spouseSet.has(st)) continue;
    for (let j = 0; j < branches.length; j++) {
      if (i === j || branches[j] === a) continue;
      if (getPairRelation(a, branches[j]).type === "chung") return true;
    }
  }
  return false;
}

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
  // 필드명은 gwansalHonjap 하나지만 남명은 실제로 "정편재혼잡"(정재+편재 동시)이다. 필드명을
  // rename하지 않는 이유: DB 컬럼(gwansal_honjap)·teaser_json·share-marriage·API 응답까지 파급.
  // 프롬프트 노출 라벨은 성별에 맞춰 marriage-prompt.ts buildFactBlock에서 분기한다.
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

  // 4-1) 배우자궁(일지) 안정도 — 일지 합/충 실측만으로 결정론 산출(dayBranchGongmang은
  // 위 주석대로 이 엔진에서 항상 false라 판단축에서 제외). 충이 하나라도 있으면 불안정이
  // 최우선(합보다 충의 영향이 크다는 통설), 충 없이 합이 있으면 안정, 둘 다 없으면 보통.
  const spousePalaceStability: MarriageFacts["spousePalaceStability"] =
    dayBranchChung.length > 0 ? "불안정" : dayBranchHap.length > 0 ? "안정" : "보통";

  // 4-2) 배우자성 손상 — spousePalaceStability(궁 안정도)·spouseStars(존재/강도)와 독립된
  // 축. 남명은 비겁(비견·겁재)이 재성(배우자성) 지지를 개두·인접으로 극하면 "비겁극재",
  // 여명은 식상(식신·상관)이 관성(배우자성) 지지를 같은 방식으로 극하면 "상관견관"으로
  // 판정한다("특히 상관"이지만 브리프 정의상 식신도 공격자에 포함). 여기에 충거(배우자성을
  // "정기로 담은" 지지가 충으로 깨지는 경우 — 일지도 포함되지만 일지가 배우자성을 담고
  // 있을 때만)를 더한다. 배우자성이 담기지 않은 지지의 bare 일지충은 여기서 세지 않는다
  // — 그건 이미 spousePalaceStability("불안정")가 별도 축으로 표현하는 신호라, 여기서도
  // 세면 궁 불안정을 배우자성 손상으로 이중계상하게 된다(이중계상 제거 전 MC 실측: 발화율
  // 남/여 각 ~50% — bare 일지충의 기저 발생률만으로 충거가 과다발화했었음. 제거 후 극
  // 감지기가 주도하는 수준으로 정상화, 수치는 marriage-v1.md 참조). 배우자성이 또렷하고
  // 궁이 안정이어도 이 신호는 별도로 발화할 수 있다(co-exist — gunggeobJaengjae류 상호배타
  // 아님).
  const attackerSet = sex === "male" ? BIGEOP_SET : SIKSSANG_SET;
  const keukReason: SpouseStarDamageReason = sex === "male" ? "비겁극재" : "상관견관";
  const spouseStarDamageReason: SpouseStarDamageReason[] = [];
  if (detectSpouseStarKeuk(dayStem, sajuData, attackerSet, spouseSet)) {
    spouseStarDamageReason.push(keukReason);
  }
  if (detectChungeo(dayStem, sajuData, spouseSet)) {
    spouseStarDamageReason.push("충거");
  }
  const spouseStarDamaged = spouseStarDamageReason.length > 0;

  // 5) 타이밍 — Task 2에서 채움
  const { timingWindows, daeunSpouseYears } = deriveTiming(
    fortune, dayStem, dayBranch, spouseSet, currentYear, spouseStarAbsent,
  );

  return {
    sex, maritalStatus, dayStem, dayBranch, spouseStarType,
    spouseStars, spouseStarAbsent, gwansalHonjap, spousePalaceHiddenStars,
    dayBranchHap, dayBranchChung, dayBranchGongmang, spousePalaceStability,
    spouseStarDamaged, spouseStarDamageReason,
    dohwa, hongyeom,
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
