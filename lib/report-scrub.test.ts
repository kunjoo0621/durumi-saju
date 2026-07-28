import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scrubHanja,
  collapseEchoParens,
  scrubStrayDecimals,
  makeScrubGripTerms,
  makeScrubGradeAlpha,
  unwrapHanjaReading,
} from "./report-scrub";

// ═══════════════════════════════════════════════════════════
// 이 파일의 fixture 대부분은 2026-07-28 실사용 15건 검수에서
// **실제로 유료 출고된 사고 문장**이다. 박제해서 재발을 막는다.
// ═══════════════════════════════════════════════════════════

// ── Task 1 기준선: 이동한 함수들의 기존 동작 ────────────────
test("scrubHanja: 한자병기 제거, 한글만 남긴다", () => {
  assert.equal(scrubHanja("홍염살(紅艶殺)의"), "홍염살의");
  assert.equal(scrubHanja("겁재(劫財, 다투는 기운)"), "겁재(다투는 기운)");
  assert.equal(scrubHanja("한자 없는 문장"), "한자 없는 문장");
});

test("collapseEchoParens: 독음 반복 괄호만 collapse, 정상 풀이는 보존", () => {
  assert.equal(collapseEchoParens("정관(정관, 바른 규칙)"), "정관(바른 규칙)");
  assert.equal(collapseEchoParens("축토(축토)"), "축토");
  assert.equal(collapseEchoParens("편재(유동적인 큰돈)"), "편재(유동적인 큰돈)");
});

test("scrubStrayDecimals: 강도값 누출 제거, 연도·나이는 보존", () => {
  assert.equal(scrubStrayDecimals("비겁이 10.5로 강하다"), "비겁이 강하다");
  assert.equal(scrubStrayDecimals("힘도 5 정도로 약해"), "힘도 약해");
  assert.equal(scrubStrayDecimals("비유하자면, 넌 물이야"), "넌 물이야");
  assert.equal(scrubStrayDecimals("2028년쯤 좋아진다"), "2028년쯤 좋아진다");
  assert.equal(scrubStrayDecimals("34세쯤 변화가 와"), "34세쯤 변화가 와");
});

// ── Task 2: 비율 오폭 (②-c) ───────────────────────────────
// 실측 사고: wealth-2 advice "투자 비중을 7: 유지하는 걸 추천해" (7:3 의 3 이 소실)
test("Task2: 비율 '7:3 정도로' 는 강도값이 아니라 원문 보존", () => {
  assert.equal(
    scrubStrayDecimals("투자 비중을 7:3 정도로 유지하는 걸 추천해"),
    "투자 비중을 7:3 정도로 유지하는 걸 추천해"
  );
});

test("Task2: 구간 표기 '3~4 정도로' 도 보존", () => {
  assert.equal(scrubStrayDecimals("3~4 정도로 나눠 담아"), "3~4 정도로 나눠 담아");
});

test("Task2: 진짜 강도값 누출은 기존대로 제거(회귀 방지)", () => {
  assert.equal(scrubStrayDecimals("힘도 5 정도로 약해"), "힘도 약해");
  assert.equal(scrubStrayDecimals("세력이 8 정도로 세다"), "세력이 세다");
});

// ── Task 3: 한자+독음 괄호 unwrap (②-b) ────────────────────
// 실측 사고: marriage-2 "네 배우자 자리는 (신금)이야" — 한자만 떼고 고아 괄호가 남았다
test("Task3: 한자+독음괄호는 독음으로 unwrap 된다", () => {
  assert.equal(unwrapHanjaReading("네 배우자 자리는 申(신금)이야"), "네 배우자 자리는 신금이야");
  assert.equal(unwrapHanjaReading("巳(사화)와는 합"), "사화와는 합");
  assert.equal(unwrapHanjaReading("寅(인목)과는 충"), "인목과는 충");
});

test("Task3: 정상 뜻풀이 괄호는 무변형(선행이 한글)", () => {
  assert.equal(unwrapHanjaReading("편재(유동적인 큰돈)"), "편재(유동적인 큰돈)");
});

test("Task3: scrubHanja 를 거쳐도 고아 괄호가 안 남는다", () => {
  assert.equal(scrubHanja("네 배우자 자리는 申(신금)이야"), "네 배우자 자리는 신금이야");
  assert.equal(scrubHanja("巳(사화)와는 합이고 寅(인목)과는 충이야"), "사화와는 합이고 인목과는 충이야");
  // 괄호 안이 한자면 기존 경로(한자 제거) 유지
  assert.equal(scrubHanja("홍염살(紅艶殺)의"), "홍염살의");
});

// ── Task 4: grip 치환 조사 정합 (②-a) ─────────────────────
// 실측 사고: wealth-4 "명리학에서는 이걸 재다신약(...)이라고 불러" → "이런 구조이라고 불러"(비문)
const WEALTH_GRIP = /신왕재왕|신왕재쇠|신왕재소|재다신약|신약재소/g;
const CAREER_GRIP = /신왕관왕|신왕관쇠|관다신약|신약관소|신약관다/g;

test("Task4: 명명 프레임 문장은 컷하고 위반 기록", () => {
  const v: string[] = [];
  const scrub = makeScrubGripTerms(WEALTH_GRIP, v);
  const out = scrub(
    "네 구조는 돈이 잘 붙어. 명리학에서는 이걸 재다신약(재물 기운은 강한데 일간의 힘이 약함)이라고 불러. 그래서 관리가 관건이야."
  );
  assert.ok(!out.includes("이라고 불러"), `명명 프레임 문장이 안 잘렸다: ${out}`);
  assert.ok(!out.includes("재다신약"), "용어가 그대로 남았다");
  assert.ok(out.includes("돈이 잘 붙어"), "앞 문장은 보존돼야 한다");
  assert.ok(out.includes("관리가 관건"), "뒤 문장도 보존돼야 한다");
  assert.ok(v.length > 0, "위반이 기록돼야 재생성이 돈다");
});

test("Task4: 일반 위치는 치환하되 조사가 깨지지 않는다", () => {
  const v: string[] = [];
  const scrub = makeScrubGripTerms(WEALTH_GRIP, v);
  assert.equal(scrub("재다신약이라 관리가 관건이야"), "이런 구조라 관리가 관건이야");
  assert.equal(scrub("재다신약이다"), "이런 구조다");
  assert.equal(scrub("신왕재왕이라서 좋아"), "이런 구조라서 좋아");
});

test("Task4: 커리어 용어도 같은 팩토리로 동일하게 처리(3검사 정합)", () => {
  const v: string[] = [];
  const scrub = makeScrubGripTerms(CAREER_GRIP, v);
  assert.equal(scrub("관다신약이라 버티기가 숙제야"), "이런 구조라 버티기가 숙제야");
  const out = scrub("명리학에서는 이걸 관다신약이라고 불러.");
  assert.ok(!out.includes("이런 구조이라고"), `조사 파손: ${out}`);
});

test("Task4: 용어가 없으면 무변형·위반 없음", () => {
  const v: string[] = [];
  const scrub = makeScrubGripTerms(WEALTH_GRIP, v);
  assert.equal(scrub("돈 그릇이 넉넉해"), "돈 그릇이 넉넉해");
  assert.equal(v.length, 0);
});

// ── Task 5: 등급 노출 역방향 (⑤) ──────────────────────────
// 실측 사고: marriage-4 "인연의 등급은 B지만 흐름은 좋아" — 정방향 정규식이 못 잡았다
test("Task5: 역방향 '등급은 B' 는 문장 컷 + 위반 기록", () => {
  const v: string[] = [];
  const scrub = makeScrubGradeAlpha(v);
  const out = scrub("인연의 등급은 B지만 흐름은 좋아. 올해는 준비하는 해야.");
  assert.ok(!/등급은\s*B/.test(out), `등급 알파벳이 남았다: ${out}`);
  assert.ok(!out.includes("등급은 지만"), `알파벳만 지운 비문이 남았다: ${out}`);
  assert.ok(out.includes("올해는 준비하는 해야"), "다른 문장은 보존");
  assert.ok(v.length > 0);
});

test("Task5: 정방향 'B등급다운' 은 기존 동작 유지", () => {
  const v: string[] = [];
  assert.equal(makeScrubGradeAlpha(v)("B등급다운 흐름"), "흐름");
});

test("Task5: 알파벳 없는 '등급은 최상위권' 은 무변형", () => {
  const v: string[] = [];
  const scrub = makeScrubGradeAlpha(v);
  assert.equal(scrub("등급은 최상위권이야"), "등급은 최상위권이야");
  assert.equal(v.length, 0);
});

test("Task5: 영어 단어 오탐 없음", () => {
  const v: string[] = [];
  const scrub = makeScrubGradeAlpha(v);
  assert.equal(scrub("Business 마인드가 있어"), "Business 마인드가 있어");
  assert.equal(v.length, 0);
});

// ── Task 7: 유행어 스크럽 (⑨) ─────────────────────────────
// 실측 누출: wealth-3 "남들이 5G급으로 성장한다고" (시니어 타깃 부적합)
test("Task7: 확정 유행어는 조용히 치환되고 문장이 자연스럽다", () => {
  assert.equal(scrubStrayDecimals("결정 속도가 5G급이야"), "결정 속도가 빛의 속도야");
  assert.equal(scrubStrayDecimals("남들이 5G급으로 성장한다고"), "남들이 빛의 속도로 성장한다고");
});

// ── ③ 기법 라벨 누출 (marriage-2 실측 3필드) ──────────────
test("기법 이름이 라벨로 새어나오면 제거된다", () => {
  assert.equal(
    scrubStrayDecimals("펀치라인: 네가 찾는 그 듬직한 어깨가 곧 온다"),
    "네가 찾는 그 듬직한 어깨가 곧 온다"
  );
  assert.equal(
    scrubStrayDecimals("돈은 물처럼 흘러. 비유: 네 돈은 강물이야"),
    "돈은 물처럼 흘러. 네 돈은 강물이야"
  );
  // 정상 문장의 콜론은 보존
  assert.equal(scrubStrayDecimals("결론 정리: 천천히 가"), "결론 정리: 천천히 가");
});
