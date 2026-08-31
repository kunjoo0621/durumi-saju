import { test } from "node:test";
import assert from "node:assert/strict";

import { getDictEntriesByCategory } from "@/lib/dict/registry";

import { getBranchRelations, YUKHAE } from "./relation-tables";

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
