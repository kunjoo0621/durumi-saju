// today 도메인 공유 상수
// TODAY_COST는 lib/constants/coins.ts (결제 도메인) 그대로 유지.

/**
 * 오늘의 운세 분석 진행 단계 (~90초)
 * - TodayEntryClient handleStart (분석 시작 직후)
 * - TodayInputPage runTodayFlow (입력 끝 결제 직후)
 * - TodayResultClient polling (결과 페이지 진입 후 pending 상태)
 * 세 흐름이 동일 단계 메시지를 공유 → 사용자 경험 연속성.
 */
export const TODAY_LOADING_STEPS: Array<{ message: string; delay: number }> = [
  { message: "사주 데이터를 계산하고 있어", delay: 0 },
  { message: "오늘 일진과 너의 사주를 매칭하는 중", delay: 8_000 },
  { message: "두루미가 오늘 너의 하루를 읽는 중", delay: 30_000 },
  { message: "결과를 정리하고 있어", delay: 70_000 },
];
