/**
 * 서버 시작 시 프로세스 타임존을 **UTC** 로 고정한다.
 *
 * ★방향 주의 — 직관과 반대다. "한국 서비스니까 KST" 가 아니다.
 *
 * 이 엔진이 쓰는 @gracefullight/saju 는 "한국 벽시계를 UTC 인 척 인코딩한" 공간에서
 * 계산한다. date-fns 어댑터의 필드 getter 가 넘긴 timeZone 을 무시하고 **프로세스
 * 로컬 필드**를 읽고(adapters/date-fns.js:34-40), 절기 탐색은 그 필드를 UTC 로 간주해
 * 태양황경을 푼다(core/four-pillars.js:56-88). 따라서 프로세스가 UTC 여야
 * `new Date(y, m-1, d, h, min)` 의 필드(=한국 벽시계)와 인스턴트가 같은 공간에 놓이고
 * 절기 시각이 천문학적으로 맞는다.
 *
 * 실측 대조 (발행 만세력 vs 라이브러리, 벽시계 규약 환산):
 *   1990 청명  발행 4/5 10:12  → UTC런 10:09 ✅ / KST런 9시간 어긋남 ❌
 *   1990 입하  발행 5/6 03:35  → UTC런 03:32 ✅
 *   1999 입하  발행 5/6 08:00  → UTC런 07:57 ✅
 * (오차 2~3분은 Meeus 근사 범위)
 *
 * KST 로 돌리면 무슨 일이 나는가 — 절기 시각이 9시간 밀려 절입 경계 출생자의
 * **월주가 뒤집히고**(실측: 1990-05-06 01:00 → UTC 庚辰(정답, 입하 03:35 전) vs
 * KST 辛巳(오답)) **대운수도 어긋난다**(39건 중 5건).
 *
 * Vercel 은 이미 UTC 라 프로덕션에선 사실상 no-op 이지만, 명시적으로 박아
 * (1) 배포 환경이 바뀌어도 안전하고 (2) 개발자 맥(KST)에서 `next dev` 가 프로덕션과
 * 다른 값을 내는 사고를 막는다.
 *
 * ※ `TZ` 는 Vercel 예약 환경변수라 프로젝트 설정으로는 못 넣는다(2026-08-06 실측).
 *   그래서 코드로 박는다.
 * ※ Edge 런타임은 TZ 변경 미지원. 사주 계산은 전부 Node 런타임 API 라우트다
 *   (`runtime = "edge"` 전수 grep 0건).
 * ※ ★scripts/*.mts 는 이 훅을 안 거친다. KST 맥에서 감사 스크립트를 돌리면
 *   프로덕션과 다른 값이 나온다 — 반드시 `TZ=UTC npx tsx scripts/...` 로 실행할 것.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.TZ === "UTC") return;
  process.env.TZ = "UTC";
}
