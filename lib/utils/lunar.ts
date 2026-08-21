import KoreanLunarCalendar from "korean-lunar-calendar";

export type CalendarType = "solar" | "lunar";

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

export function convertLunarToSolar(
  year: number,
  month: number,
  day: number,
  isLeapMonth = false
): CalendarDate | null {
  try {
    const calendar = new KoreanLunarCalendar();
    calendar.setLunarDate(year, month, day, isLeapMonth);
    const solar = calendar.getSolarCalendar();
    return {
      year: solar.year,
      month: solar.month,
      day: solar.day,
    };
  } catch {
    return null;
  }
}

/**
 * 그 해 그 음력 월에 **윤달이 실제로 존재하는가**.
 *
 * ★`setLunarDate(y, m, d, true)` 는 윤달이 없어도 `true` 를 돌려준다(평달과 같은 값).
 *   그래서 반환값만 보면 안 되고, **평달 변환 결과와 양력이 다른지**로 판정해야 한다.
 *   (2026-08-21: 이걸 몰라 244건 전부 "윤달 가능"으로 오판한 적이 있다)
 *
 * 윤달은 19년에 7번(메톤 주기)이라 대부분의 월은 `false` 다.
 * 입력 UI 는 이 값이 `true` 일 때만 윤달 체크박스를 노출한다 —
 * 윤달 없는 달에 항상 보이면 혼란만 준다.
 */
export function hasLeapMonth(year: number, month: number): boolean {
  try {
    // ★타입 선언상 setLunarDate 는 void 를 반환한다(런타임은 boolean).
    //   truthiness 로 검사하면 TS1345 가 난다 — 결과 비교로만 판정한다.
    const leap = new KoreanLunarCalendar();
    leap.setLunarDate(year, month, 1, true);
    const plain = new KoreanLunarCalendar();
    plain.setLunarDate(year, month, 1, false);
    const a = leap.getSolarCalendar();
    const b = plain.getSolarCalendar();
    if (!a?.year || !b?.year) return false;
    return !(a.year === b.year && a.month === b.month && a.day === b.day);
  } catch {
    return false;
  }
}

export function formatDisplayDate(year: number, month: number, day: number) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}.${mm}.${dd}`;
}
