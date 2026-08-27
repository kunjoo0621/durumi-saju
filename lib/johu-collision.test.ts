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
