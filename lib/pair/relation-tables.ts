// 지지 관계 정본 — 두 지지 사이에 성립하는 관계를 "전부" 돌려준다.
//
// 왜 새로 만드는가: lib/utils/saju-enrichment.ts 의 getPairRelation 은 우선순위로
// 관계를 하나만 돌려준다. 원국 안에서 대표 관계 하나를 고르는 용도로는 맞지만,
// 두 사람 원국을 대조할 때는 겹치는 관계가 사라지면 안 된다. 사전 정본상
// 丑午는 해(害)·원진·귀문 셋 다이고, 셋의 해석이 서로 다르다.

import { BANGHAP, HYUNG, SAMHAP, WONJIN, YUKAP, YUKCHUNG } from "@/lib/utils/saju-enrichment";

export type BranchRelationKind =
  | "육합"
  | "삼합"
  | "방합"
  | "동일"
  | "충"
  | "형"
  | "해"
  | "원진"
  | "귀문";

// 지지 쌍 엔트리. dictSlug 를 들고 다니는 이유는 사전(lib/dict)과의 대조를
// 테스트가 기계적으로 강제하기 위해서다 — 사람이 눈으로 맞추면 반드시 갈라진다.
export type BranchPairEntry = {
  a: string;
  b: string;
  /** lib/dict/data/relation|sinsal 의 슬러그. 사전 엔트리가 없으면 null */
  dictSlug: string | null;
};

// 육해(六害) — 사전 정본과 1:1 대조.
// lib/dict/data/relation/{jami,chuko,insa,myojin,sinhae,yusul}-hae.ts
// 연해자평 계열에서는 천(穿)·상천살(相穿殺)로도 부른다.
export const YUKHAE: BranchPairEntry[] = [
  { a: "子", b: "未", dictSlug: "jami-hae" },   // 세가상해(勢家相害)
  { a: "丑", b: "午", dictSlug: "chuko-hae" },  // 관귀상해(官鬼相害)
  { a: "寅", b: "巳", dictSlug: "insa-hae" },
  { a: "卯", b: "辰", dictSlug: "myojin-hae" }, // 이소릉장(以少凌長)
  { a: "申", b: "亥", dictSlug: "sinhae-hae" },
  { a: "酉", b: "戌", dictSlug: "yusul-hae" },  // 질투상해(嫉妒相害)
];

// 귀문관살(鬼門關殺) — 사전 정본(lib/dict/data/sinsal/gwimun.ts)의 통설 6쌍.
// ★원진과 4쌍(丑午·卯申·辰亥·巳戌)이 겹치고 2쌍(子酉·寅未 vs 子未·寅酉)이 갈린다.
//   사전이 "학파별로 약간 차이가 있으나 통설은…"이라고 명문화한 그 지점이며,
//   겹친다고 원진으로 대체하면 안 된다 — 예민함/직관(귀문)과 까닭 없는 미움(원진)은
//   해석이 다르다.
export const GWIMUN: BranchPairEntry[] = [
  { a: "子", b: "酉", dictSlug: "gwimun" },
  { a: "丑", b: "午", dictSlug: "gwimun" },
  { a: "寅", b: "未", dictSlug: "gwimun" },
  { a: "卯", b: "申", dictSlug: "gwimun" },
  { a: "辰", b: "亥", dictSlug: "gwimun" },
  { a: "巳", b: "戌", dictSlug: "gwimun" },
];

function entryIn(entries: BranchPairEntry[], a: string, b: string): boolean {
  return entries.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

function tupleIn(pairs: [string, string][], a: string, b: string): boolean {
  return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

// 형(刑) — saju-enrichment 의 HYUNG 정본을 그대로 쓴다(테이블 복사 금지).
// 삼형·상형은 두 글자가 같은 그룹에 있으면 성립하고, 자형은 같은 글자가 두 번
// 나오는 그룹(["辰","辰"] 등)이라 그룹 안 중복 개수로 가른다.
// 삼합·방합은 세 글자 그룹이라 두 글자만 놓으면 반합(半合)이 된다.
// ★학파차 주의: 삼합 반합을 "왕지(子午卯酉)를 포함해야 성립"으로 보는 견해가 있으나,
//   우리 엔진은 이미 그룹 안 두 글자면 성립으로 판정해 왔다(getPairRelation). 여기서
//   정의를 바꾸면 같은 사실이 두 모듈에서 갈린다. 바꾸려면 사전·기존 상품과 함께 바꿔야 한다.
function triadHasBoth(
  triads: readonly (readonly string[])[],
  a: string,
  b: string,
): boolean {
  if (a === b) return false;
  return triads.some((t) => {
    const g = t.slice(0, 3);
    return g.includes(a) && g.includes(b);
  });
}

function isHyungPair(a: string, b: string): boolean {
  return HYUNG.some(([group]) => {
    if (!group.includes(a) || !group.includes(b)) return false;
    if (a !== b) return true;
    return group.filter((g) => g === a).length >= 2; // 자형
  });
}

export function getBranchRelations(a: string, b: string): BranchRelationKind[] {
  const out: BranchRelationKind[] = [];
  // 순서는 "붙는 관계 → 부딪히는 관계"로 읽히게 두되, 우선순위가 아니다.
  // 이 함수는 성립하는 관계를 전부 돌려주므로 어느 것도 다른 것을 가리지 않는다.
  if (YUKAP.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) out.push("육합");
  // 방합 반방합 — 같은 계절 세 글자 중 둘. 기존 getPairRelation(saju-enrichment.ts:905)이
  // "그룹 안 두 글자면 성립"으로 보고 있어 그 판정을 그대로 따른다(같은 사실이 두 모듈에서
  // 갈리지 않게 하는 것이 이 엔진의 목적이다).
  if (triadHasBoth(SAMHAP, a, b)) out.push("삼합");
  if (triadHasBoth(BANGHAP, a, b)) out.push("방합");
  if (a === b) out.push("동일");
  if (entryIn(YUKHAE, a, b)) out.push("해");
  if (tupleIn(YUKCHUNG, a, b)) out.push("충");
  if (isHyungPair(a, b)) out.push("형");
  if (tupleIn(WONJIN, a, b)) out.push("원진");
  if (entryIn(GWIMUN, a, b)) out.push("귀문");
  return out;
}
