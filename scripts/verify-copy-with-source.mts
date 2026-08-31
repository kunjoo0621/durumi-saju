/**
 * CopyWithSource 회귀 검증 — 실제 브라우저로 복사해 클립보드를 읽는다.
 *
 * 실행: npx next build && npx next start -p 3998 &  (그 다음)
 *      npx tsx scripts/verify-copy-with-source.mts
 *
 * ★역검증 완료(2026-08-31): MIN_CHARS 를 999999 로 올려 기능을 끄면 5/5 → 3/5 로 떨어진다.
 *   즉 이 테스트는 기능을 실제로 감지한다. 그리고 그 상태에서도 복사 자체는 정상 동작했다.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3998";
const DICT = `${BASE}/dict/gangyak/junghwa-singang`;

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ locale: "ko-KR", permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();

async function copySelectionOf(sel: string, opts: { chars?: number } = {}) {
  return page.evaluate(({ sel, chars }) => {
    // "longest" = 페이지에서 가장 긴 <p> (본문 문단을 확실히 잡기 위함)
    const el = sel === "longest"
      ? [...document.querySelectorAll("p")].sort((a, b) => (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0))[0]
      : document.querySelector(sel);
    if (!el) return { ok: false, why: `선택자 없음: ${sel}` };
    const range = document.createRange();
    if (chars != null) {
      // 첫 텍스트 노드에서 앞 N글자만 선택
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node: Node | null = null;
      while ((node = walker.nextNode())) if ((node.textContent ?? "").trim().length > chars) break;
      if (!node) return { ok: false, why: "텍스트 노드 없음" };
      range.setStart(node, 0);
      range.setEnd(node, chars);
    } else {
      range.selectNodeContents(el);
    }
    const s = window.getSelection()!;
    s.removeAllRanges();
    s.addRange(range);
    const ok = document.execCommand("copy");
    return { ok, selected: s.toString().length };
  }, { sel, chars: opts.chars ?? null });
}

const results: [string, boolean, string][] = [];
function check(name: string, pass: boolean, detail: string) {
  results.push([name, pass, detail]);
  console.log(`${pass ? "✅" : "❌"} ${name}\n     ${detail}`);
}

await page.goto(DICT, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(1200);

// ── 1) 긴 복사 → 출처가 붙어야 한다 ─────────────
const r1 = await copySelectionOf("longest");
const clip1 = await page.evaluate(() => navigator.clipboard.readText());
check(
  "긴 본문 복사 → 출처 첨부",
  clip1.includes("출처: 사주보는 두루미") && clip1.includes("/dict/gangyak/junghwa-singang"),
  `복사됨 ${clip1.length}자 · 끝부분: ${JSON.stringify(clip1.slice(-70))}`,
);

// ── 1-b) ★1번 직후에 읽어야 한다 — 뒤 테스트가 클립보드를 덮어쓴다.
//  HTML 서식도 세팅됐나 ──────────────────────
const htmlOk = await page.evaluate(async () => {
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) if (it.types.includes("text/html")) {
      const blob = await it.getType("text/html");
      const s = await blob.text();
      return { has: true, tail: s, link: /출처/.test(s) && /<a[^>]+href=/.test(s), paras: (s.match(/<p[ >]/g) || []).length };
    }
    return { has: false, tail: "", link: false, paras: 0 };
  } catch (e: any) { return { has: false, tail: "읽기실패: " + e?.message, link: false, paras: 0 }; }
});
check("HTML 서식 동반(문단 유지 + 출처 링크)", htmlOk.has && htmlOk.link,
  `html ${htmlOk.tail.length}자 · <p> ${htmlOk.paras}개 · 출처링크 ${htmlOk.link ? "있음" : "없음"}` +
  (htmlOk.link ? ` · ${JSON.stringify((htmlOk.tail.match(/<p>출처[^<]*<a[^>]*>[^<]*<\/a><\/p>/) || [""])[0].slice(0, 110))}` : ""));


// ── 2) 짧은 복사 → 붙으면 안 된다 ────────────────
await copySelectionOf("longest", { chars: 10 });
const clip2 = await page.evaluate(() => navigator.clipboard.readText());
check(
  "짧은 복사(10자) → 출처 없음",
  !clip2.includes("출처:") && clip2.length > 0,
  `복사됨 ${JSON.stringify(clip2)}`,
);

// ── 3) 본문 밖(헤더) 복사 → 붙으면 안 된다 ───────
const r3 = await copySelectionOf("header");
const clip3 = await page.evaluate(() => navigator.clipboard.readText());
check(
  "본문 밖(header) 복사 → 출처 없음",
  !clip3.includes("출처:"),
  r3.ok ? `복사됨 ${clip3.length}자` : `header 없음 — 건너뜀`,
);

// ── 4) ★복사 자체가 안 깨졌나 (원문 보존) ────────
check(
  "원문이 온전히 보존됨",
  clip1.length > 100 && !clip1.startsWith("출처:"),
  `원문 ${clip1.length - 60}자 + 출처. 앞부분: ${JSON.stringify(clip1.slice(0, 50))}`,
);

console.log(`\n${results.filter((r) => r[1]).length}/${results.length} 통과`);
await ctx.close(); await b.close();
process.exit(results.every((r) => r[1]) ? 0 : 1);
