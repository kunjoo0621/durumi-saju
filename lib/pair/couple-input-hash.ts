// couple 의 입력 해시와 "결제 전 판정 게이트".
//
// ★입력 해시가 곧 중복 차감 방어선이다. 상대가 바뀌었는데 해시가 같으면
//   "이미 결제함"으로 오인해 **다른 상대의 옛 결과**를 그대로 보여준다.
//   이 프로젝트가 겪은 재사용 이중과금 사고(75건/54명)와 같은 계열의 실패다.
//
// ★A/B 순서는 고정이다(요청자 = A). 판정 자체는 대칭이지만(pair-facts 의 144 전수 대칭)
//   서술은 "너/쟤" 시점이라 산출물이 다르다. 그래서 해시도 달라야 한다.

import crypto from "crypto";

import { buildInputHash, type InputPayload } from "@/lib/analysis";

export interface PartnerInput {
  name?: string;
  birthYear?: string;
  birthMonth?: string;
  birthDay?: string;
  birthHour?: string;
  birthMinute?: string;
  birthLocation?: string;
  gender?: string;
  calendarType?: string;
  isLeapMonth?: boolean;
  unknownBirthTime?: boolean;
}

const normText = (v?: string) => (v || "").trim().replace(/\s+/g, " ");
const normNum = (v?: string, len = 2) => {
  if (!v) return "";
  const n = String(parseInt(v, 10));
  if (!n || n === "NaN") return "";
  return n.padStart(len, "0");
};

/** 상대 입력 정규화 — buildInputHash(lib/analysis.ts:2201)의 정규화 규칙을 맞춘다. */
function normalizePartner(b: PartnerInput): string {
  return JSON.stringify({
    name: normText(b.name),
    birthYear: normNum(b.birthYear, 4),
    birthMonth: normNum(b.birthMonth, 2),
    birthDay: normNum(b.birthDay, 2),
    calendarType: b.calendarType || "solar",
    isLeapMonth: b.isLeapMonth === true,
    // ★시간 미상이면 시·분을 무시한다. 안 그러면 같은 사람이 입력할 때마다 다른 해시가 되어
    //   중복 차감으로 이어진다.
    birthHour: b.unknownBirthTime ? "unknown" : normNum(b.birthHour, 2),
    birthMinute: b.unknownBirthTime ? "unknown" : normNum(b.birthMinute, 2),
    birthLocation: normText(b.birthLocation),
    gender: normText(b.gender),
    unknownBirthTime: Boolean(b.unknownBirthTime),
  });
}

/**
 * (본인 해시) + (상대 정규화) 를 결합한 해시.
 * 본인 쪽은 기존 `buildInputHash` 를 그대로 쓴다 — 정규화 규칙이 갈라지지 않게.
 */
export function buildCoupleInputHash(a: InputPayload, b: PartnerInput): string {
  const combined = JSON.stringify({ a: buildInputHash(a), b: normalizePartner(b) });
  return crypto.createHash("sha256").update(combined).digest("hex");
}

/**
 * 결제 전 판정 게이트.
 *
 * teaser 를 저장한 시점과 결제 시점 사이에 대표사주 재분석 등으로 원국이 바뀔 수 있다.
 * 그 상태로 과금하면 **사용자가 본 것과 다른 리포트**를 파는 셈이다.
 * (marriage analyze 의 같은 게이트 미러)
 *
 * ★재계산은 반드시 **저장된 연도**로 해야 한다. '오늘'로 다시 계산하면 12/31 teaser →
 *   1/1 analyze 에서 대운 구간이 넘어가 판정이 밀리고, **정당한 결제가 튕긴다.**
 *   그래서 couple_results.current_year 를 not null 로 저장한다.
 *
 * 종합만 보지 않고 축까지 본다 — 종합이 같아도 축이 바뀌면 본문이 달라지기 때문이다.
 */
export function isVerdictStale(
  stored: { verdict: string; axes: string[] },
  fresh: { verdict: string; axes: string[] },
): boolean {
  if (stored.verdict !== fresh.verdict) return true;
  if (stored.axes.length !== fresh.axes.length) return true;
  return stored.axes.some((v, i) => v !== fresh.axes[i]);
}
