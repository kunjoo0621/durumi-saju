import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const TEST_RESULT_ID = "e2e-late-login-0001";
const TEST_BATTLE_ID = "e2e-battle-0001";

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

const MOCK_BATTLE_FULL_RESULT = {
  playerA: {
    name: "두루미",
    tier: { grade: "A", composite: 82, percentileRank: 88, topPercent: 12, title: "테스트", description: "설명" },
    scores: { wealth: 75, love: 80, career: 85, health: 70, social: 78 },
  },
  playerB: {
    name: "홍길동",
    tier: { grade: "B", composite: 72, percentileRank: 65, topPercent: 35, title: "테스트B", description: "설명B" },
    scores: { wealth: 70, love: 85, career: 75, health: 65, social: 72 },
  },
  comparison: {
    matches: [
      { category: "wealth", scoreA: 75, scoreB: 70, winner: "A" as const, intensity: "close" as const, killingLine: "재물운 대결" },
      { category: "love", scoreA: 80, scoreB: 85, winner: "B" as const, intensity: "close" as const, killingLine: "연애운 대결" },
      { category: "career", scoreA: 85, scoreB: 75, winner: "A" as const, intensity: "dominant" as const, killingLine: "직장운 대결" },
      { category: "health", scoreA: 70, scoreB: 65, winner: "A" as const, intensity: "close" as const, killingLine: "건강운 대결" },
      { category: "social", scoreA: 78, scoreB: 72, winner: "A" as const, intensity: "close" as const, killingLine: "대인운 대결" },
    ],
    winsA: 4,
    winsB: 1,
    draws: 0,
    overallWinner: "A" as const,
    overallIntensity: "dominant" as const,
  },
  llmAnalysis: {
    heroQuip: "두루미의 압도적 승리!",
    categoryResults: {
      wealth: { killingLine: "재물운 테스트", detail: "재물운 상세" },
      love: { killingLine: "연애운 테스트", detail: "연애운 상세" },
      career: { killingLine: "직장운 테스트", detail: "직장운 상세" },
      health: { killingLine: "건강운 테스트", detail: "건강운 상세" },
      social: { killingLine: "대인운 테스트", detail: "대인운 상세" },
    },
    chemistry: {
      punchline: "테스트 궁합",
      analysis: "궁합 분석 내용",
      bonusScenarios: [],
    },
    finalVerdict: "최종 결론 테스트",
    simulations: [],
    futureTimeline: [],
  },
  relationshipType: "lover" as const,
};

const MOCK_BATTLE_RESULT = {
  result: MOCK_BATTLE_FULL_RESULT,
  battleId: TEST_BATTLE_ID,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock all common auth/coin APIs for authenticated user flow */
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
  await page.route("**/api/coins/balance", (route) =>
    route.fulfill({ json: { balance: 100 } }),
  );
}

/** Mock APIs for teaser → result flow (saju analysis) */
async function setupTeaserAnalysisMocks(page: Page, opts: { existingResultId?: string } = {}) {
  await page.route("**/api/intake/session", (route) =>
    route.fulfill({
      json: {
        sessionId: "test-session-001",
        ...(opts.existingResultId ? { existingResultId: opts.existingResultId } : {}),
      },
    }),
  );

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

  let progressCalls = 0;
  await page.route("**/api/results/progress**", (route) => {
    progressCalls++;
    route.fulfill({
      json: { status: progressCalls >= 2 ? "completed" : "pending" },
    });
  });

  await page.route("**/api/results/analyze", (route) =>
    route.fulfill({ json: { status: "completed" } }),
  );

  await page.route("**/api/results/full", (route) =>
    route.fulfill({ json: MOCK_FULL_RESULT }),
  );
}

/** Mock APIs for teaser → battle result flow */
async function setupTeaserBattleMocks(page: Page) {
  await page.route("**/api/intake/session", (route) =>
    route.fulfill({ json: { sessionId: "test-battle-session-001" } }),
  );

  await page.route("**/api/coins/spend", (route) =>
    route.fulfill({
      json: {
        ok: true,
        type: "battle",
        balance: 95,
      },
    }),
  );

  await page.route("**/api/battle/analyze", (route) =>
    route.fulfill({ json: MOCK_BATTLE_RESULT }),
  );

  // Battle result page fetches from /api/battles/{id}
  await page.route("**/api/battles/**", (route) =>
    route.fulfill({
      json: {
        battle: {
          id: TEST_BATTLE_ID,
          full_result: MOCK_BATTLE_FULL_RESULT,
          player_a_name: "두루미",
          player_b_name: "홍길동",
          relationship_type: "lover",
          created_at: new Date().toISOString(),
        },
      },
    }),
  );

  // Battle result page also calls /api/results/primary
  await page.route("**/api/results/primary", (route) =>
    route.fulfill({ json: { primaryResultId: null } }),
  );
}

/** /start 7-step form */
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

/** /battle/input form */
async function fillBattleForm(page: Page) {
  // 인증 유저 → selectMode 표시됨 → "새로 입력하기" 클릭
  await page.locator('button:has-text("새로 입력하기")').click();

  // --- Player A ---
  const nameA = page.locator('input[type="text"]');
  await nameA.waitFor({ state: "visible", timeout: 10_000 });
  await nameA.fill("두루미");
  await page.locator(".btn-primary:has-text('다음')").click();

  const birthA = page.locator('input[inputmode="numeric"]').first();
  await birthA.waitFor({ state: "visible", timeout: 10_000 });
  await birthA.fill("19950621");
  await page.locator("button:has-text('태어난 시간을 몰라요')").click();
  await page.locator(".btn-primary:has-text('다음')").click();

  await page.locator('button.btn-option:has-text("서울")').first().waitFor({ state: "visible", timeout: 10_000 });
  await page.locator('button.btn-option:has-text("서울")').first().click();
  await page.locator(".btn-primary:has-text('다음')").click();

  await page.locator('button.btn-option:has-text("남성")').waitFor({ state: "visible", timeout: 10_000 });
  await page.locator('button.btn-option:has-text("남성")').click();
  await page.locator(".btn-primary:has-text('다음')").click();

  await page.locator('button.btn-option:has-text("연인")').waitFor({ state: "visible", timeout: 10_000 });
  await page.locator('button.btn-option:has-text("연인")').click();
  await page.locator(".btn-primary:has-text('다음')").click();

  // --- Player B ---
  const nameB = page.locator('input[type="text"]');
  await nameB.waitFor({ state: "visible", timeout: 10_000 });
  await nameB.fill("홍길동");
  await page.locator(".btn-primary:has-text('다음')").click();

  const birthB = page.locator('input[inputmode="numeric"]').first();
  await birthB.waitFor({ state: "visible", timeout: 10_000 });
  await birthB.fill("19930315");
  await page.locator("button:has-text('태어난 시간을 몰라요')").click();
  await page.locator(".btn-primary:has-text('다음')").click();

  await page.locator('button.btn-option:has-text("경기")').waitFor({ state: "visible", timeout: 10_000 });
  await page.locator('button.btn-option:has-text("경기")').click();
  await page.locator(".btn-primary:has-text('다음')").click();

  await page.locator('button.btn-option:has-text("여성")').waitFor({ state: "visible", timeout: 10_000 });
  await page.locator('button.btn-option:has-text("여성")').click();
  await page.locator(".btn-primary:has-text('결제하러 가기')").click();
}

// ---------------------------------------------------------------------------
// Tests 1 & 2 share the same browser context (cookie persistence for dup check)
// ---------------------------------------------------------------------------

test.describe.serial("개인사주 + 중복 방지", () => {
  let ctx: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext();
    page = await ctx.newPage();
  });

  test.afterAll(async () => {
    await ctx.close();
  });

  test("테스트 1: 개인사주 알 결제 플로우", async () => {
    await setupAuthMocks(page);
    await setupTeaserAnalysisMocks(page);

    await page.goto("/start");
    await page.waitForLoadState("networkidle");

    await fillStartForm(page);

    // 티저 페이지 도달
    await page.waitForURL("**/teaser**", { timeout: 15_000 });
    await page.screenshot({ path: "tests/screenshots/teaser.png" });

    // "N알로 전체 결과 보기" 버튼 대기 + 클릭
    const payBtn = page.locator('.btn-primary:has-text("알로 전체 결과 보기")');
    await expect(payBtn).toBeVisible({ timeout: 15_000 });
    await expect(payBtn).toBeEnabled({ timeout: 10_000 });
    await payBtn.click();

    // Wait for /result URL, then wait for analysis content
    await page.waitForURL("**/result**", { timeout: 15_000 });

    // Wait for polling to complete and result to render
    await expect(
      page.locator('button:has-text("결과 공유하기")'),
    ).toBeVisible({ timeout: 30_000 });

    await page.screenshot({ path: "tests/screenshots/result.png" });

    // Extract resultId from URL
    const url = new URL(page.url());
    const resultId = url.searchParams.get("resultId") ?? "";
    expect(resultId).toBeTruthy();

    // Result content should be rendered
    const bodyText = await page.innerText("body");
    expect(bodyText).toContain("E2E 테스트 분석 결과입니다.");
  });

  test("테스트 2: 중복 결제 방지 → 기존 결과로 리다이렉트", async () => {
    // Same context — re-setup with existingResultId
    await setupAuthMocks(page);
    await setupTeaserAnalysisMocks(page, { existingResultId: TEST_RESULT_ID });

    await page.goto("/start");
    await page.waitForLoadState("networkidle");

    await fillStartForm(page);

    // 티저 페이지 도달
    await page.waitForURL("**/teaser**", { timeout: 15_000 });

    // 결제 버튼 클릭
    const payBtn = page.locator('.btn-primary:has-text("알로 전체 결과 보기")');
    await expect(payBtn).toBeVisible({ timeout: 15_000 });
    await expect(payBtn).toBeEnabled({ timeout: 10_000 });
    await payBtn.click();

    // Duplicate modal should show "결과 보러가기" button
    const viewExistingBtn = page.locator('button:has-text("결과 보러가기")');
    await expect(viewExistingBtn).toBeVisible({ timeout: 10_000 });
    await viewExistingBtn.click();

    // Should navigate to result page with existing resultId
    await page.waitForURL("**/result**", { timeout: 15_000 });
    const url = new URL(page.url());
    const returnedId = url.searchParams.get("resultId") ?? "";
    expect(returnedId).toBe(TEST_RESULT_ID);

    await page.screenshot({ path: "tests/screenshots/duplicate-prevention.png" });
  });
});

// ---------------------------------------------------------------------------
// Test 3: Share link (mocked result)
// ---------------------------------------------------------------------------

test("테스트 3: 공유 링크 (존재하지 않는 ID → 404 처리)", async ({ page }) => {
  await page.goto("/result/share/non-existent-id-12345");
  await page.waitForLoadState("networkidle");

  // Should show 404 page
  const bodyText = await page.innerText("body");
  expect(bodyText).toContain("404");

  await page.screenshot({ path: "tests/screenshots/share-page-404.png" });
});

// ---------------------------------------------------------------------------
// Test 4: Battle flow
// ---------------------------------------------------------------------------

test("테스트 4: 배틀 알 결제 플로우", async ({ page }) => {
  await setupAuthMocks(page);
  await setupTeaserBattleMocks(page);

  await page.goto("/battle/input");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "tests/screenshots/battle-select-mode.png" });

  await fillBattleForm(page);

  // 티저 페이지 도달 (배틀)
  await page.waitForURL("**/teaser?type=battle**", { timeout: 15_000 });
  await page.screenshot({ path: "tests/screenshots/battle-teaser.png" });

  // "N알로 대결하기" 버튼 대기 + 클릭
  const payBtn = page.locator('.btn-primary:has-text("알로 대결하기")');
  await expect(payBtn).toBeVisible({ timeout: 15_000 });
  await expect(payBtn).toBeEnabled({ timeout: 10_000 });
  await payBtn.click();

  // Wait for battle result URL
  await page.waitForURL("**/battle/result**", { timeout: 30_000 });

  // Wait for result to render
  await expect(
    page.locator("text=두루미의 압도적 승리"),
  ).toBeVisible({ timeout: 15_000 });

  await page.screenshot({ path: "tests/screenshots/battle-result.png" });

  const bodyText = await page.innerText("body");
  expect(bodyText).toContain("두루미");
  expect(bodyText).toContain("홍길동");
});
