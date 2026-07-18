import {
  STEM_ELEMENT,
  BRANCH_INFO,
  CONTROLS,
  GENERATES,
  getTenStar,
  type EnrichedSajuData,
  type KoreanElement,
} from "./utils/saju-enrichment";
import type { SajuData } from "./utils/saju";
import type { FortuneResult } from "./utils/saju-fortune";

export type WealthInterest =
  | "목돈·노후 준비"
  | "투자로 불리기"
  | "사업·수입 키우기"
  | "지출·빚 관리";

export interface WealthStarHit {
  pillar: "year" | "month" | "day" | "hour";
  source: "천간" | "지장간";
  star: "정재" | "편재";
}

export interface WealthTimingWindow {
  year: number;
  age: number;
  triggers: Array<"재성투출" | "식상투출" | "비겁손재" | "비겁조력">;
  isPast: boolean;
}

// 그릇(재를 감당하는 능력) = (신강/신약) × (weighted 재성 강/약) 2차원 4상한.
// v1의 3-band(강/중/약)는 '중' 밴드가 Monte Carlo(1,000명)에서 11%밖에 안 잡히는
// 죽은 구간이었음(Fable 리뷰 지적) → 2차원 4상한으로 교체해 밴드 붕괴를 제거.
export type WealthGrip = "신왕재왕" | "신왕재쇠" | "재다신약" | "신약재소";

export interface WealthFacts {
  interest: WealthInterest;
  dayStem: string;
  jaeseong: WealthStarHit[]; // 재성 탐지(위치)
  jaeseongType: "정재우세" | "편재우세" | "재성혼재" | "무재";
  jaeseongAbsent: boolean;
  jaeseongStrength: number; // 재성 weighted 강도 점수
  bigeopStrength: number; // 비겁 weighted 강도 점수
  strengthLevel: string; // judgeStrength 결과 (신강/신약 등 8단계)
  jaeGrip: WealthGrip; // 그릇 2차원 4상한
  jaedaShinyak: boolean; // 재다신약 (jaeGrip === "재다신약"에서 파생)
  sikssangSaengjae: boolean; // 식상생재 (weighted-aware)
  gunggeobJaengjae: boolean; // 군겁쟁재
  jaego: boolean; // 재고(財庫) 유무
  yongshinFavorsWealth: boolean; // 용신이 재/식상
  timingWindows: WealthTimingWindow[];
  daeunWealthYears: Array<{ startAge: number; endAge: number; star: string }>;
}

// "정재(正財)" → "정재"
function bareStar(label: string): string {
  return label.replace(/\(.*\)/, "");
}

// 일간 기준 target 천간이 어떤 십성인지 (bare)
function tenStarOf(dayStem: string, targetStem: string): string | null {
  const dm = STEM_ELEMENT[dayStem];
  const t = STEM_ELEMENT[targetStem];
  if (!dm || !t) return null;
  return bareStar(getTenStar(dm.element, dm.yin_yang, t.element, t.yin_yang));
}

const PILLARS = ["year", "month", "day", "hour"] as const;

// 오행별 묘(墓)/재고(財庫) 지지 — 코드베이스의 12운성 양간기준 장생지(YANG_BIRTH_BRANCH,
// saju-enrichment.ts:358/saju-fortune.ts:20)로부터 파생: 묘=TWELVE_STAGE_NAMES 인덱스8
// (targetIdx - birthIdx + 12) % 12 === 8 지지를 각 오행별로 계산해 검증한 고정표.
//   목(甲 장생=亥) → 8번째 = 未
//   화(丙 장생=寅) → 戌   토(戊 장생=寅, 화토동궁) → 戌
//   금(庚 장생=巳) → 丑
//   수(壬 장생=申) → 辰
// (fabrication 방지: 임의 추측이 아니라 기존 unexported YANG_BIRTH_BRANCH 알고리즘을
// 손계산으로 재현 후 고정값화. 함수가 export되지 않아 재사용 대신 파생표를 둠.)
const ELEMENT_GRAVE_BRANCH: Record<KoreanElement, string> = {
  목: "未",
  화: "戌",
  토: "戌",
  금: "丑",
  수: "辰",
};

const STRONG_LEVELS = new Set(["극왕", "태강", "신강", "중화신강"]);

// ── v2 강약 가중 모델 ──────────────────────────────────────────────
// v1은 지장간을 전부 "천간 투출과 동일 무게(1)"로 카운트했음(unweighted full-count).
// 여기(餘氣) 한 글자만 스쳐도 천간 투출과 동급으로 잡혀 식상생재 94.7%·재다신약
// 41.7%처럼 사실상 모든 사주가 발화하는 discrimination 붕괴를 낳음(Fable 리뷰).
// v2는 출처별로 다른 가중치를 준다:
//   천간 투출 = 3 (가장 강한 신호 — 실제로 겉으로 드러난 기운)
//   지지 정기(본기, jijanggan[0]) = 2
//   중기(jijanggan[1]) = 1.5
//   여기(jijanggan[2]) = 0.5 (가장 약한 신호 — 스쳐가는 기운)
//   + 월지(月支) 지장간은 위 가중치에 1.5배 — 월령이 강약을 지배한다는 명리 원칙 반영.
const STEM_WEIGHT = 3;
const JIJANGGAN_POSITION_WEIGHT = [2, 1.5, 0.5] as const; // index 0=본기 1=중기 2=여기
const JIJANGGAN_FALLBACK_WEIGHT = 0.5; // 위치를 못 찾은 경우(방어적 폴백) — 가장 약한 가중치
const MONTH_BRANCH_MULTIPLIER = 1.5;

interface WeightedHit {
  pillar: (typeof PILLARS)[number];
  source: "천간" | "지장간";
  star: string;
  weight: number;
}

// 4주(년/월/일/시) 전체를 훑어 십성별 weighted hit 목록을 만든다.
// day 천간(일간 자기 자신)은 제외 — 자기 자신과 비교하면 항상 "비견"이 잡혀
// 군겁쟁재 등 카운트가 허위로 부풀려짐(calculateTenStars가 day stem 인덱스를
// 건너뛰는 것과 동일 정책). day 지지의 지장간은 배우자궁/재고 판단에 실질적
// 의미가 있으므로 포함.
function collectWeightedHits(sajuData: SajuData, dayStem: string): WeightedHit[] {
  const hits: WeightedHit[] = [];
  for (const pos of PILLARS) {
    const pillar = sajuData[pos];
    if (!pillar) continue;

    if (pillar.heavenlyStem && pos !== "day") {
      const st = tenStarOf(dayStem, pillar.heavenlyStem);
      if (st) hits.push({ pillar: pos, source: "천간", star: st, weight: STEM_WEIGHT });
    }

    const branch = pillar.earthlyBranch;
    const branchInfo = branch ? BRANCH_INFO[branch] : undefined;
    for (const hiddenStem of pillar.hiddenStems ?? []) {
      const hs = tenStarOf(dayStem, hiddenStem);
      if (!hs) continue;
      const posIdx = branchInfo?.jijanggan.findIndex((j) => j.stem === hiddenStem) ?? -1;
      const baseWeight =
        posIdx >= 0 && posIdx < JIJANGGAN_POSITION_WEIGHT.length
          ? JIJANGGAN_POSITION_WEIGHT[posIdx]
          : JIJANGGAN_FALLBACK_WEIGHT;
      const weight = pos === "month" ? baseWeight * MONTH_BRANCH_MULTIPLIER : baseWeight;
      hits.push({ pillar: pos, source: "지장간", star: hs, weight });
    }
  }
  return hits;
}

function sumWeight(hits: WeightedHit[], starSet: Set<string>): number {
  let total = 0;
  for (const h of hits) {
    if (starSet.has(h.star)) total += h.weight;
  }
  return Math.round(total * 100) / 100;
}

// ── v2 판정 임계값(1,000명 Monte Carlo로 튜닝, wealth-mc.mts 참조) ──
// 재성 "강" 판정 컷은 신강/신약 모집단에 따라 분리한다. 실측(1,000명 diag): 신강
// 모집단의 jaeseongStrength 중앙값은 3.5, 신약 모집단은 6 — 신강 차트는 비겁·인성이
// 이미 사주 슬롯 다수를 차지해 구조적으로 재의 여유치가 낮다. 단일 임계(8)를 그대로
// 쓰면 "신왕재왕"이 4.2%짜리 죽은 밴드가 되어 v1이 앓던 병(그릇 '중' 11% 죽은 밴드)을
// 사분면 버전으로 재현하게 됨 → 신강/신약 모집단별 상대 기준으로 분리.
const JAE_STRONG_THRESHOLD_WHEN_STRONG = 4.5; // 신강 모집단 내 상위 ~40% 컷
const JAE_STRONG_THRESHOLD_WHEN_WEAK = 8; // 신약 모집단 내 상위 ~28% 컷 → 재다신약 10~15%
const BIGEOP_STRONG_THRESHOLD = 6;
// 식상생재: 지장간 여기 1개(0.5)만으로는 발화하지 않도록 최소 "본기급(2)" 이상을 요구.
const SIKSSANG_MEANINGFUL_THRESHOLD = 3;

export function deriveWealthFacts(
  enriched: EnrichedSajuData,
  fortune: FortuneResult | null,
  sajuData: SajuData,
  interest: WealthInterest,
  currentYear: number,
): WealthFacts {
  const dayStem = sajuData.day.heavenlyStem;
  const dayMasterElement = enriched.dayMaster.element;

  // 1) weighted hit 전체 수집 (천간 + 지장간, 4주 전부)
  const allHits = collectWeightedHits(sajuData, dayStem);

  // 2) 재성(정재/편재) — 위치 목록은 종전과 동일하게 유지(프롬프트/UI가 위치를 소비)
  const jaeseong: WealthStarHit[] = allHits
    .filter((h) => h.star === "정재" || h.star === "편재")
    .map((h) => ({ pillar: h.pillar, source: h.source, star: h.star as "정재" | "편재" }));
  const jaeseongAbsent = jaeseong.length === 0;

  const jeongjaeWeight = sumWeight(allHits, new Set(["정재"]));
  const pyeonjaeWeight = sumWeight(allHits, new Set(["편재"]));
  const jaeseongStrength = Math.round((jeongjaeWeight + pyeonjaeWeight) * 100) / 100;
  const hasJeongjae = jeongjaeWeight > 0;
  const hasPyeonjae = pyeonjaeWeight > 0;
  const jaeseongType: WealthFacts["jaeseongType"] =
    hasJeongjae && hasPyeonjae
      ? "재성혼재"
      : hasJeongjae
        ? "정재우세"
        : hasPyeonjae
          ? "편재우세"
          : "무재";

  const bigeopStrength = sumWeight(allHits, BIGEOP_SET);

  // 3) 신강/신약 (이미 enrichSajuData 단계에서 계산됨 — 재계산 아닌 재사용)
  const strengthLevel = enriched.strength.result;
  const isStrong = STRONG_LEVELS.has(strengthLevel);

  // 4) 그릇(jaeGrip): (신강/신약) × (weighted 재성 강/약) 2차원 4상한.
  // jaedaShinyak은 여기서 파생만 함 — 별도 재판정 없음(단일 진실원).
  const jaeStrongThreshold = isStrong ? JAE_STRONG_THRESHOLD_WHEN_STRONG : JAE_STRONG_THRESHOLD_WHEN_WEAK;
  const jaeseongStrong = jaeseongStrength >= jaeStrongThreshold;
  const jaeGrip: WealthGrip = isStrong
    ? jaeseongStrong
      ? "신왕재왕"
      : "신왕재쇠"
    : jaeseongStrong
      ? "재다신약"
      : "신약재소";
  const jaedaShinyak = jaeGrip === "재다신약";

  // 5) 식상생재: weighted-aware — 여기(0.5) 하나만으로는 발화하지 않음
  const sikssangStrength = sumWeight(allHits, SIKSSANG_SET);
  const sikssangSaengjae = sikssangStrength >= SIKSSANG_MEANINGFUL_THRESHOLD;

  // 6) 군겁쟁재: 비겁 왕(weighted) ∧ 재성 존재하되 약(weighted, 무재 아님) ∧ 관성 구제 없음.
  // 자평 정통 개념상 군겁쟁재(群劫爭財)는 "비겁이 많아 신강해졌지만 정작 재는 얼마
  // 없는" 신왕재쇠(自我強, 財弱) 국면에서 성립한다 — 비겁 여럿이 적은 재를 놓고 다투는
  // 그림. 신왕재왕(자아도 강하고 재도 넉넉)은 오히려 다툴 게 없는 "그릇 강"(순조로운
  // 핸들링) 케이스이므로, gunggeobJaengjae는 jaeGrip === "신왕재쇠" 분기 안에서만
  // 판정해 "그릇 강(신왕재왕)"과 절대 동시 발화하지 않도록 구조적으로 보장한다.
  const hasGwansung = allHits.some((h) => h.star === "정관" || h.star === "편관");
  const gunggeobJaengjae =
    jaeGrip === "신왕재쇠" &&
    !jaeseongAbsent &&
    bigeopStrength >= BIGEOP_STRONG_THRESHOLD &&
    !hasGwansung;

  // 상호배타 불변식 가드(런타임 검증) — 위 조건식 구조상 항상 false이어야 하지만,
  // 향후 로직 변경 시 회귀를 즉시 잡기 위해 명시적으로 assert.
  // (jaeGrip 리터럴로 직접 비교하면 TS가 이미 상호배타를 정적으로 증명해 "no overlap"
  // 컴파일 에러를 내므로, jaeGrip==="신왕재왕"과 동치인 별도 boolean(strongAndAbundant)을
  // 통해 런타임 가드를 살려둔다.)
  const strongAndAbundant = isStrong && jaeseongStrong;
  if (gunggeobJaengjae && strongAndAbundant) {
    throw new Error(
      `[wealth-facts] 불변식 위반: jaeGrip="${jaeGrip}"(신왕재왕, 그릇 강)과 gunggeobJaengjae가 동시 발화`,
    );
  }
  if (gunggeobJaengjae && jaeseongAbsent) {
    throw new Error("[wealth-facts] 불변식 위반: 무재 상태에서 gunggeobJaengjae 발화");
  }

  // 7) 재고(財庫): 재 오행의 묘(墓) 지지가 사주 지지에 존재하는지 (v1과 동일 — Fable 검증 완료, 유지)
  const jaeElement = CONTROLS[dayMasterElement];
  const siksangElement = GENERATES[dayMasterElement];
  const graveBranch = ELEMENT_GRAVE_BRANCH[jaeElement];
  let jaego = false;
  if (!graveBranch) {
    console.warn(`[wealth-facts] 재고 묘지 파생 실패: jaeElement=${jaeElement}`);
  } else {
    const branches = PILLARS.map((pos) => sajuData[pos]?.earthlyBranch).filter(
      (b): b is string => !!b,
    );
    jaego = branches.includes(graveBranch);
  }
  // BRANCH_INFO 참조(지장간 교차 확인) — graveBranch가 실제 지지 테이블에 존재하는지 방어
  if (graveBranch && !BRANCH_INFO[graveBranch]) {
    console.warn(`[wealth-facts] graveBranch(${graveBranch})가 BRANCH_INFO에 없음`);
    jaego = false;
  }

  // 8) 용신이 재/식상을 반기는지 — 억부용신(eokbu) 오행이 재성 오행 또는 식상 오행과 일치 (v1과 동일, 유지)
  const yongshinFavorsWealth =
    enriched.yongshin.eokbu === jaeElement || enriched.yongshin.eokbu === siksangElement;

  // 9) 타이밍 — 비겁 트리거는 신강/신약에 따라 라벨 반전(v2)
  const { timingWindows, daeunWealthYears } = deriveTiming(fortune, currentYear, isStrong);

  return {
    interest,
    dayStem,
    jaeseong,
    jaeseongType,
    jaeseongAbsent,
    jaeseongStrength,
    bigeopStrength,
    strengthLevel,
    jaeGrip,
    jaedaShinyak,
    sikssangSaengjae,
    gunggeobJaengjae,
    jaego,
    yongshinFavorsWealth,
    timingWindows,
    daeunWealthYears,
  };
}

const JAESEONG_SET = new Set(["정재", "편재"]);
const SIKSSANG_SET = new Set(["식신", "상관"]);
const BIGEOP_SET = new Set(["비견", "겁재"]);

// 세운 3트리거(재성투출·식상투출·비겁조력/비겁손재) + 대운 재성 구간 산출.
// 실측: FortuneResult.seun[].tenStar / .daeun.pillars[].tenStar 는 @gracefullight/saju
// getTenGodForStem(...).korean 값으로 이미 bare("정재", 한자 미포함) — bareStar()는 no-op이지만
// 형식이 바뀌어도 깨지지 않도록 그대로 적용(결혼운 엔진과 동일 안전장치).
//
// v2 라벨 반전: v1은 비겁 대운/세운을 항상 "손재"(손실)로 라벨링했으나, 이는 신강
// 차트에서만 성립하는 판단이다. 신약 차트에서 비겁운은 부족한 힘을 보태주는 용신급
// 지원(용비겁)이므로 "비겁조력"으로 라벨을 반전한다.
function deriveTiming(
  fortune: FortuneResult | null,
  currentYear: number,
  isStrong: boolean,
): {
  timingWindows: WealthTimingWindow[];
  daeunWealthYears: WealthFacts["daeunWealthYears"];
} {
  const timingWindows: WealthTimingWindow[] = [];
  const daeunWealthYears: WealthFacts["daeunWealthYears"] = [];
  if (!fortune) return { timingWindows, daeunWealthYears };

  const bigeopTrigger: "비겁손재" | "비겁조력" = isStrong ? "비겁손재" : "비겁조력";

  for (const s of fortune.seun ?? []) {
    const triggers: WealthTimingWindow["triggers"] = [];
    const st = bareStar(s.tenStar);
    if (JAESEONG_SET.has(st)) triggers.push("재성투출");
    if (SIKSSANG_SET.has(st)) triggers.push("식상투출");
    if (BIGEOP_SET.has(st)) triggers.push(bigeopTrigger);
    if (triggers.length > 0) {
      timingWindows.push({ year: s.year, age: s.age, triggers, isPast: s.year < currentYear });
    }
  }

  for (const d of fortune.daeun?.pillars ?? []) {
    const st = bareStar(d.tenStar);
    if (JAESEONG_SET.has(st)) {
      daeunWealthYears.push({ startAge: d.startAge, endAge: d.endAge, star: st });
    }
  }

  return { timingWindows, daeunWealthYears };
}
