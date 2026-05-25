// KST(Asia/Seoul) 기준 날짜 문자열 산출 유틸
// today 운세는 한국 사용자 기준 "오늘"이 필요. new Date().toISOString()은 UTC라
// KST 00:00~08:59 사이엔 전날 날짜가 반환됨 → KST timezone 명시 필수.

/**
 * KST(Asia/Seoul) 기준 "YYYY-MM-DD" 문자열 반환.
 * @param d 기준 Date (default: 현재 시각)
 */
export function getKSTDateString(d: Date = new Date()): string {
  // en-CA locale은 ISO 8601 형식(YYYY-MM-DD)을 보장.
  // timeZone 명시로 KST 기준 산출.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
