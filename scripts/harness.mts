/**
 * 두루미 통합 분석 하네스 — 흩어진 소스를 한 번에 모아 **사슬**로 본다.
 *
 * 왜 만들었나 (2026-08-21):
 *  - 소스가 8개인데 전부 따로 돌리고 눈으로 대조하고 있었다. 그러다 이틀간 8번 틀렸다.
 *    "사전이 병목"(Vercel 페이지뷰 오독), "후기 1,919건"(네이버 total 오독) 같은 것들.
 *  - 개별 숫자가 아니라 **채널 간 연결**을 봐야 판단이 선다.
 *    유튜브 도달 → 브랜드 검색 → 홈 랜딩 → 결제 가 한 줄로 이어지는지.
 *  - GSC 는 90일치만 보관한다. **스냅샷을 남기지 않으면 과거가 사라진다.**
 *
 * 원칙:
 *  - 수집기 하나가 죽어도 나머지는 진행한다(부분 실패 허용, 실패는 명시).
 *  - 모든 지표에 "무엇이 아닌가"를 붙인다. 상세는 docs/METRICS.md.
 *  - 매 실행마다 JSON 스냅샷을 남겨 시계열을 쌓는다.
 *
 * 실행: npx tsx scripts/harness.mts            (기본: 30일)
 *       npx tsx scripts/harness.mts --days=14
 *       npx tsx scripts/harness.mts --full     (느린 수집기까지: 네이버 수요·트렌드)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import crypto from "crypto";

// ── 설정 ────────────────────────────────────────────────
const env: Record<string, string> = {};
for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([^#=]+)=["']?(.+?)["']?$/); if (m) env[m[1].trim()] = m[2].trim();
}
const DAYS = Number(process.argv.find(a=>a.startsWith("--days="))?.split("=")[1] ?? 30);
const FULL = process.argv.includes("--full");
const SNAP_DIR = "data/harness";

const c = { reset:"\x1b[0m", dim:"\x1b[2m", bold:"\x1b[1m", cyan:"\x1b[36m", green:"\x1b[32m",
            yellow:"\x1b[33m", red:"\x1b[31m", mag:"\x1b[35m" };
const L=(s:any,n:number)=>{const t=String(s);return t.length>n?t.slice(0,n-1)+"…":t.padEnd(n);};
const R=(s:any,n:number)=>String(s).padStart(n);
const won=(n:number)=>`${Math.round(n).toLocaleString()}원`;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

type Section = { ok: boolean; note?: string; [k: string]: any };
const OUT: Record<string, Section> = {};

async function collect(name: string, fn: () => Promise<Section>) {
  process.stderr.write(`${c.dim}  … ${name}${c.reset}\n`);
  try { OUT[name] = await fn(); }
  catch (e: any) { OUT[name] = { ok: false, note: (e.message ?? String(e)).slice(0, 160) }; }
}

// ── 1. Supabase — 가입·결제·채널 ─────────────────────────
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
/** ★Supabase select 는 기본 1000행에서 잘린다. 집계는 반드시 페이지네이션. */
async function all<T>(build:(a:number,b:number)=>any): Promise<T[]> {
  const P=1000, out:T[]=[];
  for (let i=0;;i+=P) { const {data,error}=await build(i,i+P-1); if(error) throw error;
    if(!data?.length) break; out.push(...data); if(data.length<P) break; }
  return out;
}
function bucket(p: string|null): string {
  if (!p) return "(없음)";
  const q = p.split("?")[0];
  if (q.startsWith("/dict")) return "사전";
  if (q.startsWith("/stories")) return "매거진";
  if (q === "/") return "홈";
  if (q.includes("/result/share")) return "공유결과지";
  if (q.startsWith("/start")) return "/start";
  return "기타";
}

async function supabaseSection(): Promise<Section> {
  const since = new Date(Date.now() - DAYS*86400_000).toISOString();
  const users = await all<any>((a,b)=> sb.from("users").select("id, landing_path, referrer, utm_source, created_at").gte("created_at",since).range(a,b));
  const pays  = await all<any>((a,b)=> sb.from("payment_transactions").select("user_id, amount, created_at").eq("status","success").range(a,b));
  const paid = new Map<string,{n:number;sum:number}>();
  for (const p of pays) { if(!p.user_id) continue; const v=paid.get(p.user_id)||{n:0,sum:0}; v.n++; v.sum+=p.amount||0; paid.set(p.user_id,v); }

  const byLanding = new Map<string,{s:number;p:number;rev:number}>();
  const byChannel = new Map<string,{s:number;p:number;rev:number}>();
  for (const u of users) {
    const add=(m:Map<string,any>,k:string)=>{ const a=m.get(k)||{s:0,p:0,rev:0}; a.s++;
      const pd=paid.get(u.id); if(pd){a.p++;a.rev+=pd.sum;} m.set(k,a); };
    add(byLanding, bucket(u.landing_path));
    add(byChannel, u.utm_source ? `캠페인(${u.utm_source})`
      : !u.referrer ? "직접/추적전"
      : /search\.naver/.test(u.referrer) ? "네이버검색"
      : /naver/.test(u.referrer) ? "네이버기타"
      : /google/.test(u.referrer) ? "구글검색"
      : /kakao/.test(u.referrer) ? "카카오톡" : "기타");
  }
  const revenue = users.reduce((s,u)=>s+(paid.get(u.id)?.sum ?? 0),0);
  const payers  = users.filter(u=>paid.get(u.id)).length;
  return { ok:true, signups: users.length, payers, revenue,
    payRate: users.length ? payers/users.length : 0,
    revPerSignup: users.length ? revenue/users.length : 0,
    byLanding: Object.fromEntries(byLanding), byChannel: Object.fromEntries(byChannel) };
}

// ── 2. GSC — 자연검색 ────────────────────────────────────
async function gscSection(): Promise<Section> {
  const key = JSON.parse(readFileSync("gsc-key.json","utf-8"));
  const now = Math.floor(Date.now()/1000);
  const b64=(s:any)=>Buffer.from(s).toString("base64url");
  const claim={iss:key.client_email,scope:"https://www.googleapis.com/auth/webmasters.readonly",aud:"https://oauth2.googleapis.com/token",exp:now+3600,iat:now};
  const unsigned=`${b64(JSON.stringify({alg:"RS256",typ:"JWT"}))}.${b64(JSON.stringify(claim))}`;
  const jwt=`${unsigned}.${b64(crypto.createSign("RSA-SHA256").update(unsigned).sign(key.private_key))}`;
  const tr=await (await fetch("https://oauth2.googleapis.com/token",{method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt})})).json();
  const tok=tr.access_token; if(!tok) throw new Error("GSC 토큰 실패");
  const site="sc-domain:durumisaju.com";
  // ★GSC 는 2~3일 지연. 끝날짜를 3일 전으로.
  const end=new Date(Date.now()-3*86400_000).toISOString().slice(0,10);
  const start=new Date(Date.now()-(DAYS+3)*86400_000).toISOString().slice(0,10);
  const q=async(dims:string[])=> (await (await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {method:"POST",headers:{Authorization:`Bearer ${tok}`,"Content-Type":"application/json"},
     body:JSON.stringify({startDate:start,endDate:end,dimensions:dims,rowLimit:1000})})).json()).rows ?? [];
  const tot=(await q([]))[0] ?? {};
  const rows=await q(["query"]);
  const brand=rows.filter((r:any)=>/두루미/.test(r.keys[0]));
  const lowCtr=rows.filter((r:any)=>r.impressions>=100 && r.ctr<0.02);
  const striking=rows.filter((r:any)=>r.position>=8&&r.position<=20&&r.impressions>=50);
  return { ok:true, window:`${start}~${end}`,
    impressions:Math.round(tot.impressions??0), clicks:Math.round(tot.clicks??0),
    ctr:tot.ctr??0, position:tot.position??0,
    brandImpressions: brand.reduce((s:number,r:any)=>s+r.impressions,0),
    brandClicks: brand.reduce((s:number,r:any)=>s+r.clicks,0),
    lowCtrCount: lowCtr.length,
    lowCtrLostClicks: Math.round(lowCtr.reduce((s:number,r:any)=>s+r.impressions*0.078-r.clicks,0)), // 정임합 CTR 7.8% 기준 기회손실
    lowCtrTop: lowCtr.sort((a:any,b:any)=>b.impressions-a.impressions).slice(0,5).map((r:any)=>({q:r.keys[0],imp:Math.round(r.impressions),ctr:+(r.ctr*100).toFixed(1),pos:+r.position.toFixed(1)})),
    strikingTop: striking.sort((a:any,b:any)=>b.impressions-a.impressions).slice(0,5).map((r:any)=>({q:r.keys[0],imp:Math.round(r.impressions),pos:+r.position.toFixed(1)})) };
}

// ── 3. 네이버 검색광고 ────────────────────────────────────
async function adsSection(): Promise<Section> {
  const K=env.NAVER_SEARCHAD_ACCESS_LICENSE,S=env.NAVER_SEARCHAD_SECRET_KEY,C=env.NAVER_SEARCHAD_CUSTOMER_ID;
  const api=async(uri:string,qs="")=>{ const ts=Date.now();
    const sig=crypto.createHmac("sha256",S).update(`${ts}.GET.${uri}`).digest("base64");
    const r=await fetch(`https://api.searchad.naver.com${uri}${qs}`,{headers:{"Content-Type":"application/json; charset=UTF-8","X-Timestamp":String(ts),"X-API-KEY":K,"X-Customer":C,"X-Signature":sig}});
    if(!r.ok) throw new Error(`${uri} ${r.status}`); return r.json(); };
  const today=new Date(Date.now()+9*3600*1000).toISOString().slice(0,10);
  const since=new Date(Date.now()+9*3600*1000-DAYS*86400_000).toISOString().slice(0,10);
  let imp=0,clk=0,cost=0,conv=0;
  for (const cp of await api("/ncc/campaigns")) {
    const f=encodeURIComponent(JSON.stringify(["impCnt","clkCnt","salesAmt","ccnt"]));
    const t=encodeURIComponent(JSON.stringify({since,until:today}));
    for (const d of ((await api("/stats",`?id=${cp.nccCampaignId}&fields=${f}&timeRange=${t}`)).data ?? []))
      { imp+=d.impCnt||0; clk+=d.clkCnt||0; cost+=d.salesAmt||0; conv+=d.ccnt||0; }
  }
  return { ok:true, impressions:imp, clicks:clk, cost, conversions:conv,
    ctr: imp?clk/imp:0, cpc: clk?cost/clk:0,
    note: conv===0 ? "전환 0 — 네이버 전환추적 검수 미완 가능성" : undefined };
}

// ── 4. YouTube — 도달 ────────────────────────────────────
async function ytSection(): Promise<Section> {
  const P="/Users/kunjoo/projects/durumi-yt-stats";
  if (!existsSync(`${P}/token.json`)) throw new Error("durumi-yt-stats token.json 없음");
  const t=JSON.parse(readFileSync(`${P}/token.json`,"utf-8"));
  const cs=JSON.parse(readFileSync(`${P}/client_secret.json`,"utf-8")).installed ?? JSON.parse(readFileSync(`${P}/client_secret.json`,"utf-8")).web;
  const tr=await (await fetch("https://oauth2.googleapis.com/token",{method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:cs.client_id,client_secret:cs.client_secret,refresh_token:t.refresh_token,grant_type:"refresh_token"})})).json();
  if(!tr.access_token) throw new Error("YT 토큰 갱신 실패");
  const ch=await (await fetch("https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true",
    {headers:{Authorization:`Bearer ${tr.access_token}`}})).json();
  const st=ch.items?.[0]?.statistics ?? {};
  return { ok:true, subscribers:+(st.subscriberCount??0), totalViews:+(st.viewCount??0), videos:+(st.videoCount??0) };
}

// ── 5. (--full) 네이버 수요·시즌성 ────────────────────────
async function naverSection(): Promise<Section> {
  const H={"X-NCP-APIGW-API-KEY-ID":env.NCP_APIGW_KEY_ID,"X-NCP-APIGW-API-KEY":env.NCP_APIGW_KEY,"Content-Type":"application/json"};
  const tr=await (await fetch("https://naverapihub.apigw.ntruss.com/search-trend/v1/search",{method:"POST",headers:H,
    body:JSON.stringify({startDate:"2025-08-01",endDate:new Date().toISOString().slice(0,10),timeUnit:"month",
      keywordGroups:[{groupName:"신년운세",keywords:["신년운세","새해운세","토정비결"]}]})})).json();
  const d=(tr.results?.[0]?.data ?? []) as {period:string;ratio:number}[];
  const pk=d.length?d.reduce((a,b)=>b.ratio>a.ratio?b:a):null;
  const rise=pk?d.find(x=>x.ratio>=pk.ratio*0.2):null;
  return { ok:true, newYearPeak:pk?.period.slice(0,7), newYearRise:rise?.period.slice(0,7) };
}

// ── 실행 ────────────────────────────────────────────────
async function main() {
  const t0=Date.now();
  process.stderr.write(`${c.dim}수집 중…${c.reset}\n`);
  await collect("supabase", supabaseSection);
  await collect("gsc", gscSection);
  await collect("ads", adsSection);
  await collect("youtube", ytSection);
  if (FULL) await collect("naver", naverSection);

  const S=OUT.supabase, G=OUT.gsc, A=OUT.ads, Y=OUT.youtube;
  const stamp=new Date().toLocaleString("ko-KR",{timeZone:"Asia/Seoul"});

  console.log(`\n${c.bold}${c.cyan}🥚 두루미 통합 하네스${c.reset}  ${c.dim}최근 ${DAYS}일 · ${stamp} KST${c.reset}`);
  const failed=Object.entries(OUT).filter(([,v])=>!v.ok);
  if (failed.length) { console.log(`${c.red}수집 실패: ${failed.map(([k,v])=>`${k}(${v.note})`).join(" · ")}${c.reset}`); }

  // ── 사슬: 도달 → 인지 → 유입 → 전환 ───────────────────
  console.log(`\n${c.bold}━━ 사슬 — 도달에서 매출까지 ━━${c.reset}`);
  const chain: [string,string,string][] = [];
  if (Y?.ok) chain.push(["도달", `유튜브 구독 ${Y.subscribers.toLocaleString()} · 누적조회 ${Y.totalViews.toLocaleString()}`, "영상 "+Y.videos+"개"]);
  if (G?.ok) chain.push(["인지", `브랜드 검색 노출 ${G.brandImpressions.toLocaleString()} · 클릭 ${G.brandClicks.toLocaleString()}`,
                          G.brandImpressions ? `CTR ${(G.brandClicks/G.brandImpressions*100).toFixed(0)}%` : ""]);
  if (G?.ok) chain.push(["유입", `자연검색 노출 ${G.impressions.toLocaleString()} · 클릭 ${G.clicks.toLocaleString()}`, `CTR ${(G.ctr*100).toFixed(2)}% · 평균 ${G.position.toFixed(1)}위`]);
  if (S?.ok) chain.push(["가입", `${S.signups.toLocaleString()}명`, ""]);
  if (S?.ok) chain.push(["결제", `${S.payers.toLocaleString()}명 · ${won(S.revenue)}`, `결제율 ${(S.payRate*100).toFixed(0)}% · 가입당 ${won(S.revPerSignup)}`]);
  for (const [k,v,x] of chain) console.log(`  ${c.mag}${L(k,6)}${c.reset}${L(v,52)}${c.dim}${x}${c.reset}`);

  // 끊긴 고리 자동 탐지
  if (Y?.ok && G?.ok && Y.totalViews > 0) {
    const per10k = G.brandImpressions / (Y.totalViews/10000);
    console.log(`  ${c.dim}└ 유튜브 누적조회 1만당 브랜드 검색 노출 ${per10k.toFixed(1)}회` +
      (per10k < 30 ? ` ${c.red}← 도달이 인지로 안 넘어감${c.reset}` : c.reset));
  }

  // ── 랜딩별 손익 ──────────────────────────────────────
  if (S?.ok) {
    console.log(`\n${c.bold}━━ 랜딩별 (가입 코호트 · 그들의 전체 결제) ━━${c.reset}`);
    console.log(`  ${c.dim}${L("랜딩",12)}${R("가입",6)}${R("결제자",7)}${R("결제율",8)}${R("매출",11)}${R("가입당",9)}${c.reset}`);
    const rows=Object.entries(S.byLanding as Record<string,any>).sort((a,b)=>b[1].rev-a[1].rev);
    for (const [k,v] of rows) { if(v.s<3) continue;
      console.log(`  ${L(k,12)}${R(v.s,6)}${R(v.p,7)}${R((v.p/v.s*100).toFixed(0)+"%",8)}${R(won(v.rev),11)}${R(won(v.rev/v.s),9)}`); }
  }

  // ── 광고 손익 ────────────────────────────────────────
  if (A?.ok && S?.ok) {
    const adSignups=Object.entries(S.byChannel as Record<string,any>)
      .filter(([k])=>k.startsWith("캠페인(naver"))
      .reduce((a,[,v])=>({s:a.s+v.s,rev:a.rev+v.rev}),{s:0,rev:0});
    const roas=A.cost?adSignups.rev/A.cost:0;
    console.log(`\n${c.bold}━━ 광고 손익 ━━${c.reset}`);
    console.log(`  광고비 ${won(A.cost)} · 클릭 ${A.clicks.toLocaleString()} · CPC ${won(A.cpc)} · CTR ${(A.ctr*100).toFixed(2)}%`);
    console.log(`  광고유입 가입 ${adSignups.s}명 · 매출 ${won(adSignups.rev)}`);
    console.log(`  ${roas<1?c.red:c.green}ROAS ${(roas*100).toFixed(0)}%${c.reset}` +
      `  ${c.dim}· CAC ${adSignups.s?won(A.cost/adSignups.s):"—"} vs 가입당매출 ${adSignups.s?won(adSignups.rev/adSignups.s):"—"}${c.reset}` +
      `  ${c.dim}· 클릭→가입 ${A.clicks?(adSignups.s/A.clicks*100).toFixed(1):"—"}%${c.reset}`);
    if (A.note) console.log(`  ${c.yellow}⚠ ${A.note}${c.reset}`);
  }

  // ── 즉시 개선 가능한 자리 ─────────────────────────────
  if (G?.ok) {
    console.log(`\n${c.bold}${c.yellow}━━ 손 대면 바로 오르는 자리 ━━${c.reset}`);
    console.log(`  ${c.dim}노출 100+ · CTR 2% 미만 (제목·메타 수정) — ${G.lowCtrCount}건, 기회손실 약 ${G.lowCtrLostClicks.toLocaleString()}클릭${c.reset}`);
    for (const r of G.lowCtrTop) console.log(`    ${L(r.q,22)}노출 ${R(r.imp.toLocaleString(),7)} · CTR ${R(r.ctr+"%",6)} · ${r.pos}위`);
    console.log(`  ${c.dim}순위 8~20위 · 노출 50+ (콘텐츠 보강)${c.reset}`);
    for (const r of G.strikingTop) console.log(`    ${L(r.q,22)}노출 ${R(r.imp.toLocaleString(),7)} · ${r.pos}위`);
  }

  // ── 시즌 D-day ───────────────────────────────────────
  if (OUT.naver?.ok) {
    const rise=OUT.naver.newYearRise;                       // 예: "2025-11"
    const nextRise=new Date(`${new Date().getFullYear()}-${rise?.slice(5,7) ?? "11"}-01T00:00:00+09:00`);
    if (nextRise.getTime() < Date.now()) nextRise.setFullYear(nextRise.getFullYear()+1);
    const dday=Math.ceil((nextRise.getTime()-Date.now())/86400_000);
    console.log(`\n${c.bold}━━ 시즌 ━━${c.reset}`);
    console.log(`  신년운세 상승 시작 ${rise} · 피크 ${OUT.naver.newYearPeak}  ${c.yellow}→ 다음 상승기까지 D-${dday}${c.reset}`);
  }

  // ── 스냅샷 저장 (GSC 90일 한계 대응) ───────────────────
  if (!existsSync(SNAP_DIR)) mkdirSync(SNAP_DIR,{recursive:true});
  const day=new Date(Date.now()+9*3600*1000).toISOString().slice(0,10);
  const file=`${SNAP_DIR}/${day}.json`;
  writeFileSync(file, JSON.stringify({ collectedAt:new Date().toISOString(), days:DAYS, ...OUT }, null, 2));
  const snaps=readdirSync(SNAP_DIR).filter(f=>f.endsWith(".json")).sort();
  console.log(`\n${c.dim}스냅샷 저장 ${file}  (누적 ${snaps.length}개) · ${((Date.now()-t0)/1000).toFixed(1)}초${c.reset}`);

  // 직전 스냅샷과 비교
  const prev=snaps.filter(f=>f!==`${day}.json`).pop();
  if (prev) {
    const p=JSON.parse(readFileSync(`${SNAP_DIR}/${prev}`,"utf-8"));
    if (p.supabase?.ok && S?.ok) {
      const d=(a:number,b:number)=>{const v=b-a;return `${v>=0?"+":""}${Math.round(v).toLocaleString()}`;};
      console.log(`${c.dim}직전(${prev.replace(".json","")}) 대비 — 가입 ${d(p.supabase.signups,S.signups)} · 매출 ${d(p.supabase.revenue,S.revenue)}원${c.reset}`);
    }
  }
  console.log(`${c.dim}※ 각 지표가 무엇이 아닌지는 docs/METRICS.md 참조.${c.reset}\n`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
