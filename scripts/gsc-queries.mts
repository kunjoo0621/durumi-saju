/**
 * Google Search Console 실적 조회 — 자연검색이 어떤 검색어로 오는지 본다.
 *
 * 왜: 두루미 매출의 68%가 자연검색인데(2026-08-20 channel-roi 실측),
 *     정작 "어떤 검색어로 오는지"를 한 번도 본 적이 없었다.
 *     gsc-key.json 은 2026-06-05 부터 있었지만 쓰는 코드가 없었다.
 *
 * 인증: gsc-key.json (서비스 계정). 의존성 없이 JWT 를 직접 만들어 access_token 을 받는다.
 *   ★선행조건 — Search Console → 설정 → 사용자 및 권한 에 서비스 계정 이메일이
 *     추가돼 있어야 한다. 없으면 sites.list 가 빈 배열을 준다(403 이 아니라 빈 값이라 헷갈린다).
 *
 * ★GSC 는 90일치만 보관한다. 장기 추이가 필요하면 주기적으로 받아 쌓아야 한다.
 * ★데이터는 2~3일 지연된다. 어제 데이터는 아직 없다.
 *
 * 실행: npx tsx scripts/gsc-queries.mts [일수=28]
 */
import crypto from "crypto";
import { readFileSync } from "fs";

const key = JSON.parse(readFileSync("gsc-key.json", "utf-8"));
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

const c = { reset:"\x1b[0m", dim:"\x1b[2m", bold:"\x1b[1m", cyan:"\x1b[36m", green:"\x1b[32m", yellow:"\x1b[33m", red:"\x1b[31m" };
const b64u = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const L = (s: any, n: number) => { const t = String(s); return t.length > n ? t.slice(0, n-1) + "…" : t.padEnd(n); };
const R = (s: any, n: number) => String(s).padStart(n);

/** 서비스 계정 JWT → access_token */
async function token(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: key.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now };
  const unsigned = `${b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64u(JSON.stringify(claim))}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(key.private_key);
  const jwt = `${unsigned}.${b64u(sig)}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`토큰 발급 실패: ${JSON.stringify(j).slice(0, 300)}`);
  return j.access_token;
}

async function api(path: string, tok: string, body?: any) {
  const r = await fetch(`https://www.googleapis.com/webmasters/v3${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path} → ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

async function main() {
  const days = Number(process.argv[2] ?? 28);
  const tok = await token();

  // 1) 접근 가능한 속성 — 도메인형(sc-domain:)인지 URL접두어형인지 여기서 갈린다
  const sites = (await api("/sites", tok)).siteEntry ?? [];
  if (!sites.length) {
    console.error("접근 가능한 속성이 없습니다. Search Console → 설정 → 사용자 및 권한 에\n" +
                  `${key.client_email} 이 추가돼 있는지 확인하세요.`);
    process.exit(1);
  }
  console.log(`\n${c.dim}접근 가능한 속성:${c.reset}`);
  for (const s of sites) console.log(`  ${s.siteUrl}  (${s.permissionLevel})`);

  const site = sites.find((s: any) => s.siteUrl.includes("durumisaju")) ?? sites[0];
  const enc = encodeURIComponent(site.siteUrl);

  // GSC 데이터는 2~3일 지연된다 — 끝날짜를 3일 전으로 잡아야 빈 구간이 안 섞인다.
  const end = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
  const start = new Date(Date.now() - (days + 3) * 86400_000).toISOString().slice(0, 10);
  const q = (dimensions: string[], rowLimit = 1000) =>
    api(`/sites/${enc}/searchAnalytics/query`, tok, { startDate: start, endDate: end, dimensions, rowLimit });

  console.log(`\n${c.bold}${c.cyan}Google Search Console — ${site.siteUrl}${c.reset}  ${c.dim}${start} ~ ${end} (${days}일)${c.reset}`);

  // 2) 총계
  const tot = (await q([])).rows?.[0];
  if (tot) {
    console.log(`\n${c.bold}총계${c.reset}  노출 ${c.green}${Math.round(tot.impressions).toLocaleString()}${c.reset}` +
      ` · 클릭 ${c.green}${Math.round(tot.clicks).toLocaleString()}${c.reset}` +
      ` · CTR ${(tot.ctr*100).toFixed(2)}% · 평균순위 ${tot.position.toFixed(1)}`);
  }

  const rows = (await q(["query"])).rows ?? [];
  const pages = (await q(["page"])).rows ?? [];

  const table = (title: string, list: any[], keyName: string, n = 20) => {
    console.log(`\n${c.bold}${c.cyan}${title}${c.reset}`);
    console.log(`  ${c.dim}${L("항목",42)}${R("노출",8)}${R("클릭",7)}${R("CTR",8)}${R("순위",7)}${c.reset}`);
    console.log(`  ${c.dim}${"─".repeat(72)}${c.reset}`);
    for (const r of list.slice(0, n)) {
      const k = String(r.keys[0]).replace(site.siteUrl.replace(/^sc-domain:/, "https://"), "").replace(/^https?:\/\/[^/]+/, "") || "/";
      console.log(`  ${L(keyName === "page" ? decodeURIComponent(k) : r.keys[0], 42)}${R(Math.round(r.impressions).toLocaleString(),8)}${R(Math.round(r.clicks),7)}${R((r.ctr*100).toFixed(1)+"%",8)}${R(r.position.toFixed(1),7)}`);
    }
  };

  table("🔍 검색어 TOP 20 (노출순)", rows, "query");
  table("📄 페이지 TOP 20 (노출순)", pages, "page");

  // 3) ★기회 — 이게 이 스크립트의 존재 이유
  const lowCtr = rows.filter(r => r.impressions >= 100 && r.ctr < 0.02).sort((a,b)=>b.impressions-a.impressions);
  console.log(`\n${c.bold}${c.yellow}⚡ 기회 A — 노출 100+ 인데 CTR 2% 미만 (제목·메타만 고치면 되는 자리)${c.reset}`);
  console.log(`  ${c.dim}${L("검색어",42)}${R("노출",8)}${R("클릭",7)}${R("CTR",8)}${R("순위",7)}${c.reset}`);
  console.log(`  ${c.dim}${"─".repeat(72)}${c.reset}`);
  for (const r of lowCtr.slice(0, 15))
    console.log(`  ${L(r.keys[0],42)}${R(Math.round(r.impressions).toLocaleString(),8)}${R(Math.round(r.clicks),7)}${R((r.ctr*100).toFixed(1)+"%",8)}${R(r.position.toFixed(1),7)}`);
  if (!lowCtr.length) console.log(`  ${c.dim}(없음)${c.reset}`);

  const striking = rows.filter(r => r.position >= 8 && r.position <= 20 && r.impressions >= 50).sort((a,b)=>b.impressions-a.impressions);
  console.log(`\n${c.bold}${c.yellow}⚡ 기회 B — 순위 8~20위 · 노출 50+ (콘텐츠 보강하면 상위권 진입 가능)${c.reset}`);
  console.log(`  ${c.dim}${L("검색어",42)}${R("노출",8)}${R("클릭",7)}${R("CTR",8)}${R("순위",7)}${c.reset}`);
  console.log(`  ${c.dim}${"─".repeat(72)}${c.reset}`);
  for (const r of striking.slice(0, 15))
    console.log(`  ${L(r.keys[0],42)}${R(Math.round(r.impressions).toLocaleString(),8)}${R(Math.round(r.clicks),7)}${R((r.ctr*100).toFixed(1)+"%",8)}${R(r.position.toFixed(1),7)}`);
  if (!striking.length) console.log(`  ${c.dim}(없음)${c.reset}`);

  console.log(`\n${c.dim}※ GSC 는 90일치만 보관한다. 장기 추이가 필요하면 주기적으로 받아 저장할 것.${c.reset}\n`);
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); });
