import { test } from "node:test";
import assert from "node:assert/strict";

import type { EnrichedSajuData, KoreanElement } from "@/lib/utils/saju-enrichment";

import { derivePairFacts } from "./pair-facts";

/** derivePairFacts 가 실제로 읽는 필드만 채운 최소 픽스처 */
function mk(opts: {
  stem: string;
  timeUnknown?: boolean;
  pillars?: { year: string; month: string; day: string; hour: string | null };
  dominant?: KoreanElement[];
  eokbu?: KoreanElement;
  gisin?: KoreanElement;
  dist?: Partial<Record<KoreanElement, number>>;
  shinsal?: string[];
}): EnrichedSajuData {
  return {
    dayMaster: { stem: opts.stem },
    isTimeUnknown: opts.timeUnknown ?? false,
    pillars: opts.pillars ?? {
      year: "甲子", month: "丙寅", day: "戊辰",
      hour: opts.timeUnknown ? null : "庚申",
    },
    elementAnalysis: { dominant: opts.dominant ?? [], deficient: [] },
    shinsal: {
      matches: (opts.shinsal ?? []).map((key) => ({ key, label: key, type: "neutral", evidence: [], detectedAt: [] })),
      labels: [], ruleset: {}, meta: {},
    },
    yongshin: { eokbu: opts.eokbu ?? "목", gisin: opts.gisin ?? "금" },
    elementDist: {
      목: opts.dist?.목 ?? 0, 화: opts.dist?.화 ?? 0, 토: opts.dist?.토 ?? 0,
      금: opts.dist?.금 ?? 0, 수: opts.dist?.수 ?? 0,
    },
  } as unknown as EnrichedSajuData;
}

const YEAR = { currentYear: 2026 };

// ★결정론 — battle-interaction.ts:161 이 new Date().getFullYear() 를 읽어서
// "같은 입력, 다른 결과"가 되는 문제를 pair 에서는 구조적으로 막는다.
// 연도는 반드시 인자로 들어오고 산출물에 그대로 박혀 저장된다.
test("currentYear 는 인자로 받아 산출물에 박힌다 (오늘 날짜를 읽지 않는다)", () => {
  const a = mk({ stem: "甲" });
  const b = mk({ stem: "己" });

  assert.equal(derivePairFacts(a, b, { currentYear: 2026 }).currentYear, 2026);
  assert.equal(derivePairFacts(a, b, { currentYear: 2027 }).currentYear, 2027);
});

// ★시주 미상 — 못 본 축을 "관계 없음"으로 처리하면 실제로 없는 것과 섞인다.
// 어느 축이 죽었는지 기록해 두어야 프롬프트가 단정하지 못한다.
test("양쪽 다 시간을 알면 죽은 축이 없다", () => {
  const f = derivePairFacts(mk({ stem: "甲" }), mk({ stem: "己" }), YEAR);

  assert.equal(f.reliability.aTimeUnknown, false);
  assert.equal(f.reliability.bTimeUnknown, false);
  assert.deepEqual(f.reliability.neutralizedAxes, []);
});

test("한쪽이라도 시간을 모르면 지지매트릭스·오행상보·용신상보 축이 중화 대상이 된다", () => {
  const aUnknown = derivePairFacts(
    mk({ stem: "甲", timeUnknown: true }), mk({ stem: "己" }), YEAR,
  );

  assert.equal(aUnknown.reliability.aTimeUnknown, true);
  assert.equal(aUnknown.reliability.bTimeUnknown, false);
  assert.deepEqual(
    [...aUnknown.reliability.neutralizedAxes].sort(),
    ["오행상보", "용신상보", "지지매트릭스"],
  );
});

// ★오행상보가 중화 대상인 이유 — calcElementCoverage(battle-interaction.ts:126)는
// va===0 으로 결핍을 판정한다. 시주 미상이면 6글자라 결핍이 구조적으로 더 뜨고,
// 상대가 "채워준다"는 가짜 양(+) 신호가 커진다. 못 본 축이 "관계 없음"이 아니라
// "상보 있음"으로 조작되는 방향이라 지지매트릭스보다 오히려 위험하다.
test("양쪽 다 시간을 모르면 죽은 축은 같고 플래그만 둘 다 선다", () => {
  const both = derivePairFacts(
    mk({ stem: "甲", timeUnknown: true }), mk({ stem: "己", timeUnknown: true }), YEAR,
  );

  assert.equal(both.reliability.aTimeUnknown, true);
  assert.equal(both.reliability.bTimeUnknown, true);
  assert.deepEqual(
    [...both.reliability.neutralizedAxes].sort(),
    ["오행상보", "용신상보", "지지매트릭스"],
  );
});

// 일간 관계는 시주와 무관하다 — 시간을 몰라도 일간은 확정되므로 중화 대상이 아니다.
test("일간 관계 축은 시주 미상에도 살아 있다", () => {
  const f = derivePairFacts(
    mk({ stem: "甲", timeUnknown: true }), mk({ stem: "己", timeUnknown: true }), YEAR,
  );

  assert.ok(!f.reliability.neutralizedAxes.includes("일간관계"));
  assert.equal(f.dayStemRelation.type, "합"); // 甲己합
});

// ★운영자 확정(§1-0) 강제 — 배틀의 summary 문자열에는 "A가 B의 용신(화)을 채워주지만…"
// 처럼 용신·기신 오행 라벨이 박혀 있다(battle-interaction.test.ts 로 확인함).
// PairFacts 가 그걸 실어 나르면 프롬프트로 새고, postprocess 가 뒤에서 지우는 술래잡기가 된다.
// 애초에 안 싣는다.
test("PairFacts 는 배틀의 프로즈(summary)를 싣지 않는다 — 구조 필드만", () => {
  const f = derivePairFacts(
    mk({ stem: "甲", dominant: ["화"], eokbu: "토", gisin: "금" }),
    mk({ stem: "丙", dominant: ["수"], eokbu: "화", gisin: "목" }),
    YEAR,
  );

  assert.ok(!("summary" in f.yongshinCompat), "yongshinCompat 에 summary 가 있으면 안 된다");
  assert.deepEqual(Object.keys(f.yongshinCompat).sort(), ["aHelpsB", "aHurtsB", "bHelpsA", "bHurtsA"]);

  // 산출물 전체 어디에도 용신·기신·희신 용어가 문자열로 들어가 있으면 안 된다.
  const dumped = JSON.stringify(f);
  for (const banned of ["용신", "기신", "희신"]) {
    assert.ok(!dumped.includes(banned), `산출물에 '${banned}' 이 새어 있다: ${dumped}`);
  }
});

// 결정론 잠금 — 연도를 주입하므로 이제 성립한다(오늘 날짜를 읽으면 성립하지 않는다).
test("같은 입력·같은 연도면 결과가 완전히 같다 (결정론)", () => {
  const a = mk({ stem: "甲", dominant: ["화"], dist: { 목: 3, 화: 2 } });
  const b = mk({ stem: "庚", dominant: ["수"], dist: { 토: 2, 금: 3, 수: 1 } });

  assert.deepEqual(
    derivePairFacts(a, b, YEAR),
    derivePairFacts(a, b, YEAR),
  );
});

/* ── 지지 4×4 전수 대조 ── */

// A: 甲子 丙寅 戊辰 庚申 (지지 子寅辰申)
// B: 己丑 辛未 壬戌 甲午 (지지 丑未戌午)
const A_PILLARS = { year: "甲子", month: "丙寅", day: "戊辰", hour: "庚申" };
const B_PILLARS = { year: "己丑", month: "辛未", day: "壬戌", hour: "甲午" };

function cell(f: ReturnType<typeof derivePairFacts>, posA: string, posB: string) {
  return f.branchMatrix.find((c) => c.posA === posA && c.posB === posB);
}

// ★배우자궁끼리 맞부딪히는 자리. 판정 레이어가 여기에 가장 큰 가중을 준다.
test("일지↔일지 칸이 궁위 정보와 함께 뽑힌다 (辰戌충)", () => {
  const f = derivePairFacts(
    mk({ stem: "戊", pillars: A_PILLARS }),
    mk({ stem: "壬", pillars: B_PILLARS }),
    YEAR,
  );

  const dayDay = cell(f, "day", "day");
  assert.ok(dayDay, "일지↔일지 칸이 없다");
  assert.equal(dayDay!.branchA, "辰");
  assert.equal(dayDay!.branchB, "戌");
  assert.deepEqual(dayDay!.relations, ["충"]);
});

// 궁위를 잃으면 년↔시 원진과 월↔월 원진이 같은 1로 뭉개진다.
test("칸마다 어느 기둥끼리인지 남는다 — 평탄 카운트로 뭉개지 않는다", () => {
  const f = derivePairFacts(
    mk({ stem: "戊", pillars: A_PILLARS }),
    mk({ stem: "壬", pillars: B_PILLARS }),
    YEAR,
  );

  // 子(A년) ↔ 丑(B년): 육합이면서 방합(亥子丑)
  const yearYear = cell(f, "year", "year");
  assert.deepEqual([...(yearYear?.relations ?? [])].sort(), ["방합", "육합"]);

  // 子(A년) ↔ 未(B월): 해이면서 원진
  const yearMonth = cell(f, "year", "month");
  assert.deepEqual([...(yearMonth?.relations ?? [])].sort(), ["원진", "해"]);

  // 寅(A월) ↔ 未(B월): 귀문
  assert.deepEqual(cell(f, "month", "month")?.relations, ["귀문"]);

  // 관계 없는 칸은 담지 않는다 (辰↔丑)
  assert.equal(cell(f, "day", "year"), undefined);
});

// ★시주 미상 — 못 본 칸을 "관계 없음"으로 남기면 실제로 관계가 없는 칸과 섞인다.
test("시주를 모르면 그 기둥이 붙은 칸은 아예 생성되지 않는다", () => {
  const f = derivePairFacts(
    mk({ stem: "戊", timeUnknown: true, pillars: { ...A_PILLARS, hour: null } }),
    mk({ stem: "壬", pillars: B_PILLARS }),
    YEAR,
  );

  // A 시주가 없으므로 A쪽이 시주인 칸은 하나도 없어야 한다
  assert.equal(
    f.branchMatrix.filter((c) => c.posA === "hour").length,
    0,
    "A 시주를 모르는데 A쪽 시주 칸이 생성됐다",
  );
  // 申(A시) ↔ 戌(B시)는 방합이지만 A 시주를 모르므로 없다
  assert.equal(cell(f, "hour", "hour"), undefined);

  // ★반대로 B 시지(午)는 멀쩡히 있으므로 A의 다른 자리와 맞대보는 건 정당한 비교다.
  //   한쪽이 모른다고 상대의 아는 정보까지 버리면 그건 과도한 절삭이다.
  //   子(A년) ↔ 午(B시) = 충
  const yearHour = cell(f, "year", "hour");
  assert.ok(yearHour, "B 시지는 알고 있으므로 이 칸은 있어야 한다");
  assert.deepEqual(yearHour!.relations, ["충"]);

  // 다만 이 축 전체의 신뢰도가 떨어졌다는 사실은 기록된다.
  assert.ok(f.reliability.neutralizedAxes.includes("지지매트릭스"));
});

/* ── 십성 교차 ── */

// ★1인 상품이 구조적으로 못 내는 값. "상대 일간이 나에게 무슨 별인가"는
// 상대 원국이 들어와야만 나온다. 그리고 방향에 따라 값이 다르다 —
// 대칭으로 만들면 이 축이 죽는다.
test("십성 교차는 양방향으로 각각 나오고 서로 다르다", () => {
  const f = derivePairFacts(mk({ stem: "甲" }), mk({ stem: "辛" }), YEAR);

  assert.equal(f.tenStarExchange.aSeesB, "정관"); // 甲(목양)이 본 辛(금음) — 금극목, 음양 다름
  assert.equal(f.tenStarExchange.bSeesA, "정재"); // 辛(금음)이 본 甲(목양) — 금극목, 음양 다름
  assert.notEqual(f.tenStarExchange.aSeesB, f.tenStarExchange.bSeesA);
});

test("십성 교차는 시주를 몰라도 나온다 (일간은 확정이므로)", () => {
  const f = derivePairFacts(
    mk({ stem: "甲", timeUnknown: true }), mk({ stem: "辛", timeUnknown: true }), YEAR,
  );
  assert.equal(f.tenStarExchange.aSeesB, "정관");
  assert.equal(f.tenStarExchange.bSeesA, "정재");
});

/* ── 배우자성 교차 ── */

// ★운영자 확정(§1-1): 동성/이성 분기를 만들지 않는다.
// 배우자성은 "각자 자기 성별로 자기 원국에서" 뽑는 값이고(여명=관성, 남명=재성),
// "상대가 그 자리에 걸리는가"의 대조는 상대 성별과 무관하게 그대로 성립한다.
// 아래 두 테스트가 그 사실을 증명한다 — 코드에 분기가 없어도 답이 달라진다.
test("이성 커플: 각자 자기 배우자성에 상대가 걸리면 양쪽 다 참", () => {
  const f = derivePairFacts(
    mk({ stem: "甲" }), mk({ stem: "辛" }),
    { ...YEAR, sexA: "female", sexB: "male" },
  );

  // 여명 甲의 배우자성은 관성. 상대 일간 辛 = 정관 → 걸린다.
  assert.equal(f.spouseStarCross.aHitByB, true);
  // 남명 辛의 배우자성은 재성. 상대 일간 甲 = 정재 → 걸린다.
  assert.equal(f.spouseStarCross.bHitByA, true);
});

test("동성 커플: 분기 없이 각자 자기 성별 기준으로 계산돼 결과가 갈린다", () => {
  const f = derivePairFacts(
    mk({ stem: "甲" }), mk({ stem: "辛" }),
    { ...YEAR, sexA: "female", sexB: "female" },
  );

  // A(여명)는 그대로 관성 → 상대 辛(정관)이 걸린다.
  assert.equal(f.spouseStarCross.aHitByB, true);
  // B도 여명이므로 배우자성이 관성인데, 상대 甲은 B에게 정재다 → 안 걸린다.
  assert.equal(f.spouseStarCross.bHitByA, false);
});

// 일간뿐 아니라 상대 일지의 정기(본기)로도 걸린다 — 사람으로 온 배우자성.
test("상대 일지의 정기가 내 배우자성이어도 걸린다", () => {
  // A: 甲 일간 여명(배우자성=관성=금). B 일지 酉 → 정기 辛(금) → 甲에게 정관.
  const f = derivePairFacts(
    mk({ stem: "甲", pillars: { year: "甲子", month: "丙寅", day: "戊辰", hour: "庚申" } }),
    mk({ stem: "丙", pillars: { year: "己丑", month: "辛未", day: "丙酉", hour: "甲午" } }),
    { ...YEAR, sexA: "female", sexB: "male" },
  );

  // 상대 일간 丙은 甲에게 식신이라 안 걸리지만, 상대 일지 酉의 정기 辛이 정관이라 걸린다.
  assert.equal(f.spouseStarCross.aHitByB, true);
});

/* ── 타이밍 교차 ── */

const win = (year: number, isPast = false) => ({ year, age: 30, triggers: [], isPast });

// ★"둘 다 열리는 해"는 1인 상품이 구조적으로 못 내는 값이다. 20알의 근거.
test("양쪽 타이밍의 교집합만 남긴다", () => {
  const f = derivePairFacts(mk({ stem: "甲" }), mk({ stem: "辛" }), {
    ...YEAR,
    timingA: [win(2027), win(2029), win(2031)],
    timingB: [win(2026), win(2029), win(2031)],
  });

  assert.deepEqual(f.fortuneCross.timingOverlapYears, [2029, 2031]);
});

// ★timingWindows 는 currentYear − 1 부터 담긴다(marriage-facts.ts:300).
// 단순 교집합이면 작년이 "둘 다 열리는 해"로 나간다 — 지나간 해를 앞으로의 기회처럼 판다.
test("이미 지나간 해(isPast)는 교집합에서 뺀다", () => {
  const f = derivePairFacts(mk({ stem: "甲" }), mk({ stem: "辛" }), {
    ...YEAR,
    timingA: [win(2025, true), win(2029)],
    timingB: [win(2025, true), win(2029)],
  });

  assert.deepEqual(f.fortuneCross.timingOverlapYears, [2029]);
});

test("겹치는 해가 없으면 빈 배열 — 없는 걸 있다고 만들지 않는다", () => {
  const f = derivePairFacts(mk({ stem: "甲" }), mk({ stem: "辛" }), {
    ...YEAR,
    timingA: [win(2027)],
    timingB: [win(2028)],
  });

  assert.deepEqual(f.fortuneCross.timingOverlapYears, []);
});

test("타이밍을 안 넘기면 빈 배열 (호출부가 아직 안 붙었을 때)", () => {
  const f = derivePairFacts(mk({ stem: "甲" }), mk({ stem: "辛" }), YEAR);
  assert.deepEqual(f.fortuneCross.timingOverlapYears, []);
});

/* ── 신살 교차 ── */

// 같은 신살이 양쪽에 다 있으면 그 결이 증폭되는 자리로 본다.
// 한쪽만 있는 것과 둘 다 있는 것은 해석이 다르므로 따로 잡는다.
test("도화·홍염이 양쪽에 다 있을 때만 참", () => {
  const both = derivePairFacts(
    mk({ stem: "甲", shinsal: ["dohwa", "hongryeom"] }),
    mk({ stem: "辛", shinsal: ["dohwa", "hongryeom"] }),
    YEAR,
  );
  assert.equal(both.shinsalCross.dohwaBoth, true);
  assert.equal(both.shinsalCross.hongryeomBoth, true);

  const onlyA = derivePairFacts(
    mk({ stem: "甲", shinsal: ["dohwa", "hongryeom"] }),
    mk({ stem: "辛", shinsal: [] }),
    YEAR,
  );
  assert.equal(onlyA.shinsalCross.dohwaBoth, false);
  assert.equal(onlyA.shinsalCross.hongryeomBoth, false);
});

// 천을귀인은 "한쪽만 있어도" 상대에게 작용하는 결로 본다 — 둘 다 조건이 아니다.
// 그래서 both 가 아니라 양쪽 보유 여부를 각각 남긴다.
test("천을귀인은 양쪽 보유 여부를 각각 남긴다 (한쪽만 있어도 의미가 있다)", () => {
  const f = derivePairFacts(
    mk({ stem: "甲", shinsal: ["chuneul"] }),
    mk({ stem: "辛", shinsal: [] }),
    YEAR,
  );
  assert.deepEqual(f.shinsalCross.chuneul, { a: true, b: false });
});

test("신살이 없으면 전부 거짓 — 없는 걸 있다고 만들지 않는다", () => {
  const f = derivePairFacts(mk({ stem: "甲" }), mk({ stem: "辛" }), YEAR);
  assert.deepEqual(f.shinsalCross, {
    dohwaBoth: false, hongryeomBoth: false, chuneul: { a: false, b: false },
  });
});

/* ── 전수 대칭 잠금 ── */

const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

/** A/B 를 뒤집었을 때 방향 필드가 서로 미러인지 확인한다. */
function assertMirrored(
  fwd: ReturnType<typeof derivePairFacts>,
  rev: ReturnType<typeof derivePairFacts>,
  label: string,
) {
  // 십성 교차
  assert.equal(fwd.tenStarExchange.aSeesB, rev.tenStarExchange.bSeesA, `${label} 십성 aSeesB`);
  assert.equal(fwd.tenStarExchange.bSeesA, rev.tenStarExchange.aSeesB, `${label} 십성 bSeesA`);

  // 배우자성 교차
  assert.equal(fwd.spouseStarCross.aHitByB, rev.spouseStarCross.bHitByA, `${label} 배우자성 a`);
  assert.equal(fwd.spouseStarCross.bHitByA, rev.spouseStarCross.aHitByB, `${label} 배우자성 b`);

  // 용신 상보
  assert.equal(fwd.yongshinCompat.aHelpsB, rev.yongshinCompat.bHelpsA, `${label} 용신 helps`);
  assert.equal(fwd.yongshinCompat.aHurtsB, rev.yongshinCompat.bHurtsA, `${label} 용신 hurts`);

  // 오행 상보
  assert.deepEqual(fwd.elementCoverage.deficientAlone.a, rev.elementCoverage.deficientAlone.b, `${label} 결핍`);
  assert.deepEqual(fwd.elementCoverage.coveredByOther.a, rev.elementCoverage.coveredByOther.b, `${label} 상보`);
  assert.equal(fwd.elementCoverage.percent, rev.elementCoverage.percent, `${label} percent`);

  // 신뢰도
  assert.equal(fwd.reliability.aTimeUnknown, rev.reliability.bTimeUnknown, `${label} 시주플래그`);

  // 지지 매트릭스 — 칸이 (posA,posB) → (posB,posA) 로 뒤집혀 같은 관계를 가져야 한다
  assert.equal(fwd.branchMatrix.length, rev.branchMatrix.length, `${label} 매트릭스 칸수`);
  for (const c of fwd.branchMatrix) {
    const mirror = rev.branchMatrix.find((x) => x.posA === c.posB && x.posB === c.posA);
    assert.ok(mirror, `${label} 미러 칸 없음 ${c.posA}/${c.posB}`);
    assert.equal(mirror!.branchA, c.branchB, `${label} 미러 지지A`);
    assert.equal(mirror!.branchB, c.branchA, `${label} 미러 지지B`);
    assert.deepEqual(mirror!.relations, c.relations, `${label} 미러 관계`);
  }
}

// ★잠금 테스트(TDD 드라이버 아님). 깨지면 "내가 A일 때와 상대가 A일 때 결과가
// 다른" 상품이 된다 — 같은 두 사람이 누가 먼저 입력했느냐로 판정이 갈린다.
test("지지 144 순서쌍 전수 — A/B 를 뒤집으면 방향 필드가 정확히 미러된다", () => {
  const opts = { ...YEAR, sexA: "female" as const, sexB: "male" as const };
  let checked = 0;

  for (const ba of BRANCHES) {
    for (const bb of BRANCHES) {
      const a = mk({ stem: "甲", dominant: ["화"], eokbu: "수", gisin: "토",
        dist: { 목: 2, 화: 3 },
        pillars: { year: "甲子", month: "丙寅", day: `戊${ba}`, hour: "庚申" } });
      const b = mk({ stem: "辛", dominant: ["수"], eokbu: "화", gisin: "목",
        dist: { 토: 1, 금: 2, 수: 3 },
        pillars: { year: "己丑", month: "辛未", day: `壬${bb}`, hour: "甲午" } });

      assertMirrored(
        derivePairFacts(a, b, opts),
        derivePairFacts(b, a, { ...opts, sexA: "male", sexB: "female" }),
        `${ba}${bb}`,
      );
      checked++;
    }
  }
  assert.equal(checked, 144, "12×12 순서쌍 전수를 봐야 한다");
});

test("천간 100 순서쌍 전수 — 십성 교차가 정확히 미러된다", () => {
  let checked = 0;
  for (const sa of STEMS) {
    for (const sb of STEMS) {
      const fwd = derivePairFacts(mk({ stem: sa }), mk({ stem: sb }), YEAR);
      const rev = derivePairFacts(mk({ stem: sb }), mk({ stem: sa }), YEAR);
      assert.equal(fwd.tenStarExchange.aSeesB, rev.tenStarExchange.bSeesA, `${sa}${sb}`);
      assert.equal(fwd.tenStarExchange.bSeesA, rev.tenStarExchange.aSeesB, `${sa}${sb}`);
      checked++;
    }
  }
  assert.equal(checked, 100);
});

// ★"못 본 것"을 "없는 것"으로 만들지 않는다 — 이 파일이 시주 미상에서 지킨 원칙을
// 성별에도 똑같이 적용한다. 성별을 안 받았으면 "안 걸림(false)"이 아니라 null 이다.
// false 로 두면 호출부가 "짝 자리에 안 걸리는 사람"으로 오독한다.
test("성별을 안 넘기면 배우자성 교차는 false 가 아니라 null", () => {
  const f = derivePairFacts(mk({ stem: "甲" }), mk({ stem: "辛" }), YEAR);
  assert.equal(f.spouseStarCross.aHitByB, null);
  assert.equal(f.spouseStarCross.bHitByA, null);

  // 한쪽만 넘긴 경우도 각각 독립적으로 판정된다
  const half = derivePairFacts(mk({ stem: "甲" }), mk({ stem: "辛" }), { ...YEAR, sexA: "female" });
  assert.equal(half.spouseStarCross.aHitByB, true);
  assert.equal(half.spouseStarCross.bHitByA, null);
});
