import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3033";
const OUTDIR = "tests/screenshots";

mkdirSync(OUTDIR, { recursive: true });

const targets = [
  { url: "/dict", name: "00-dict-hub" },
  { url: "/dict/saju/intro", name: "01-saju-intro" },
  { url: "/dict/pillars/ilju", name: "02-pillars-ilju" },
  { url: "/dict/cheongan/gap", name: "03-cheongan-gap" },
  { url: "/dict/jiji/ja", name: "04-jiji-ja" },
  { url: "/dict/gabja/gapja", name: "05-gabja-gapja" },
  { url: "/dict/ohaeng/mok", name: "06-ohaeng-mok" },
  { url: "/dict/sipsung/jeongin", name: "07-sipsung-jeongin" },
  { url: "/dict/unseong12/jangsaeng", name: "08-unseong12-jangsaeng" },
  { url: "/dict/relation/gapgi-hap", name: "09-relation-gapgi-hap" },
  { url: "/dict/sinsal/dohwa", name: "10-sinsal-dohwa" },
  { url: "/dict/sipisinsal/dohwa", name: "11-sipisinsal-dohwa" },
];

const browser = await chromium.launch();
try {
  for (const t of targets) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${t.url}`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${OUTDIR}/${t.name}.png`,
      fullPage: true,
    });
    console.log(`${t.name} ✓`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
