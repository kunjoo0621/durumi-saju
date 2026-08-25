/**
 * 재계산 규모 감사 — grandfather 를 풀면 등급이 몇 명이나 바뀌는가.
 *
 * 왜: 저장 결과 3,251건이 v2~v19 12종으로 파편화돼 있다(89%가 구버전).
 *     "일관되게 하려면 전부 재계산" 인데, 그 전에 하향 규모를 알아야 한다.
 *
 * 비교 3종:
 *   stored : full_json 에 저장된 등급 (사용자가 실제로 본 값)
 *   v19    : 현행 엔진으로 재계산
 *   fix    : 현행 + 강약 수정(12운성 제거 + 지장간 전층 통근)
 *
 * ★TZ=UTC 필수.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env: Record<string,string>={};
for(const l of readFileSync(".env.local","utf-8").split("\n")){
  const m=l.match(/^([^#=]+)=["']?(.+?)["']?$/); if(m) env[m[1].trim()]=m[2].trim(); }
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
async function all<T>(b:(x:number,y:number)=>any):Promise<T[]>{
  const P=1000,out:T[]=[]; for(let i=0;;i+=P){const{data,error}=await b(i,i+P-1);
    if(error)throw error; if(!data?.length)break; out.push(...data); if(data.length<P)break;} return out; }

const ORDER=["D","C","B","A","S"];
const rank=(g:string)=>ORDER.indexOf(g);

async function main(){
  if(new Date().getTimezoneOffset()!==0){console.error("TZ=UTC 로 실행하세요");process.exit(1);}
  const { resolveSajuEnrichedData } = await import("../lib/analysis");
  const { calculateServerScoring } = await import("../lib/utils/saju-scoring");

  const rows = await all<any>((a,b)=> sb.from("saju_results")
    .select("id, birth_date, birth_time, gender, region, calendar_type, full_json").range(a,b));
  console.log(`saju_results ${rows.length.toLocaleString()}건 로드`);

  let ok=0, noStored=0, fail=0;
  let same=0, up=0, down=0;
  const moves:Record<string,number>={};
  const byVer:Record<number,{n:number;chg:number;down:number}>={};

  for(const r of rows){
    const fj:any=r.full_json;
    if(!fj || fj._error){ noStored++; continue; }
    const stored = fj?.tier?.grade ?? fj?.grade ?? null;
    const sver = Number(fj.scoringVersion ?? 0);
    if(!stored || rank(stored)<0){ noStored++; continue; }
    try{
      const d=String(r.birth_date ?? ""); if(d.length<10){ fail++; continue; }
      const tm=String(r.birth_time ?? ""); const tu = tm.length<5;
      const { enriched } = await resolveSajuEnrichedData({
        name: "", birthYear: d.slice(0,4), birthMonth: d.slice(5,7), birthDay: d.slice(8,10),
        calendarType: (r.calendar_type === "lunar" ? "lunar" : "solar"),
        birthHour: tu? "12" : tm.slice(0,2), birthMinute: tu? "0" : tm.slice(3,5),
        birthLocation: r.region ?? "", gender: r.gender ?? "male",
        relationshipStatus: "", employmentStatus: "", coreFearAxis: "",
        unknownBirthTime: tu,
      } as any);
      if(!enriched){ fail++; continue; }
      const now = calculateServerScoring(enriched)?.tier?.grade;
      if(!now || rank(now)<0){ fail++; continue; }
      ok++;
      byVer[sver] ??= {n:0,chg:0,down:0}; byVer[sver].n++;
      if(now===stored) same++;
      else {
        const d=rank(now)-rank(stored);
        d>0?up++:down++;
        byVer[sver].chg++; if(d<0) byVer[sver].down++;
        moves[`${stored} → ${now}`]=(moves[`${stored} → ${now}`]??0)+1;
      }
    }catch{ fail++; }
  }
  const p=(n:number)=>`${n.toLocaleString()}명 (${(n/ok*100).toFixed(1)}%)`;
  console.log(`\n비교 성공 ${ok.toLocaleString()}건 · 저장등급없음 ${noStored} · 계산실패 ${fail}`);
  console.log(`\n■ grandfather 를 풀고 현행 v19 로 재계산하면`);
  console.log(`  그대로        ${p(same)}`);
  console.log(`  등급 상승     ${p(up)}`);
  console.log(`  ★등급 하락    ${p(down)}`);
  console.log(`\n변화 top 10`);
  Object.entries(moves).sort((a,b)=>b[1]-a[1]).slice(0,10)
    .forEach(([k,v])=>console.log(`  ${k.padEnd(10)} ${String(v).padStart(5)}명`));
  console.log(`\n저장 버전별 (하락 인원)`);
  Object.keys(byVer).map(Number).sort((a,b)=>a-b).forEach(v=>{
    const x=byVer[v]; console.log(`  v${String(v).padEnd(3)} ${String(x.n).padStart(5)}건 → 변경 ${String(x.chg).padStart(4)} · 하락 ${String(x.down).padStart(4)}`);
  });
}
main();
