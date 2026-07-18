import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSelfInput,
  deriveSelfScores,
  computeSelfSaju,
  type SelfSajuInput,
} from "./self-input";
import { buildInputHash } from "./analysis";
import { enrichSajuData } from "./utils/saju";
import type { SajuData } from "./utils/saju";
import { computeMarriageGrade, extractLoveScore } from "./marriage-grade";
import { computeWealthGrade, extractWealthScore } from "./wealth-grade";

const rawA: SelfSajuInput = {
  name: "  홍길동 ",
  birthYear: "1990",
  birthMonth: "3",
  birthDay: "5",
  calendarType: "solar",
  birthHour: "9",
  birthMinute: "30",
  birthLocation: "서울",
  gender: "남",
  unknownBirthTime: false,
};

test("normalizeSelfInput: 같은 입력 → 동일 buildInputHash (start↔analyze 매칭 생명선)", () => {
  const h1 = buildInputHash(normalizeSelfInput(rawA));
  const h2 = buildInputHash(normalizeSelfInput({ ...rawA }));
  assert.equal(h1, h2);
});

test("normalizeSelfInput: default(관계/직업/코어) 결정론적으로 고정", () => {
  const n = normalizeSelfInput(rawA);
  assert.equal(n.relationshipStatus, "솔로");
  assert.equal(n.employmentStatus, "직장인");
  assert.equal(n.coreFearAxis, "DISMISS");
});

test("normalizeSelfInput: trim 안정 (공백 차이가 해시를 바꾸지 않음)", () => {
  const n1 = normalizeSelfInput(rawA); // name "  홍길동 "
  const n2 = normalizeSelfInput({ ...rawA, name: "홍길동", birthLocation: " 서울 " });
  assert.equal(buildInputHash(n1), buildInputHash(n2));
});

test("unknownBirthTime: 시/분 값이 달라도 동일 해시 (시간미상이면 시/분 무시)", () => {
  const n1 = normalizeSelfInput({ ...rawA, unknownBirthTime: true, birthHour: "9", birthMinute: "30" });
  const n2 = normalizeSelfInput({ ...rawA, unknownBirthTime: true, birthHour: "23", birthMinute: "0" });
  assert.equal(buildInputHash(n1), buildInputHash(n2));
});

// 일간 甲. 관성/재성 존재하는 검증된 픽스처(marriage-facts.test.ts와 동일)
const chart: SajuData = {
  year: { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },
  month: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
  day: { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour: { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

test("deriveSelfScores: 동일 enriched → 동일 점수 (등급 게이트 결정성)", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const s1 = deriveSelfScores(enriched);
  const s2 = deriveSelfScores(enriched);
  assert.deepEqual(s1, s2);
  assert.ok(Number.isFinite(s1.연애운));
  assert.ok(Number.isFinite(s1.재물운));
});

test("deriveSelfScores → extractLoveScore/extractWealthScore → 등급 산출 성공", () => {
  const enriched = enrichSajuData(chart, { isTimeUnknown: false });
  const scores = deriveSelfScores(enriched);
  const love = extractLoveScore({ scores });
  const wealth = extractWealthScore({ scores });
  assert.equal(typeof love, "number");
  assert.equal(typeof wealth, "number");
  assert.ok(computeMarriageGrade(love as number).grade);
  assert.ok(computeWealthGrade(wealth as number).grade);
});

test("computeSelfSaju: 실제 생년월일 파이프라인 → 원국·enriched·점수 산출", async () => {
  const input = normalizeSelfInput(rawA);
  const { saju, enriched, sajuText } = await computeSelfSaju(input);
  assert.ok(saju.day.heavenlyStem, "일간 계산됨");
  assert.ok(sajuText.length > 0, "sajuText 생성됨");
  const scores = deriveSelfScores(enriched);
  assert.ok(Number.isFinite(scores.연애운));
  assert.ok(Number.isFinite(scores.재물운));
});
