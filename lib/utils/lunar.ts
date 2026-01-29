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

export function formatDisplayDate(year: number, month: number, day: number) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}.${mm}.${dd}`;
}
