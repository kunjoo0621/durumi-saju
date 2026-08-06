/**
 * 서버 시작 시 프로세스 타임존을 한국(KST)으로 고정한다.
 *
 * 왜 코드로 하는가 — Vercel 은 `TZ` 를 **예약 환경변수**로 잡아 두어 프로젝트
 * 환경변수로 설정할 수 없다(2026-08-06 실측: 대시보드에서 이름이 거부됨).
 * 그래서 런타임에서 직접 박는다. Node 는 process.env.TZ 가 바뀌면 이후 Date
 * 해석에 즉시 반영한다(실측: TZ=UTC 로 띄운 프로세스에서 변경 후
 * `new Date(1996,1,27,6,0)` 이 KST 인스턴트와 정확히 일치).
 *
 * 왜 필요한가 — 엔진은 출생 시각을 `new Date(y, m-1, d, h, min)`(로컬 TZ 해석)로
 * 만드는데(lib/utils/saju.ts · saju-fortune.ts), @gracefullight/saju 가 이 값을
 * 대운수 계산에서 **절대 인스턴트**로 써서 절기 밀리초와 뺄셈한다(core/luck.js:9-17).
 * 절기 시각은 천문 계산이라 TZ 무관인데 출생 인스턴트만 9시간 밀려, UTC 로 돌면
 * 절입 경계 출생자의 대운수가 1살 어긋난다(실측 39건 중 5건).
 * 원국 4기둥은 어댑터가 로컬 '필드'를 읽어 TZ 무관 — 대운수만 영향받는다.
 *
 * ※ Edge 런타임은 TZ 변경을 지원하지 않지만, 사주 계산은 전부 Node 런타임
 *   API 라우트에서 돈다. 그래서 nodejs 일 때만 적용한다.
 * ※ 이미 KST 인 환경(운영자 맥·CI)에서는 같은 값을 다시 넣는 no-op 이다.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.TZ === "Asia/Seoul") return;
  process.env.TZ = "Asia/Seoul";
}
