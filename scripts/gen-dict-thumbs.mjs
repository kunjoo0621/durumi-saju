/**
 * 사주 사전 리스트 썸네일 5장 (4:3 다크 카드). visu 다크·미니멀 결 + 브랜드 로즈.
 * HTML을 파일로 쓰지 않고 Playwright setContent로 렌더 → sharp WebP.
 * 실행: node scripts/gen-dict-thumbs.mjs
 */
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("public/images/hub/dict");
const ROSE = "#F43F5E";
const NEUT = "#8b93a3";

const SYM = {
  hapA: `<circle cx="80" cy="70" r="45" fill="none" stroke="${ROSE}" stroke-width="4.5"/><circle cx="120" cy="70" r="45" fill="none" stroke="${NEUT}" stroke-width="4.5"/>`,
  hapB: `<circle cx="80" cy="70" r="44" fill="${ROSE}" fill-opacity="0.9"/><circle cx="120" cy="70" r="44" fill="none" stroke="#e5e7eb" stroke-width="4.5"/>`,
  bolt: `<path d="M112 8 L68 84 L98 84 L84 140 L142 58 L110 58 Z" fill="${ROSE}"/>`,
  pillar: `<line x1="48" y1="128" x2="152" y2="128" stroke="${NEUT}" stroke-width="4.5" stroke-linecap="round"/><rect x="76" y="22" width="48" height="100" rx="12" fill="none" stroke="${ROSE}" stroke-width="4.5"/><rect x="88" y="40" width="24" height="66" rx="6" fill="${ROSE}" fill-opacity="0.85"/>`,
  balance: `<line x1="38" y1="58" x2="162" y2="58" stroke="${ROSE}" stroke-width="5" stroke-linecap="round"/><path d="M100 58 L82 112 L118 112 Z" fill="none" stroke="${NEUT}" stroke-width="4.5" stroke-linejoin="round"/><circle cx="100" cy="50" r="7" fill="${ROSE}"/><circle cx="50" cy="58" r="10" fill="none" stroke="${NEUT}" stroke-width="3.5"/><circle cx="150" cy="58" r="10" fill="none" stroke="${NEUT}" stroke-width="3.5"/>`,
};

const CARDS = [
  { slug: "jeongim-hap", eyebrow: "천간의 합", keyword: "정임합", sym: SYM.hapA },
  { slug: "byeongsin-hap", eyebrow: "천간의 합", keyword: "병신합", sym: SYM.hapB },
  { slug: "cheonsal", eyebrow: "12신살", keyword: "천살", sym: SYM.bolt },
  { slug: "gyeongjin", eyebrow: "60갑자 일주", keyword: "경진일주", sym: SYM.pillar },
  { slug: "singang", eyebrow: "강약", keyword: "중화신강", sym: SYM.balance },
];

function html(c) {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"/>
<style>
@font-face{font-family:"SBAggroM";src:url("https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2108@1.1/SBAggroM.woff") format("woff");}
*{margin:0;box-sizing:border-box}
.card{width:480px;height:360px;position:relative;overflow:hidden;
  background:radial-gradient(130% 110% at 28% 18%, #17121b 0%, #0c0b10 55%, #09090b 100%);
  font-family:"Pretendard",sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.glow{position:absolute;top:-90px;right:-70px;width:260px;height:260px;border-radius:50%;
  background:${ROSE};opacity:.12;filter:blur(70px)}
.eyebrow{color:${ROSE};font-size:19px;font-weight:600;letter-spacing:.02em;z-index:1}
.sym{z-index:1}
.kw{font-family:"SBAggroM","Pretendard";color:#fff;font-size:52px;letter-spacing:-.01em;z-index:1}
</style></head>
<body><div class="card"><div class="glow"></div>
<div class="eyebrow">${c.eyebrow}</div>
<svg class="sym" width="170" height="120" viewBox="0 0 200 150">${c.sym}</svg>
<div class="kw">${c.keyword}</div>
</div></body></html>`;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 480, height: 360 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await mkdir(OUT, { recursive: true });
for (const c of CARDS) {
  await page.setContent(html(c), { waitUntil: "networkidle" });
  await page.waitForTimeout(1200); // 폰트
  const png = await page.locator(".card").screenshot();
  await sharp(png).webp({ quality: 88 }).toFile(path.join(OUT, `${c.slug}.webp`));
  console.log("  ", c.slug + ".webp");
}
await browser.close();
console.log("done ->", OUT);
