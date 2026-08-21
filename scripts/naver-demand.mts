/**
 * 네이버 검색 수요 조사 — 지식iN·블로그·카페에 "무엇을 얼마나 묻고 쓰는가".
 *
 * 왜: 2026-08-20 실측에서 **명리 개념 글이 유입 1인당 3,000원**(연예인 글 1,041원의 2.9배)을
 *     만든다는 게 나왔다. 그런데 "어떤 개념을 쓸지"는 감으로 고르고 있었다.
 *     지식iN 질문 수 = 실제 수요다. 그걸로 다음에 쓸 글을 정한다.
 *
 * 같이 보는 것:
 *  - 블로그 글 수 → 브랜드 후기 자산 현황 (두루미 vs 경쟁사)
 *  - 카페 글 수 → 커뮤니티에서 얼마나 회자되는지
 *
 * 인증: NAVER API HUB (ncloud). `.env.local` 의 NCP_APIGW_KEY_ID / NCP_APIGW_KEY
 *   ★2026-07-31 부로 developers.naver.com 신규 신청은 종료됐다. HUB 로만 발급된다.
 *   ★엔드포인트/헤더가 구 방식과 완전히 다르다:
 *      구:  openapi.naver.com/v1/search/kin.json   X-Naver-Client-Id / -Secret
 *      HUB: naverapihub.apigw.ntruss.com/search/v1/kin  X-NCP-APIGW-API-KEY-ID / -KEY
 *   ★Data Lab(검색어트렌드)만 게이트웨이가 다르다(naveropenapi.apigw.ntruss.com) — 별도 구독 필요.
 *
 * 한도: 검색 통합 일 25,000 / 월 775,000. 이 스크립트는 1회 실행에 ~120건 쓴다.
 *
 * 실행: npx tsx scripts/naver-demand.mts [카테고리...]
 *       예) npx tsx scripts/naver-demand.mts 꿈 신살
 */
import { readFileSync, readdirSync } from "fs";

const env: Record<string, string> = {};
for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim();
}
const H = {
  "X-NCP-APIGW-API-KEY-ID": env.NCP_APIGW_KEY_ID,
  "X-NCP-APIGW-API-KEY": env.NCP_APIGW_KEY,
};
if (!H["X-NCP-APIGW-API-KEY-ID"]) { console.error(".env.local 에 NCP_APIGW_KEY_ID / NCP_APIGW_KEY 필요"); process.exit(1); }

const c = { reset:"\x1b[0m", dim:"\x1b[2m", bold:"\x1b[1m", cyan:"\x1b[36m", green:"\x1b[32m", yellow:"\x1b[33m", red:"\x1b[31m" };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const L = (s: any, n: number) => { const t = String(s); return t.length > n ? t.slice(0, n-1)+"…" : t.padEnd(n); };
const R = (s: any, n: number) => String(s).padStart(n);

/**
 * ★★ total 은 "그 검색어에 대한 문서 수"가 **아니다**. 절대 그대로 보고하지 말 것.
 *
 * 2026-08-21 실제 사고: `두루미사주` total = 1,919 를 "후기가 1,919건 있다"로 보고했는데,
 * 결과를 열어보니 전부 무관한 글이었다 — "꽃의 말 제라늄"(두루미=새), "전포 두루미"(오겹살
 * 맛집), "여우와 두루미"(우화), "한덕수 총리 두루미상"(관상)…
 * 네이버는 **토큰을 쪼개 OR 로 긁고, 쿼리에 따옴표를 넣어도 total 은 그대로**다.
 * 실제 두루미 후기는 **0건**이었다.
 *
 * 그래서 이 스크립트는 total 을 **상한(upper bound)** 으로만 쓰고,
 * 브랜드처럼 오탐이 치명적인 항목은 반드시 sampleRate() 로 실측 비율을 곱한다.
 */
async function upperBound(kind: Kind, query: string): Promise<number> {
  const j = await call(kind, query, 1, 1);
  return j?.total ?? 0;
}

type Kind = "kin" | "blog" | "cafearticle";

async function call(kind: Kind, query: string, display: number, start: number): Promise<any> {
  const url = `https://naverapihub.apigw.ntruss.com/search/v1/${kind}` +
    `?query=${encodeURIComponent(query)}&display=${display}&start=${start}`;
  for (let a = 0; a < 3; a++) {
    const r = await fetch(url, { headers: H });
    if (r.ok) return r.json();
    if (r.status === 429) { await sleep(3000); continue; }   // 키당 50 RPS
    throw new Error(`${kind}/${query} → ${r.status} ${(await r.text()).slice(0, 120)}`);
  }
  return null;
}

const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/**
 * 상위 N건을 실제로 열어 "정말 그 대상을 다룬 글"의 비율을 잰다.
 * total × 이 비율 = 믿을 수 있는 추정치. 비율이 낮으면 total 은 쓰레기라는 뜻이다.
 */
async function sampleRate(kind: Kind, query: string, must: RegExp, n = 100)
  : Promise<{ rate: number; checked: number; hits: string[] }> {
  let checked = 0, hit = 0; const hits: string[] = [];
  for (let start = 1; start <= n - 49; start += 50) {
    const j = await call(kind, query, 50, start);
    for (const it of (j?.items ?? [])) {
      checked++;
      const text = `${strip(it.title)} ${strip(it.description)} ${it.link ?? ""}`;
      if (must.test(text)) { hit++; if (hits.length < 5) hits.push(strip(it.title).slice(0, 46)); }
    }
    if (!j?.items?.length) break;
    await sleep(200);
  }
  return { rate: checked ? hit / checked : 0, checked, hits };
}

/**
 * 사전(/dict)에 이미 페이지가 있는 주제인지 — 없으면 '빈칸'이 곧 기회다.
 *
 * ★손으로 목록을 유지하지 않는다. 2026-08-21 첫 버전에서 하드코딩했다가
 *   일간 10종·60갑자·12신살이 전부 "사전 없음"으로 오탐났다(실제로는 다 있었다).
 *   lib/dict/data/ 를 직접 읽어 name/meta.title 에서 한글 용어를 긁는다.
 */
function loadDictTerms(): Set<string> {
  const terms = new Set<string>();
  const root = "lib/dict/data";
  for (const cat of readdirSync(root)) {
    for (const f of readdirSync(`${root}/${cat}`)) {
      const src = readFileSync(`${root}/${cat}/${f}`, "utf-8").slice(0, 1500);
      for (const m of src.matchAll(/(?:name|title):\s*"([^"]+)"/g)) {
        // "병(丙) — 병화 일간의 성격…" 같은 제목에서 한글 덩어리만 추출
        for (const w of m[1].matchAll(/[가-힣]{2,6}/g)) terms.add(w[0]);
      }
    }
  }
  return terms;
}
const DICT_TERMS = loadDictTerms();
/** 검색어가 사전 용어를 품고 있거나 그 반대면 커버된 것으로 본다(병화일간 ↔ 병화). */
const hasDict = (q: string) => {
  for (const t of DICT_TERMS) if (t.length >= 2 && (q.includes(t) || t.includes(q))) return true;
  return false;
};

const GROUPS: Record<string, string[]> = {
  강약: ["신강","신약","중화신강","중화신약","태강","태약","극왕","극약"],
  합충: ["정임합","갑기합","을경합","병신합","무계합","자오충","묘유충","인신충","사해충","축미충","진술충","삼합","육합","방합"],
  일간: ["갑목일간","을목일간","병화일간","정화일간","무토일간","기토일간","경금일간","신금일간","임수일간","계수일간"],
  신살: ["도화살","역마살","화개살","홍염살","백호살","괴강살","원진살","귀문관살","탕화살","고란살","12신살"],
  일주: ["무오일주","기사일주","을유일주","경신일주","신사일주","갑자일주","병오일주","임자일주"],
  꿈: ["이빨빠지는꿈","돌아가신분꿈","똥꿈","뱀꿈","물꿈","불꿈","임신꿈","돈줍는꿈","도둑꿈","결혼식꿈"],
};

/**
 * 브랜드는 오탐이 치명적이라 **반드시 표본 검증**을 건다.
 * must = "이 글이 정말 그 브랜드를 다뤘는가"를 가르는 정규식.
 * ownLink = 자사 채널이면 외부 후기가 아니다(두루미는 상위 100건 중 6건이 전부 자사였다).
 */
const BRANDS: { name: string; must: RegExp; own?: RegExp }[] = [
  { name: "두루미사주",  must: /두루미\s*사주|사주보는\s*두루미|durumisaju/i, own: /durumi_log|durumisaju/i },
  { name: "사주아이",    must: /사주\s*아이|saju-kid|990\s*원?\s*사주/i },
  { name: "점신",       must: /점신/ },
  { name: "포스텔러",    must: /포스텔러|forceteller/i },
  { name: "헬로우봇",    must: /헬로우\s*봇|hellobot/i },
];

async function main() {
  const only = process.argv.slice(2);
  const groups = only.length ? Object.fromEntries(Object.entries(GROUPS).filter(([k]) => only.includes(k))) : GROUPS;

  console.log(`\n${c.bold}${c.cyan}네이버 검색 수요 조사${c.reset}  ${c.dim}지식iN 질문 수 = 실제 수요${c.reset}`);
  console.log(`${c.dim}실행 ${new Date().toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} KST${c.reset}`);

  for (const [cat, terms] of Object.entries(groups)) {
    const rows: { t: string; kin: number; blog: number; dict: boolean }[] = [];
    for (const t of terms) {
      rows.push({ t, kin: await upperBound("kin", t), blog: await upperBound("blog", t), dict: hasDict(t) });
      await sleep(120);
    }
    rows.sort((a, b) => b.kin - a.kin);
    console.log(`\n${c.bold}━━ ${cat} ━━${c.reset}`);
    console.log(`  ${c.dim}${L("검색어",16)}${R("지식iN 질문",12)}${R("블로그 글",11)}   사전${c.reset}`);
    console.log(`  ${c.dim}${"─".repeat(48)}${c.reset}`);
    for (const r of rows) {
      const gap = !r.dict && r.kin >= 500 ? `${c.yellow} ← 사전 없음${c.reset}` : "";
      console.log(`  ${L(r.t,16)}${R(r.kin.toLocaleString(),12)}${R(r.blog.toLocaleString(),11)}   ${r.dict?c.green+"O"+c.reset:c.dim+"-"+c.reset}${gap}`);
    }
  }

  console.log(`\n${c.bold}━━ 브랜드 — 후기 자산 현황 ${c.dim}(표본 100건 검증)${c.reset}${c.bold} ━━${c.reset}`);
  console.log(`  ${c.dim}${L("브랜드",14)}${R("total",9)}${R("적중률",8)}${R("실질추정",10)}${R("자사글",7)}${c.reset}`);
  console.log(`  ${c.dim}${"─".repeat(50)}${c.reset}`);
  for (const b of BRANDS) {
    const tot = await upperBound("blog", b.name);
    const s = await sampleRate("blog", b.name, b.must);
    const own = b.own ? (await sampleRate("blog", b.name, b.own)).rate : 0;
    const real = Math.round(tot * s.rate);
    const bad = s.rate < 0.3;
    console.log(
      `  ${b.own?c.green:""}${L(b.name,14)}${c.reset}${R(tot.toLocaleString(),9)}` +
      `${bad?c.red:""}${R((s.rate*100).toFixed(0)+"%",8)}${c.reset}` +
      `${R(real.toLocaleString(),10)}${R(own?(own*100).toFixed(0)+"%":"—",7)}` +
      (bad ? `${c.red}  ← total 신뢰불가${c.reset}` : "")
    );
    if (s.hits.length) console.log(`  ${c.dim}   예) ${s.hits.slice(0,2).join(" / ")}${c.reset}`);
  }

  console.log(`\n${c.dim}※ 지식iN 질문이 많은데 사전 페이지가 없으면 = 수요는 있고 공급이 없는 자리.${c.reset}`);
  console.log(`${c.red}※ total 은 상한일 뿐이다. 네이버는 토큰을 쪼개 OR 로 긁고 따옴표도 무시한다.${c.reset}`);
  console.log(`${c.red}  '두루미사주' total 1,919 의 실제 내용은 오겹살집·우화·관상이었다(진짜 후기 0건).${c.reset}`);
  console.log(`${c.red}  적중률 30% 미만이면 total 을 인용하지 말 것. 자사글 비율이 높으면 외부 후기가 아니다.${c.reset}\n`);
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); });
