import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveWealthFacts } from "./wealth-facts";
import { enrichSajuData } from "./utils/saju";
import type { SajuData } from "./utils/saju";
import type { FortuneResult } from "./utils/saju-fortune";

// 일간 甲(목/양). CONTROLS[목]=토 → 정재(己 토음)/편재(戊 토양).
// 년간 戊(편재)·월간 己(정재) 직접 투출 + 지장간에도 재성 다수(戊 중복) → 재성혼재.
const mixedChart: SajuData = {
  year: { heavenlyStem: "戊", earthlyBranch: "辰", hiddenStems: ["戊", "乙", "癸"] },
  month: { heavenlyStem: "己", earthlyBranch: "巳", hiddenStems: ["丙", "戊", "庚"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

test("정재+편재 존재 → jaeseongType 재성혼재, jaeseongAbsent false", () => {
  const enriched = enrichSajuData(mixedChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, mixedChart, "목돈 모으기", 2026);
  assert.equal(facts.jaeseongType, "재성혼재");
  assert.equal(facts.jaeseongAbsent, false);
  assert.ok(facts.jaeseong.some((h) => h.star === "정재"));
  assert.ok(facts.jaeseong.some((h) => h.star === "편재"));
});

// 일간 甲(목/양), 신약(득령/득지/득시/득세 대부분 불리) + 재성(토) 다수 노출.
// 천간: 戊(편재)·己(정재)·庚(편관, 재 아님). 지지: 戌·未 재성 지장간 중복.
const jaedaShinyakChart: SajuData = {
  year: { heavenlyStem: "戊", earthlyBranch: "戌", hiddenStems: ["戊", "辛", "丁"] },
  month: { heavenlyStem: "己", earthlyBranch: "未", hiddenStems: ["己", "丁", "乙"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
};

test("신약 + 재 과다 → jaedaShinyak true, jaeToGamdang 약", () => {
  const enriched = enrichSajuData(jaedaShinyakChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, jaedaShinyakChart, "지출·빚 관리", 2026);
  assert.ok(
    !["극왕", "태강", "신강", "중화신강"].includes(facts.strengthLevel),
    `신약계열이어야 함 (실측 strengthLevel=${facts.strengthLevel})`,
  );
  assert.ok(facts.jaeseong.length >= 2, "재성 2개 이상(재다)이어야 함");
  assert.equal(facts.jaedaShinyak, true);
  assert.equal(facts.jaeToGamdang, "약");
});

// 일간 甲(목/양). 년간 丙(화양)=식신(GENERATES[목]=화, sameYY) 직접 투출.
const sikssangChart: SajuData = {
  year: { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
  month: { heavenlyStem: "壬", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "乙", earthlyBranch: "丑", hiddenStems: ["己", "癸", "辛"] },
};

test("식신/상관 존재 → sikssangSaengjae true", () => {
  const enriched = enrichSajuData(sikssangChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, sikssangChart, "투자로 불리기", 2026);
  assert.equal(facts.sikssangSaengjae, true);
});

// 재성(토, 戊/己) 전무 차트: 일간 甲, 년/월/시 천간(壬乙辛)과 지지(子卯酉) 모두
// 지장간에 戊/己를 포함하지 않는 조합만 선택(子=[癸] 卯=[乙] 酉=[辛]).
const noJaeChart: SajuData = {
  year: { heavenlyStem: "壬", earthlyBranch: "子", hiddenStems: ["癸"] },
  month: { heavenlyStem: "乙", earthlyBranch: "卯", hiddenStems: ["乙"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },
};

test("무재 차트: jaeseongType 무재, jaeseongAbsent true", () => {
  const enriched = enrichSajuData(noJaeChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, noJaeChart, "사업·수입 키우기", 2026);
  assert.equal(facts.jaeseongAbsent, true);
  assert.equal(facts.jaeseongType, "무재");
});

test("타이밍: 세운 tenStar 재성/식상/비겁 → 트리거 매칭", () => {
  const enriched = enrichSajuData(mixedChart, { isTimeUnknown: false });
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
  const facts = deriveWealthFacts(enriched, fortune, mixedChart, "목돈 모으기", 2026);

  const w2027 = facts.timingWindows.find((w) => w.year === 2027);
  assert.ok(w2027);
  assert.ok(w2027!.triggers.includes("재성투출"));
  assert.equal(w2027!.isPast, false);

  const w2028 = facts.timingWindows.find((w) => w.year === 2028);
  assert.ok(w2028);
  assert.ok(w2028!.triggers.includes("식상투출"));

  const w2029 = facts.timingWindows.find((w) => w.year === 2029);
  assert.ok(w2029);
  assert.ok(w2029!.triggers.includes("비겁손재"));

  // 대운 재성 구간: 정재(己巳)만 포함, 식신(丙寅)은 제외
  assert.equal(facts.daeunWealthYears.length, 1);
  assert.equal(facts.daeunWealthYears[0].star, "정재");
  assert.equal(facts.daeunWealthYears[0].startAge, 23);
});

test("재고(財庫): 재(토) 오행의 묘지 戌이 지지에 있으면 jaego true", () => {
  // jaedaShinyakChart 년지가 戌 — 목의 재(CONTROLS[목]=토) 묘지는 戌.
  const enriched = enrichSajuData(jaedaShinyakChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, jaedaShinyakChart, "지출·빚 관리", 2026);
  assert.equal(facts.jaego, true);
});

// 비겁(비견/겁재) 2개 + 재성 1개(≤1) → 군겁쟁재.
// 천간(year乙=겁재, month甲=비견, day甲 제외, hour丙=식신) + 지지 丑 지장간에서 정재 1개만.
const gunggeobChart: SajuData = {
  year: { heavenlyStem: "乙", earthlyBranch: "丑", hiddenStems: ["己", "癸", "辛"] },
  month: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "丙", earthlyBranch: "子", hiddenStems: ["癸"] },
};

test("비겁 2개+ AND 재성 1개 이하 → gunggeobJaengjae true", () => {
  const enriched = enrichSajuData(gunggeobChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, gunggeobChart, "목돈 모으기", 2026);
  assert.equal(facts.jaeseong.length, 1, `재성 1개여야 함 (실측 ${facts.jaeseong.length}개)`);
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
    ["극왕", "태강", "신강", "중화신강"].includes(enriched.strength.result),
    `신강계열이어야 함 (실측 ${enriched.strength.result})`,
  );
  assert.equal(enriched.yongshin.eokbu, "화", `용신 억부가 화(식상)여야 함 (실측 ${enriched.yongshin.eokbu})`);
  const facts = deriveWealthFacts(enriched, null, yongshinSikssangChart, "투자로 불리기", 2026);
  assert.equal(facts.yongshinFavorsWealth, true);
});

test("fortune null이면 타이밍/대운 재성 구간 빈 배열", () => {
  const enriched = enrichSajuData(mixedChart, { isTimeUnknown: false });
  const facts = deriveWealthFacts(enriched, null, mixedChart, "목돈 모으기", 2026);
  assert.deepEqual(facts.timingWindows, []);
  assert.deepEqual(facts.daeunWealthYears, []);
});
