import { test } from "node:test";
import assert from "node:assert/strict";

import { getAllDictEntries, getDictEntriesByCategory } from "@/lib/dict/registry";
import { BRANCH_INFO } from "@/lib/utils/saju-enrichment";

import { getBranchRelations, GWIMUN, YUKHAE } from "./relation-tables";

// 한 쌍이 여러 관계를 동시에 갖는다는 것이 이 모듈의 존재 이유다.
// 기존 lib/utils/saju-enrichment.ts 의 getPairRelation 은 우선순위로 하나만 돌려주는데,
// 사전 정본상 子未는 육해(六害)이면서 동시에 원진이다. 하나만 고르면 나머지가 사라진다.
test("子未는 해(害)이면서 원진이다 — 한 쌍이 여러 관계를 동시에 갖는다", () => {
  const rels = getBranchRelations("子", "未");

  assert.ok(rels.includes("해"), `해가 빠졌다: ${JSON.stringify(rels)}`);
  assert.ok(rels.includes("원진"), `원진이 빠졌다: ${JSON.stringify(rels)}`);
  assert.equal(rels.length, 2, `子未는 해·원진 2개뿐이어야 한다: ${JSON.stringify(rels)}`);
});

// 겹침의 극단. 사전(lib/dict/data/sinsal/gwimun.ts)이 "원진살과 일부 겹칩니다"라고
// 명문화한 그 지점이다. 셋을 각각 다르게 해석하므로 하나로 뭉뚱그리면 안 된다.
test("丑午는 해·원진·귀문 셋 다에 해당한다", () => {
  const rels = getBranchRelations("丑", "午");

  for (const kind of ["해", "원진", "귀문"] as const) {
    assert.ok(rels.includes(kind), `${kind}이 빠졌다: ${JSON.stringify(rels)}`);
  }
  assert.equal(rels.length, 3, `丑午는 3개여야 한다: ${JSON.stringify(rels)}`);
});

// ★ 사전 정합 — 이 프로젝트에서 명리 사실이 갈라진 경로는 언제나 "엔진이 사전을
// 못 따라가는 것"이었다(v21 종왕 분기 때 사전은 이미 맞게 적혀 있었고 엔진만 틀렸다).
// 그래서 테이블이 사전과 어긋나면 빌드가 아니라 테스트가 먼저 깨지게 만든다.
test("육해 6쌍은 사전의 relation -hae 엔트리 6개와 1:1 대응한다", () => {
  const dictHaeSlugs = getDictEntriesByCategory("relation")
    .map((e) => e.slug)
    .filter((s) => s.endsWith("-hae"))
    .sort();

  assert.equal(dictHaeSlugs.length, 6, `사전의 육해 엔트리가 6개가 아니다: ${dictHaeSlugs}`);

  const tableSlugs = YUKHAE.map((h) => h.dictSlug).sort();
  assert.deepEqual(
    tableSlugs,
    dictHaeSlugs,
    `엔진 테이블과 사전이 어긋났다.\n  엔진: ${tableSlugs}\n  사전: ${dictHaeSlugs}`,
  );
});

// 겹침은 원진·귀문 축에만 있는 게 아니다. 寅巳는 육해이면서 동시에
// 삼형(寅巳申 무은지형)의 한 변이다. 형을 못 잡으면 "왜 부딪히는지"의 절반이 빈다.
test("寅巳는 해이면서 형이다", () => {
  const rels = getBranchRelations("寅", "巳");

  assert.ok(rels.includes("해"), `해가 빠졌다: ${JSON.stringify(rels)}`);
  assert.ok(rels.includes("형"), `형이 빠졌다: ${JSON.stringify(rels)}`);
});

// ★이 모듈이 필요한 이유를 가장 잘 보여주는 쌍.
// 巳申은 육합(사신합수)이면서 동시에 삼형(寅巳申)의 한 변이다 — 명리에서 형합(刑合)이라
// 따로 부른다. 기존 getPairRelation 은 우선순위가 합 > 충 > 형 이라 "합"만 돌려주고
// 형을 버린다. 붙으면서 동시에 부딪히는 자리인데 절반만 남으면 해석이 반대로 간다.
test("巳申은 육합이면서 형이다 — 기존 getPairRelation 이 버리는 절반", () => {
  const rels = getBranchRelations("巳", "申");

  assert.ok(rels.includes("육합"), `육합이 빠졌다: ${JSON.stringify(rels)}`);
  assert.ok(rels.includes("형"), `형이 빠졌다: ${JSON.stringify(rels)}`);
});

// 丑未는 육충이면서 축술미 삼형(지세지형)의 한 변이다. 충만 보면 "정면 충돌"로
// 끝나지만, 형이 함께 걸리면 "믿는 구석을 앞세워 부딪힌다"는 결이 더해진다.
test("丑未는 충이면서 형이다", () => {
  const rels = getBranchRelations("丑", "未");

  assert.ok(rels.includes("충"), `충이 빠졌다: ${JSON.stringify(rels)}`);
  assert.ok(rels.includes("형"), `형이 빠졌다: ${JSON.stringify(rels)}`);
});

// 子丑은 육합(자축합토)이면서 해자축 방합(북방 수국)의 두 글자다.
// 붙는 방식이 둘인데 오행 결과가 다르다(합토 vs 수국) — 하나로 뭉개면 안 된다.
test("子丑은 육합이면서 방합 반방합이다", () => {
  const rels = getBranchRelations("子", "丑");

  assert.ok(rels.includes("육합"), `육합이 빠졌다: ${JSON.stringify(rels)}`);
  assert.ok(rels.includes("방합"), `방합이 빠졌다: ${JSON.stringify(rels)}`);
});

test("申子는 삼합 반합이다 (신자진 수국)", () => {
  const rels = getBranchRelations("申", "子");
  assert.deepEqual(rels, ["삼합"], `삼합 하나만 나와야 한다: ${JSON.stringify(rels)}`);
});

// 같은 글자가 두 번. 辰辰·午午·酉酉·亥亥는 자형(自刑)이라 "동일"로만 처리하면
// 부딪히는 결이 사라진다. 반대로 寅寅은 자형이 아니라 동일일 뿐이다.
test("辰辰은 동일 지지이면서 자형이다 / 寅寅은 동일 지지일 뿐이다", () => {
  const jin = getBranchRelations("辰", "辰");
  assert.ok(jin.includes("동일"), `동일이 빠졌다: ${JSON.stringify(jin)}`);
  assert.ok(jin.includes("형"), `자형이 빠졌다: ${JSON.stringify(jin)}`);

  const inin = getBranchRelations("寅", "寅");
  assert.deepEqual(inin, ["동일"], `寅寅은 자형이 아니다: ${JSON.stringify(inin)}`);
});

const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

/** 12지지의 순서 없는 전 조합 78쌍(서로 다른 66 + 같은 글자 12) */
function allPairs(): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < BRANCHES.length; i++) {
    for (let j = i; j < BRANCHES.length; j++) out.push([BRANCHES[i], BRANCHES[j]]);
  }
  return out;
}

// 관계 종류별 쌍 개수를 명리에서 독립적으로 세어 박는다. 구현이 뱉은 값을 그대로
// 베끼면 스냅샷이 버그까지 축복해버리므로, 기대값은 정의에서 나와야 한다.
//   육합 6 / 육충 6 / 육해 6 / 원진 6 / 귀문 6
//   삼합 4조 × 3쌍 = 12 / 방합 4조 × 3쌍 = 12 / 동일 12
//   형 = 寅巳申 3 + 丑戌未 3 + 子卯 1 + 자형(辰午酉亥) 4 = 11
test("전 78쌍에서 관계 종류별 쌍 개수가 정본과 일치한다", () => {
  const count: Record<string, number> = {};
  for (const [a, b] of allPairs()) {
    for (const kind of getBranchRelations(a, b)) count[kind] = (count[kind] ?? 0) + 1;
  }

  assert.deepEqual(count, {
    육합: 6, 삼합: 12, 방합: 12, 동일: 12,
    충: 6, 형: 11, 해: 6, 원진: 6, 귀문: 6,
  });
});

// 대칭성 — 두 사람을 어느 쪽부터 넣든 관계는 같아야 한다. 이게 깨지면
// "내가 A일 때와 상대가 A일 때 결과가 다른" 상품이 된다.
test("getBranchRelations 는 인자 순서에 대해 대칭이다 (78쌍 전수)", () => {
  for (const [a, b] of allPairs()) {
    assert.deepEqual(
      getBranchRelations(a, b),
      getBranchRelations(b, a),
      `${a}${b} 와 ${b}${a} 가 다르다`,
    );
  }
});

// 귀문은 육해와 달리 쌍별 사전 엔트리가 없어 산문에서 옮겨온 값이라 제일 약한 고리였다.
// 사전의 구조화 필드 highlight "조합"과 기계적으로 대조해 그 구멍을 막는다.
// 사전이 바뀌면(학파 재검토 등) 이 테스트가 먼저 깨진다.
test("귀문 6쌍은 사전 gwimun 엔트리의 '조합' 필드와 일치한다", () => {
  const entry = getAllDictEntries().find((e) => e.slug === "gwimun");
  assert.ok(entry, "사전에 gwimun 엔트리가 없다");

  const combo = entry!.highlight?.find((h) => h.label === "조합")?.value;
  assert.ok(combo, "gwimun 엔트리에 '조합' 필드가 없다");

  const fromTable = GWIMUN.map(
    ({ a, b }) => `${BRANCH_INFO[a].korean}${BRANCH_INFO[b].korean}`,
  ).join("·");

  assert.ok(
    combo!.startsWith(fromTable),
    `엔진 테이블과 사전 '조합' 필드가 어긋났다.\n  엔진: ${fromTable}\n  사전: ${combo}`,
  );
});
