import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveWealthFacts } from "./wealth-facts";
import { enrichSajuData } from "./utils/saju";
import type { SajuData } from "./utils/saju";
import type { FortuneResult } from "./utils/saju-fortune";

const STRONG_LEVELS = ["극왕", "태강", "신강", "중화신강"];

// 일간 甲(목/양). CONTROLS[목]=토 → 정재(己 토음)/편재(戊 토양).
// 년간 戊(편재)·월간 己(정재) 직접 투출 + 지장간에도 재성 다수(戊 중복) → 재성혼재.
const mixedChart: SajuData = {
  year: { heavenlyStem: "戊", earthlyBranch: "辰", hiddenStems: ["戊", "乙", "癸"] },
  month: { heavenlyStem: "己", earthlyBranch: "巳", hiddenStems: ["丙", "戊", "庚"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

test("정재+편재 존재 → jaeseongType 재성혼재, jaeseongAbsent false, jaeseongStrength>0", () => {
  const enriched = enrichSajuData(mixedChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, mixedChart, "목돈·노후 준비", 2026);
  assert.equal(facts.jaeseongType, "재성혼재");
  assert.equal(facts.jaeseongAbsent, false);
  assert.ok(facts.jaeseong.some((h) => h.star === "정재"));
  assert.ok(facts.jaeseong.some((h) => h.star === "편재"));
  // 실측(엔진 재현): 천간 투출(戊·weight3) + 지장간 다수 → weighted 9.25
  assert.equal(facts.jaeseongStrength, 9.25);
});

// 일간 甲(목/양), 신약(득령/득지/득시/득세 대부분 불리) + 재성(토) 다수 노출(천간 2 + 지지 지장간 다수).
const jaedaShinyakChart: SajuData = {
  year: { heavenlyStem: "戊", earthlyBranch: "戌", hiddenStems: ["戊", "辛", "丁"] },
  month: { heavenlyStem: "己", earthlyBranch: "未", hiddenStems: ["己", "丁", "乙"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
};

test("신약 + weighted 재성 과다(≥6) → jaedaShinyak true, jaeGrip 재다신약", () => {
  const enriched = enrichSajuData(jaedaShinyakChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, jaedaShinyakChart, "지출·빚 관리", 2026);
  assert.ok(
    !STRONG_LEVELS.includes(facts.strengthLevel),
    `신약계열이어야 함 (실측 strengthLevel=${facts.strengthLevel})`,
  );
  // 실측(엔진 재현): 천간 투출 2개(戊·庚 중 戊만 재성=3) + 월지(1.5배) 정기 己(2*1.5=3) 등 → 11.5
  assert.equal(facts.jaeseongStrength, 11.5, `weighted 재성 강도 실측 불일치 (${facts.jaeseongStrength})`);
  assert.equal(facts.jaedaShinyak, true);
  assert.equal(facts.jaeGrip, "재다신약");
});

// 일간 甲(목/양). 년간 丙(화양)=식신(GENERATES[목]=화, sameYY) 직접 투출(weight 3, 임계 2 이상) → 발화.
const sikssangChart: SajuData = {
  year: { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
  month: { heavenlyStem: "壬", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "乙", earthlyBranch: "丑", hiddenStems: ["己", "癸", "辛"] },
};

test("식신/상관 유의미한 weight(천간 투출 등, ≥2) 존재 → sikssangSaengjae true", () => {
  const enriched = enrichSajuData(sikssangChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, sikssangChart, "투자로 불리기", 2026);
  assert.equal(facts.sikssangSaengjae, true);
});

// v2 weighted-aware 검증: 식상이 오직 "여기(餘氣)" 한 글자(weight 0.5, 월지 아님)로만
// 스쳐가면 임계(2) 미달 → 발화하지 않는다. v1은 이런 경우도 무조건 true였음(94.7% 발화의
// 원인) — 이 테스트가 그 회귀를 잡는다.
// 일간 甲: 년 壬(편인) 子(정인) / 월 乙(겁재) 卯(겁재) / 일지 戌(戊편재·辛정관·丁상관=여기,
// day pillar라 월지배율 없음 → weight 0.5) / 시 辛(정관) 酉(정관). 상관(丁) 외 식상 전무.
const sikssangTrivialChart: SajuData = {
  year: { heavenlyStem: "壬", earthlyBranch: "子", hiddenStems: ["癸"] },
  month: { heavenlyStem: "乙", earthlyBranch: "卯", hiddenStems: ["乙"] },
  day: { heavenlyStem: "甲", earthlyBranch: "戌", hiddenStems: ["戊", "辛", "丁"] },
  hour: { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },
};

test("식상이 여기(0.5)로만 존재(임계 2 미달) → sikssangSaengjae false (v1 회귀 방지)", () => {
  const enriched = enrichSajuData(sikssangTrivialChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, sikssangTrivialChart, "투자로 불리기", 2026);
  assert.equal(facts.sikssangSaengjae, false);
});

// 재성(토, 戊/己) 전무 차트: 일간 甲, 년/월/시 천간(壬乙辛)과 지지(子卯酉) 모두
// 지장간에 戊/己를 포함하지 않는 조합만 선택(子=[癸] 卯=[乙] 酉=[辛]).
const noJaeChart: SajuData = {
  year: { heavenlyStem: "壬", earthlyBranch: "子", hiddenStems: ["癸"] },
  month: { heavenlyStem: "乙", earthlyBranch: "卯", hiddenStems: ["乙"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },
};

test("무재 차트: jaeseongType 무재, jaeseongAbsent true, jaeseongStrength 0, 군겁쟁재는 무재라 제외", () => {
  const enriched = enrichSajuData(noJaeChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, noJaeChart, "사업·수입 키우기", 2026);
  assert.equal(facts.jaeseongAbsent, true);
  assert.equal(facts.jaeseongType, "무재");
  assert.equal(facts.jaeseongStrength, 0);
  // 이 차트는 비겁 weighted 6(임계 통과)이지만 무재라서 군겁쟁재는 반드시 false여야 함
  // ("무재∧군겁쟁재는 0%"라는 Fable 요구사항의 단위테스트 앵커).
  assert.ok(facts.bigeopStrength >= 6, `비겁 강도가 임계 이상이어야 무재 배제 테스트 의미가 있음 (${facts.bigeopStrength})`);
  assert.equal(facts.gunggeobJaengjae, false);
});

test("타이밍: 세운 tenStar 재성/식상/비겁 → 트리거 매칭 (신약 차트 → 비겁조력)", () => {
  const enriched = enrichSajuData(mixedChart, { isTimeUnknown: false });
  assert.ok(
    !STRONG_LEVELS.includes(enriched.strength.result),
    `mixedChart는 신약계열이어야 라벨반전 테스트가 유효함 (실측 ${enriched.strength.result})`,
  );
  const fortune: FortuneResult = {
    daeun: {
      gender: "male",
      isForward: true,
      startAge: 3,
      startAgeDetail: { years: 3, months: 0, days: 0 },
      daysToTerm: 0,
      pillars: [
        { index: 0, startAge: 23, endAge: 32, pillar: "己巳", stem: "己", branch: "巳", tenStar: "정재", twelveStage: "제왕" },
        { index: 1, startAge: 33, endAge: 42, pillar: "丙寅", stem: "丙", branch: "寅", tenStar: "식신", twelveStage: "건록" },
      ],
    },
    seun: [
      { year: 2027, age: 33, pillar: "己巳", stem: "己", branch: "巳", tenStar: "정재", twelveStage: "제왕" },
      { year: 2028, age: 34, pillar: "丙寅", stem: "丙", branch: "寅", tenStar: "식신", twelveStage: "건록" },
      { year: 2029, age: 35, pillar: "甲子", stem: "甲", branch: "子", tenStar: "비견", twelveStage: "목욕" },
    ],
  };
  const facts = deriveWealthFacts(enriched, fortune, mixedChart, "목돈·노후 준비", 2026);

  const w2027 = facts.timingWindows.find((w) => w.year === 2027);
  assert.ok(w2027);
  assert.ok(w2027!.triggers.includes("재성투출"));
  assert.equal(w2027!.isPast, false);

  const w2028 = facts.timingWindows.find((w) => w.year === 2028);
  assert.ok(w2028);
  assert.ok(w2028!.triggers.includes("식상투출"));

  const w2029 = facts.timingWindows.find((w) => w.year === 2029);
  assert.ok(w2029);
  // v2 라벨 반전: 신약 차트의 비겁운은 손재가 아니라 조력(용비겁)
  assert.ok(w2029!.triggers.includes("비겁조력"));
  assert.ok(!w2029!.triggers.includes("비겁손재"));

  // 대운 재성 구간: 정재(己巳)만 포함, 식신(丙寅)은 제외
  assert.equal(facts.daeunWealthYears.length, 1);
  assert.equal(facts.daeunWealthYears[0].star, "정재");
  assert.equal(facts.daeunWealthYears[0].startAge, 23);
});

// 신강(비겁·재성 모두 weighted 강) 차트: 甲일간, 비견/겁재 천간 2개 + 지지 정기 다수,
// 재성도 천간 투출+월지 정기로 weighted 7 → jaeGrip "신왕재왕".
const strongAbundantChart: SajuData = {
  year: { heavenlyStem: "甲", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
  month: { heavenlyStem: "己", earthlyBranch: "未", hiddenStems: ["己", "丁", "乙"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

test("타이밍: 신강 차트의 비겁 세운 → 비겁손재 라벨(반전 아님)", () => {
  const enriched = enrichSajuData(strongAbundantChart, { isTimeUnknown: false });
  assert.ok(
    STRONG_LEVELS.includes(enriched.strength.result),
    `신강계열이어야 함 (실측 ${enriched.strength.result})`,
  );
  const fortune: FortuneResult = {
    daeun: { gender: "male", isForward: true, startAge: 3, startAgeDetail: { years: 3, months: 0, days: 0 }, daysToTerm: 0, pillars: [] },
    seun: [
      { year: 2029, age: 35, pillar: "甲子", stem: "甲", branch: "子", tenStar: "비견", twelveStage: "목욕" },
    ],
  };
  const facts = deriveWealthFacts(enriched, fortune, strongAbundantChart, "목돈·노후 준비", 2026);
  const w2029 = facts.timingWindows.find((w) => w.year === 2029);
  assert.ok(w2029);
  assert.ok(w2029!.triggers.includes("비겁손재"));
  assert.ok(!w2029!.triggers.includes("비겁조력"));
});

test("그릇(jaeGrip): 신강+weighted 재성 강(≥6) → 신왕재왕, 군겁쟁재는 false(상호배타)", () => {
  const enriched = enrichSajuData(strongAbundantChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, strongAbundantChart, "목돈·노후 준비", 2026);
  assert.equal(facts.jaeGrip, "신왕재왕");
  assert.equal(facts.jaeseongStrength, 7);
  // 비겁도 weighted 강(7.75, 임계 6 이상)이지만 재도 왕성해 "다툴 이유가 없음"
  // → 그릇 강(신왕재왕)과 군겁쟁재는 절대 동시 발화하지 않는다 (Fable 요구 불변식).
  assert.ok(facts.bigeopStrength >= 6, `비겁도 강해야 상호배타 테스트가 의미 있음 (${facts.bigeopStrength})`);
  assert.equal(facts.gunggeobJaengjae, false);
});

test("재고(財庫): 재(토) 오행의 묘지 戌이 지지에 있으면 jaego true", () => {
  // jaedaShinyakChart 년지가 戌 — 목의 재(CONTROLS[목]=토) 묘지는 戌.
  const enriched = enrichSajuData(jaedaShinyakChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, jaedaShinyakChart, "지출·빚 관리", 2026);
  assert.equal(facts.jaego, true);
});

// 군겁쟁재(v2): 자평 정통상 "비겁이 많아 신강해졌지만 재는 얼마 없는" 신왕재쇠 국면에서
// 성립(신왕재왕=다툴 게 없어 배제). 일간 甲: 비견/겁재 천간+지지 정기 다수(weighted 10)
// vs 재성은 여기·중기 파편만(weighted 3.25, 재쇠) + 관성(금) 전무(구제 없음).
const gunggeobChart: SajuData = {
  year: { heavenlyStem: "甲", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
  month: { heavenlyStem: "乙", earthlyBranch: "午", hiddenStems: ["丁", "己"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

test("군겁쟁재(v2): 비겁 weighted 왕 + 재성 존재하되 약 + 관성 구제 없음 → true, jaeGrip 신왕재쇠", () => {
  const enriched = enrichSajuData(gunggeobChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, gunggeobChart, "목돈·노후 준비", 2026);
  assert.equal(facts.jaeGrip, "신왕재쇠");
  assert.ok(facts.bigeopStrength >= 6, `비겁 강도 실측 (${facts.bigeopStrength})`);
  assert.equal(facts.jaeseongAbsent, false, "무재가 아니라 '재 존재하되 약'이어야 함");
  assert.ok(facts.jaeseongStrength > 0 && facts.jaeseongStrength < 6);
  assert.equal(facts.gunggeobJaengjae, true);
});

// 신강(목3 수4) + 관성(금)만 1개 있고 식상(화)·재성(토)이 0 → 용신 후보 동률에서
// 우선순위(관성>식상>재성)상 식상이 선택 → 용신=식상(화) → 재물(식상)을 반김.
const yongshinSikssangChart: SajuData = {
  year: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  month: { heavenlyStem: "壬", earthlyBranch: "酉", hiddenStems: ["辛"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "癸", earthlyBranch: "卯", hiddenStems: ["乙"] },
};

test("용신이 식상(재물 생산 경로)을 반기면 yongshinFavorsWealth true", () => {
  const enriched = enrichSajuData(yongshinSikssangChart, { isTimeUnknown: false });
  assert.ok(
    STRONG_LEVELS.includes(enriched.strength.result),
    `신강계열이어야 함 (실측 ${enriched.strength.result})`,
  );
  assert.equal(enriched.yongshin.eokbu, "화", `용신 억부가 화(식상)여야 함 (실측 ${enriched.yongshin.eokbu})`);
  const facts = deriveWealthFacts(enriched, null, yongshinSikssangChart, "투자로 불리기", 2026);
  assert.equal(facts.yongshinFavorsWealth, true);
});

test("fortune null이면 타이밍/대운 재성 구간 빈 배열", () => {
  const enriched = enrichSajuData(mixedChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, mixedChart, "목돈·노후 준비", 2026);
  assert.deepEqual(facts.timingWindows, []);
  assert.deepEqual(facts.daeunWealthYears, []);
});

// ── 겁재 탈재(손재 구멍) ────────────────────────────────────────────
// 실제 운영자 개인사주 메인 리포트가 "군겁쟁재/손재 구조"로 읽는 실사용자 차트.
// 일간 癸(수/음). 월간 壬(수/양)=겁재(같은 오행, 다른 음양) 직접 투출 +
// 월지 午의 정기 丁(화/음)=재성(CONTROLS[수]=화, sameYY(음,음)=true → 편재) —
// 겁재가 재성 지지 바로 위에 앉은 "개두" 형태. 재성 자체는 weighted로 약하지 않을
// 수 있으나(jaeGrip 사분면과 무관), 겁재가 재를 직접 누르는 손재 구멍은 별도로 존재.
const userChart: SajuData = {
  year: { heavenlyStem: "乙", earthlyBranch: "亥", hiddenStems: ["戊", "甲", "壬"] },
  month: { heavenlyStem: "壬", earthlyBranch: "午", hiddenStems: ["丙", "己", "丁"] },
  day: { heavenlyStem: "癸", earthlyBranch: "未", hiddenStems: ["丁", "乙", "己"] },
  hour: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["戊", "壬", "庚"] },
};

test("겁재 탈재(실사용자 차트): 월간 壬(겁재)이 월지 午 정기 丁(편재) 위에 개두 → bigeopTaljae true, jaeGrip과 co-exist", () => {
  const enriched = enrichSajuData(userChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, userChart, "지출·빚 관리", 2026);
  assert.equal(facts.bigeopTaljae, true, "겁재 개두(월간 壬 / 월지 午 정기 丁)를 잡아야 함");
  // 이 차트가 바로 이번 수정의 발단: 엔진은 재성을 weighted "강"으로 읽어 jaeGrip이
  // "신왕재왕"(조화)으로 나온다 — gunggeobJaengjae(신왕재쇠 전용)는 구조상 false가
  // 맞다. 하지만 겁재 개두로 인한 손재 구멍은 실재하므로 bigeopTaljae가 별도로
  // true를 잡아 메인 개인사주 리포트("잘 버는데 주머니가 샌다")와 정합을 맞춘다.
  assert.equal(facts.jaeGrip, "신왕재왕", `실측 jaeGrip 확인용 (${facts.jaeGrip})`);
  assert.equal(facts.gunggeobJaengjae, false);
});

// 부정 케이스: 비겁 천간(년간 乙=겁재)은 있지만 같은/인접 기둥 지지에 재성(토)이
// 정기·중기로 존재하지 않음(년지 亥=壬·甲, 월지 卯=乙 모두 무재) + 재성은 시지 未에만
// 있는데 시주는 년주와 인접하지 않음(연-월, 월-일, 일-시만 인접) → 거리 미달로 false.
const bigeopFarFromJaeChart: SajuData = {
  year: { heavenlyStem: "乙", earthlyBranch: "亥", hiddenStems: ["壬", "甲"] },
  month: { heavenlyStem: "丙", earthlyBranch: "卯", hiddenStems: ["乙"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "辛", earthlyBranch: "未", hiddenStems: ["己", "丁", "乙"] },
};

test("겁재 탈재 부정 케이스: 비겁(년간 겁재)과 재성(시지 정기)이 같은/인접 기둥이 아니면 → false", () => {
  const enriched = enrichSajuData(bigeopFarFromJaeChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, bigeopFarFromJaeChart, "지출·빚 관리", 2026);
  assert.equal(facts.bigeopTaljae, false);
});

// co-exist 검증: strongAbundantChart는 년간 甲(비견, day 甲과 같은 오행·같은 음양)이
// 인접한 월지 未의 정기 己(정재)와 개두 형태 — jaeGrip이 "신왕재왕"(그릇 강)이어도
// bigeopTaljae가 true로 발화해야 한다(gunggeobJaengjae처럼 신왕재왕과 상호배타가
// 아니라 의도적으로 co-exist하는 것이 이 필드의 핵심 요구사항).
test("겁재 탈재 co-exist: 신왕재왕 차트도 비겁-재성 개두가 있으면 bigeopTaljae true (gunggeobJaengjae와 달리 상호배타 아님)", () => {
  const enriched = enrichSajuData(strongAbundantChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, strongAbundantChart, "목돈·노후 준비", 2026);
  assert.equal(facts.jaeGrip, "신왕재왕");
  assert.equal(facts.gunggeobJaengjae, false);
  assert.equal(facts.bigeopTaljae, true, "비견(년간 甲)-재성(월지 未 정기 己) 개두를 잡아야 함");
});
