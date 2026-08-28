/**
 * 네이버 서치어드바이저 — 콘텐츠 노출/클릭 조회 (자동, 브라우저 안 뜸).
 *
 * ★네이버는 서치어드바이저 데이터를 주는 공개 API 가 없다.
 *   제휴 API 는 '수집요청'·IndexNow 뿐으로 전부 **보내는** API 다(2026-08-26 가이드 전수 확인).
 *   그래서 웹마스터 콘솔의 **내부 JSON API** 를 로그인 세션으로 호출한다.
 *
 * 선행: npx tsx scripts/naver-sa-login.mts  (1회, 대화형. 세션 만료 시에만 재실행)
 * 실행: npx tsx scripts/naver-sa-stats.mts [기준일수=30]
 *
 * ★구글 GSC 와 다른 점 — 네이버는 **검색어(query) 를 안 준다.** URL 별까지만 나온다.
 *   그리고 웹 검색 영역만 산정한다(VIEW·블로그·광고 영역 제외).
 */
import { chromium, type BrowserContext } from "playwright";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROFILE_DIR = join(homedir(), ".durumi-naver-profile");
const SITE = "https://www.durumisaju.com";
const ENC = encodeURIComponent(SITE);
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const c = { reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m", cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m" };
const R = (s: unknown, n: number) => String(s).padStart(n);
const L = (s: unknown, n: number) => { const t = String(s); return t.length > n ? t.slice(0, n - 1) + "…" : t.padEnd(n); };
const num = (n: number) => Math.round(n).toLocaleString();

type Log = { date: string; exposeCount: number; clickCount: number; ctr: number };
type Url = { key: string; exposeCount: number; clickCount: number; ctr: number; exposedRank: number };

function bail(msg: string): never {
  console.error(`\n${c.red}${msg}${c.reset}\n`);
  console.error("  세션이 없거나 만료됐습니다. 아래를 한 번 실행하면 됩니다(브라우저에서 로그인):");
  console.error("    npx tsx scripts/naver-sa-login.mts\n");
  process.exit(1);
}

async function main() {
  if (!existsSync(PROFILE_DIR)) bail("프로필이 없습니다.");

  let ctx: BrowserContext;
  try {
    ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true,
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      userAgent: UA,
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch (e: any) {
    // 프로필은 한 번에 한 프로세스만 쓸 수 있다 — 블로그 자동화와 동시 실행 시 여기 걸린다.
    bail(`프로필을 열지 못했습니다(다른 프로세스가 쓰는 중일 수 있습니다): ${e?.message}`);
  }

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  // 계정 enc_id 는 로그인 응답에 실려 온다 — 하드코딩하지 않고 관측해서 쓴다.
  let encId: string | null = null;
  page.on("response", (r) => {
    const m = r.url().match(/\/api-console\/report\/\w+\/([0-9a-f]{40,})/);
    if (m) encId = m[1];
  });

  await page.goto(`https://searchadvisor.naver.com/console/site/report/expose?site=${ENC}`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });

  const url = page.url();
  if (url.includes("nidlogin") || url.includes("auth/login") || url.includes("oauth2.0/authorize")) {
    await ctx.close();
    bail("로그인 상태가 아닙니다.");
  }
  await page.waitForTimeout(3_000);
  if (!encId) {
    // 리포트 XHR 이 아직 안 떴으면 한 번 더 기다린다.
    await page.waitForTimeout(4_000);
  }
  if (!encId) { await ctx.close(); bail("리포트 API 를 관측하지 못했습니다(화면 구조 변경 가능성)."); }

  async function report(period: number) {
    const u = `https://searchadvisor.naver.com/api-console/report/expose/${encId}?site=${ENC}&period=${period}`;
    const r = await page.evaluate(async (uu) => {
      const res = await fetch(uu, { credentials: "include" });
      return { status: res.status, body: await res.text() };
    }, u);
    if (r.status !== 200) return null;
    try { return JSON.parse(r.body); } catch { return null; }
  }

  const days = Number(process.argv[2] ?? 30);
  const d90 = await report(90);
  const dN = await report(days);
  const d7 = await report(7);
  await ctx.close();

  if (!dN) bail("리포트 조회에 실패했습니다.");

  const item = dN.items?.[0];
  const latest = dN.meta?.latestDate;
  console.log(`\n${c.bold}${c.cyan}네이버 서치어드바이저 — 콘텐츠 노출/클릭${c.reset}  ${c.dim}${SITE}${c.reset}`);
  console.log(`${c.dim}최근 업데이트: ${latest}  ·  웹 검색 영역만 산정(VIEW·블로그·광고 제외)${c.reset}\n`);

  for (const [label, d] of [[`${days}일`, dN], ["7일", d7]] as const) {
    const p = d?.items?.[0]?.period;
    if (!p) continue;
    console.log(
      `  ${c.bold}${L(label, 6)}${c.reset} 노출 ${c.green}${R(num(p.exposeCount), 9)}${c.reset}` +
        ` · 클릭 ${c.green}${R(num(p.clickCount), 6)}${c.reset} · CTR ${p.ctr}%` +
        `  ${c.dim}(직전 동기간 대비 노출 ${p.prevExposeRatio > 0 ? "+" : ""}${p.prevExposeRatio}% · 클릭 ${p.prevClickRatio > 0 ? "+" : ""}${p.prevClickRatio}%)${c.reset}`,
    );
  }

  // 일자별 — 추이가 여기서 나온다
  const logs: Log[] = (d90?.items?.[0]?.logs ?? item?.logs ?? []).slice().sort((a: Log, b: Log) => a.date.localeCompare(b.date));
  if (logs.length) {
    console.log(`\n${c.bold}일자별 (최근 21일)${c.reset}`);
    console.log(`  ${c.dim}날짜          노출     클릭    CTR${c.reset}`);
    for (const l of logs.slice(-21))
      console.log(`  ${l.date.slice(0, 4)}-${l.date.slice(4, 6)}-${l.date.slice(6)}  ${R(num(l.exposeCount), 7)}  ${R(num(l.clickCount), 5)}  ${R(l.ctr, 4)}%`);

    const agg = (a: string, b: string) => {
      const s = logs.filter((l) => a <= l.date && l.date <= b);
      if (!s.length) return null;
      const e = s.reduce((x, l) => x + l.exposeCount, 0);
      const k = s.reduce((x, l) => x + l.clickCount, 0);
      return { n: s.length, e, k, ctr: ((k / e) * 100).toFixed(2), ed: Math.round(e / s.length), kd: (k / s.length).toFixed(1) };
    };
    const last = logs.at(-1)!.date;
    const d = (o: number) => { const t = new Date(`${last.slice(0,4)}-${last.slice(4,6)}-${last.slice(6)}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - o); return t.toISOString().slice(0,10).replace(/-/g,""); };
    console.log(`\n${c.bold}최근 7일 vs 직전 7일 (일평균)${c.reset}`);
    for (const [lb, a, b] of [["최근 7일", d(6), last], ["직전 7일", d(13), d(7)]] as const) {
      const r = agg(a, b);
      if (r) console.log(`  ${L(lb, 10)} 노출/일 ${R(num(r.ed), 7)} · 클릭/일 ${R(r.kd, 6)} · CTR ${r.ctr}%`);
    }
  }

  // URL 별 — 네이버는 검색어를 안 주므로 이게 최대 해상도
  const urls: Url[] = (item?.urls ?? []).slice().sort((a: Url, b: Url) => b.clickCount - a.clickCount);
  if (urls.length) {
    console.log(`\n${c.bold}URL별 TOP 20 (${days}일, 클릭순)${c.reset}  ${c.dim}상위 ${urls.length}개만 제공${c.reset}`);
    console.log(`  ${c.dim}클릭   노출    CTR  순위  경로${c.reset}`);
    for (const u of urls.slice(0, 20))
      console.log(`  ${R(u.clickCount, 4)} ${R(num(u.exposeCount), 7)} ${R(u.ctr, 5)}% ${R(u.exposedRank, 5)}  ${u.key.replace(SITE, "") || "/"}`);
  }
  console.log(`\n${c.dim}※ 네이버는 검색어(query) 데이터를 제공하지 않는다. URL 까지가 한계다.${c.reset}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
