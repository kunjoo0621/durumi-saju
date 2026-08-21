/**
 * `lunar-javascript` 최소 타입 선언 — 패키지가 .d.ts 를 제공하지 않는다.
 * 정밀 절기(lib/utils/solar-terms-precise.ts)가 쓰는 부분만 좁게 선언한다.
 * ★반환 시각은 **중국표준시(UTC+8)** 기준이다. 한국시로 쓰려면 +1시간.
 */
declare module "lunar-javascript" {
  interface JieQiSolar {
    getYear(): number;
    getMonth(): number;   // 1-12
    getDay(): number;
    getHour(): number;
    getMinute(): number;
    getSecond(): number;
  }
  interface LunarObj {
    /** 한자 절기명(立春·清明 …) → 시각. 24절기 전체(절+중기)가 들어 있다. */
    getJieQiTable(): Record<string, JieQiSolar>;
  }
  interface SolarObj {
    getLunar(): LunarObj;
  }
  export const Solar: {
    fromYmd(year: number, month: number, day: number): SolarObj;
  };
}
