import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 사주 엔진의 **전제 조건** 테스트 — 프로세스 타임존이 Asia/Seoul 이어야 한다.
 *
 * 왜 필요한가 (2026-08-06 독립 검수에서 발견):
 * 엔진은 출생 시각을 `new Date(year, month-1, day, hour, minute)` 로 만든다
 * (lib/utils/saju.ts:322 · lib/utils/saju-fortune.ts:98). 이건 **프로세스 로컬 TZ**로
 * 해석되는 생성자다. 그런데 @gracefullight/saju 는 이 값을 두 가지로 나눠 쓴다:
 *
 *  - 원국 4기둥: date-fns 어댑터가 `getYear/getMonth/getHour(d.date)` 로 **로컬 필드**를
 *    읽는다(adapters/date-fns.js:34-39 — timeZone 필드는 쓰지 않는다).
 *    → 어떤 TZ에서든 넣은 값이 그대로 나와 TZ 무관하다.
 *  - 대운수: `adapter.toMillis(birthDateTime)` 로 **절대 인스턴트**를 얻어 절기 밀리초와
 *    뺄셈한다(core/luck.js:9-17). 절기 시각은 천문 계산이라 TZ 무관인데,
 *    출생 인스턴트만 TZ에 따라 9시간 움직인다. → 절입 경계 사용자의 대운수가 1살 어긋난다.
 *
 * 실측: 결혼운 39건을 TZ=Asia/Seoul 과 TZ=UTC 로 각각 재계산하니 4기둥은 39/39 동일,
 * 대운수는 **5건(13%)이 1살 차이**였다(1999-04-10 22:40 → 8 vs 9 등).
 * 사용자는 한국 벽시계 시각을 입력하므로 KST 해석이 맞고, UTC로 도는 프로덕션이 틀렸다.
 *
 * 근본 해결은 호출부마다 날짜를 갈아끼우는 게 아니다 — 라이브러리가 로컬 필드 의미와
 * 절대 인스턴트 의미를 섞어 쓰기 때문에(core/solar-terms.js:153-155 가 한 함수 안에서
 * 둘 다 쓴다) 부분 패치는 깨지기 쉽다. 코드가 이미 `timeZone: "Asia/Seoul"` 로 선언한
 * 전제를 **프로세스에 고정**하는 게 맞다. 이 테스트가 그 고정을 강제한다.
 *
 * 깨졌다면: 실행 환경 TZ를 Asia/Seoul 로 맞춰라.
 *  - CI·로컬: .github/workflows/test.yml 의 env.TZ (또는 셸에서 TZ=Asia/Seoul)
 *  - 프로덕션: instrumentation.ts 가 서버 기동 시 process.env.TZ 를 박는다.
 *    ★Vercel 은 TZ 를 **예약 환경변수**로 잡아 프로젝트 설정으로는 넣을 수 없다
 *      (2026-08-06 실측: 대시보드가 이름을 거부). 그래서 코드로 박는다.
 */
test("프로세스 TZ가 Asia/Seoul이라 출생 시각이 KST 인스턴트로 만들어진다", () => {
  // 한국 벽시계 1996-02-27 06:00 의 진짜 인스턴트 = UTC 1996-02-26 21:00
  const wallClock = new Date(1996, 1, 27, 6, 0).getTime();
  const kstInstant = Date.UTC(1996, 1, 27, 6, 0) - 9 * 60 * 60 * 1000;
  assert.equal(
    wallClock,
    kstInstant,
    `프로세스 TZ가 Asia/Seoul이 아니다(현재 offset ${-new Date(1996, 1, 27).getTimezoneOffset() / 60}h). ` +
      "대운수가 절입 경계에서 1살 어긋난다. TZ=Asia/Seoul 을 설정하라.",
  );
});
