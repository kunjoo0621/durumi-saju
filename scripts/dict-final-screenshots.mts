import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3033";
const OUTDIR = "tests/screenshots/final";

mkdirSync(OUTDIR, { recursive: true });

const targets = [
  ["", "dict", "허브"],
  ["saju", "intro", "사주란"],
  ["saju", "dae-un", "대운"],
  ["saju", "shin-gang-shin-yak", "신강신약"],
  ["gabja", "eulchuk", "을축"],
  ["gabja", "gyeongo", "경오"],
  ["gabja", "mujin", "무진-백호"],
  ["gabja", "imjin", "임진-괴강"],
  ["gabja", "byeongo", "병오-양인"],
  ["gabja", "gabin", "갑인-간여지동"],
  ["gabja", "gyehae", "계해-마지막"],
  ["sinsal", "tanghwa", "탕화살"],
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
