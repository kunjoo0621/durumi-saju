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

const c = { reset:"\x1b[0m", dim:"\x1b[2m", bold:"\x1b[1m", cyan:"\x1b[36m", green:"\x1b[32m", yellow:"\x1b[33m" };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const L = (s: any, n: number) => { const t = String(s); return t.length > n ? t.slice(0, n-1)+"…" : t.padEnd(n); };
const R = (s: any, n: number) => String(s).padStart(n);

/** total = 해당 검색어의 전체 문서 수 = 수요/공급의 크기 */
async function total(kind: "kin" | "blog" | "cafearticle", query: string): Promise<number> {
  const url = `https://naverapihub.apigw.ntruss.com/search/v1/${kind}?query=${encodeURIComponent(query)}&display=1`;
  for (let a = 0; a < 3; a++) {
    const r = await fetch(url, { headers: H });
    if (r.ok) return (await r.json()).total ?? 0;
    if (r.status === 429) { await sleep(3000); continue; }   // 키당 50 RPS
    throw new Error(`${kind}/${query} → ${r.status} ${(await r.text()).slice(0, 120)}`);
  }
  return 0;
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

const BRANDS = ["두루미사주","사주보는두루미","사주아이","점신","포스텔러"];

async function main() {
  const only = process.argv.slice(2);
  const groups = only.length ? Object.fromEntries(Object.entries(GROUPS).filter(([k]) => only.includes(k))) : GROUPS;

  console.log(`\n${c.bold}${c.cyan}네이버 검색 수요 조사${c.reset}  ${c.dim}지식iN 질문 수 = 실제 수요${c.reset}`);
  console.log(`${c.dim}실행 ${new Date().toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} KST${c.reset}`);

  for (const [cat, terms] of Object.entries(groups)) {
    const rows: { t: string; kin: number; blog: number; dict: boolean }[] = [];
    for (const t of terms) {
      rows.push({ t, kin: await total("kin", t), blog: await total("blog", t), dict: hasDict(t) });
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

  console.log(`\n${c.bold}━━ 브랜드 — 후기 자산 현황 ━━${c.reset}`);
  console.log(`  ${c.dim}${L("브랜드",16)}${R("블로그 글",11)}${R("카페 글",10)}${R("지식iN",9)}${c.reset}`);
  console.log(`  ${c.dim}${"─".repeat(48)}${c.reset}`);
  for (const b of BRANDS) {
    const [blog, cafe, kin] = [await total("blog", b), await total("cafearticle", b), await total("kin", b)];
    const me = b.includes("두루미");
    console.log(`  ${me?c.green:""}${L(b,16)}${c.reset}${R(blog.toLocaleString(),11)}${R(cafe.toLocaleString(),10)}${R(kin.toLocaleString(),9)}`);
    await sleep(120);
  }

  console.log(`\n${c.dim}※ 지식iN 질문이 많은데 사전 페이지가 없으면 = 수요는 있고 공급이 없는 자리.${c.reset}`);
  console.log(`${c.dim}※ total 은 네이버가 보유한 문서 수 추정치라 절대값보다 상대 비교로 볼 것.${c.reset}\n`);
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); });
