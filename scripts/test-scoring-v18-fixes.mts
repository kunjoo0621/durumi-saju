// v18 수정 검증: ② composite 단조성(비감소) + ① 비겁 과다 감점 실동작
const { calculateTier, calculateScores } = await import("@/lib/utils/saju-scoring");
function base(over:any):any {
  return { elementDist:{목:1,화:1,토:1,금:2,수:3}, strength:"신강", tenStars:["식신","겁재","정인","편재","편관"],
    tenStarsFull:["식신","겁재","정인","편재","편관"], relationships:{hap:[],chung:[],hyung:[]}, shinsal:[], shinsalBadCount:0,
    isTimeUnknown:false, hasManselyeok:true, has건록제왕:false, hasYongshinInStems:false, goodShinsalCount:0,
    hasYongshinMonthRoot:false, hasSamhap:false, ...over };
}
let prev=999, monoOK=true, viol:any=null;
for(let bad=0;bad<=8;bad++){
  const chung=Array.from({length:Math.min(bad,3)},(_,i)=>"충"+i);
  const hyung=Array.from({length:Math.max(0,bad-3)},(_,i)=>"형"+i);
  const inp=base({tenStarsFull:["비견","겁재","비견","겁재","상관"],tenStars:["비견","겁재","상관"],strength:"신약",
    relationships:{hap:[],chung,hyung},shinsalBadCount:bad,elementDist:{목:0,화:0,토:0,금:4,수:4}});
  const t=calculateTier(inp,calculateScores(inp));
  if(t.composite>prev+0.001){monoOK=false;viol={bad,composite:t.composite,prev};}
  prev=t.composite;
}
console.log("② 단조성(나쁠수록 composite 비증가):", monoOK?"PASS ✅":"FAIL ❌ "+JSON.stringify(viol));
const scN=calculateScores(base({tenStarsFull:["비견","식신","정재"],tenStars:["비견","식신","정재"]}));
const scO=calculateScores(base({tenStarsFull:["비견","겁재","비견","겁재","식신"],tenStars:["비견","겁재","식신"]}));
console.log("① 비겁1 대인운:",scN.대인운,"| 비겁4(과다) 대인운:",scO.대인운,"→",scO.대인운<scN.대인운?"PASS ✅ (과다가 더 낮음)":"FAIL ❌");
