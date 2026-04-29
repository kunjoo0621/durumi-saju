import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3033";
const OUTDIR = "tests/screenshots/jiji";

mkdirSync(OUTDIR, { recursive: true });

const jiji = [
  ["ja", "자"],
  ["chuk", "축"],
  ["in", "인"],
  ["myo", "묘"],
  ["jin", "진"],
  ["sa", "사"],
  ["o", "오"],
  ["mi", "미"],
  ["sin", "신"],
  ["yu", "유"],
  ["sul", "술"],
  ["hae", "해"],
];

const browser = await chromium.launch();
try {
  for (const [slug, label] of jiji) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dict/jiji/${slug}`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${OUTDIR}/${slug}-${label}.png`,
      fullPage: true,
    });
    console.log(`${slug} ${label} ✓`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
