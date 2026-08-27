import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateSaju, enrichSajuData } from "./utils/saju";
import { formatEnrichedSajuText } from "./utils/saju-enrichment";

/**
 * 조후용신 == 기신 충돌 시 우선순위 노트 (2026-08-27)
 *
 * 조후는 계절(월지)만 보고 선언되고 기신은 억부에서 도출되므로 둘이 같은 오행을
 * 가리키는 경우가 생긴다(전 사용자 3,285명 중 282명 실측). 그동안 한 프롬프트에
 * "조후용신-수(水) … / 기신: 수(水)"가 나란히 나가 LLM에게 모순 지시가 됐다.
 *
 * ★조후를 숨기지 않는다 — 사전(yongshin/johu.ts "억부와 갈릴 때")이 "어느 쪽 결핍이
 *   더 시급한지를 따진다"고 가르치고, 궁통보감 원칙("調候為急")도 충돌 집단(하절·동절생)
 *   에서 조후를 더 중히 본다. 대신 시급성을 원국 보유량으로 판정한다.
 */

async function factsOf(y: number, m: number, d: number, h: number, mi: number) {
  const saju = await calculateSaju(y, m, d, h, mi);
  assert.ok(saju, "사주 계산 실패");
  const enriched = enrichSajuData(saju!);
  return { enriched, text: formatEnrichedSajuText(enriched) };
}
const gisinLine = (t: string) => t.split("\n").find((l) => l.startsWith("기신:")) ?? "";

test("조후==기신 충돌이면 기신 라인에 우선순위 노트가 붙는다 (운영자 사주, 수 3개 → n>=2)", async () => {
  const { enriched, text } = await factsOf(1995, 6, 21, 16, 30);
  const y = enriched.yongshin!;
  assert.equal(y.johu, y.gisin, "이 사주는 조후==기신 충돌 케이스여야 한다");
  const line = gisinLine(text);
  assert.match(line, /★조후 충돌/);
  // n>=2 분기: 한열이 이미 해소됐으므로 억부 우선
  assert.match(line, /이미 3개 있어 한열은 해소/);
  assert.match(line, /억부를 우선/);
});

test("충돌이 없으면 노트가 붙지 않는다", async () => {
  // 충돌 없는 사주를 찾아 검증 (없으면 스킵하지 않고 실패 — 전원 충돌은 비정상)
  const cands: [number, number, number, number, number][] = [
    [1990, 3, 15, 9, 0], [1988, 11, 2, 22, 0], [2001, 1, 9, 4, 0], [1975, 8, 30, 14, 0],
  ];
  let checked = 0;
  for (const c of cands) {
    const { enriched, text } = await factsOf(...c);
    const y = enriched.yongshin!;
    if (!y.johu || y.johu === y.gisin) continue;
    checked++;
    assert.doesNotMatch(gisinLine(text), /★조후 충돌/);
  }
  assert.ok(checked > 0, "비충돌 사주를 하나도 못 찾았다 — 표본 재선정 필요");
});

test("노트 3분기 임계는 0 / 1 / 2+ 로 고정된다", async () => {
  // 임계 문구가 바뀌면 프롬프트 지침(analysis.ts [조후용신 활용])과 어긋나므로 잠근다
  const src = await import("node:fs").then((fs) =>
    fs.readFileSync("lib/utils/saju-enrichment.ts", "utf-8"),
  );
  assert.match(src, /if \(n === 0\)/, "n===0 분기 소실");
  assert.match(src, /else if \(n === 1\)/, "n===1 분기 소실");
  assert.match(src, /한열 보정이 급하다\(조후위급\)/, "n=0 문구 소실");
  assert.match(src, /더 늘리지는 않는/, "n=1 문구 소실");
  assert.match(src, /한열은 해소됐다/, "n>=2 문구 소실");
});

test("analysis 프롬프트에 조후 충돌 지침이 있다", async () => {
  const src = await import("node:fs").then((fs) => fs.readFileSync("lib/analysis.ts", "utf-8"));
  assert.match(src, /조후용신 = 기신이면/, "프롬프트 지침 소실");
  assert.match(src, /\[★조후 충돌\] 노트/, "노트 참조 소실");
});

test("checkout 눈에 띄는 신살 태그는 key 로 매칭하고 한자를 뗀다", async () => {
  const { enriched } = await factsOf(1990, 3, 15, 9, 0);
  const KEYS = new Set(["dohwa", "yeokma", "chuneul", "munchang"]);
  const hit = enriched.shinsal.matches.find((s) => KEYS.has(s.key));
  assert.ok(hit, "이 사주는 눈에 띄는 신살을 하나 이상 가져야 한다");
  // ★옛 필터가 죽어 있던 두 원인을 잠근다
  assert.match(hit!.label, /\(/, "label 에 한자 병기가 있어야 함 — 완전일치 매칭이 실패하던 이유");
  assert.equal(hit!.label.replace(/\s*\(.*?\)/, ""), "도화살");
  assert.equal(hit!.type, "neutral", "도화는 neutral — type==='good' 필터가 실패하던 이유");
});

/* ─────────────────────────────────────────────────────────────
 * v21 종왕(從旺) 분기 (2026-08-27)
 *
 * 극왕에 관살이 없으면 신강 분기가 관성(=분포 0, 항상 최저)을 반드시 용신으로 뽑았다.
 * 적천수천미 從象은 그 명식을 종왕으로 보고 관살운을 "犯旺, 凶禍立至"라 한다.
 * 자사 사전 gangyak/geukwang.ts 도 이미 "종격이면 용신은 정반대로 비겁·인성"이라 적어,
 * 엔진만 사전·고전을 못 따라가던 상태였다.
 * ───────────────────────────────────────────────────────────── */
import { determineYongshin } from "./utils/saju-enrichment";
import type { KoreanElement } from "./utils/saju-enrichment";

const dist = (o: Partial<Record<KoreanElement, number>>) =>
  ({ 목: 0, 화: 0, 토: 0, 금: 0, 수: 0, ...o }) as Record<KoreanElement, number>;

test("종왕: 극왕 + 관살0 + 재성0 + 인수>=1 → 용신 비겁 / 희신 인성 / 기신 관성", () => {
  // 일간 목: 관성=금, 재성=토, 인성=수, 식상=화
  const y = determineYongshin("목", { result: "극왕" } as never, dist({ 목: 5, 수: 3 }), "寅");
  assert.equal(y.eokbu, "목", "용신은 비겁(왕신 순응)");
  assert.equal(y.heesin, "수", "희신은 인성 — 임철초 '運行比劫印綬則吉'");
  assert.equal(y.gisin, "금", "기신은 관성 — '官殺運, 謂之犯旺'");
  assert.match(y.eokbuReason, /종왕/);
});

test("종왕 아님: 재성이 있으면 종왕으로 선언하지 않는다 (군겁쟁재 회피)", () => {
  // 재성(토)이 원국에 있으면 四柱皆比劫이 아니고, 임철초는 "遇財星, 群劫相爭, 九死一生"이라 한다
  const y = determineYongshin("목", { result: "극왕" } as never, dist({ 목: 4, 수: 2, 토: 2 }), "寅");
  assert.notEqual(y.eokbu, "목", "비겁을 용신으로 주면 군겁쟁재를 키운다");
  assert.notEqual(y.eokbu, "금", "관살이 0인데 관성을 뽑으면 犯旺");
  assert.ok(y.eokbu === "화" || y.eokbu === "토", "식상 또는 재성 중에서 나와야 한다");
  assert.match(y.eokbuReason, /관살 부재로 관성 제외/);
});

test("관살이 있으면 극왕이어도 기존 억부가 그대로 작동한다", () => {
  // 관성(금)·식상(화)·재성(토)이 모두 1로 동률 → 기존 우선순위(관성>식상>재성)대로 관성
  const y = determineYongshin("목", { result: "극왕" } as never, dist({ 목: 4, 수: 1, 금: 1, 화: 1, 토: 1 }), "寅");
  assert.equal(y.eokbu, "금", "관살이 있으면 종왕·관성제외 분기를 타지 않는다");
  assert.match(y.eokbuReason, /보강/);
  assert.doesNotMatch(y.eokbuReason, /종왕/);
  assert.doesNotMatch(y.eokbuReason, /관성 제외/);
});

test("태강은 종왕 스코프 밖이다 (旺之極 = 4득 4개인 극왕만)", () => {
  const y = determineYongshin("목", { result: "태강" } as never, dist({ 목: 5, 수: 3 }), "寅");
  assert.notEqual(y.eokbu, "목", "태강은 종왕 분기를 타면 안 된다");
  assert.doesNotMatch(y.eokbuReason, /종왕/);
});

test("SCORING_VERSION 이 21로 올라가 있다 (용신이 점수에 물림)", async () => {
  const src = await import("node:fs").then((fs) => fs.readFileSync("lib/utils/saju-scoring.ts", "utf-8"));
  assert.match(src, /export const SCORING_VERSION = 21;/);
});

test("종왕 ∩ 조후충돌: 犯旺 오행을 '채우라'고 하지 않고 종왕 전용 문구가 붙는다", async () => {
  // 종왕 기신은 관성이고 게이트가 관살 0을 요구하므로, 조후==기신이면 조후 오행 개수가
  // 항상 0 → 옛 로직이면 전원 n=0("조후위급, 채워라") 분기에 떨어진다.
  // 임철초는 종왕에 관살을 두고 "官殺運, 謂之犯旺, 凶禍立至"라 한다. 실측 종왕 28명 중 6명.
  // ★실사용자 표본(1997-05-24 12:30 광주) — 화 일간 종왕, 조후 수 == 기신 수
  const saju = await calculateSaju(1997, 5, 24, 12, 30, { birthLocation: "광주" });
  assert.ok(saju);
  const enriched = enrichSajuData(saju!);
  const y = enriched.yongshin!;
  assert.equal(enriched.strength?.result, "극왕");
  assert.match(y.eokbuReason, /종왕/, "종왕으로 판정돼야 하는 표본");
  assert.equal(y.johu, y.gisin, "조후==기신 교집합이 성립하는 표본");

  const line = formatEnrichedSajuText(enriched).split("\n").find((l) => l.startsWith("기신:")) ?? "";
  assert.match(line, /★종왕 우선/, "종왕 전용 문구가 붙어야 한다");
  assert.doesNotMatch(line, /★조후 충돌/, "일반 조후 충돌 문구가 붙으면 안 된다");
  assert.doesNotMatch(line, /채워야 할 오행/, "犯旺 오행을 채우라고 하면 안 된다");
  assert.match(line, /犯旺/);
});
