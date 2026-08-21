/**
 * 네이버 검색어트렌드 — 시즌성 + 성별·연령대 분해.
 *
 * 왜: ①신년운세·꿈해몽이 언제부터 오르는지 알아야 발행 시점이 정해진다.
 *     ②"두루미 타깃은 35~54세 여성"은 유튜브 시청자 데이터에서 온 가설인데,
 *       검색 수요에서도 같은지 한 번도 확인한 적이 없다. 이게 유일한 무료 검증 수단이다.
 *
 * ★엔드포인트를 찾는 데 애먹었다(2026-08-21). 기록해둔다:
 *     naverapihub.apigw.ntruss.com/datalab/v1/search      → 404
 *     naveropenapi.apigw.ntruss.com/datalab/v1/search     → 401 (구 게이트웨이, 미구독)
 *     naverapihub.apigw.ntruss.com/search-trend/v1/search → 200  ★정답
 *   콘솔 표시명("검색어트렌드")을 따른 경로지 datalab 이 아니다.
 *
 * 한도: 월 50,000 · 일일 제한 없음.
 * ★ratio 는 절대 검색량이 아니라 **구간 내 최댓값을 100 으로 놓은 상대값**이다.
 *   그룹 간 비교는 되지만 "몇 건"으로 읽으면 안 된다. 절대량은 검색광고 키워드도구로.
 *
 * 실행: npx tsx scripts/naver-trend.mts
 */
import { readFileSync } from "fs";

const env: Record<string, string> = {};
for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim();
}
const H = {
  "X-NCP-APIGW-API-KEY-ID": env.NCP_APIGW_KEY_ID,
  "X-NCP-APIGW-API-KEY": env.NCP_APIGW_KEY,
  "Content-Type": "application/json",
};
const c = { reset:"\x1b[0m", dim:"\x1b[2m", bold:"\x1b[1m", cyan:"\x1b[36m", green:"\x1b[32m", yellow:"\x1b[33m" };
const L = (s:any,n:number)=>{const t=String(s);return t.length>n?t.slice(0,n-1)+"…":t.padEnd(n);};
const R = (s:any,n:number)=>String(s).padStart(n);
const bar = (v:number,max=100,w=26)=>"█".repeat(Math.round(v/max*w));

type Group = { groupName: string; keywords: string[] };
async function trend(groups: Group[], opt: { timeUnit?: string; startDate?: string; endDate?: string; gender?: "m"|"f"; ages?: string[] } = {}) {
  const body = {
    startDate: opt.startDate ?? "2025-08-01",
    endDate:   opt.endDate   ?? "2026-08-18",
    timeUnit:  opt.timeUnit  ?? "month",
    keywordGroups: groups,
    ...(opt.gender ? { gender: opt.gender } : {}),
    ...(opt.ages ? { ages: opt.ages } : {}),
  };
  const r = await fetch("https://naverapihub.apigw.ntruss.com/search-trend/v1/search", {
    method: "POST", headers: H, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0,200)}`);
  return (await r.json()).results ?? [];
}

/** 여러 그룹의 data 를 합쳐 전체 최댓값을 100 으로 재정규화 — 그룹 간 비교가 가능해진다 */
function peakOf(results: any[]) {
  let mx = 0; for (const g of results) for (const d of g.data) mx = Math.max(mx, d.ratio);
  return mx || 1;
}

const AGES: Record<string,string> = { "3":"19~24","4":"25~29","5":"30~34","6":"35~39","7":"40~44","8":"45~49","9":"50~54","10":"55~59","11":"60+" };

async function main() {
  console.log(`\n${c.bold}${c.cyan}네이버 검색어트렌드${c.reset}  ${c.dim}ratio = 구간 최댓값 100 기준 상대값(절대 검색량 아님)${c.reset}`);

  // ── 1. 시즌성 (최근 12개월, 월별) ──────────────────────────
  const SEASON: Group[] = [
    { groupName: "사주",      keywords: ["사주","사주풀이","무료사주"] },
    { groupName: "신년운세",  keywords: ["신년운세","새해운세","토정비결"] },
    { groupName: "궁합",      keywords: ["궁합","사주궁합"] },
    { groupName: "꿈해몽",    keywords: ["꿈해몽","꿈풀이"] },
  ];
  const res = await trend(SEASON);
  const mx = peakOf(res);
  console.log(`\n${c.bold}━━ 시즌성 (최근 12개월) ━━${c.reset}`);
  const months = res[0].data.map((d:any)=>d.period.slice(0,7));
  console.log(`  ${c.dim}${L("월",9)}${res.map((g:any)=>R(g.title,10)).join("")}${c.reset}`);
  console.log(`  ${c.dim}${"─".repeat(9+res.length*10)}${c.reset}`);
  months.forEach((m:string, i:number) => {
    const cells = res.map((g:any)=>{
      const v = g.data[i]?.ratio ?? 0, pct = Math.round(v/mx*100);
      return R(pct >= 80 ? `${c.yellow}${pct}${c.reset}` : String(pct), pct>=80?10+9:10);
    }).join("");
    console.log(`  ${L(m,9)}${cells}`);
  });
  console.log(`  ${c.dim}※ 100 = 이 표 전체의 최고점. 80 이상은 노란색.${c.reset}`);

  // ── 2. 세그먼트별 '시즌 시점' ──────────────────────────────
  //
  // ★★ 하지 말 것: 성별·연령대를 따로 조회해 평균을 내고 비중으로 나누는 것.
  //    ratio 는 **요청 구간 안에서 최댓값을 100 으로 놓은 상대값**이라,
  //    세그먼트를 따로 부르면 각자 자기 구간에서 정규화된다. 그걸 나누면
  //    무조건 균등하게 나온다(2026-08-21 실제로 전 연령대가 10~12% 로 나왔다).
  //    네이버 검색어트렌드는 **세그먼트 간 크기 비교를 지원하지 않는다.**
  //    연령·성별 비중이 필요하면 GA4/유튜브 애널리틱스처럼 원천이 다른 데서 봐야 한다.
  //
  // ✅ 유효한 것: 같은 세그먼트 **안에서의 시간 축 비교**.
  //    "이 세그먼트에서는 신년운세가 몇 월에 뜨는가"는 정확히 답할 수 있다.
  const SEG: { label: string; opt: any }[] = [
    { label: "전체",       opt: {} },
    { label: "남성",       opt: { gender: "m" } },
    { label: "여성",       opt: { gender: "f" } },
    { label: "35~44세",    opt: { ages: ["6","7"] } },
    { label: "45~54세",    opt: { ages: ["8","9"] } },
  ];
  const TOPIC: Group[] = [{ groupName: "신년운세", keywords: ["신년운세","새해운세","토정비결"] }];
  console.log(`\n${c.bold}━━ 세그먼트별 신년운세 시즌 시점 ━━${c.reset}  ${c.dim}(세그먼트 간 크기 비교는 불가 — 시점만 본다)${c.reset}`);
  console.log(`  ${c.dim}${L("세그먼트",10)}${L("피크 월",10)}${L("상승 시작(피크의 20% 도달)",28)}${c.reset}`);
  console.log(`  ${c.dim}${"─".repeat(48)}${c.reset}`);
  for (const s of SEG) {
    try {
      const r = await trend(TOPIC, s.opt);
      const d = r[0].data as { period: string; ratio: number }[];
      const pk = d.reduce((a,b)=> b.ratio>a.ratio?b:a);
      const rise = d.find(x => x.ratio >= pk.ratio * 0.2);
      console.log(`  ${L(s.label,10)}${c.yellow}${L(pk.period.slice(0,7),10)}${c.reset}${L(rise?.period.slice(0,7) ?? "—",28)}`);
    } catch (e:any) { console.log(`  ${L(s.label,10)}조회 실패 ${e.message.slice(0,40)}`); }
    await new Promise(r=>setTimeout(r,150));
  }
  console.log(`  ${c.dim}※ '상승 시작' = 콘텐츠·광고를 준비해야 하는 시점.${c.reset}\n`);
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); });
