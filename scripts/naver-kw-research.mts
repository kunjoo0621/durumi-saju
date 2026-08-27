/**
 * 네이버 검색광고 키워드 리서치 — 우리 /dict 238개 항목의 검색량·경쟁도를 실측한다.
 *
 * 왜: 우리 유입의 57%가 /dict 랜딩인데, 광고는 전 키워드가 `/` 로만 떨어진다.
 *     네이버가 이미 채점하고 있다 — "정임합" adRelevanceScore 2/10.
 *     명리 롱테일은 검색량이 있고 광고 경쟁이 0인 구간이 있다. 그걸 찾는다.
 *
 * ★검색 형태로 조합해서 물어본다(갑자→"갑자일주"). 맨 용어는 동음이의어라 쓰레기가 섞인다
 *   (신강=신장/신강(중국), 상관=직장상사, 병인=病因).
 * ★exact match 만 읽는다 — keywordstool 은 연관 키워드를 잔뜩 얹어준다.
 * ★429 잦다. 5개씩·2초 간격·1회 재시도.
 *
 * 실행: npx tsx scripts/naver-kw-research.mts [카테고리...]
 */
import crypto from "crypto";
import { readFileSync } from "fs";

const env: Record<string,string> = {};
for (const l of readFileSync("/Users/kunjoo/projects/durumi-saju/.env.local","utf-8").split("\n")) { const m=l.match(/^([^#=]+)=(.*)$/); if(m) env[m[1].trim()]=m[2].trim(); }
const K=env.NAVER_SEARCHAD_ACCESS_LICENSE, S=env.NAVER_SEARCHAD_SECRET_KEY, C=env.NAVER_SEARCHAD_CUSTOMER_ID;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function api(uri:string, qs=""): Promise<any> {
  for (let a=0;a<2;a++) {
    const ts=Date.now();
    const sig=crypto.createHmac("sha256",S).update(`${ts}.GET.${uri}`).digest("base64");
    const r=await fetch(`https://api.searchad.naver.com${uri}${qs}`,{headers:{"Content-Type":"application/json; charset=UTF-8","X-Timestamp":String(ts),"X-API-KEY":K,"X-Customer":C,"X-Signature":sig}});
    const t=await r.text();
    if (r.ok) return JSON.parse(t);
    if (r.status===429 && a===0) { await sleep(5000); continue; }
    throw new Error(`${uri} ${r.status} ${t.slice(0,120)}`);
  }
}
const num=(v:any)=> typeof v==="string" ? (v.includes("<")?5:parseInt(v.replace(/[^0-9]/g,""))||0) : (v||0);

const terms = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-kunjoo/e36a5cc6-70fe-4694-b95b-519902a11f6d/scratchpad/dict-terms.json","utf-8"));
const only = process.argv.slice(2);
const targets = only.length ? terms.filter((t:any)=>only.includes(t.cat)) : terms;
const found = new Map<string,any>();
for (let i=0;i<targets.length;i+=5) {
  const batch = targets.slice(i,i+5);
  try {
    const r = await api("/keywordstool", `?hintKeywords=${encodeURIComponent(batch.map((b:any)=>b.q).join(","))}&showDetail=1`);
    for (const k of (r.keywordList??[])) found.set(k.relKeyword, k);
  } catch(e:any) { console.error(`  ! ${batch.map((b:any)=>b.q).join(",")} → ${e.message.slice(0,80)}`); }
  await sleep(2000);
  if (i%50===0) console.error(`  …${i}/${targets.length}`);
}
const rows = targets.map((t:any)=>{
  const k = found.get(t.q);
  if(!k) return null;
  const pc=num(k.monthlyPcQcCnt), mo=num(k.monthlyMobileQcCnt);
  return { ...t, pc, mo, tot: pc+mo, comp: k.compIdx, ads: num(k.plAvgDepth) };
}).filter(Boolean).sort((a:any,b:any)=>b.tot-a.tot);

const w=(s:string)=>s.length+(s.match(/[가-힣]/g)?.length??0);
console.log(`\n■ /dict 항목 검색량 실측 — 조회 ${targets.length}개 중 ${rows.length}개 확인\n`);
console.log("  검색어              카테고리   월검색수  (PC/모바일)     경쟁도  광고수  랜딩");
console.log("  "+"─".repeat(96));
for (const r of rows) {
  if (r.tot < 50) continue;
  console.log("  "+r.q+" ".repeat(Math.max(1,20-w(r.q)))
    + r.cat.padEnd(11)
    + String(r.tot).padStart(8)
    + `  (${r.pc}/${r.mo})`.padEnd(16)
    + String(r.comp).padStart(6)
    + String(r.ads).padStart(7)
    + `  /dict/${r.cat}/${r.slug}`);
}
const cheap = rows.filter((r:any)=>r.tot>=100 && r.ads<=2);
console.log(`\n★ 월검색 100+ & 광고 2개 이하(= 경쟁 거의 없음): ${cheap.length}개, 합계 월검색 ${cheap.reduce((a:number,b:any)=>a+b.tot,0).toLocaleString()}회`);
const byCat: Record<string,{n:number,v:number}> = {};
for (const r of rows) { const b=byCat[r.cat]??={n:0,v:0}; b.n++; b.v+=r.tot; }
console.log("\n■ 카테고리별 합계 (월검색량 순)");
for (const [c,v] of Object.entries(byCat).sort((a,b)=>b[1].v-a[1].v)) console.log(`  ${c.padEnd(12)} ${String(v.n).padStart(3)}개  월검색 ${v.v.toLocaleString()}회`);
