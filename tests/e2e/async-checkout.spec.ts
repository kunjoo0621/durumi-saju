import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const TEST_RESULT_ID = "e2e-async-test-0001";

const MOCK_SESSION = {
  user: { name: "테스트유저", email: "test@test.com", image: null },
  expires: "2099-12-31T23:59:59.999Z",
};

const MOCK_FULL_RESULT = {
  result: {
    tier: {
      grade: "A",
      composite: 82,
      percentileRank: 88,
      topPercent: 12,
      title: "테스트 운세",
      description: "테스트 설명",
    },
    scores: { 재물운: 75, 연애운: 80, 직장운: 85, 건강운: 70, 대인운: 78 },
    sections: [
      { icon: "🌟", title: "종합 해석", content: "E2E 테스트 분석 결과입니다." },
      { icon: "💰", title: "재물운 분석", content: "재물운 테스트 내용입니다." },
    ],
    coreFearAxisBlock: "선택한 고민: 인간관계\n\n테스트 분석 내용",
    scoringVersion: 11,
  },
  resultId: TEST_RESULT_ID,
  unlockedAt: new Date().toISOString(),
  access: "user",
  is_guest: false,
  input: {
    name: "두루미",
    birthDate: "1995-06-21",
    birthTime: null,
    region: "서울",
    gender: "남성",
    relationshipStatus: "솔로",
    employmentStatus: "직장인",
    calendarType: "solar",
    coreFearAxis: "DISMISS",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 결과 페이지에서 사용하는 API를 모두 mock 처리.
 * progressResponses: poll 호출 순서대로 반환할 응답 배열 (마지막 값이 반복)
 */
async function setupResultMocks(
  page: Page,
  opts: {
    progressResponses?: Array<{ status: string; refunded?: boolean }>;
    fullFirstPending?: boolean;
    fullFailAfterPending?: boolean;
  } = {},
) {
  const {
    progressResponses = [{ status: "completed" }],
    fullFirstPending = false,
    fullFailAfterPending = false,
  } = opts;

  let progressIdx = 0;
  let fullCallCount = 0;

  // Auth session → 인증된 유저
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: MOCK_SESSION }),
  );

  // CSRF (NextAuth 내부 호출)
  await page.route("**/api/auth/csrf", (route) =>
    route.fulfill({ json: { csrfToken: "test-csrf" } }),
  );

  // providers (NextAuth)
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({ json: { kakao: { id: "kakao", name: "Kakao" } } }),
  );

  // Analyze → 항상 성공 (실제 LLM 호출 방지)
  await page.route("**/api/results/analyze", (route) =>
    route.fulfill({ json: { status: "completed" } }),
  );

  // Progress → 순차 응답
  await page.route("**/api/results/progress**", (route) => {
    const idx = Math.min(progressIdx, progressResponses.length - 1);
    progressIdx++;
    route.fulfill({ json: progressResponses[idx] });
  });

  // Results/full → 조건부 응답
  await page.route("**/api/results/full", (route) => {
    fullCallCount++;
    if (fullFirstPending && fullCallCount === 1) {
      return route.fulfill({
        status: 202,
        json: { pending: true, resultId: TEST_RESULT_ID },
      });
    }
    if (fullFailAfterPending) {
      return route.fulfill({
        status: 500,
        json: { error: "분석에 실패했습니다.", failed: true, refunded: true },
      });
    }
    route.fulfill({ json: MOCK_FULL_RESULT });
  });
}

/**
 * /start 7단계 입력 폼
 */
async function fillStartForm(page: Page) {
  await page.locator('input[aria-label="이름"]').fill("두루미");
  await page.locator(".btn-primary:has-text('다음')").click();

  await page.locator("#birthDate").fill("19950621");
  const unknownTimeBtn = page.locator("button:has-text('태어난 시간을 몰라요')");
  if ((await unknownTimeBtn.getAttribute("aria-pressed")) !== "true") {
    await unknownTimeBtn.click();
  }
  await page.locator(".btn-primary:has-text('다음')").click();

  await page.locator('[aria-label="출생 지역"] button:has-text("서울")').click();
  await page.locator(".btn-primary:has-text('다음')").click();

  await page.locator('[aria-label="성별"] button:has-text("남성")').click();
  await page.locator(".btn-primary:has-text('다음')").click();

  await page.locator('[aria-label="연애 상태"] button:has-text("솔로")').click();
  await page.locator(".btn-primary:has-text('다음')").click();

  await page.locator('[aria-label="현재 상태"] button:has-text("직장인")').click();
  await page.locator(".btn-primary:has-text('다음')").click();

  await page.locator('[aria-label="핵심 공포 축"] button:has-text("인간관계")').click();
  await page.locator(".btn-primary:has-text('결과 받기')").click();
}

/**
 * /teaser 페이지에서 인증 + 코인 mock 세팅 후 결제 버튼 클릭
 */
async function setupTeaserAndPay(page: Page, opts: { existingResultId?: string } = {}) {
  // Coin balance
  await page.route("**/api/coins/balance", (route) =>
    route.fulfill({ json: { balance: 100 } }),
  );

  // Intake session 생성
  await page.route("**/api/intake/session", (route) =>
    route.fulfill({
      json: {
        sessionId: "test-session-001",
        ...(opts.existingResultId ? { existingResultId: opts.existingResultId } : {}),
      },
    }),
  );

  // Spend → pending 반환
  await page.route("**/api/coins/spend", (route) =>
    route.fulfill({
      json: {
        ok: true,
        resultId: TEST_RESULT_ID,
        balance: 95,
        pending: true,
      },
    }),
  );

  // 티저 페이지 도달 대기
  await page.waitForURL("**/teaser**", { timeout: 15_000 });

  // "N알로 전체 결과 보기" 버튼 대기 + 클릭
  const payBtn = page.locator('.btn-primary:has-text("알로 전체 결과 보기")');
  await expect(payBtn).toBeVisible({ timeout: 15_000 });
  await expect(payBtn).toBeEnabled({ timeout: 10_000 });
  await payBtn.click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("비동기 체크아웃 → 결과 전환", () => {
  test("pending → polling → 결과 표시 정상 전환", async ({ page }) => {
    // Progress: 처음 2번은 pending, 3번째에 completed
    await setupResultMocks(page, {
      progressResponses: [
        { status: "pending" },
        { status: "pending" },
        { status: "completed" },
      ],
    });

    await page.goto(`/result?resultId=${TEST_RESULT_ID}&pending=true`);

    // 1) 로딩 애니메이션이 보여야 함
    await expect(
      page.locator("text=사주 데이터를 계산하고 있어"),
    ).toBeVisible({ timeout: 5_000 });

    // 2) Polling 완료 후 결과가 표시될 때까지 대기 — "결과 공유하기" 버튼으로 확인
    await expect(
      page.locator('button:has-text("결과 공유하기")'),
    ).toBeVisible({ timeout: 30_000 });

    // 3) 결과 내용 확인
    const body = await page.innerText("body");
    expect(body).toContain("E2E 테스트 분석 결과입니다.");

    await page.screenshot({ path: "tests/screenshots/async-pending-to-result.png" });
  });

  test("분석 실패 → 환불 안내 + 올바른 버튼 표시", async ({ page }) => {
    // Progress: 바로 failed 반환
    await setupResultMocks(page, {
      progressResponses: [{ status: "failed", refunded: true }],
    });

    await page.goto(`/result?resultId=${TEST_RESULT_ID}&pending=true`);

    // 1) 로딩 먼저 보임
    await expect(
      page.locator("text=사주 데이터를 계산하고 있어"),
    ).toBeVisible({ timeout: 5_000 });

    // 2) 실패 메시지 표시 대기
    await expect(
      page.locator("text=알은 환불됐으니 걱정마"),
    ).toBeVisible({ timeout: 30_000 });

    // 3) "다시 시도" 버튼은 없어야 함 (알이 환불됐으므로)
    await expect(page.locator("button:has-text('다시 시도')")).toBeHidden();

    // 4) "처음으로 돌아가기" 버튼만 있어야 함
    await expect(
      page.locator("button:has-text('처음으로 돌아가기')"),
    ).toBeVisible();

    // 5) "결제는 완료되었어요" 문구는 없어야 함 (환불이니까)
    const body = await page.innerText("body");
    expect(body).not.toContain("결제는 완료되었어요");

    await page.screenshot({ path: "tests/screenshots/async-failed-refund.png" });
  });

  test("페이지 새로고침 → 202 pending 복구 → 결과 표시", async ({ page }) => {
    await setupResultMocks(page, {
      fullFirstPending: true,
      progressResponses: [
        { status: "pending" },
        { status: "completed" },
      ],
    });

    // pending 파라미터 없이 접근 (새로고침 시뮬레이션)
    await page.goto(`/result?resultId=${TEST_RESULT_ID}`);

    // 1) 처음에는 일반 로딩 → 202 수신 → pending 로딩으로 전환
    await expect(
      page.locator("text=사주 데이터를 계산하고 있어"),
    ).toBeVisible({ timeout: 15_000 });

    // 2) Polling 완료 후 결과 표시 — "결과 공유하기" 버튼으로 확인
    await expect(
      page.locator('button:has-text("결과 공유하기")'),
    ).toBeVisible({ timeout: 30_000 });

    const body = await page.innerText("body");
    expect(body).toContain("E2E 테스트 분석 결과입니다.");

    await page.screenshot({ path: "tests/screenshots/async-refresh-recovery.png" });
  });

  test("Suspense fallback과 결과 로딩이 동일한 디자인", async ({ page }) => {
    await setupResultMocks(page, {
      progressResponses: [{ status: "completed" }],
    });

    // ResultClient JS chunk 로딩을 300ms 지연
    await page.route("**/_next/static/chunks/**ResultClient**", async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.continue();
    });

    await page.goto(`/result?resultId=${TEST_RESULT_ID}&pending=true`);

    const spinner = page.locator('[class*="spinner"], [class*="Spinner"]').first();
    await expect(spinner).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: "tests/screenshots/async-no-flicker.png" });
  });

  test("폼 입력 → 티저 → 결과 페이지 전체 플로우", async ({ page }) => {
    // Auth + result mocks
    await setupResultMocks(page, {
      progressResponses: [
        { status: "pending" },
        { status: "completed" },
      ],
    });

    // Coin balance
    await page.route("**/api/coins/balance", (route) =>
      route.fulfill({ json: { balance: 100 } }),
    );

    // Intake session 생성
    await page.route("**/api/intake/session", (route) =>
      route.fulfill({ json: { sessionId: "test-session-001" } }),
    );

    // Spend → pending 반환
    await page.route("**/api/coins/spend", (route) =>
      route.fulfill({
        json: {
          ok: true,
          resultId: TEST_RESULT_ID,
          balance: 95,
          pending: true,
        },
      }),
    );

    // 1) 폼 입력
    await page.goto("/start");
    await page.waitForLoadState("networkidle");
    await fillStartForm(page);

    // 2) 티저 페이지 도달
    await page.waitForURL("**/teaser**", { timeout: 15_000 });
    await page.screenshot({ path: "tests/screenshots/async-teaser-page.png" });

    // 3) "N알로 전체 결과 보기" 버튼 대기 + 클릭
    const payBtn = page.locator('.btn-primary:has-text("알로 전체 결과 보기")');
    await expect(payBtn).toBeVisible({ timeout: 15_000 });
    await expect(payBtn).toBeEnabled({ timeout: 10_000 });
    await payBtn.click();

    // 4) 결과 페이지로 이동
    await page.waitForURL("**/result**", { timeout: 15_000 });

    // 5) 결과 페이지의 pending 로딩 확인
    await expect(
      page.locator("text=사주 데이터를 계산하고 있어"),
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "tests/screenshots/async-result-loading.png" });

    // 6) 결과 표시 대기 — "결과 공유하기" 버튼으로 확인
    await expect(
      page.locator('button:has-text("결과 공유하기")'),
    ).toBeVisible({ timeout: 30_000 });

    const body = await page.innerText("body");
    expect(body).toContain("E2E 테스트 분석 결과입니다.");

    await page.screenshot({ path: "tests/screenshots/async-result-final.png" });
  });
});
