import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const TEST_RESULT_ID = "e2e-additional-0001";

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
      { icon: "🌟", title: "종합 해석", content: "E2E 추가 테스트 결과입니다." },
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

async function setupUnauthMocks(page: Page) {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: {} }),
  );
  await page.route("**/api/auth/csrf", (route) =>
    route.fulfill({ json: { csrfToken: "test-csrf" } }),
  );
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({ json: { kakao: { id: "kakao", name: "Kakao", type: "oauth", signinUrl: "/api/auth/signin/kakao", callbackUrl: "/api/auth/callback/kakao" } } }),
  );
}

async function setupAuthMocks(page: Page) {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: MOCK_SESSION }),
  );
  await page.route("**/api/auth/csrf", (route) =>
    route.fulfill({ json: { csrfToken: "test-csrf" } }),
  );
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({ json: { kakao: { id: "kakao", name: "Kakao" } } }),
  );
}

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

// ===========================================================================
// 1. 비로그인 시나리오
// ===========================================================================

test.describe("비로그인 시나리오", () => {
  test("비로그인 → 티저에서 '카카오로 로그인하기' 버튼 표시", async ({ page }) => {
    await setupUnauthMocks(page);

    await page.goto("/start");
    await page.waitForLoadState("networkidle");
    await fillStartForm(page);

    // 티저 페이지 도달
    await page.waitForURL("**/teaser**", { timeout: 15_000 });

    // 비로그인 → "카카오로 로그인하기" 버튼이 보여야 함
    await expect(
      page.locator('button:has-text("카카오로 로그인하기")'),
    ).toBeVisible({ timeout: 10_000 });

    // "알로 전체 결과 보기" 버튼은 없어야 함
    await expect(
      page.locator('button:has-text("알로 전체 결과 보기")'),
    ).toBeHidden();

    // 사주 원국은 표시되어야 함
    await expect(
      page.locator("text=사주 원국"),
    ).toBeVisible({ timeout: 10_000 });

    // "전체 사주를 보려면 로그인이 필요해" 문구
    await expect(
      page.locator("text=전체 사주를 보려면 로그인이 필요해"),
    ).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/unauth-teaser.png" });
  });

  test("비로그인 → 티저에서 로그인 버튼 클릭 시 카카오 로그인 트리거", async ({ page }) => {
    await setupUnauthMocks(page);

    // NextAuth signin 엔드포인트 감시
    let signinCalled = false;
    await page.route("**/api/auth/signin/kakao**", (route) => {
      signinCalled = true;
      // 실제 카카오 리다이렉트 대신 빈 페이지 반환
      route.fulfill({ status: 200, body: "<html><body>카카오 로그인</body></html>", contentType: "text/html" });
    });

    await page.goto("/start");
    await page.waitForLoadState("networkidle");
    await fillStartForm(page);

    await page.waitForURL("**/teaser**", { timeout: 15_000 });

    const loginBtn = page.locator('button:has-text("카카오로 로그인하기")');
    await expect(loginBtn).toBeVisible({ timeout: 10_000 });
    await loginBtn.click();

    // 카카오 로그인이 트리거되었는지 확인 (signin 엔드포인트 호출 또는 페이지 이동)
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    // signin 페이지로 이동했거나 API 호출이 있었으면 성공
    const loginTriggered = signinCalled || currentUrl.includes("signin") || currentUrl.includes("kakao");
    expect(loginTriggered).toBeTruthy();

    await page.screenshot({ path: "tests/screenshots/unauth-login-trigger.png" });
  });

  test("비로그인 → 메뉴 페이지에서 사주 카드 클릭 시 /start로 이동", async ({ page }) => {
    await setupUnauthMocks(page);

    await page.goto("/menu");
    await page.waitForLoadState("networkidle");

    // 사주 카드 클릭
    const sajuCard = page.locator('text=내 사주 보러가기');
    await expect(sajuCard).toBeVisible({ timeout: 10_000 });
    await sajuCard.click();

    // 비로그인이면 /start로 이동
    await page.waitForURL("**/start**", { timeout: 10_000 });
    await page.screenshot({ path: "tests/screenshots/unauth-menu-to-start.png" });
  });

  test("비로그인 → 반려동물 궁합 카드 클릭 시 아무 동작 없음", async ({ page }) => {
    await setupUnauthMocks(page);

    await page.goto("/menu");
    await page.waitForLoadState("networkidle");

    const beforeUrl = page.url();

    // 반려동물 궁합 카드 클릭 시도
    const petCard = page.locator("text=반려동물 궁합 보기");
    await expect(petCard).toBeVisible({ timeout: 10_000 });
    await petCard.click();

    // URL 변경 없어야 함 (비활성 카드)
    await page.waitForTimeout(1000);
    expect(page.url()).toBe(beforeUrl);

    // "준비중" 태그 확인
    await expect(page.locator("text=준비중").first()).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/unauth-pet-disabled.png" });
  });
});

// ===========================================================================
// 2. 잔액 부족 시나리오
// ===========================================================================

test.describe("잔액 부족 시나리오", () => {
  test("잔액 부족 → 충전 바텀시트 표시", async ({ page }) => {
    await setupAuthMocks(page);

    // 잔액 0
    await page.route("**/api/coins/balance", (route) =>
      route.fulfill({ json: { balance: 0 } }),
    );

    // intake session
    await page.route("**/api/intake/session", (route) =>
      route.fulfill({ json: { sessionId: "test-session-001" } }),
    );

    // spend → 잔액 부족
    await page.route("**/api/coins/spend", (route) =>
      route.fulfill({
        json: { insufficient: true, balance: 0 },
      }),
    );

    await page.goto("/start");
    await page.waitForLoadState("networkidle");
    await fillStartForm(page);

    // 티저 도달
    await page.waitForURL("**/teaser**", { timeout: 15_000 });

    // 결제 버튼 클릭
    const payBtn = page.locator('.btn-primary:has-text("알로 전체 결과 보기")');
    await expect(payBtn).toBeVisible({ timeout: 15_000 });
    await expect(payBtn).toBeEnabled({ timeout: 10_000 });
    await payBtn.click();

    // 충전 바텀시트가 열려야 함 — visible한 dialog 내의 텍스트로 확인
    const dialog = page.locator('div[role="dialog"]:visible');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.locator("text=알이 부족해!")).toBeVisible();

    // "N알 더 필요해" 문구 확인
    await expect(dialog.locator("text=알 더 필요해")).toBeVisible();

    // 충전 패키지 카드들이 보여야 함
    await expect(dialog.locator("text=기본")).toBeVisible();
    await expect(dialog.locator("text=인기")).toBeVisible();
    await expect(dialog.locator("text=알뜰")).toBeVisible();

    // "충전한 알은 1년간 유효합니다" 안내 문구
    await expect(dialog.locator("text=충전한 알은 1년간 유효합니다")).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/insufficient-balance-sheet.png" });
  });

  test("잔액 부족 → 바텀시트 닫기 가능", async ({ page }) => {
    await setupAuthMocks(page);

    await page.route("**/api/coins/balance", (route) =>
      route.fulfill({ json: { balance: 0 } }),
    );
    await page.route("**/api/intake/session", (route) =>
      route.fulfill({ json: { sessionId: "test-session-001" } }),
    );
    await page.route("**/api/coins/spend", (route) =>
      route.fulfill({ json: { insufficient: true, balance: 0 } }),
    );

    await page.goto("/start");
    await page.waitForLoadState("networkidle");
    await fillStartForm(page);

    await page.waitForURL("**/teaser**", { timeout: 15_000 });

    const payBtn = page.locator('.btn-primary:has-text("알로 전체 결과 보기")');
    await expect(payBtn).toBeVisible({ timeout: 15_000 });
    await expect(payBtn).toBeEnabled({ timeout: 10_000 });
    await payBtn.click();

    // 바텀시트 열림 확인
    const dialog = page.locator('div[role="dialog"]:visible');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.locator("text=알이 부족해!")).toBeVisible();

    // 닫기 버튼 클릭 (X 버튼)
    const closeBtn = dialog.locator("button").first();
    await closeBtn.click();

    // 바텀시트 닫힘 확인
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // 티저 페이지에 여전히 있어야 함
    expect(page.url()).toContain("/teaser");

    await page.screenshot({ path: "tests/screenshots/insufficient-balance-close.png" });
  });
});

// ===========================================================================
// 3. 모바일 뷰포트 시나리오
// ===========================================================================

test.describe("모바일 뷰포트", () => {
  test.use({
    viewport: { width: 375, height: 812 }, // iPhone X
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
  });

  test("모바일 → 메뉴 페이지 레이아웃 정상", async ({ page }) => {
    await setupAuthMocks(page);

    await page.goto("/menu");
    await page.waitForLoadState("networkidle");

    // 3개 카드 모두 보여야 함
    await expect(page.locator("text=내 사주 보러가기")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=사주 배틀 하러가기")).toBeVisible();
    await expect(page.locator("text=반려동물 궁합 보기")).toBeVisible();

    // 카드가 화면을 넘치지 않는지 확인
    const menuCard = page.locator("text=내 사주 보러가기").locator("..").locator("..");
    const box = await menuCard.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(375);
    }

    await page.screenshot({ path: "tests/screenshots/mobile-menu.png" });
  });

  test("모바일 → 폼 입력 정상 작동", async ({ page }) => {
    await setupUnauthMocks(page);

    await page.goto("/start");
    await page.waitForLoadState("networkidle");

    // 이름 입력
    const nameInput = page.locator('input[aria-label="이름"]');
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("모바일유저");
    await page.locator(".btn-primary:has-text('다음')").click();

    // 생년월일 입력
    await page.locator("#birthDate").fill("20000101");
    const unknownTimeBtn = page.locator("button:has-text('태어난 시간을 몰라요')");
    if ((await unknownTimeBtn.getAttribute("aria-pressed")) !== "true") {
      await unknownTimeBtn.click();
    }
    await page.locator(".btn-primary:has-text('다음')").click();

    // 지역 선택
    await page.locator('[aria-label="출생 지역"] button:has-text("서울")').click();
    await page.locator(".btn-primary:has-text('다음')").click();

    // 성별 선택
    await page.locator('[aria-label="성별"] button:has-text("여성")').click();
    await page.locator(".btn-primary:has-text('다음')").click();

    // 여기까지 왔으면 폼이 모바일에서 정상 작동
    await expect(page.locator('[aria-label="연애 상태"]')).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: "tests/screenshots/mobile-form.png" });
  });

  test("모바일 → 티저 페이지 레이아웃 정상", async ({ page }) => {
    await setupUnauthMocks(page);

    await page.goto("/start");
    await page.waitForLoadState("networkidle");
    await fillStartForm(page);

    await page.waitForURL("**/teaser**", { timeout: 15_000 });

    // 사주 원국 표시
    await expect(page.locator("text=사주 원국")).toBeVisible({ timeout: 10_000 });

    // CTA 버튼 표시
    await expect(
      page.locator('button:has-text("카카오로 로그인하기")'),
    ).toBeVisible({ timeout: 10_000 });

    // 전체 페이지가 가로 스크롤 없이 표시되는지 확인
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);

    await page.screenshot({ path: "tests/screenshots/mobile-teaser.png" });
  });

  test("모바일 → 코인 페이지 (미인증) → 랜딩으로 리다이렉트", async ({ page }) => {
    // /coins는 middleware에서 서버사이드 JWT 검증 → 미인증 시 / 로 리다이렉트
    await page.goto("/coins");
    await page.waitForLoadState("networkidle");

    // 랜딩 페이지로 리다이렉트되어야 함
    expect(page.url()).toContain("returnTo");

    // 크래시 없이 랜딩 페이지 렌더링
    const bodyText = await page.innerText("body");
    expect(bodyText.length).toBeGreaterThan(0);

    await page.screenshot({ path: "tests/screenshots/mobile-coins-redirect.png" });
  });
});

// ===========================================================================
// 4. API 에러 시나리오
// ===========================================================================

test.describe("API 에러 시나리오", () => {
  test("intake/session 실패 → 에러 메시지 표시 + 결제 버튼 비활성", async ({ page }) => {
    await setupAuthMocks(page);

    await page.route("**/api/coins/balance", (route) =>
      route.fulfill({ json: { balance: 100 } }),
    );

    // intake session 실패
    await page.route("**/api/intake/session", (route) =>
      route.fulfill({ status: 500, json: { error: "서버 오류" } }),
    );

    await page.goto("/start");
    await page.waitForLoadState("networkidle");
    await fillStartForm(page);

    await page.waitForURL("**/teaser**", { timeout: 15_000 });

    // 결제 버튼이 disabled 상태여야 함 (sessionId가 없으므로)
    const payBtn = page.locator('.btn-primary:has-text("준비 중...")');
    await expect(payBtn).toBeVisible({ timeout: 15_000 });
    await expect(payBtn).toBeDisabled();

    await page.screenshot({ path: "tests/screenshots/api-error-intake.png" });
  });

  test("coins/spend 서버 에러 → 에러 메시지 표시", async ({ page }) => {
    await setupAuthMocks(page);

    await page.route("**/api/coins/balance", (route) =>
      route.fulfill({ json: { balance: 100 } }),
    );
    await page.route("**/api/intake/session", (route) =>
      route.fulfill({ json: { sessionId: "test-session-001" } }),
    );

    // spend → 500 에러
    await page.route("**/api/coins/spend", (route) =>
      route.fulfill({
        status: 500,
        json: { error: "처리에 실패했습니다." },
      }),
    );

    await page.goto("/start");
    await page.waitForLoadState("networkidle");
    await fillStartForm(page);

    await page.waitForURL("**/teaser**", { timeout: 15_000 });

    const payBtn = page.locator('.btn-primary:has-text("알로 전체 결과 보기")');
    await expect(payBtn).toBeVisible({ timeout: 15_000 });
    await expect(payBtn).toBeEnabled({ timeout: 10_000 });
    await payBtn.click();

    // 에러 메시지 표시
    await expect(
      page.locator("text=처리에 실패했습니다."),
    ).toBeVisible({ timeout: 10_000 });

    // 티저 페이지에 여전히 있어야 함 (결과 페이지로 이동 안 됨)
    expect(page.url()).toContain("/teaser");

    await page.screenshot({ path: "tests/screenshots/api-error-spend.png" });
  });

  test("coins/spend 환불 응답 → 환불 에러 메시지 표시", async ({ page }) => {
    await setupAuthMocks(page);

    await page.route("**/api/coins/balance", (route) =>
      route.fulfill({ json: { balance: 100 } }),
    );
    await page.route("**/api/intake/session", (route) =>
      route.fulfill({ json: { sessionId: "test-session-001" } }),
    );

    // spend → 실패 + 환불
    await page.route("**/api/coins/spend", (route) =>
      route.fulfill({
        status: 500,
        json: { error: "분석 실패", refunded: true },
      }),
    );

    await page.goto("/start");
    await page.waitForLoadState("networkidle");
    await fillStartForm(page);

    await page.waitForURL("**/teaser**", { timeout: 15_000 });

    const payBtn = page.locator('.btn-primary:has-text("알로 전체 결과 보기")');
    await expect(payBtn).toBeVisible({ timeout: 15_000 });
    await expect(payBtn).toBeEnabled({ timeout: 10_000 });
    await payBtn.click();

    // 환불 관련 에러 메시지
    await expect(
      page.locator("text=환불"),
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "tests/screenshots/api-error-refund.png" });
  });

  test("네트워크 에러 → 코인 페이지 (미인증) → middleware가 차단하고 리다이렉트", async ({ page }) => {
    // /coins는 middleware 보호 라우트 → 서버사이드 JWT 없으면 / 로 리다이렉트
    // page.route()는 브라우저 요청만 mock → middleware 서버사이드 검증은 우회 불가
    await page.goto("/coins");
    await page.waitForLoadState("networkidle");

    // 랜딩 페이지로 리다이렉트 확인
    expect(page.url()).not.toContain("/coins");

    // 크래시 없이 렌더링
    const bodyText = await page.innerText("body");
    expect(bodyText.length).toBeGreaterThan(0);

    await page.screenshot({ path: "tests/screenshots/api-error-coins-redirect.png" });
  });

  test("results/full 500 에러 → 결과 페이지 에러 처리", async ({ page }) => {
    await setupAuthMocks(page);

    await page.route("**/api/results/full", (route) =>
      route.fulfill({
        status: 500,
        json: { error: "서버 에러" },
      }),
    );
    await page.route("**/api/results/analyze", (route) =>
      route.fulfill({ json: { status: "completed" } }),
    );

    await page.goto(`/result?resultId=${TEST_RESULT_ID}`);

    // 페이지가 크래시하지 않아야 함 — 에러 메시지 or 빈 상태 표시
    await page.waitForTimeout(5000);
    const bodyText = await page.innerText("body");
    // 크래시(빈 페이지)가 아닌 어떤 콘텐츠든 있어야 함
    expect(bodyText.length).toBeGreaterThan(0);

    await page.screenshot({ path: "tests/screenshots/api-error-results-full.png" });
  });
});

// ===========================================================================
// 5. 페이지 접근성 & 기본 렌더링
// ===========================================================================

test.describe("페이지 기본 렌더링", () => {
  test("랜딩 페이지 정상 로드", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const bodyText = await page.innerText("body");
    expect(bodyText.length).toBeGreaterThan(0);

    // 페이지 크래시 없음 확인
    await expect(page.locator("body")).not.toHaveText("Application error");

    await page.screenshot({ path: "tests/screenshots/landing-page.png" });
  });

  test("메뉴 페이지 → 3개 카드 정상 렌더링", async ({ page }) => {
    await setupAuthMocks(page);

    await page.goto("/menu");
    await page.waitForLoadState("networkidle");

    // 사주 카드
    await expect(page.locator("text=내 사주 보러가기")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=개인 분석")).toBeVisible();

    // 배틀 카드
    await expect(page.locator("text=사주 배틀 하러가기")).toBeVisible();
    await expect(page.locator("text=1:1 대결")).toBeVisible();

    // 반려동물 궁합 카드 (비활성)
    await expect(page.locator("text=반려동물 궁합 보기")).toBeVisible();
    await expect(page.locator("text=준비중").first()).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/menu-all-cards.png" });
  });

  test("존재하지 않는 페이지 → 404", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");

    // Next.js 404 처리
    expect(res?.status()).toBe(404);

    await page.screenshot({ path: "tests/screenshots/404-page.png" });
  });
});
