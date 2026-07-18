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
  | "목돈 모으기"
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
  triggers: Array<"재성투출" | "식상투출" | "비겁손재">;
  isPast: boolean;
}

export interface WealthFacts {
  interest: WealthInterest;
  dayStem: string;
  jaeseong: WealthStarHit[]; // 재성 탐지
  jaeseongType: "정재우세" | "편재우세" | "재성혼재" | "무재";
  jaeseongAbsent: boolean;
  strengthLevel: string; // judgeStrength 결과 (신강/신약 등 8단계)
  jaeToGamdang: "강" | "중" | "약"; // 재를 감당하는 그릇
  jaedaShinyak: boolean; // 재다신약
  sikssangSaengjae: boolean; // 식상생재
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

export function deriveWealthFacts(
  enriched: EnrichedSajuData,
  fortune: FortuneResult | null,
  sajuData: SajuData,
  interest: WealthInterest,
  currentYear: number,
): WealthFacts {
  const dayStem = sajuData.day.heavenlyStem;
  const dayMasterElement = enriched.dayMaster.element;

  // 1) 전체 십성 탐지 (천간 + 지장간, 4주 전부) — day 천간은 일간 자기 자신과의
  // 비교라 의미 없는 항상-비견 매치를 만들어내므로 제외(calculateTenStars가 stems[2]를
  // 건너뛰는 것과 동일 정책). day 지지의 지장간은 배우자궁/재고 판단에 실질적 의미가
  // 있으므로 포함.
  const allHits: { pillar: (typeof PILLARS)[number]; source: "천간" | "지장간"; star: string }[] = [];
  for (const pos of PILLARS) {
    const pillar = sajuData[pos];
    if (!pillar) continue;
    if (pillar.heavenlyStem && pos !== "day") {
      const st = tenStarOf(dayStem, pillar.heavenlyStem);
      if (st) allHits.push({ pillar: pos, source: "천간", star: st });
    }
    for (const hidden of pillar.hiddenStems ?? []) {
      const hs = tenStarOf(dayStem, hidden);
      if (hs) allHits.push({ pillar: pos, source: "지장간", star: hs });
    }
  }

  // 2) 재성(정재/편재) 탐지
  const jaeseong: WealthStarHit[] = allHits
    .filter((h) => h.star === "정재" || h.star === "편재")
    .map((h) => ({ pillar: h.pillar, source: h.source, star: h.star as "정재" | "편재" }));
  const jaeseongAbsent = jaeseong.length === 0;
  const hasJeongjae = jaeseong.some((h) => h.star === "정재");
  const hasPyeonjae = jaeseong.some((h) => h.star === "편재");
  const jaeseongType: WealthFacts["jaeseongType"] =
    hasJeongjae && hasPyeonjae
      ? "재성혼재"
      : hasJeongjae
        ? "정재우세"
        : hasPyeonjae
          ? "편재우세"
          : "무재";

  // 3) 신강/신약 (이미 enrichSajuData 단계에서 계산됨 — 재계산 아닌 재사용)
  const strengthLevel = enriched.strength.result;
  const isStrong = STRONG_LEVELS.has(strengthLevel);

  // 4) 재를 감당하는 그릇: 신강&재유=강, 신약&재다(2개+)=약(재다신약), 그 외=중
  let jaeToGamdang: WealthFacts["jaeToGamdang"];
  let jaedaShinyak = false;
  if (isStrong && jaeseong.length > 0) {
    jaeToGamdang = "강";
  } else if (!isStrong && jaeseong.length >= 2) {
    jaeToGamdang = "약";
    jaedaShinyak = true;
  } else {
    jaeToGamdang = "중";
  }

  // 5) 식상생재: 십성에 식신/상관 존재
  const sikssangSaengjae = allHits.some((h) => h.star === "식신" || h.star === "상관");

  // 6) 군겁쟁재: 비견+겁재 2개 이상 AND 재성 약(1개 이하) 또는 무재.
  // day 천간(일간 자기 자신)은 위 allHits 수집 단계에서 이미 제외됨 — 포함 시
  // 일간=일간 자기비교가 항상 비견으로 잡혀 허위로 카운트가 부풀려짐.
  const bigeopCount = allHits.filter((h) => h.star === "비견" || h.star === "겁재").length;
  const gunggeobJaengjae = bigeopCount >= 2 && jaeseong.length <= 1;

  // 7) 재고(財庫): 재 오행의 묘(墓) 지지가 사주 지지에 존재하는지
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

  // 8) 용신이 재/식상을 반기는지 — 억부용신(eokbu) 오행이 재성 오행 또는 식상 오행과 일치
  const yongshinFavorsWealth =
    enriched.yongshin.eokbu === jaeElement || enriched.yongshin.eokbu === siksangElement;

  // 9) 타이밍
  const { timingWindows, daeunWealthYears } = deriveTiming(fortune, currentYear);

  return {
    interest,
    dayStem,
    jaeseong,
    jaeseongType,
    jaeseongAbsent,
    strengthLevel,
    jaeToGamdang,
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

// 세운 3트리거(재성투출·식상투출·비겁손재) + 대운 재성 구간 산출.
// 실측: FortuneResult.seun[].tenStar / .daeun.pillars[].tenStar 는 @gracefullight/saju
// getTenGodForStem(...).korean 값으로 이미 bare("정재", 한자 미포함) — bareStar()는 no-op이지만
// 형식이 바뀌어도 깨지지 않도록 그대로 적용(결혼운 엔진과 동일 안전장치).
function deriveTiming(
  fortune: FortuneResult | null,
  currentYear: number,
): {
  timingWindows: WealthTimingWindow[];
  daeunWealthYears: WealthFacts["daeunWealthYears"];
} {
  const timingWindows: WealthTimingWindow[] = [];
  const daeunWealthYears: WealthFacts["daeunWealthYears"] = [];
  if (!fortune) return { timingWindows, daeunWealthYears };

  for (const s of fortune.seun ?? []) {
    const triggers: WealthTimingWindow["triggers"] = [];
    const st = bareStar(s.tenStar);
    if (JAESEONG_SET.has(st)) triggers.push("재성투출");
    if (SIKSSANG_SET.has(st)) triggers.push("식상투출");
    if (BIGEOP_SET.has(st)) triggers.push("비겁손재");
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
