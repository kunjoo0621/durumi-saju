import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3033";
const OUTDIR = "tests/screenshots/cheongan";

mkdirSync(OUTDIR, { recursive: true });

const cheongan = [
  ["gap", "갑"],
  ["eul", "을"],
  ["byeong", "병"],
  ["jeong", "정"],
  ["mu", "무"],
  ["gi", "기"],
  ["gyeong", "경"],
  ["sin", "신"],
  ["im", "임"],
  ["gye", "계"],
];

const browser = await chromium.launch();
try {
  for (const [slug, label] of cheongan) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dict/cheongan/${slug}`, {
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
