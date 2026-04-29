import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3033";
const OUTDIR = "tests/screenshots/gabja-hub";

mkdirSync(OUTDIR, { recursive: true });

const browser = await chromium.launch();
try {
  // Mobile
  let ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "dark",
  });
  let page = await ctx.newPage();
  await page.goto(`${BASE}/dict/gabja`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUTDIR}/gabja-hub-mobile.png`, fullPage: true });
  console.log("mobile ✓");
  await ctx.close();

  // Desktop
  ctx = await browser.newContext({
    viewport: { width: 1280, height: 1600 },
    colorScheme: "dark",
  });
  page = await ctx.newPage();
  await page.goto(`${BASE}/dict/gabja`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUTDIR}/gabja-hub-desktop.png`, fullPage: true });
  console.log("desktop ✓");
  await ctx.close();
} finally {
  await browser.close();
}
