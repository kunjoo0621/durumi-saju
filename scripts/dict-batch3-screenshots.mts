import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3033";
const OUTDIR = "tests/screenshots/batch3";

mkdirSync(OUTDIR, { recursive: true });

const targets = [
  ["ohaeng", "mok", "목"],
  ["ohaeng", "hwa", "화"],
  ["ohaeng", "to", "토"],
  ["ohaeng", "geum", "금"],
  ["ohaeng", "su", "수"],
  ["pillars", "yeonju", "년주"],
  ["pillars", "wolju", "월주"],
  ["pillars", "ilju", "일주"],
  ["pillars", "siju", "시주"],
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
