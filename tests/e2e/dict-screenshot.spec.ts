import { test } from "@playwright/test";

test.use({ baseURL: "http://localhost:3033" });

test("snapshot: dict ilju gapja (mobile)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dict/ilju/gapja", { waitUntil: "networkidle" });
  await page.screenshot({
    path: "tests/screenshots/dict-ilju-gapja-mobile.png",
    fullPage: true,
  });
});

test("snapshot: dict hub (mobile)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dict", { waitUntil: "networkidle" });
  await page.screenshot({
    path: "tests/screenshots/dict-hub-mobile.png",
    fullPage: true,
  });
});

test("snapshot: dict ilju category (mobile)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dict/ilju", { waitUntil: "networkidle" });
  await page.screenshot({
    path: "tests/screenshots/dict-ilju-cat-mobile.png",
    fullPage: true,
  });
});

test("snapshot: dict ilju gapja (desktop)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await page.goto("/dict/ilju/gapja", { waitUntil: "networkidle" });
  await page.screenshot({
    path: "tests/screenshots/dict-ilju-gapja-desktop.png",
    fullPage: true,
  });
});
