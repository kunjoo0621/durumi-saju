import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3033";
const OUTDIR = "tests/screenshots/audit";

mkdirSync(OUTDIR, { recursive: true });

const targets = [
  // 카테고리 허브
  ["", "dict", "허브"],
  ["dict", "saju", "사주입문허브"],
  ["dict", "gabja", "60갑자허브"],
  ["dict", "sinsal", "신살허브"],
  // 갑자 시작과 끝
  ["gabja", "gapja", "1번갑자"],
  ["gabja", "gyehae", "60번계해"],
  // 백호 / 괴강 / 양인
  ["gabja", "mujin", "백호5번"],
  ["gabja", "gyeongjin", "괴강17번"],
  ["gabja", "byeongo", "양인43번"],
  // 간여지동
  ["gabja", "gabin", "간여지동51번"],
  ["gabja", "gyeongsin", "간여지동57번"],
  // 사주 입문
  ["saju", "how-to-read", "사주보는법"],
  ["saju", "shin-gang-shin-yak", "신강신약"],
  // 신살 길성
  ["sinsal", "cheonyl-gwiin", "천을귀인"],
  ["sinsal", "tanghwa", "탕화살"],
  // 합충형
  ["relation", "byeongsin-hap", "병신합"],
  ["relation", "sinjajin-samhap", "신자진삼합"],
];

const browser = await chromium.launch();
try {
  for (const [cat, slug, label] of targets) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
    });
    const page = await ctx.newPage();
    let url: string;
    if (cat === "") url = `${BASE}/dict`;
    else if (cat === "dict") url = `${BASE}/dict/${slug}`;
    else url = `${BASE}/dict/${cat}/${slug}`;

    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${OUTDIR}/${cat || "root"}-${slug}-${label}.png`,
      fullPage: true,
    });
    console.log(`${cat || "root"}/${slug} ${label} ✓`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
