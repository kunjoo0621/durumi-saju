declare module "korean-lunar-calendar" {
  export default class KoreanLunarCalendar {
    setLunarDate(year: number, month: number, day: number, isLeapMonth?: boolean): void;
    getSolarCalendar(): { year: number; month: number; day: number };
  }
}
