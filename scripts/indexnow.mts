/**
 * IndexNow — 네이버·빙에 색인을 즉시 요청한다.
 *
 * 왜: 두루미 매출의 68%가 자연검색이고 유입 1위가 네이버다(39.5%).
 *     그런데 새 글을 올려도 크롤러가 올 때까지 기다리고 있었다.
 *     IndexNow 는 "이 URL 바뀌었다"를 밀어넣는 프로토콜이다. 네이버가 2023-07 부터 지원한다.
 *
 * ★키는 이미 있었다 — public/2dfc3efb200b289102abd71e6b9b91b8.txt (내용=파일명).
 *   프로덕션에서 200 으로 살아 있는 것도 확인했다. 제출 코드만 없었다.
 *
 * ★구글은 IndexNow 를 지원하지 않는다. 구글은 사이트맵/자연 크롤링에 맡긴다.
 *
 * 실행:
 *   npx tsx scripts/indexnow.mts --new            사이트맵에서 최근 변경분만 (기본 7일)
 *   npx tsx scripts/indexnow.mts --all            사이트맵 전체 (453개) — 남용 주의
 *   npx tsx scripts/indexnow.mts <url> [<url>...] 특정 URL 만
 *   npx tsx scripts/indexnow.mts --new --dry      실제 제출 없이 대상만 출력
 */
const HOST = "www.durumisaju.com";
const KEY = "2dfc3efb200b289102abd71e6b9b91b8";
const KEY_URL = `https://${HOST}/${KEY}.txt`;
/** 한 번에 최대 10,000 URL 까지 받지만, 과하게 밀어넣을 이유가 없다. */
const MAX_BATCH = 500;

const c = { reset:"\x1b[0m", dim:"\x1b[2m", bold:"\x1b[1m", green:"\x1b[32m", red:"\x1b[31m", yellow:"\x1b[33m" };
const args = process.argv.slice(2);
const DRY = args.includes("--dry");

/** 사이트맵에서 <loc> 와 <lastmod> 를 뽑는다 */
async function fromSitemap(sinceDays: number | null): Promise<string[]> {
  const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
  const out: string[] = [];
  const cutoff = sinceDays === null ? 0 : Date.now() - sinceDays * 86400_000;
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>(.*?)<\/loc>/)?.[1];
    if (!loc) continue;
    if (sinceDays !== null) {
      const lm = m[1].match(/<lastmod>(.*?)<\/lastmod>/)?.[1];
      // lastmod 가 없으면 '언제 바뀌었는지 모른다'는 뜻 — 최근분 제출에서는 뺀다.
      if (!lm || new Date(lm).getTime() < cutoff) continue;
    }
    out.push(loc);
  }
  return out;
}

async function submit(urls: string[]) {
  const body = { host: HOST, key: KEY, keyLocation: KEY_URL, urlList: urls };
  // 네이버·빙 각각에 던진다. api.indexnow.org 로 한 번에 던지면 참여 엔진에 전파되지만,
  // 어느 엔진이 거부했는지 안 보여서 따로 친다.
  const endpoints = [
    ["네이버", "https://searchadvisor.naver.com/indexnow"],
    ["빙",     "https://www.bing.com/indexnow"],
  ];
  for (const [name, url] of endpoints) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
      const txt = (await r.text()).slice(0, 120);
      const ok = r.status === 200 || r.status === 202;
      console.log(`  ${ok ? c.green + "✓" : c.red + "✗"} ${name} → ${r.status}${txt ? " " + txt : ""}${c.reset}`);
      if (r.status === 403) console.log(`    ${c.yellow}403 = 키 파일 검증 실패. ${KEY_URL} 확인${c.reset}`);
      if (r.status === 429) console.log(`    ${c.yellow}429 = 너무 잦음. 잠시 후 재시도${c.reset}`);
    } catch (e: any) { console.log(`  ${c.red}✗ ${name} → ${e.message.slice(0, 80)}${c.reset}`); }
  }
}

async function main() {
  const explicit = args.filter(a => a.startsWith("http"));
  let urls: string[];
  let label: string;

  if (explicit.length) { urls = explicit; label = "지정 URL"; }
  else if (args.includes("--all")) { urls = await fromSitemap(null); label = "사이트맵 전체"; }
  else {
    const d = Number(args.find(a=>a.startsWith("--days="))?.split("=")[1] ?? 7);
    urls = await fromSitemap(d); label = `최근 ${d}일 변경분`;
  }

  console.log(`\n${c.bold}IndexNow${c.reset}  ${c.dim}${label} · ${urls.length}건${c.reset}`);
  if (!urls.length) {
    console.log(`  ${c.dim}제출할 URL 이 없습니다. sitemap 의 lastmod 를 확인하세요.${c.reset}`);
    console.log(`  ${c.dim}(lastmod 가 없는 URL 은 최근분 제출에서 제외됩니다 — --all 로 강제 가능)${c.reset}\n`);
    return;
  }
  urls.slice(0, 8).forEach(u => console.log(`  ${c.dim}· ${u.replace(`https://${HOST}`, "")}${c.reset}`));
  if (urls.length > 8) console.log(`  ${c.dim}· … 외 ${urls.length - 8}건${c.reset}`);

  if (DRY) { console.log(`\n  ${c.yellow}--dry — 실제 제출 안 함${c.reset}\n`); return; }

  for (let i = 0; i < urls.length; i += MAX_BATCH) {
    const batch = urls.slice(i, i + MAX_BATCH);
    console.log(`\n  ${c.dim}배치 ${Math.floor(i/MAX_BATCH)+1} — ${batch.length}건${c.reset}`);
    await submit(batch);
    if (i + MAX_BATCH < urls.length) await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`\n${c.dim}※ 200/202 는 '접수됨'이지 '색인됨'이 아니다. 실제 반영은 검색엔진 판단이다.${c.reset}`);
  console.log(`${c.dim}※ 구글은 IndexNow 미지원 — 사이트맵과 자연 크롤링에 맡긴다.${c.reset}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
