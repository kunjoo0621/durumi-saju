// 재물운·결혼운·커리어운 guard_violations 감사 집계(읽기 전용) — 배포 후 2~4주 데이터로
// (1)어느 단정예언 패턴이 자주 새는지 (2)richness 미달 최종출고율 (3)재생성 attempts 분포를 본다.
// 접두어: 무접두=순수 위반, richness:=얇음, attempts:N=재생성 횟수. 실행: npx tsx scripts/wm-guard-stats.mts
import { config } from "dotenv"; config({ path: ".env.local" });
async function main(){
 const { supabaseAdmin } = await import("../lib/supabaseAdmin");
 for(const [svc,table] of [["재물운","wealth_results"],["결혼운","marriage_results"],["커리어운","career_results"]] as const){
  const {data}=await supabaseAdmin.from(table).select("guard_violations").not("guard_violations","is",null).order("created_at",{ascending:false}).limit(200);
  const rows=(data||[]) as any[];
  const total=rows.length;
  const patt=new Map<string,number>(); let richMiss=0; const attemptDist=new Map<string,number>();
  for(const r of rows){const gv:string[]=Array.isArray(r.guard_violations)?r.guard_violations:[];
   let hadRich=false;
   for(const v of gv){
    if(v.startsWith("richness:")){hadRich=true;}
    else if(v.startsWith("attempts:")){const n=v.split(":")[1]; attemptDist.set(n,(attemptDist.get(n)||0)+1);}
    else {const m=v.match(/\/(.+)\//); const key=m?m[1]:v.split(":")[0].split("(")[0].trim(); patt.set(key,(patt.get(key)||0)+1);}
   }
   if(hadRich)richMiss++;
  }
  console.log(`\n===== ${svc} — guard_violations 기록 ${total}건 =====`);
  console.log(`richness 미달 출고: ${richMiss}건`);
  console.log(`재생성 attempts 분포:`, JSON.stringify(Object.fromEntries(attemptDist)));
  const top=[...patt.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12);
  console.log(`상위 위반 패턴:`); for(const [k,c] of top) console.log(`  ${c}회  ${k}`);
  if(!top.length) console.log("  (기록된 위반 패턴 없음)");
 }
}
main().catch(e=>console.error(e));
