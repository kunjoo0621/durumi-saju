/**
 * 강약 12운성 버그 — 실제 사용자 영향 실측.
 * 현행(12운성 OR 본기) vs 수정안(12운성 제거 + 지장간 전층 통근)으로
 * 실 사용자 원국의 8단계·진영이 몇 명이나 바뀌는지 센다.
 * ★TZ=UTC 필수.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";


const env: Record<string, string> = {};
for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([^#=]+)=["']?(.+?)["']?$/); if (m) env[m[1].trim()] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function all<T>(build: (a:number,b:number)=>any): Promise<T[]> {
  const P = 1000, out: T[] = [];
  for (let i = 0; ; i += P) {
    const { data, error } = await build(i, i + P - 1); if (error) throw error;
    if (!data?.length) break; out.push(...data); if (data.length < P) break;
  }
  return out;
}
const SEL:Record<string,string>={甲:"목",乙:"목",丙:"화",丁:"화",戊:"토",己:"토",庚:"금",辛:"금",壬:"수",癸:"수"};
const GEN:Record<string,string>={목:"화",화:"토",토:"금",금:"수",수:"목"};
const genMe=(e:string)=>Object.keys(GEN).find(k=>GEN[k]===e)!;
const BRs=["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const YANG=new Set(["甲","丙","戊","庚","壬"]);
const JS:Record<string,string>={甲:"亥",丙:"寅",戊:"寅",庚:"巳",壬:"申",乙:"午",丁:"酉",己:"酉",辛:"子",癸:"卯"};
const NM=["장생","목욕","관대","건록","제왕","쇠","병","사","묘","절","태","양"];
const PROS=new Set(["장생","관대","건록","제왕"]);
const stage=(s:string,b:string)=>{const bi=BRs.indexOf(JS[s]),ti=BRs.indexOf(b);
  return NM[YANG.has(s)?((ti-bi+12)%12):((bi-ti+12)%12)];};
const { BRANCH_INFO } = await import("../lib/utils/saju-enrichment");
const BI = BRANCH_INFO as any;
const bongi=(b:string)=>BI[b].jijanggan[0].stem;
const cur=(s:string,b:string)=>{ if(PROS.has(stage(s,b)))return true;
  const e=SEL[bongi(b)]; return e===SEL[s]||GEN[e]===SEL[s];};
const fix=(s:string,b:string)=>{ if(BI[b].jijanggan.some((j:any)=>SEL[j.stem]===SEL[s]))return true;
  return SEL[bongi(b)]===genMe(SEL[s]);};
function level(f:(s:string,b:string)=>boolean, stems:string[], brs:string[], timeUnknown:boolean){
  const ds=stems[2], de=SEL[ds], gm=genMe(de);
  const dist:Record<string,number>={목:0,화:0,토:0,금:0,수:0};
  const useStems = timeUnknown? stems.slice(0,3): stems;
  const useBrs   = timeUnknown? brs.slice(0,3):   brs;
  for(const st of useStems) dist[SEL[st]]++;
  for(const b of useBrs) dist[BI[b].element]++;
  const total=useStems.length+useBrs.length, help=dist[de]+dist[gm], resist=Math.max(0,total-help);
  const dr=f(ds,brs[1]), dj=f(ds,brs[2]), dsi= timeUnknown? false : f(ds,brs[3]);
  let hs=0; for(let i=0;i<useStems.length;i++){ if(i===2)continue; const e=SEL[useStems[i]]; if(e===de||e===gm) hs++; }
  const dse=hs>=2, tc=[dr,dj,dsi,dse].filter(Boolean).length, hr=help/total;
  if(tc===4)return"극왕"; if(tc===3&&hr>0.6)return"태강"; if(tc===3)return"신강";
  if(tc===2&&help>=resist)return"중화신강"; if(tc===2)return"중화신약"; if(tc===1)return"신약";
  if(dist[de]===0)return"극약";
  return Object.values(dist).filter(v=>v===0).length>=2?"태약":"신약";
}
const STRONG=new Set(["극왕","태강","신강","중화신강"]);
async function main(){
  if(new Date().getTimezoneOffset()!==0){console.error("TZ=UTC 로 실행하세요"); process.exit(1);}
  const { calculateSaju } = await import("../lib/utils/saju");
  const rows = await all<any>((a,b)=> sb.from("saju_results")
    .select("birth_date, birth_time, gender, region, calendar_type").range(a,b));
  console.log(`saju_results ${rows.length.toLocaleString()}건 로드`);
  let ok=0, diff=0, flip=0, up=0, down=0; const pairs:Record<string,number>={};
  for(const r of rows){
    try{
      const d=String(r.birth_date ?? ""); if(d.length<10) continue;
      const y=+d.slice(0,4), mo=+d.slice(5,7), dd=+d.slice(8,10);
      if(!y||y<1901||y>2030) continue;
      const tm=String(r.birth_time ?? ""); const tu = tm.length<5;
      const [h,mi] = tu? [12,0] : [+tm.slice(0,2), +tm.slice(3,5)];
      const P:any = await calculateSaju(y,mo,dd,h,mi,{ birthLocation: r.region ?? undefined });
      if(!P) continue;
      const stems=[P.year.heavenlyStem,P.month.heavenlyStem,P.day.heavenlyStem,P.hour?.heavenlyStem ?? P.day.heavenlyStem];
      const brs  =[P.year.earthlyBranch,P.month.earthlyBranch,P.day.earthlyBranch,P.hour?.earthlyBranch ?? P.day.earthlyBranch];
      if(!SEL[stems[2]]) continue;
      const a=level(cur,stems,brs,tu), b=level(fix,stems,brs,tu);
      ok++;
      if(a!==b){ diff++; pairs[`${a} → ${b}`]=(pairs[`${a} → ${b}`]??0)+1;
        if(STRONG.has(a)!==STRONG.has(b)){ flip++; STRONG.has(b)?up++:down++; } }
    }catch{}
  }
  const p=(n:number)=>`${n.toLocaleString()}명 (${(n/ok*100).toFixed(1)}%)`;
  console.log(`\n계산 성공 ${ok.toLocaleString()}명`);
  console.log(`8단계가 바뀌는 사람        ${p(diff)}`);
  console.log(`신강↔신약 진영이 뒤집힘    ${p(flip)}`);
  console.log(`  └ 신약 → 신강 (상향)     ${up.toLocaleString()}명`);
  console.log(`  └ 신강 → 신약 (하향)     ${down.toLocaleString()}명`);
  console.log(`\n가장 많이 일어나는 변화 top 8`);
  Object.entries(pairs).sort((x,y)=>y[1]-x[1]).slice(0,8)
    .forEach(([k,v])=>console.log(`  ${k.padEnd(22)} ${v.toLocaleString()}명`));
}
main();
