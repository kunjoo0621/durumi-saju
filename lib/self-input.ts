// lib/self-input.ts
// 자체입력(로그인 유저가 방금 입력한 생년월일) 경로 공용 유틸.
// 결혼운·재물운이 대표사주(from-primary) 없이도 원국·점수를 즉석 계산할 때 사용한다.
//
// ★ start·analyze가 동일 body를 넘겨도 반드시 동일 buildInputHash가 나오도록
//   정규화(default 채움)를 이 파일 단일 소스에 고정한다 — 결제 row 매칭 생명선.
//   (relationship/employment/coreFear는 점수·facts에 무관하지만 buildInputHash에
//    포함되므로, 양쪽이 같은 default를 쓰지 않으면 해시가 어긋나 teaser row를 못 찾는다.)

import type { InputPayload } from "@/lib/analysis";
import { normalizeScores, type AnalysisScores } from "@/lib/resultSchema";
import { calculateServerScoring } from "@/lib/utils/saju-scoring";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import {
  DEFAULT_RELATIONSHIP_STATUS,
  DEFAULT_EMPLOYMENT_STATUS,
  DEFAULT_CORE_FEAR_AXIS,
} from "@/lib/constants/saju-defaults";

// 클라이언트가 자체입력 경로에서 보내는 원시 입력 (SajuInputFlow 산출물 형태)
export type SelfSajuInput = {
  name?: string;
  birthYear?: string;
  birthMonth?: string;
  birthDay?: string;
  calendarType?: "solar" | "lunar";
  birthHour?: string;
  birthMinute?: string;
  birthLocation?: string;
  gender?: string;
  unknownBirthTime?: boolean;
};

// 원시 입력 → InputPayload 정규화.
// relationship/employment/coreFear는 default 고정 (calculateServerScoring은 enriched만 사용해
// 점수에 무관하고, 서비스 고유 관계상태/관심사는 별도 컬럼으로 저장하므로).
// start·analyze 양쪽이 반드시 이 함수만 경유해야 buildInputHash가 일치한다.
export function normalizeSelfInput(raw: SelfSajuInput): InputPayload {
  const s = (v?: string) => (v ?? "").trim();
  const unknownBirthTime = Boolean(raw.unknownBirthTime);
  return {
    name: s(raw.name),
    birthYear: s(raw.birthYear),
    birthMonth: s(raw.birthMonth),
    birthDay: s(raw.birthDay),
    calendarType: raw.calendarType === "lunar" ? "lunar" : "solar",
    birthHour: unknownBirthTime ? "" : s(raw.birthHour),
    birthMinute: unknownBirthTime ? "" : s(raw.birthMinute),
    birthLocation: s(raw.birthLocation),
    gender: s(raw.gender),
    relationshipStatus: DEFAULT_RELATIONSHIP_STATUS,
    employmentStatus: DEFAULT_EMPLOYMENT_STATUS,
    coreFearAxis: DEFAULT_CORE_FEAR_AXIS,
    unknownBirthTime,
  };
}

export function normGender(g: string): "male" | "female" {
  return /여|female|f/i.test(g) ? "female" : "male";
}

export type SelfSajuResult = {
  saju: NonNullable<Awaited<ReturnType<typeof calculateSaju>>>;
  enriched: ReturnType<typeof enrichSajuData>;
  fortune: Awaited<ReturnType<typeof calculateFortune>> | null;
  gender: "male" | "female";
  sajuText: string;
};

// 음력변환 → calculateSaju → enrichSajuData → calculateFortune → formatSajuText.
// app/api/marriage/from-primary/route.ts 파이프라인 미러(광범위 리팩터 금지 원칙상 공유가 아닌 재현).
// 계산 실패 시 throw — 호출 라우트의 try/catch가 generic 500으로 처리한다(CLAUDE.md 규약).
export async function computeSelfSaju(input: InputPayload): Promise<SelfSajuResult> {
  let calcYear = Number(input.birthYear);
  let calcMonth = Number(input.birthMonth);
  let calcDay = Number(input.birthDay);

  if (input.calendarType === "lunar") {
    const converted = convertLunarToSolar(calcYear, calcMonth, calcDay);
    if (!converted) throw new Error("SELF_LUNAR_CONVERT_FAILED");
    calcYear = converted.year;
    calcMonth = converted.month;
    calcDay = converted.day;
  }

  const hour = input.unknownBirthTime ? undefined : Number(input.birthHour);
  const minute = input.unknownBirthTime ? undefined : Number(input.birthMinute);

  const saju = await calculateSaju(calcYear, calcMonth, calcDay, hour, minute, {
    birthLocation: input.birthLocation,
  });
  if (!saju) throw new Error("SELF_SAJU_CALC_FAILED");

  const enriched = enrichSajuData(saju, { isTimeUnknown: input.unknownBirthTime });
  const gender = normGender(input.gender);

  let fortune: Awaited<ReturnType<typeof calculateFortune>> | null = null;
  try {
    fortune = await calculateFortune({
      birthYear: calcYear,
      birthMonth: calcMonth,
      birthDay: calcDay,
      birthHour: hour,
      birthMinute: minute,
      gender,
      birthLocation: input.birthLocation,
      yearPillar: saju.year.heavenlyStem + saju.year.earthlyBranch,
      monthPillar: saju.month.heavenlyStem + saju.month.earthlyBranch,
      dayPillar: saju.day.heavenlyStem + saju.day.earthlyBranch,
      hourPillar: saju.hour.heavenlyStem + saju.hour.earthlyBranch,
      isTimeUnknown: input.unknownBirthTime,
    });
  } catch (fortuneError) {
    console.error("[SELF_SAJU] fortune 계산 실패 (타이밍 없이 진행)", fortuneError);
  }

  const sajuText = formatSajuText(saju, { isTimeUnknown: input.unknownBirthTime });
  return { saju, enriched, fortune, gender, sajuText };
}

// from-primary가 저장 full_json.scores에서 읽던 카테고리 점수를 "동일 산식"으로 즉석 생성.
// 개인사주 full_json.scores = normalizeScores(calculateServerScoring(enriched).scores) 이므로
// 자체입력 경로도 같은 값이 나온다 → 등급 게이트(409) 오탐 없음.
// extractLoveScore/extractWealthScore에 { scores: deriveSelfScores(enriched) } 로 통과시켜 사용.
export function deriveSelfScores(
  enriched: Parameters<typeof calculateServerScoring>[0],
): AnalysisScores {
  return normalizeScores(calculateServerScoring(enriched).scores);
}
