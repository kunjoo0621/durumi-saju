// 상대(B) 원국 계산.
//
// 라우트 안에 두면 검증할 수 없어 따로 뽑는다. 실패를 절대 기본값으로 때우지 않는다 —
// 잘못 만들어진 원국으로 판정이 나가면 그건 틀린 리포트를 파는 것이다.

import type { Sex } from "./pair-facts";
import type { PartnerInput } from "./couple-input-hash";
import { calculateSaju, enrichSajuData } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { convertLunarToSolar } from "@/lib/utils/lunar";

export type PartnerChart =
  | {
      ok: true;
      enriched: ReturnType<typeof enrichSajuData>;
      fortune: Awaited<ReturnType<typeof calculateFortune>> | null;
      sex: Sex;
      birthYear: number;
    }
  | { ok: false; error: string };

/** 대운은 성별로 순행·역행이 갈린다. 성별 없이는 사주 계산 자체가 성립하지 않는다. */
function normSex(g?: string): Sex {
  return /여|female|f/i.test(g ?? "") ? "female" : "male";
}

export async function computePartnerChart(b: PartnerInput): Promise<PartnerChart> {
  let year = parseInt(b.birthYear ?? "", 10);
  let month = parseInt(b.birthMonth ?? "", 10);
  let day = parseInt(b.birthDay ?? "", 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { ok: false, error: "상대 생년월일을 다시 확인해 주세요." };
  }

  if (b.calendarType === "lunar") {
    const converted = convertLunarToSolar(year, month, day);
    if (!converted) return { ok: false, error: "상대 생년월일 변환에 실패했어요." };
    year = converted.year;
    month = converted.month;
    day = converted.day;
  }

  // ★시간을 모르면 시·분을 넘기지 않는다. 0시로 때우면 있지도 않은 시주가 생기고,
  //   그 가짜 시주가 지지 4×4 대조에 들어가 없는 관계를 지어낸다.
  const isTimeUnknown = b.unknownBirthTime === true || !b.birthHour;
  const hour = isTimeUnknown ? undefined : Number(b.birthHour);
  const minute = isTimeUnknown ? undefined : Number(b.birthMinute ?? "0");

  const saju = await calculateSaju(year, month, day, hour, minute, {
    birthLocation: b.birthLocation,
  });
  if (!saju) return { ok: false, error: "상대 사주 계산에 실패했어요." };

  const enriched = enrichSajuData(saju, { isTimeUnknown });
  const sex = normSex(b.gender);

  // 대운·세운. 실패해도 치명적이지 않다(타이밍 축이 비는 것뿐) — null 로 두고
  // pair-facts 가 "겹치는 해 없음"으로 처리한다. ★없다고 감점하지 않는다.
  let fortune: Awaited<ReturnType<typeof calculateFortune>> | null = null;
  try {
    fortune = await calculateFortune(saju, sex === "male" ? "남성" : "여성", year);
  } catch (e) {
    console.error("[COUPLE] 상대 대운 계산 실패", (e as Error)?.message);
  }

  return { ok: true, enriched, fortune, sex, birthYear: year };
}
