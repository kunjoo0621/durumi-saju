import { calculateSaju, enrichSajuData, type SajuData } from "@/lib/utils/saju";
import type { EnrichedSajuData } from "@/lib/utils/saju-enrichment";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import type { CelebritySajuInfo } from "./types";

export type ComputedCelebritySaju = {
  data: SajuData | null;
  /** 십성·신살·강약 등 풍부 데이터. data와 함께 계산됨 (data null이면 null). */
  enriched: EnrichedSajuData | null;
  /** birthTime이 누락돼 12:00 fallback으로 계산됨. UI에서 시주 마스킹 필요. */
  hourUnknown: boolean;
};

/**
 * 연예인 글의 birth info → SajuData + 메타.
 * SSG 빌드 시 server component에서 await로 호출.
 *
 * - 음력 입력은 양력으로 먼저 변환
 * - 시 미상은 사이트 표준대로 12:00 fallback (calculateSaju 내부 처리)
 *   하지만 hourUnknown 플래그를 함께 반환해 시주 컬럼을 UI에서 마스킹할 수 있게 함.
 *   → 12:00 추정값이 사용자에게 사실로 보이는 사고 차단.
 * - 실패 시 data=null (페이지에서 차트 미렌더 처리)
 */
export async function computeCelebritySaju(
  info: CelebritySajuInfo,
): Promise<ComputedCelebritySaju> {
  const [yStr, mStr, dStr] = info.birthDate.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);

  const hourUnknown = !info.birthTime;

  if (!year || !month || !day) return { data: null, enriched: null, hourUnknown };

  // 음력 → 양력 변환
  let solarYear = year;
  let solarMonth = month;
  let solarDay = day;

  if (info.calendar === "lunar") {
    const solar = convertLunarToSolar(year, month, day, info.isLeapMonth ?? false);
    if (!solar) return { data: null, enriched: null, hourUnknown };
    solarYear = solar.year;
    solarMonth = solar.month;
    solarDay = solar.day;
  }

  let hour: number | undefined;
  let minute: number | undefined;
  if (info.birthTime) {
    const [hStr, minStr] = info.birthTime.split(":");
    const h = Number(hStr);
    const m = Number(minStr ?? "0");
    if (Number.isFinite(h) && Number.isFinite(m)) {
      hour = h;
      minute = m;
    }
  }

  const data = await calculateSaju(solarYear, solarMonth, solarDay, hour, minute);
  // 시 미상이면 enrichSajuData에 isTimeUnknown 플래그 — 시주 의존 신살 가중치 자동 조정.
  const enriched = data
    ? enrichSajuData(data, { isTimeUnknown: hourUnknown })
    : null;
  return { data, enriched, hourUnknown };
}

/** 출생 정보 노출용 문자열 — "1996.11.01 · 양력 · 시 미상" */
export function formatCelebrityBirthMeta(info: CelebritySajuInfo): string {
  const [y, m, d] = info.birthDate.split("-");
  const dateStr = `${y}.${m}.${d}`;
  const calStr = info.calendar === "lunar" ? "음력" : "양력";
  const timeStr = info.birthTime ? info.birthTime : "시 미상";
  return `${dateStr} · ${calStr} · ${timeStr}`;
}
