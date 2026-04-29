import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3033";
const OUTDIR = "tests/screenshots/batch5";

mkdirSync(OUTDIR, { recursive: true });

const targets = [
  ["", "dict", "허브"],
  ["relation", "eulgyeong-hap", "을경합"],
  ["relation", "jao-chung", "자오충"],
  ["relation", "inosul-samhap", "인오술-삼합"],
  ["sinsal", "yangin", "양인살"],
  ["sinsal", "baekho", "백호살"],
  ["sinsal", "cheonyl-gwiin", "천을귀인"],
  ["sipisinsal", "jangseongsal", "장성살"],
  ["sipisinsal", "yeokmasal", "역마살-12신살"],
];

const browser = await chromium.launch();
try {
  for (const [cat, slug, label] of targets) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
    });
    const page = await ctx.newPage();
    const url = cat ? `${BASE}/dict/${cat}/${slug}` : `${BASE}/dict`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${OUTDIR}/${cat || "hub"}-${slug}-${label}.png`,
      fullPage: true,
    });
    console.log(`${cat || "hub"}/${slug} ${label} ✓`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
