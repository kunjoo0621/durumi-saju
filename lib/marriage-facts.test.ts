import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveMarriageFacts } from "./marriage-facts";
import { enrichSajuData } from "./utils/saju";
import type { SajuData } from "./utils/saju";
import type { FortuneResult } from "./utils/saju-fortune";

// 일간 甲(목/양). 辛(금/음)=정관, 庚(금/양)=편관 → 관살혼잡. 여명.
const chart: SajuData = {
  year:  { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },       // 辛=정관
  month: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["庚","壬","戊"] }, // 庚=편관
  day:   { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },        // 일간 甲, 일지 子
  hour:  { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲","丙","戊"] },
};

test("여명: 정관+편관 존재 → 관성 배우자성 탐지 + 관살혼잡", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, chart, "female", "솔로", 2026);
  assert.equal(facts.spouseStarType, "관성");
  assert.equal(facts.spouseStarAbsent, false);
  assert.equal(facts.gwansalHonjap, true);
  assert.ok(facts.spouseStars.some((s) => s.star === "정관"));
  assert.ok(facts.spouseStars.some((s) => s.star === "편관"));
});

test("남명: 재성이 배우자성", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, chart, "male", "기혼", 2026);
  assert.equal(facts.spouseStarType, "재성");
});

test("일지 지장간 십성 산출", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, chart, "female", "솔로", 2026);
  // 일지 子 지장간 癸(수/음) vs 일간 甲(목/양) → 정인
  assert.ok(facts.spousePalaceHiddenStars.includes("정인"));
});

const fortune: FortuneResult = {
  daeun: {
    gender: "female", isForward: true, startAge: 5,
    startAgeDetail: { years: 5, months: 0, days: 0 }, daysToTerm: 0,
    pillars: [
      { index: 0, startAge: 25, endAge: 34, pillar: "辛酉", stem: "辛", branch: "酉", tenStar: "정관", twelveStage: "제왕" },
    ],
  },
  seun: [
    // 일간 甲, 일지 子. 丑=子와 육합(子丑合) → 세운합일지. 辛=정관 투출 → 배우자성투출.
    { year: 2027, age: 33, pillar: "辛丑", stem: "辛", branch: "丑", tenStar: "정관", twelveStage: "관대" },
  ],
};

test("타이밍: 세운 지지 일지합 + 배우자성 투출 → 트리거 2종", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, fortune, chart, "female", "솔로", 2026);
  const w = facts.timingWindows.find((x) => x.year === 2027);
  assert.ok(w, "2027 창이 있어야 함");
  assert.ok(w!.triggers.includes("세운합일지"));
  assert.ok(w!.triggers.includes("배우자성투출"));
  assert.equal(w!.isPast, false);
});

// 배우자궁(일지) 안정도 — 일지 子 기준 다른 지지를 바꿔가며 합/충 유무만 다르게 구성.
// 寅은 子와 6합·6충 어느 쪽에도 해당하지 않는 중립 지지(필러용).
const dayBranchChungChart: SajuData = {
  year:  { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
  month: { heavenlyStem: "庚", earthlyBranch: "午", hiddenStems: ["丁", "己"] }, // 子午沖
  day:   { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour:  { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

const dayBranchHapChart: SajuData = {
  year:  { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
  month: { heavenlyStem: "己", earthlyBranch: "丑", hiddenStems: ["己", "癸", "辛"] }, // 子丑合
  day:   { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour:  { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

const dayBranchNeutralChart: SajuData = {
  year:  { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
  month: { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
  day:   { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour:  { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

test("배우자궁 안정도: 일지 충 있으면 불안정", () => {
  const enriched = enrichSajuData(dayBranchChungChart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, dayBranchChungChart, "female", "솔로", 2026);
  assert.ok(facts.dayBranchChung.length > 0, "일지 충이 탐지돼야 함");
  assert.equal(facts.spousePalaceStability, "불안정");
});

test("배우자궁 안정도: 충 없이 일지 합 있으면 안정", () => {
  const enriched = enrichSajuData(dayBranchHapChart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, dayBranchHapChart, "female", "솔로", 2026);
  assert.equal(facts.dayBranchChung.length, 0);
  assert.ok(facts.dayBranchHap.length > 0, "일지 합이 탐지돼야 함");
  assert.equal(facts.spousePalaceStability, "안정");
});

test("배우자궁 안정도: 합도 충도 없으면 보통", () => {
  const enriched = enrichSajuData(dayBranchNeutralChart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, dayBranchNeutralChart, "female", "솔로", 2026);
  assert.equal(facts.dayBranchChung.length, 0);
  assert.equal(facts.dayBranchHap.length, 0);
  assert.equal(facts.spousePalaceStability, "보통");
});

// ── 배우자성 손상(비겁극재/상관견관/충거) ──────────────────────────────
// 실제 운영자 개인사주 메인 리포트가 "겁재 탈재/손재 구조"로 읽는 실사용자 차트
// (lib/wealth-facts.test.ts의 userChart와 동일 원국). 일간 癸(수/음).
// 월간 壬(수/양)=겁재(같은 오행, 다른 음양) 직접 투출 + 월지 午 정기 丁(화/음)=
// 편재(CONTROLS[수]=화, sameYY(음,음)=true → 편재, 남명 배우자성) — 겁재가
// 배우자성 지지 바로 위에 앉은 "개두" 형태.
const spouseKeukMaleChart: SajuData = {
  year: { heavenlyStem: "乙", earthlyBranch: "亥", hiddenStems: ["戊", "甲", "壬"] },
  month: { heavenlyStem: "壬", earthlyBranch: "午", hiddenStems: ["丙", "己", "丁"] },
  day: { heavenlyStem: "癸", earthlyBranch: "未", hiddenStems: ["丁", "乙", "己"] },
  hour: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["戊", "壬", "庚"] },
};

test("배우자성 손상(남명, 실사용자 차트): 월간 壬(겁재)이 월지 午 정기 丁(편재=배우자성) 위에 개두 → spouseStarDamaged true, 비겁극재", () => {
  const enriched = enrichSajuData(spouseKeukMaleChart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, spouseKeukMaleChart, "male", "기혼", 2026);
  assert.equal(facts.spouseStarType, "재성");
  assert.equal(facts.spouseStarDamaged, true);
  assert.ok(
    facts.spouseStarDamageReason.includes("비겁극재"),
    `실측 reason=${JSON.stringify(facts.spouseStarDamageReason)}`,
  );
  // 이 차트는 배우자궁(일지 未) 자체는 충이 없어 spousePalaceStability가 "안정"에 가까울 수
  // 있다(합충 없으면 "보통") — 배우자성 손상은 궁 안정도와 독립된 축임을 확인.
  assert.equal(facts.dayBranchChung.length, 0, "일지 충 없음(독립 판정 확인용)");
});

// 여명 상관견관: 일간 甲(목/양). CONTROLS-역(금)이 관성(배우자성) — 월간 丁(화/음)=상관
// (GENERATES[목]=화, sameYY(양,음)=false→상관) 직접 투출 + 월지 酉 정기 辛(금/음)=정관
// (CONTROLS[금]=목=dayMaster, sameYY(양,음)=false→정관, 여명 배우자성) — 상관이 배우자성
// 지지 바로 위에 앉은 개두 형태. 년지 丑·시지 寅은 충 관계를 만들지 않는 중립 필러.
const spouseKeukFemaleChart: SajuData = {
  year: { heavenlyStem: "己", earthlyBranch: "丑", hiddenStems: ["己", "癸", "辛"] },
  month: { heavenlyStem: "丁", earthlyBranch: "酉", hiddenStems: ["辛"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

test("배우자성 손상(여명): 월간 丁(상관)이 월지 酉 정기 辛(정관=배우자성) 위에 개두 → spouseStarDamaged true, 상관견관", () => {
  const enriched = enrichSajuData(spouseKeukFemaleChart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, spouseKeukFemaleChart, "female", "솔로", 2026);
  assert.equal(facts.spouseStarType, "관성");
  assert.equal(facts.spouseStarDamaged, true);
  assert.ok(
    facts.spouseStarDamageReason.includes("상관견관"),
    `실측 reason=${JSON.stringify(facts.spouseStarDamageReason)}`,
  );
});

// 충거 정밀화(1): 배우자성을 "정기로 담은" 지지가 충당하는 진짜 케이스만 인정.
// 일간 甲(목/양), 여명. 일지 酉(정기 辛=정관=배우자성)가 월지 卯와 卯酉沖 →
// 배우자성을 담은 일지 자체가 충당하므로 충거가 정당하게 발화해야 한다.
// 극(비겁/식상 공격자) 개두·인접은 구성상 없음(년간 己=정재, 월간 乙=겁재, 시간
// 戊=편재 — 여명 공격자 식상=식신/상관에 해당하는 천간이 전무) → 충거만 단독 발화.
const spouseChungeoOnlyChart: SajuData = {
  year: { heavenlyStem: "己", earthlyBranch: "子", hiddenStems: ["癸"] },
  month: { heavenlyStem: "乙", earthlyBranch: "卯", hiddenStems: ["乙"] },
  day: { heavenlyStem: "甲", earthlyBranch: "酉", hiddenStems: ["辛"] },
  hour: { heavenlyStem: "戊", earthlyBranch: "辰", hiddenStems: ["戊", "乙", "癸"] },
};

test("배우자성 손상: 배우자성을 담은 일지가 충당하면 충거 단독 발화(극 없음)", () => {
  const enriched = enrichSajuData(spouseChungeoOnlyChart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, spouseChungeoOnlyChart, "female", "솔로", 2026);
  assert.equal(facts.spouseStarAbsent, false, "일지 酉 지장간 辛=정관으로 배우자성 존재해야 함");
  assert.ok(facts.dayBranchChung.length > 0, "일지 卯酉沖이 잡혀야 함(궁 불안정도 동시 성립하는 정상 케이스)");
  assert.equal(facts.spouseStarDamaged, true);
  assert.deepEqual(facts.spouseStarDamageReason, ["충거"]);
});

// 충거 정밀화(2): bare 일지충 — 일지가 충당하지만 그 일지가 배우자성을 담고 있지 않은
// 경우는 이미 spousePalaceStability("불안정")가 표현하는 신호이므로 배우자성 손상에는
// 카운트하지 않는다(이중계상 방지가 이번 정밀화의 핵심). dayBranchChungChart(월지 午 vs
// 일지 子, 子午沖)는 일지 子의 정기가 정인(癸)이라 배우자성(관성)을 담지 않는다.
test("배우자성 손상: 배우자성을 담지 않은 bare 일지충은 카운트하지 않음(궁 불안정과 이중계상 방지)", () => {
  const enriched = enrichSajuData(dayBranchChungChart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, dayBranchChungChart, "female", "솔로", 2026);
  assert.ok(facts.dayBranchChung.length > 0, "일지 子午沖이 잡혀야 함(궁 불안정 성립 확인용)");
  assert.equal(facts.spousePalaceStability, "불안정", "궁 불안정 신호는 여전히 spousePalaceStability에 있어야 함");
  assert.equal(facts.spouseStarDamaged, false, "일지가 배우자성을 담지 않으므로 배우자성 손상은 아니어야 함");
  assert.deepEqual(facts.spouseStarDamageReason, []);
});

// 클린 네거티브: 배우자성(정관, 년간 辛)은 존재하되 극/충 어느 쪽도 없는 차트.
// 일간 甲(목/양). 배우자성을 담은 지지가 전무하도록(금 지지 酉·戌·申 회피) 구성 —
// 관성은 오직 년간 천간 투출로만 존재하고, 어떤 지지도 정기·중기로 관성을 담지 않아
// 극·충 판정축(지지 기반) 자체가 구조적으로 트리거되지 않는다.
const spouseCleanChart: SajuData = {
  year: { heavenlyStem: "辛", earthlyBranch: "卯", hiddenStems: ["乙"] },
  month: { heavenlyStem: "戊", earthlyBranch: "巳", hiddenStems: ["丙", "庚", "戊"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

test("배우자성 손상 클린 네거티브: 배우자성 존재하되 극/충 없으면 spouseStarDamaged false", () => {
  const enriched = enrichSajuData(spouseCleanChart, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(enriched, null, spouseCleanChart, "female", "솔로", 2026);
  assert.equal(facts.spouseStarAbsent, false, "정관(년간 辛) 투출로 배우자성은 존재해야 함");
  assert.equal(facts.spouseStarDamaged, false);
  assert.deepEqual(facts.spouseStarDamageReason, []);
});

test("무관/무재 폴백: 배우자성 없으면 대운 배우자성 구간 수집", () => {
  // 배우자성 없는 차트: 일간 甲, 배우자성(정/편관) 천간·지장간 전무하게 구성
  const noStar: SajuData = {
    year:  { heavenlyStem: "甲", earthlyBranch: "寅", hiddenStems: ["甲","丙","戊"] },
    month: { heavenlyStem: "丙", earthlyBranch: "午", hiddenStems: ["丁","己"] },
    day:   { heavenlyStem: "甲", earthlyBranch: "寅", hiddenStems: ["甲","丙","戊"] },
    hour:  { heavenlyStem: "戊", earthlyBranch: "辰", hiddenStems: ["戊","乙","癸"] },
  };
  const en = enrichSajuData(noStar, { isTimeUnknown: false });
  const facts = deriveMarriageFacts(en, fortune, noStar, "female", "솔로", 2026);
  assert.equal(facts.spouseStarAbsent, true);
  assert.ok(facts.daeunSpouseYears.length >= 1, "대운 정관(辛酉) 구간이 잡혀야 함");
});
