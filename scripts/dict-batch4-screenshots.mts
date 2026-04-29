import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3033";
const OUTDIR = "tests/screenshots/batch4";

mkdirSync(OUTDIR, { recursive: true });

const targets = [
  ["sipsung", "bigyeon", "비견"],
  ["sipsung", "sikshin", "식신"],
  ["sipsung", "pyeongwan", "편관"],
  ["sipsung", "pyeonin", "편인"],
  ["unseong12", "jewang", "제왕"],
  ["unseong12", "jeol", "절"],
  ["unseong12", "tae", "태"],
];

const browser = await chromium.launch();
try {
  for (const [cat, slug, label] of targets) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dict/${cat}/${slug}`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${OUTDIR}/${cat}-${slug}-${label}.png`,
      fullPage: true,
    });
    console.log(`${cat}/${slug} ${label} ✓`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
