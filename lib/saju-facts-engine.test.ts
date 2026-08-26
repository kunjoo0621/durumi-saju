// 명리 사실 대조 ① — 엔진 내부 사본끼리 대조 (2026-08-03 신설)
//
// 배경: docs/SAJU_FACT_INTEGRITY_PLAN.md §2-1 / §6-1.
//   같은 명리 표가 리포 안에 여러 벌 존재하는데(엔진만 해도 2벌) 대조 장치가 0개였다.
//   12신살 년주 기준 버그가 6개월간 라이브로 나간 것도, 巳 지장간 순서가 두 테이블에서
//   갈린 것도 "어긋나면 알려 주는 장치"가 없었기 때문이다.
//
// 정본(SSOT) 선언: `lib/utils/saju-enrichment.ts`.
//   (계획서 §5 "안 A' = 엔진 정본 + 대조 테스트 계약". 데이터 이관 0, 리팩토링 0.)
//   `lib/utils/saju.ts`는 같은 사실의 사본이며, 이 파일이 둘의 일치를 계약으로 강제한다.
//
// 실행: NODE_OPTIONS='--conditions=import' npx tsx --test lib/saju-facts-engine.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  STEM_ELEMENT,
  BRANCH_INFO,
  GENERATES,
  CONTROLS,
  getTenStar,
  type KoreanElement,
} from "./utils/saju-enrichment";
import {
  getHeavenlyStemElement,
  getEarthlyBranchElement,
  getStemPolarity,
  getBranchPolarity,
  getStemLabel,
  getBranchLabel,
  getElementName,
  getHiddenStems,
  getMainHiddenStem,
  getTenGod,
  type ElementType,
} from "./utils/saju";

// ─────────────────────────────────────────────────────────────
// known-drift 허용 목록
// ─────────────────────────────────────────────────────────────
// 도입 시점에 이미 어긋나 있던 항목만 여기에 명시한다. 목록에 없는 드리프트는 실패한다.
// ★목록에 있는데 실제로는 일치하는 항목도 실패한다(= 해소됐으면 목록에서 지워라).
//   유예 목록이 방치돼 썩는 걸 막는 장치다.
// ★2026-08-26: "weight-sum:寅" 해소. 교정값을 甲5·丙3·戊2 로 확정하고
//   enrichment 정본과 dict gabja 5편(甲寅·丙寅·戊寅·庚寅·壬寅)을 동시에 고쳤다.
//   근거는 이 목록이 스스로 적어 둔 그대로다 — repo 관행상 3원소 지지는 5/3/2이고
//   (巳 丙5·庚3·戊2 / 申 庚5·壬3·戊2), 寅만 2원소 지지의 앞자리 7(亥 壬7·甲3 /
//   午 丁7·己3)을 3원소에 쓰고 있었다. 사령일수 순서(정기 甲 > 중기 丙 > 여기 戊)도 유지된다.
const KNOWN_DRIFT: Record<string, string> = {};

function driftAwareEqual(key: string, actual: unknown, expected: unknown, message: string) {
  let same = true;
  try {
    assert.deepEqual(actual, expected);
  } catch {
    same = false;
  }
  const excused = Object.prototype.hasOwnProperty.call(KNOWN_DRIFT, key);
  if (same) {
    assert.ok(
      !excused,
      `known-drift 항목 "${key}"가 해소됐다. KNOWN_DRIFT에서 삭제하라 (사유: ${KNOWN_DRIFT[key]})`,
    );
    return;
  }
  assert.ok(
    excused,
    `${message}\n  actual=${JSON.stringify(actual)}\n  expected=${JSON.stringify(expected)}`,
  );
}

const STEMS = Object.keys(STEM_ELEMENT);
const BRANCHES = Object.keys(BRANCH_INFO);

// saju.ts의 ElementType("wood") ↔ enrichment의 KoreanElement("목") 다리.
// 다리 자체도 saju.ts의 공개 함수로만 만든다(테스트가 제3의 사본을 들지 않게).
function korean(el: ElementType | null): KoreanElement | null {
  return el ? (getElementName(el) as KoreanElement) : null;
}

// ─────────────────────────────────────────────────────────────
// 1. 천간 10자 — 오행·음양·한글 (saju.ts ↔ saju-enrichment.ts)
// ─────────────────────────────────────────────────────────────
test("천간 10자: 오행이 두 테이블에서 같다", () => {
  assert.equal(STEMS.length, 10, "STEM_ELEMENT가 10천간을 다 갖고 있어야 한다");
  for (const stem of STEMS) {
    assert.equal(
      korean(getHeavenlyStemElement(stem)),
      STEM_ELEMENT[stem].element,
      `천간 ${stem} 오행 불일치`,
    );
  }
});

test("천간 10자: 음양이 두 테이블에서 같다", () => {
  for (const stem of STEMS) {
    const polarity = getStemPolarity(stem);
    const expected = STEM_ELEMENT[stem].yin_yang === "양" ? "yang" : "yin";
    assert.equal(polarity, expected, `천간 ${stem} 음양 불일치`);
  }
});

test("천간 10자: 한글 표기가 두 테이블에서 같다", () => {
  for (const stem of STEMS) {
    // getStemLabel = "갑甲" 형태
    assert.equal(
      getStemLabel(stem),
      `${STEM_ELEMENT[stem].korean}${stem}`,
      `천간 ${stem} 한글 표기 불일치`,
    );
  }
});

// ─────────────────────────────────────────────────────────────
// 2. 지지 12자 — 오행·음양·한글
// ─────────────────────────────────────────────────────────────
test("지지 12자: 오행이 두 테이블에서 같다", () => {
  assert.equal(BRANCHES.length, 12, "BRANCH_INFO가 12지지를 다 갖고 있어야 한다");
  for (const branch of BRANCHES) {
    assert.equal(
      korean(getEarthlyBranchElement(branch)),
      BRANCH_INFO[branch].element,
      `지지 ${branch} 오행 불일치`,
    );
  }
});

test("지지 12자: 음양이 두 테이블에서 같다", () => {
  for (const branch of BRANCHES) {
    const polarity = getBranchPolarity(branch);
    const expected = BRANCH_INFO[branch].yin_yang === "양" ? "yang" : "yin";
    assert.equal(polarity, expected, `지지 ${branch} 음양 불일치`);
  }
});

test("지지 12자: 한글 표기가 두 테이블에서 같다", () => {
  for (const branch of BRANCHES) {
    assert.equal(
      getBranchLabel(branch),
      `${BRANCH_INFO[branch].korean}${branch}`,
      `지지 ${branch} 한글 표기 불일치`,
    );
  }
});

// ─────────────────────────────────────────────────────────────
// 3. 지장간 — 구성과 **순서**까지 (12지지 전수)
// ─────────────────────────────────────────────────────────────
// 순서를 포함해 비교하는 이유: BRANCH_INFO.jijanggan의 인덱스 0/1/2가 본기/중기/여기이고,
// career·wealth·marriage-facts가 이 인덱스로 가중치를 매긴다. 순서가 갈리면 같은 지장간이
// 제품마다 다른 무게를 받는다(실제로 巳에서 그런 일이 있었다 — marriage-facts.ts:179 주석).
test("지장간: 12지지 전부 구성과 순서가 두 테이블에서 같다", () => {
  for (const branch of BRANCHES) {
    driftAwareEqual(
      `jijanggan:${branch}`,
      getHiddenStems(branch),
      BRANCH_INFO[branch].jijanggan.map((j) => j.stem),
      `지지 ${branch} 지장간이 saju.ts와 saju-enrichment.ts에서 다르다`,
    );
  }
});

test("지장간: 본기(첫 원소)가 두 테이블에서 같다", () => {
  for (const branch of BRANCHES) {
    assert.equal(
      getMainHiddenStem(branch),
      BRANCH_INFO[branch].jijanggan[0].stem,
      `지지 ${branch} 본기 불일치`,
    );
  }
});

test("지장간: 원소 개수는 1~3개이고 중복이 없다", () => {
  for (const branch of BRANCHES) {
    const stems = BRANCH_INFO[branch].jijanggan.map((j) => j.stem);
    assert.ok(stems.length >= 1 && stems.length <= 3, `지지 ${branch} 지장간 개수 ${stems.length}`);
    assert.equal(new Set(stems).size, stems.length, `지지 ${branch} 지장간에 중복 원소`);
    for (const s of stems) {
      assert.ok(STEM_ELEMENT[s], `지지 ${branch} 지장간 ${s}가 천간이 아니다`);
    }
  }
});

test("지장간: weight 합이 12지지 모두 10이다", () => {
  for (const branch of BRANCHES) {
    const sum = BRANCH_INFO[branch].jijanggan.reduce((acc, j) => acc + j.weight, 0);
    driftAwareEqual(
      `weight-sum:${branch}`,
      sum,
      10,
      `지지 ${branch} 지장간 weight 합이 10이 아니다`,
    );
  }
});

test("지장간: weight가 본기→여기 순으로 비증가한다", () => {
  for (const branch of BRANCHES) {
    const weights = BRANCH_INFO[branch].jijanggan.map((j) => j.weight);
    for (let i = 1; i < weights.length; i++) {
      assert.ok(
        weights[i - 1] >= weights[i],
        `지지 ${branch} weight 역전: ${JSON.stringify(weights)} (index 0=본기여야 함)`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────
// 4. 상생·상극 — saju.ts는 테이블을 감추고 있어 getTenGod로 역산해 대조
// ─────────────────────────────────────────────────────────────
// saju.ts의 ELEMENT_GENERATES / ELEMENT_CONTROLS는 export되지 않는다.
// 대신 getTenGod의 판정 규칙(식신/상관 = 일간이 생하는 것, 편재/정재 = 일간이 극하는 것)을
// 이용해 사본 테이블을 역산한다. 역산이 불가능하면(= 어느 천간도 해당 십성이 아니면) 실패시킨다.
function derivedFromTenGod(kind: "generates" | "controls"): Record<KoreanElement, KoreanElement> {
  const want = kind === "generates" ? ["식신", "상관"] : ["편재", "정재"];
  const out = {} as Record<KoreanElement, KoreanElement>;
  for (const dayStem of STEMS) {
    const dayEl = STEM_ELEMENT[dayStem].element;
    const hits = new Set<KoreanElement>();
    for (const target of STEMS) {
      const tenGod = getTenGod(dayStem, target);
      assert.ok(tenGod, `getTenGod(${dayStem}, ${target})가 null — 사본 테이블에 구멍이 있다`);
      if (want.includes(tenGod)) hits.add(STEM_ELEMENT[target].element);
    }
    assert.equal(
      hits.size,
      1,
      `일간 ${dayStem}의 ${kind} 오행이 ${hits.size}개로 역산됐다(1개여야 함): ${[...hits]}`,
    );
    const [only] = [...hits];
    if (out[dayEl]) assert.equal(out[dayEl], only, `오행 ${dayEl}의 ${kind}가 천간마다 다르다`);
    out[dayEl] = only;
  }
  return out;
}

test("상생(生) 사이클 5쌍이 두 테이블에서 같다", () => {
  const fromSaju = derivedFromTenGod("generates");
  assert.equal(Object.keys(fromSaju).length, 5, "5오행 전부 역산돼야 한다");
  assert.deepEqual(fromSaju, { ...GENERATES }, "saju.ts ELEMENT_GENERATES ↔ enrichment GENERATES 불일치");
});

test("상극(剋) 사이클 5쌍이 두 테이블에서 같다", () => {
  const fromSaju = derivedFromTenGod("controls");
  assert.equal(Object.keys(fromSaju).length, 5, "5오행 전부 역산돼야 한다");
  assert.deepEqual(fromSaju, { ...CONTROLS }, "saju.ts ELEMENT_CONTROLS ↔ enrichment CONTROLS 불일치");
});

// ─────────────────────────────────────────────────────────────
// 5. 십성 판정 — 두 구현(getTenGod / getTenStar) 전수 대조 10×10
// ─────────────────────────────────────────────────────────────
test("십성 판정: 천간 100쌍 전부 두 구현이 같은 답을 낸다", () => {
  let checked = 0;
  for (const dayStem of STEMS) {
    const day = STEM_ELEMENT[dayStem];
    for (const target of STEMS) {
      const t = STEM_ELEMENT[target];
      const fromSaju = getTenGod(dayStem, target);
      // getTenStar는 "비견(比肩)" 형태 — 한자 괄호를 떼고 비교
      const fromEnrich = getTenStar(day.element, day.yin_yang, t.element, t.yin_yang).replace(
        /\(.*\)$/,
        "",
      );
      assert.notEqual(fromEnrich, "알수없음", `getTenStar(${dayStem}, ${target}) 판정 실패`);
      assert.equal(fromSaju, fromEnrich, `십성 불일치: 일간 ${dayStem} · 대상 ${target}`);
      checked++;
    }
  }
  assert.equal(checked, 100, "10×10 전수를 돌아야 한다");
});

// ─────────────────────────────────────────────────────────────
// 6. 천간합·천간충 — battle-interaction.ts ↔ yearly-interaction.ts
// ─────────────────────────────────────────────────────────────
// 두 모듈 다 상수를 export하지 않고 각자 리터럴로 들고 있다
// (yearly-interaction.ts:12 주석이 "동일한 표준 매핑 재정의"라고 스스로 밝힌다).
// 런타임으로 꺼낼 방법이 없으므로 소스를 파싱해 대조한다.
// ★파싱 실패는 "일치"가 아니라 **실패**로 처리한다 — 검사기가 조용히 무력화되는 걸 막는다.
function readLib(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

function parseStemPairs(source: string, file: string, constName: string): [string, string][] {
  const block = new RegExp(`const\\s+${constName}\\b[^=]*=\\s*\\[([\\s\\S]*?)\\];`).exec(source);
  assert.ok(block, `${file}에서 ${constName} 선언을 못 찾았다 — 파싱 실패는 통과가 아니다`);
  const pairs = [...block![1].matchAll(/\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g)].map(
    (m) => [m[1], m[2]] as [string, string],
  );
  assert.ok(pairs.length > 0, `${file}의 ${constName}에서 쌍을 하나도 파싱하지 못했다`);
  for (const [a, b] of pairs) {
    assert.ok(STEM_ELEMENT[a] && STEM_ELEMENT[b], `${file} ${constName}의 ${a}${b}가 천간 쌍이 아니다`);
  }
  return pairs;
}

const BATTLE_SRC = readLib("./utils/battle-interaction.ts");
const YEARLY_SRC = readLib("./utils/yearly-interaction.ts");

test("천간합 5쌍이 battle-interaction과 yearly-interaction에서 같다", () => {
  const battle = parseStemPairs(BATTLE_SRC, "battle-interaction.ts", "CHEONGAN_HAP");
  const yearly = parseStemPairs(YEARLY_SRC, "yearly-interaction.ts", "CHEONGAN_HAP");
  assert.equal(battle.length, 5, "천간합은 5쌍이다");
  assert.deepEqual(yearly, battle, "천간합 표가 두 모듈에서 다르다");
  // 명리 불변식: 천간합은 갑기·을경·병신·정임·무계 — 간지 순번이 정확히 5 차이나는 쌍이다.
  for (const [a, b] of battle) {
    const gap = Math.abs(STEMS.indexOf(a) - STEMS.indexOf(b));
    assert.equal(gap, 5, `천간합 ${a}${b}: 천간 순번 차가 5가 아니다`);
    assert.notEqual(
      STEM_ELEMENT[a].yin_yang,
      STEM_ELEMENT[b].yin_yang,
      `천간합 ${a}${b}: 합은 음양이 달라야 한다`,
    );
  }
});

test("천간충 4쌍이 battle-interaction과 yearly-interaction에서 같다", () => {
  const battle = parseStemPairs(BATTLE_SRC, "battle-interaction.ts", "CHEONGAN_CHUNG");
  const yearly = parseStemPairs(YEARLY_SRC, "yearly-interaction.ts", "CHEONGAN_CHUNG");
  assert.equal(battle.length, 4, "천간충은 4쌍(토는 충하지 않음)이다");
  assert.deepEqual(yearly, battle, "천간충 표가 두 모듈에서 다르다");
  // 명리 불변식: 충은 같은 음양끼리 서로 극하는 관계다.
  for (const [a, b] of battle) {
    const ea = STEM_ELEMENT[a].element;
    const eb = STEM_ELEMENT[b].element;
    assert.equal(
      STEM_ELEMENT[a].yin_yang,
      STEM_ELEMENT[b].yin_yang,
      `천간충 ${a}${b}: 충은 음양이 같아야 한다`,
    );
    assert.ok(
      CONTROLS[ea] === eb || CONTROLS[eb] === ea,
      `천간충 ${a}${b}: 두 오행이 상극 관계가 아니다`,
    );
  }
});
