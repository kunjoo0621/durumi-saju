/**
 * 결과 화면에 그릴 원국(4주 + enrichment)을 **서버에서 한 번** 만든다.
 *
 * ★왜 이 파일이 있나 (2026-08-22 유료 클레임 D-14)
 * 화면이 원국을 직접 재계산하던 구조 때문에, 서버가 분석에 쓴 사주와 화면에 그려진 사주가
 * 6개월간 갈라져 있었다(전수 2,913건 중 68건. 원인은 `birthLocation` 인자 하나 누락).
 * 같은 사실을 두 곳에서 계산하면 언제든 또 갈라진다. **계산은 여기 한 곳에서만** 하고
 * 화면은 받아서 그리기만 한다.
 *
 * 결과 화면(`/api/results/full`)과 공유 화면(`/result/share/[id]`)이 **같은 함수**를 쓴다 —
 * 한쪽만 고치는 실수를 구조적으로 막기 위해서다.
 */
import { calculateSaju, enrichSajuData, type SajuData } from "@/lib/utils/saju";
import type { EnrichedSajuData } from "@/lib/utils/saju-enrichment";
import { convertLunarToSolar, type CalendarType } from "@/lib/utils/lunar";

/** `saju_results` 행에서 원국 계산에 필요한 부분만. */
export type ChartSource = {
  birth_date?: string | null;
  birth_time?: string | null;
  calendar_type?: string | null;
  /** 출생지역. ★빠지면 서울 경도가 기본값이라 시주가 틀어진다(D-14의 원인). */
  region?: string | null;
  /**
   * 음력 윤달 여부. **DB 행에는 이 값이 없다**(입력 시점에만 존재) —
   * 그래서 과거 행을 읽기 시점에 계산하면 평달로 처리된다(기존 동작과 동일).
   * 분석 시점 저장에서는 반드시 넘겨서 분석에 쓴 값과 일치시킨다.
   */
  is_leap_month?: boolean | null;
};

export type ChartSnapshot = {
  sajuData: SajuData;
  enriched: EnrichedSajuData;
  birthYear: number;
  unknownBirthTime: boolean;
};

/**
 * 저장된 입력으로 원국을 계산한다. 계산 불가(생년월일 없음/엔진 실패)면 `null`.
 * 호출부는 null 이면 차트를 감추거나 기존 폴백을 쓴다 — 절대 던지지 않는다(표시 경로다).
 */
export async function buildChartSnapshot(row: ChartSource): Promise<ChartSnapshot | null> {
  if (!row?.birth_date) return null;

  const [y, m, d] = String(row.birth_date).split("-").map(Number);
  if (!y || !m || !d) return null;

  let calcY = y;
  let calcM = m;
  let calcD = d;
  const calendar = (row.calendar_type as CalendarType) || "solar";
  if (calendar === "lunar") {
    const converted = convertLunarToSolar(calcY, calcM, calcD, row.is_leap_month === true);
    if (converted) {
      calcY = converted.year;
      calcM = converted.month;
      calcD = converted.day;
    }
  }

  const unknownBirthTime = !row.birth_time;
  const [hour, minute] = row.birth_time
    ? String(row.birth_time).split(":").map(Number)
    : [undefined, undefined];

  const sajuData = await calculateSaju(calcY, calcM, calcD, hour, minute, {
    birthLocation: row.region ?? undefined,
  });
  if (!sajuData) return null;

  return {
    sajuData,
    enriched: enrichSajuData(sajuData, { isTimeUnknown: unknownBirthTime }),
    birthYear: y,
    unknownBirthTime,
  };
}

/**
 * 분석 시점에 저장할 원국 스냅샷. `full_json.chart` 에 넣는다.
 *
 * ★왜 저장하나: 읽기 시점 계산은 "화면 == **지금** 엔진"만 보장한다. 결제한 결과의 본문·점수는
 * 얼려두는 정책이라(하향 방지), 엔진이 바뀌면 **옛 본문 vs 새로 계산한 차트**가 또 갈라진다.
 * 분석 시점 값을 박아두면 그 사람 결과는 산 시점 그대로 고정된다.
 *
 * ★음력 윤달은 DB 행에 없으므로 **여기서만** 정확히 넘길 수 있다.
 */
export async function buildChartForAnalysis(args: {
  birthDate: string;
  birthTime: string | null;
  calendarType?: string | null;
  birthLocation?: string | null;
  isLeapMonth?: boolean;
}): Promise<ChartSnapshot | null> {
  return buildChartSnapshot({
    birth_date: args.birthDate,
    birth_time: args.birthTime,
    calendar_type: args.calendarType ?? "solar",
    region: args.birthLocation ?? null,
    is_leap_month: args.isLeapMonth === true,
  });
}

/**
 * 저장된 스냅샷을 꺼낸다. 없으면(과거 행) `null` — 호출부가 읽기 시점 계산으로 폴백한다.
 * 스냅샷은 `full_json.chart` 에 산다(별도 컬럼이 아니라 — DDL 없이 넣기 위해서다).
 */
export function readStoredChart(fullJson: unknown): ChartSnapshot | null {
  const chart = (fullJson as any)?.chart;
  if (!chart?.sajuData?.day?.heavenlyStem || !chart?.enriched) return null;
  return chart as ChartSnapshot;
}
