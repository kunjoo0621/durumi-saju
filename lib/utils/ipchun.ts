/**
 * 입춘(立春) 기준 명리학 연도(세운 연도) 산출.
 *
 * 명리학에서 한 해의 시작은 양력 1월 1일이 아니라 입춘(매년 2월 3~5일).
 * 1월 1일~입춘 사이에 분석을 받는 사용자는 정통 명리학상 "전년도 세운"으로 봐야 함.
 *
 * - dict/saju/se-un 정의: "입춘 이전에 들어오는 운은 전년도 세운으로 봅니다."
 * - 자평진전·삼명통회 표준
 */

// 한국 표준시(KST) 기준 입춘 절입 시각 lookup.
// 자료: 한국천문연구원 24절기 데이터.
// 형식: year → [month, day, hour, minute] (KST)
const IPCHUN_TABLE: Record<number, [number, number, number, number]> = {
  2020: [2, 4, 17, 3],
  2021: [2, 3, 22, 58],
  2022: [2, 4, 4, 51],
  2023: [2, 4, 10, 43],
  2024: [2, 4, 16, 27],
  2025: [2, 3, 22, 11],
  2026: [2, 4, 4, 1],
  2027: [2, 4, 9, 46],
  2028: [2, 4, 15, 31],
  2029: [2, 3, 21, 21],
  2030: [2, 4, 3, 9],
  2031: [2, 4, 8, 58],
  2032: [2, 4, 14, 49],
  2033: [2, 3, 20, 41],
  2034: [2, 4, 2, 41],
  2035: [2, 4, 8, 31],
  2036: [2, 4, 14, 20],
  2037: [2, 3, 20, 11],
  2038: [2, 4, 2, 2],
  2039: [2, 4, 7, 51],
  2040: [2, 4, 13, 38],
};

function getIpchunFromTable(year: number): Date {
  const data = IPCHUN_TABLE[year];
  if (data) {
    const [month, day, hour, minute] = data;
    return new Date(year, month - 1, day, hour, minute, 0);
  }
  // Fallback: 2월 4일 자정 (lookup 누락 시 — 오차 최대 1일)
  return new Date(year, 1, 4, 0, 0, 0);
}

export interface SolarYearResolution {
  solarYear: number;          // 명리학 연도 (세운 기준)
  gregorianYear: number;      // 양력 연도
  beforeIpchun: boolean;      // 분석 시점이 그 해 입춘 이전인지
  ipchunDate: Date;           // 그 양력 연도의 입춘 절입 시각 (KST)
}

/**
 * 동기 — 정확한 입춘 lookup 기반.
 * 클라이언트·서버 모두 사용 가능. SDK 의존 없음.
 */
export function resolveSolarYear(date: Date = new Date()): SolarYearResolution {
  const gregorianYear = date.getFullYear();

  // 3월 이후는 무조건 그 양력 연도가 세운 연도
  if (date.getMonth() > 1) {
    return {
      solarYear: gregorianYear,
      gregorianYear,
      beforeIpchun: false,
      ipchunDate: getIpchunFromTable(gregorianYear),
    };
  }

  const ipchun = getIpchunFromTable(gregorianYear);
  const beforeIpchun = date.getTime() < ipchun.getTime();
  return {
    solarYear: beforeIpchun ? gregorianYear - 1 : gregorianYear,
    gregorianYear,
    beforeIpchun,
    ipchunDate: ipchun,
  };
}

/**
 * 라벨용 — "2월 4일 04시 01분 (입춘)" 형식.
 */
export function formatIpchunLabel(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}월 ${day}일 ${hour}시 ${minute}분`;
}
