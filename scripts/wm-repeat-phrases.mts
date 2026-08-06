// 재물운·결혼운·커리어운 출고 리포트 코퍼스에서 반복구(템플릿 냄새) 실측 — 다양성 게이트.
// 각 리포트 산문에서 12자 윈도우의 "문서 빈도"(몇 %의 리포트에 등장)를 집계, 상위 출력.
// 프롬프트에 클리셰 무차별 나열 대신 상위 반복구의 출처 예시만 교체하기 위한 데이터.
// ★2026-08-06 수정: 윈도우 필터가 /^[가-힣 ]+$/ 라 괄호·숫자가 낀 구간을 통째로 버렸다.
//   이 리포트들은 용어 뜻풀이 괄호가 많아 실측 윈도우의 44~49%가 폐기되고 있었다
//   실측 채택률은 53~56%뿐이었다. 윈도우 안 한글이 6자 이상이면 집계한다(채택률 98%).
//   ※ 처음 쓴 /[가-힣]{4,}/ 는 오히려 44~45%로 더 버렸다 — 12자 안에 '연속' 한글 4자 런이
//     없는 순한글 구간(공백이 런을 끊음)을 새로 버리기 때문. 연속 런이 아니라 총 개수로 세야 한다.
//   ※ 필터를 걷어내도 3상품 모두 30%+ 반복구는 0이었다 — 문자열 반복은 실제로 없다.
//   두루뭉술함의 정체는 문장이 아니라 서사 골격이며, 그건 wm-narrative-moves.mts 로 잰다.
// 실행: npx tsx scripts/wm-repeat-phrases.mts
import { config } from "dotenv"; config({ path: ".env.local" });
async function main(){
 const { supabaseAdmin } = await import("../lib/supabaseAdmin");
 const specs=[
  ["재물운","wealth_results",["jaeseongDiagnosis","jaeGripDiagnosis","savingStyle","riskAndPace","timingFlow"]],
  ["결혼운","marriage_results",["spouseStar","spousePalace","partnerProfile","relationshipPattern","timingFlow"]],
  ["커리어운","career_results",["gwanseongDiagnosis","careerGripDiagnosis","workStyle","riskAndPace","timingFlow"]],
 ] as const;
 const W=12; // 윈도우 길이
 for(const [svc,table,keys] of specs){
  const {data}=await supabaseAdmin.from(table).select("full_json").not("full_json","is",null).order("created_at",{ascending:false}).limit(40);
  const docs=((data||[]) as any[]).map(r=>{const fj=r.full_json||{}; const txt=keys.map(k=>fj[k]||"").concat((fj.advice||[]).map((a:any)=>a.text||"")).join(" "); return txt.replace(/\s+/g," ");});
  if(docs.length<3){console.log(`\n${svc}: 표본 ${docs.length}건(부족)`);continue;}
  const df=new Map<string,number>();
  for(const d of docs){const seen=new Set<string>(); for(let i=0;i+W<=d.length;i+=3){const g=d.slice(i,i+W); if((g.match(/[가-힣]/g)?.length??0)>=6&&!seen.has(g)){seen.add(g); df.set(g,(df.get(g)||0)+1);}}}
  const top=[...df.entries()].filter(([,c])=>c/docs.length>=0.3).sort((a,b)=>b[1]-a[1]).slice(0,15);
  console.log(`\n===== ${svc} (${docs.length}건) — 30%+ 리포트에 등장하는 12자 구간 상위 =====`);
  for(const [g,c] of top) console.log(`  ${(c/docs.length*100).toFixed(0)}% (${c}/${docs.length})  "${g}"`);
  if(!top.length) console.log("  (30%+ 반복구 없음 — 다양성 양호)");
 }
}
main().catch(e=>console.error(e));
