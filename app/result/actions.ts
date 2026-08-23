"use server";

import { buildChartSnapshot, type ChartSnapshot } from "@/lib/result-chart";

/**
 * 저장된 결과가 없는 경로(스토어 입력만 있는 상태)에서 쓸 원국 계산.
 *
 * ★화면(브라우저)에서 계산하지 않기 위해 존재한다. 같은 사실을 서버와 화면이 각자 계산하면
 * 언제든 갈라진다 — 그게 D-14(6개월간 시주 불일치)의 구조적 원인이었다.
 * 계산 규칙은 결과 API·공유 페이지와 **같은 빌더**를 쓴다.
 */
export async function computeChartFromInput(args: {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  calendarType?: string;
  isLeapMonth?: boolean;
  birthHour?: string;
  birthMinute?: string;
  birthLocation?: string;
  unknownBirthTime?: boolean;
}): Promise<ChartSnapshot | null> {
  const y = Number(args.birthYear);
  const m = Number(args.birthMonth);
  const d = Number(args.birthDay);
  if (!y || !m || !d) return null;

  const birthTime = args.unknownBirthTime
    ? null
    : `${String(args.birthHour ?? "0").padStart(2, "0")}:${String(args.birthMinute ?? "0").padStart(2, "0")}`;

  return buildChartSnapshot({
    birth_date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    birth_time: birthTime,
    calendar_type: args.calendarType ?? "solar",
    region: args.birthLocation ?? null,
    is_leap_month: args.isLeapMonth === true,
  });
}
