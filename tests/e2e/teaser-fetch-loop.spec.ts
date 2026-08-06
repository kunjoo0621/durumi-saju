import { test, expect, type Page } from "@playwright/test";

// 2026-07-29 무한 fetch 루프 회귀 방지.
//
// 사고: /career/teaser의 teaser fetch effect가 selfInput "객체 참조"에 걸려 있었고,
// useAllInputs가 인라인 selector라 렌더마다 새 참조를 돌려줬다. 응답을 저장하는
// setTeaserFacts가 매번 새 객체(JSON.parse 산물)라 리렌더를 무조건 유발했고,
// 그 리렌더가 다시 새 참조를 만들어 effect를 재실행시켰다 — 종료 조건이 없다.
// 단일 유저 탭 하나가 5분간 /api/career/start에 22,674건(초당 ~76회)을 쐈다.
//
// 이 스펙이 못박는 것:
//   1) 정상 진입 시 start는 정확히 1회 — 루프가 죽었는지
//   2) 에러 응답에서도 start는 1회 — 기존 코드는 error↔loading 진동으로 에러 경로도 루프였다
//      (이게 "429만 던져도 클라이언트 루프가 죽는다"가 틀린 이유)
//   3) "다시 시도"는 정확히 1회만 더 — 가드가 막다른 화면을 만들지 않으면서 루프도 안 연다
//
// wealth/marriage teaser는 동일 코드 미러라 career로 대표 검증한다.

const MOCK_SESSION = {
  user: { name: "테스트유저", email: "test@test.com", image: null },
  expires: "2099-12-31T23:59:59.999Z",
};

const SELF_INPUT = {
  name: "테스트",
  birthYear: "1995",
  birthMonth: "6",
  birthDay: "21",
  calendarType: "solar",
  birthHour: "10",
  birthMinute: "30",
  birthLocation: "서울",
  gender: "남성",
  relationshipStatus: "",
  employmentStatus: "",
  coreFearAxis: "",
  unknownBirthTime: false,
};

const TEASER_OK = {
  ok: true,
  resultId: "00000000-0000-0000-0000-000000000001",
  // 등급 필드 없음: 결제 전에는 서버가 grade를 스트립한다(app/api/career/start/route.ts).
  teaser: { gwanseongType: "정관우세", situation: "진로 탐색" },
  alreadyUnlocked: false,
};

/** 인증 + 잔액 모킹, 그리고 persist 스토어에 생년월일·상황을 심어 teaser 진입 조건을 만든다. */
async function setupTeaserPage(page: Page) {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: MOCK_SESSION }));
  await page.route("**/api/auth/csrf", (route) =>
    route.fulfill({ json: { csrfToken: "test-csrf" } }),
  );
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({ json: { kakao: { id: "kakao", name: "Kakao" } } }),
  );
  await page.route("**/api/coins/balance", (route) => route.fulfill({ json: { balance: 100 } }));

  await page.addInitScript(
    ([input, situation]) => {
      localStorage.setItem("saju-input-store", JSON.stringify({ state: input, version: 0 }));
      localStorage.setItem(
        "saju-career-store",
        JSON.stringify({ state: { situation }, version: 0 }),
      );
    },
    [SELF_INPUT, "진로 탐색"] as const,
  );
}

test.describe("teaser 무한 fetch 루프 회귀", () => {
  test("정상 진입: /api/career/start를 정확히 1회만 호출한다", async ({ page }) => {
    let startCalls = 0;
    await setupTeaserPage(page);
    await page.route("**/api/career/start", (route) => {
      startCalls++;
      route.fulfill({ json: TEASER_OK });
    });

    await page.goto("/career/teaser");

    // 등급이 화면에 뜰 때까지 = teaser 로드 완료
    await expect(page.locator("text=커리어운 ?등급")).toBeVisible({ timeout: 30_000 });

    // 루프였다면 이 대기 동안 수백~수천 건이 쌓인다(사고 당시 초당 ~76회).
    await page.waitForTimeout(5_000);

    expect(startCalls, `start 호출 ${startCalls}회 — 1회여야 한다`).toBe(1);
  });

  test("에러 응답: 재시도 루프에 빠지지 않고 1회로 멈춘다", async ({ page }) => {
    let startCalls = 0;
    await setupTeaserPage(page);
    await page.route("**/api/career/start", (route) => {
      startCalls++;
      route.fulfill({ status: 500, json: { error: "일시적 오류야." } });
    });

    await page.goto("/career/teaser");

    await expect(page.locator("text=일시적 오류야.")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(5_000);

    // 기존 코드는 setTeaserState("loading")이 effect 시작 시 무조건 실행돼 에러 상태에서도
    // error→loading 전이가 상태 변경으로 잡혀 리렌더를 유발했다 → 에러 경로도 루프였다.
    expect(startCalls, `에러 시 start 호출 ${startCalls}회 — 1회여야 한다`).toBe(1);
  });

  test("에러 후 '다시 시도': 정확히 1회만 더 호출한다", async ({ page }) => {
    let startCalls = 0;
    let failFirst = true;
    await setupTeaserPage(page);
    await page.route("**/api/career/start", (route) => {
      startCalls++;
      if (failFirst) {
        failFirst = false;
        return route.fulfill({ status: 500, json: { error: "일시적 오류야." } });
      }
      route.fulfill({ json: TEASER_OK });
    });

    await page.goto("/career/teaser");
    await expect(page.locator("text=일시적 오류야.")).toBeVisible({ timeout: 30_000 });

    // 가드가 막다른 화면을 만들지 않는지 — 재시도 수단이 실제로 있어야 한다.
    const retry = page.locator("button:has-text('다시 시도')");
    await expect(retry).toBeVisible();
    await retry.click();

    await expect(page.locator("text=커리어운 ?등급")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(5_000);

    expect(startCalls, `재시도 포함 start 호출 ${startCalls}회 — 2회여야 한다`).toBe(2);
  });

  // wealth/marriage는 career와 코드가 미러다. "미러니까 괜찮다"고 단정하지 않고 실제로 센다.
  const MIRRORS = [
    { path: "/wealth", storeKey: "saju-wealth-store", field: "interest", value: "목돈·노후 준비" },
    { path: "/marriage", storeKey: "saju-marriage-store", field: "maritalStatus", value: "솔로" },
  ] as const;

  for (const m of MIRRORS) {
    test(`미러 ${m.path}/teaser: start를 정확히 1회만 호출한다`, async ({ page }) => {
      let startCalls = 0;
      await page.route("**/api/auth/session", (route) => route.fulfill({ json: MOCK_SESSION }));
      await page.route("**/api/auth/csrf", (route) =>
        route.fulfill({ json: { csrfToken: "test-csrf" } }),
      );
      await page.route("**/api/auth/providers", (route) =>
        route.fulfill({ json: { kakao: { id: "kakao", name: "Kakao" } } }),
      );
      await page.route("**/api/coins/balance", (route) => route.fulfill({ json: { balance: 100 } }));
      await page.addInitScript(
        ([input, storeKey, field, value]) => {
          localStorage.setItem("saju-input-store", JSON.stringify({ state: input, version: 0 }));
          localStorage.setItem(
            storeKey as string,
            JSON.stringify({ state: { [field as string]: value }, version: 0 }),
          );
        },
        [SELF_INPUT, m.storeKey, m.field, m.value] as const,
      );
      await page.route(`**/api${m.path}/start`, (route) => {
        startCalls++;
        route.fulfill({ json: { ok: true, resultId: "x", teaser: {} } });
      });

      await page.goto(`${m.path}/teaser`);
      // 루프였다면 이 대기 동안 수천 건이 쌓인다(수정 전 실측: 15초에 5,709건).
      await page.waitForTimeout(10_000);

      expect(startCalls, `${m.path}/start 호출 ${startCalls}회 — 1회여야 한다`).toBe(1);
    });
  }
});
