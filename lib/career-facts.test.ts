import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveCareerFacts } from "./career-facts";
import type { SajuData } from "./utils/saju";
import type { FortuneResult } from "./utils/saju-fortune";
import type { EnrichedSajuData, KoreanElement } from "./utils/saju-enrichment";

// career-facts는 saju/saju-fortune을 타입으로만 참조하고 런타임 계산은 saju-enrichment(순수)만
// 쓴다. 유닛 격리를 위해 enriched는 career-facts가 실제로 읽는 3필드만 스텁으로 주입한다
// (dayMaster.element / strength.result / yongshin.eokbu). 신강/신약을 직접 통제해 grip 로직을
// 결정론으로 검증 — 실제 enrichSajuData 강약 산출과의 end-to-end 대조는 별도 스크립트(완료기준4).
function stubEnriched(
  strengthResult: string,
  opts?: { element?: KoreanElement; eokbu?: KoreanElement },
): EnrichedSajuData {
  return {
    dayMaster: { element: opts?.element ?? "목", yin_yang: "양" },
    strength: { result: strengthResult },
    yongshin: { eokbu: opts?.eokbu ?? "수" },
  } as unknown as EnrichedSajuData;
}

// 일간 기준(모든 fixture 甲=목/양):
//   관성(官)=금 — 庚(편관)/辛(정관)   인성(印)=수 — 壬(편인)/癸(정인)
//   식상(食傷)=화 — 丙(식신)/丁(상관)  재성=토 — 戊(편재)/己(정재)  비겁=목 — 甲(비견)/乙(겁재)

// ── F1: 정관우세 + 관인상생 (신강 주입) ──
// 辛(정관) 천간 투출 + 酉(정기 辛) → 관성 weighted 5(단일 투출+α, MEANINGFUL 4 통과).
// 편관(庚) 전무. 인성(癸 투출3 + 子 정기 癸 2 = 5)도 유의미 → 관인상생 성립.
const jeonggwanChart: SajuData = {
  year: { heavenlyStem: "癸", earthlyBranch: "卯", hiddenStems: ["乙"] },
  month: { heavenlyStem: "甲", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },
};

test("정관 투출·편관 전무 → gwanseongType 정관우세, gwanseongAbsent false", () => {
  const facts = deriveCareerFacts(stubEnriched("신강"), null, jeonggwanChart, "현직 성장", 2026);
  assert.equal(facts.gwanseongType, "정관우세");
  assert.equal(facts.gwanseongAbsent, false);
  assert.ok(facts.gwanseong.some((h) => h.star === "정관"));
  assert.ok(!facts.gwanseong.some((h) => h.star === "편관"));
});

test("정관 + 인성 둘 다 유의미 → gwaninSangsaeng true", () => {
  const facts = deriveCareerFacts(stubEnriched("신강"), null, jeonggwanChart, "현직 성장", 2026);
  assert.equal(facts.gwaninSangsaeng, true);
});

// ── F2: 편관우세 + 신약 → 관다신약 ──
const chilsalChart: SajuData = {
  year: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
  month: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "戊", earthlyBranch: "辰", hiddenStems: ["戊", "乙", "癸"] },
};

test("편관 과다 + 신약 → gwanseongType 편관우세, careerGrip 관다신약, gwandaSinyak true", () => {
  const facts = deriveCareerFacts(stubEnriched("신약"), null, chilsalChart, "이직 고민", 2026);
  assert.equal(facts.gwanseongType, "편관우세");
  assert.ok(facts.gwanseongStrength >= 8, `편관 weighted 강도 (${facts.gwanseongStrength})`);
  assert.equal(facts.careerGrip, "관다신약");
  assert.equal(facts.gwandaSinyak, true);
});

test("동일 편관 과다 차트라도 신강이면 신왕관왕 (강약 통제로 grip 분기 확인)", () => {
  const facts = deriveCareerFacts(stubEnriched("신강"), null, chilsalChart, "현직 성장", 2026);
  assert.equal(facts.careerGrip, "신왕관왕");
  assert.equal(facts.gwandaSinyak, false);
});

// ── F3: 관살혼잡 (정관 辛 + 편관 庚) ──
const gwansalHonjapChart: SajuData = {
  year: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
  month: { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
};

test("정관+편관 둘 다 유력(투간/정기) → gwanseongType 관살혼잡", () => {
  const facts = deriveCareerFacts(stubEnriched("신약"), null, gwansalHonjapChart, "진로 탐색", 2026);
  assert.equal(facts.gwanseongType, "관살혼잡");
});

// ★관살혼잡 유력 기준(2026-07-21): 운영자 실사주 — 편관(己) 유력(未 정기·午 중기) + 정관(戊)은
// 申 여기(가장 약)로만 존재. 전통 명리상 정관이 여기뿐이면 관살혼잡 아님 → 편관우세여야 한다.
const operatorChart: SajuData = {
  year: { heavenlyStem: "乙", earthlyBranch: "亥", hiddenStems: ["壬", "甲"] },
  month: { heavenlyStem: "壬", earthlyBranch: "午", hiddenStems: ["丁", "己"] },
  day: { heavenlyStem: "癸", earthlyBranch: "未", hiddenStems: ["己", "丁", "乙"] },
  hour: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
};

test("정관이 여기(餘氣)로만 있으면 관살혼잡 아님 → 편관우세 (운영자 실사주)", () => {
  const facts = deriveCareerFacts(
    stubEnriched("중화신강", { element: "수", eokbu: "토" }),
    null,
    operatorChart,
    "이직 고민",
    2026,
  );
  assert.notEqual(facts.gwanseongType, "관살혼잡", "정관이 여기뿐인데 관살혼잡으로 잡힘");
  assert.equal(facts.gwanseongType, "편관우세");
  // 관성 목록·무관 판정은 여전히 '존재' 기준(정관 戊 여기도 궁위엔 잡힘)
  assert.equal(facts.gwanseongAbsent, false);
});

// ── F4: 무관 (金 전무) ──
const mugwanChart: SajuData = {
  year: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  month: { heavenlyStem: "乙", earthlyBranch: "卯", hiddenStems: ["乙"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

test("관성 전무 → 무관, gwanseongAbsent true, gwanseongStrength 0, 상관견관 false", () => {
  const facts = deriveCareerFacts(stubEnriched("신강"), null, mugwanChart, "독립·사업", 2026);
  assert.equal(facts.gwanseongType, "무관");
  assert.equal(facts.gwanseongAbsent, true);
  assert.equal(facts.gwanseongStrength, 0);
  assert.equal(facts.sanggwanGyeongwan, false);
});

// ── F5: 상관견관 위치극 양성 ──
// 월간 丁(상관)이 인접한 년지 申(정기 庚=편관) 위 — 개두/인접 극 → true.
const sanggwanGyeongwanChart: SajuData = {
  year: { heavenlyStem: "甲", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
  month: { heavenlyStem: "丁", earthlyBranch: "卯", hiddenStems: ["乙"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
};

// ★2026-07-28 명리 교정: 이 차트의 타깃 申(庚 정기)은 甲 일간 기준 **편관**이다.
// 상관이 편관을 만나는 건 상관견관(위화백단)이 아니라 **제살(制殺)** — 칠살을 다스리는
// 능력으로 길하게 보는 게 통설이다. 기존 코드는 공격자 쪽에서 "식신은 식신제살이라 제외"를
// 정확히 판단해놓고 타깃 쪽에서 같은 구분을 하지 않아, 압박을 생산적으로 다루는 구조에
// 반골·구설 서사를 붙이고 있었다. 이 테스트는 그 옛 동작을 박제하고 있었으므로 뒤집는다.
test("상관(월간 丁)이 편관 지지(년지 申, 庚 정기)를 극 → sanggwanGyeongwan false (제살)", () => {
  const facts = deriveCareerFacts(stubEnriched("신강"), null, sanggwanGyeongwanChart, "현직 성장", 2026);
  assert.equal(facts.gwanseongAbsent, false, "관성(庚)이 있어야 의미 있음");
  assert.equal(facts.sanggwanGyeongwan, false, "상관+편관은 제살이라 견관이 아니다");
});

// 진짜 상관견관 — 타깃이 정관(酉의 辛 정기 = 甲 일간 기준 정관)일 때만 성립.
const sanggwanJeonggwanChart: SajuData = {
  year: { heavenlyStem: "甲", earthlyBranch: "酉", hiddenStems: ["辛"] },
  month: { heavenlyStem: "丁", earthlyBranch: "卯", hiddenStems: ["乙"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
};

test("상관(월간 丁)이 인접 지지(년지 酉)의 정관(辛 정기)을 극 → sanggwanGyeongwan true", () => {
  const facts = deriveCareerFacts(stubEnriched("신강"), null, sanggwanJeonggwanChart, "현직 성장", 2026);
  assert.equal(facts.gwanseongAbsent, false, "관성(辛)이 있어야 의미 있음");
  assert.equal(facts.sanggwanGyeongwan, true);
});

// ── F6: 상관 존재하되 비인접 (음성) ──
const sanggwanFarChart: SajuData = {
  year: { heavenlyStem: "甲", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
  month: { heavenlyStem: "甲", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "丁", earthlyBranch: "卯", hiddenStems: ["乙"] },
};

test("상관(시간 丁)과 관성(년지 申)이 비인접 → sanggwanGyeongwan false", () => {
  const facts = deriveCareerFacts(stubEnriched("신강"), null, sanggwanFarChart, "현직 성장", 2026);
  assert.equal(facts.gwanseongAbsent, false);
  assert.equal(facts.sanggwanGyeongwan, false);
});

// ── 식신은 상관견관 공격자가 아니다 (식신제살) ──
const siksinNotAttackerChart: SajuData = {
  year: { heavenlyStem: "丙", earthlyBranch: "子", hiddenStems: ["癸"] },
  month: { heavenlyStem: "甲", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
};

test("식신(년간 丙)은 관성 공격자 아님 → sanggwanGyeongwan false (식신제살)", () => {
  const facts = deriveCareerFacts(stubEnriched("신강"), null, siksinNotAttackerChart, "현직 성장", 2026);
  assert.equal(facts.sanggwanGyeongwan, false);
});

test("식신 투출 → siksangType 식신우세, siksinStrength>0", () => {
  const facts = deriveCareerFacts(stubEnriched("신강"), null, siksinNotAttackerChart, "독립·사업", 2026);
  assert.equal(facts.siksangType, "식신우세");
  assert.ok(facts.siksinStrength > 0);
});

// ── 용신이 관성/인성 오행이면 yongshinFavorsCareer true ──
test("억부용신이 인성 오행(수)이면 yongshinFavorsCareer true", () => {
  const facts = deriveCareerFacts(
    stubEnriched("신약", { element: "목", eokbu: "수" }),
    null,
    chilsalChart,
    "현직 성장",
    2026,
  );
  assert.equal(facts.yongshinFavorsCareer, true);
});

test("억부용신이 관성 오행(금)이면 yongshinFavorsCareer true", () => {
  const facts = deriveCareerFacts(
    stubEnriched("신약", { element: "목", eokbu: "금" }),
    null,
    chilsalChart,
    "현직 성장",
    2026,
  );
  assert.equal(facts.yongshinFavorsCareer, true);
});

// ── 타이밍: 관성투출/인성투출/식상투출 + 대운 관성 ──
test("타이밍: 세운 관성/인성/식상 → 트리거 매칭, 대운 관성 구간", () => {
  const fortune: FortuneResult = {
    daeun: {
      gender: "male",
      isForward: true,
      startAge: 3,
      startAgeDetail: { years: 3, months: 0, days: 0 },
      daysToTerm: 0,
      pillars: [
        { index: 0, startAge: 23, endAge: 32, pillar: "辛酉", stem: "辛", branch: "酉", tenStar: "정관", twelveStage: "제왕" },
        { index: 1, startAge: 33, endAge: 42, pillar: "丙寅", stem: "丙", branch: "寅", tenStar: "식신", twelveStage: "건록" },
      ],
    },
    seun: [
      { year: 2027, age: 33, pillar: "辛酉", stem: "辛", branch: "酉", tenStar: "정관", twelveStage: "제왕" },
      { year: 2028, age: 34, pillar: "癸亥", stem: "癸", branch: "亥", tenStar: "정인", twelveStage: "목욕" },
      { year: 2029, age: 35, pillar: "丙寅", stem: "丙", branch: "寅", tenStar: "식신", twelveStage: "건록" },
    ],
  };
  const facts = deriveCareerFacts(stubEnriched("신강"), fortune, jeonggwanChart, "현직 성장", 2026);

  const w2027 = facts.timingWindows.find((w) => w.year === 2027);
  assert.ok(w2027 && w2027.triggers.includes("관성투출"));
  assert.equal(w2027!.isPast, false);

  const w2028 = facts.timingWindows.find((w) => w.year === 2028);
  assert.ok(w2028 && w2028.triggers.includes("인성투출"));

  const w2029 = facts.timingWindows.find((w) => w.year === 2029);
  assert.ok(w2029 && w2029.triggers.includes("식상투출"));

  assert.equal(facts.daeunCareerYears.length, 1);
  assert.equal(facts.daeunCareerYears[0].star, "정관");
  assert.equal(facts.daeunCareerYears[0].startAge, 23);
});

test("fortune null이면 타이밍/대운 빈 배열", () => {
  const facts = deriveCareerFacts(stubEnriched("신강"), null, jeonggwanChart, "현직 성장", 2026);
  assert.deepEqual(facts.timingWindows, []);
  assert.deepEqual(facts.daeunCareerYears, []);
});

// ── 불변식: gwandaSinyak ↔ careerGrip ──
test("불변식: gwandaSinyak은 careerGrip 관다신약에서만 파생", () => {
  const cases: Array<[SajuData, string]> = [
    [jeonggwanChart, "신강"],
    [chilsalChart, "신약"],
    [gwansalHonjapChart, "신약"],
    [mugwanChart, "신강"],
  ];
  for (const [chart, strength] of cases) {
    const facts = deriveCareerFacts(stubEnriched(strength), null, chart, "현직 성장", 2026);
    assert.equal(facts.gwandaSinyak, facts.careerGrip === "관다신약");
  }
});
