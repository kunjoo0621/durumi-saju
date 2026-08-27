/** 임시: 매거진 figure 카드 렌더. 커밋하지 않음. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import path from "path";
const HTML = "file:///Users/kunjoo/projects/durumi-blog/visu-html/saju/mag-2608b-figures.html";
const OUT = path.join(process.cwd(), "public/stories/figures");
const IDS = ["jangseong-sal-1","jangseong-sal-2","yukhae-sal-1","yukhae-sal-2","yuyoungwoo-1","yuyoungwoo-2","yangsejong-1","yangsejong-2","v-bts-1","v-bts-2"];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto(HTML, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
for (const id of IDS) {
  const el = page.locator(`[id="${id}"]`);
  const over = await el.evaluate((c: any) => {
    const footTop = c.querySelector(".foot").getBoundingClientRect().top;
    let worst = 0, who = "";
    for (const n of c.querySelectorAll(".body *")) {
      const bb = n.getBoundingClientRect();
      if (bb.height === 0) continue;
      if (bb.bottom - footTop > worst) { worst = bb.bottom - footTop; who = String(n.className).slice(0, 24); }
    }
    return { over: Math.round(worst), who };
  });
  await el.screenshot({ path: path.join(OUT, `${id}.png`) });
  console.log(`${id}.png${over.over > 1 ? `   ⚠ 넘침 ${over.over}px (${over.who})` : "   ok"}`);
}
await browser.close();
