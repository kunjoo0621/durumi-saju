/**
 * 묘(墓) 후처리 검증 테스트
 * — Gemini API 직접 호출 + postprocessBattleResult 적용 전/후 비교
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createDateFnsAdapter } from "@gracefullight/saju/adapters/date-fns";
import {
  getFourPillars,
  analyzeTwelveStages,
  analyzeSolarTerms,
  calculateMajorLuck,
  calculateYearlyLuck,
  getTenGodForStem,
} from "@gracefullight/saju";
import type { Gender, MajorLuckResult, LuckPillar, YearlyLuckResult } from "@gracefullight/saju";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const { postprocessBattleResult } = _require("../lib/battle-postprocess") as { postprocessBattleResult: Function };

// ── .env.local 파싱 ──
const envPath = resolve(import.meta.dirname!, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}
const GEMINI_API_KEY = envVars["GEMINI_API_KEY"];
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not found in .env.local");
const GEMINI_MODEL = "gemini-2.5-flash";

// ── 상수 (saju-fortune.ts 동일) ──
const STAGE_KOREAN = ["장생","목욕","관대","건록","제왕","쇠","병","사","묘","절","태","양"] as const;
const BRANCHES_L = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"] as const;
const YANG_STEMS = new Set(["甲","丙","戊","庚","壬"]);
const YANG_BIRTH: Record<string,string> = {"甲":"亥","丙":"寅","戊":"寅","庚":"巳","壬":"申"};
const YIN_BIRTH: Record<string,string> = {"乙":"午","丁":"酉","己":"酉","辛":"子","癸":"卯"};
function getTwelveStageKr(ds: string, br: string): string {
  const isYang = YANG_STEMS.has(ds);
  const birthBr = isYang ? YANG_BIRTH[ds] : YIN_BIRTH[ds];
  if (!birthBr) return "?";
  const bI = BRANCHES_L.indexOf(birthBr as any), tI = BRANCHES_L.indexOf(br as any);
  if (bI<0||tI<0) return "?";
  return STAGE_KOREAN[isYang ? (tI-bI+12)%12 : (bI-tI+12)%12];
}
const SK: Record<string,string> = {"甲":"갑","乙":"을","丙":"병","丁":"정","戊":"무","己":"기","庚":"경","辛":"신","壬":"임","癸":"계"};
const BK: Record<string,string> = {"子":"자","丑":"축","寅":"인","卯":"묘","辰":"진","巳":"사","午":"오","未":"미","申":"신","酉":"유","戌":"술","亥":"해"};
const SE: Record<string,string> = {"甲":"목","乙":"목","丙":"화","丁":"화","戊":"토","己":"토","庚":"금","辛":"금","壬":"수","癸":"수"};
const BE: Record<string,string> = {"子":"수","丑":"토","寅":"목","卯":"목","辰":"토","巳":"화","午":"화","未":"토","申":"금","酉":"금","戌":"토","亥":"수"};
const SYY: Record<string,string> = {"甲":"양","乙":"음","丙":"양","丁":"음","戊":"양","己":"음","庚":"양","辛":"음","壬":"양","癸":"음"};
const EG: Record<string,string> = {목:"화",화:"토",토:"금",금:"수",수:"목"};
const EC: Record<string,string> = {목:"토",화:"금",토:"수",금:"목",수:"화"};
const HIDDEN: Record<string,string[]> = {"子":["癸"],"丑":["己","癸","辛"],"寅":["甲","丙","戊"],"卯":["乙"],"辰":["戊","乙","癸"],"巳":["丙","戊","庚"],"午":["丁","己"],"未":["己","丁","乙"],"申":["庚","壬","戊"],"酉":["辛"],"戌":["戊","辛","丁"],"亥":["壬","甲"]};

function fmtP(s: string, b: string) { return `${s}${b}(${SK[s]}${BK[b]})`; }

function getTG(ds: string, ts: string): string {
  const de=SE[ds],te=SE[ts],dy=SYY[ds],ty=SYY[ts]; if(!de||!te) return "?";
  const same=dy===ty;
  if(de===te) return same?"비견":"겁재";
  if(EG[de]===te) return same?"식신":"상관";
  if(EG[te]===de) return same?"편인":"정인";
  if(EC[de]===te) return same?"편재":"정재";
  if(EC[te]===de) return same?"편관":"정관";
  return "?";
}

function calcTenStars(ds: string, stems: string[], branches: string[]): string[] {
  const r: string[] = [];
  for (const s of stems) if(s!==ds) r.push(getTG(ds,s));
  for (const b of branches) { const m=HIDDEN[b]?.[0]; if(m) r.push(getTG(ds,m)); }
  return r;
}

function calcElDist(stems: string[], branches: string[]): Record<string,number> {
  const d: Record<string,number>={목:0,화:0,토:0,금:0,수:0};
  for(const s of stems) d[SE[s]]++; for(const b of branches) d[BE[b]]++;
  return d;
}

// ── 합/충 검출 ──
const HAP_PAIRS: [string,string][] = [["子","丑"],["寅","亥"],["卯","戌"],["辰","酉"],["巳","申"],["午","未"]];
const CHUNG_PAIRS: [string,string][] = [["子","午"],["丑","未"],["寅","申"],["卯","酉"],["辰","戌"],["巳","亥"]];
function findRels(branches: string[]): {hap:string[],chung:string[]} {
  const hap:string[]=[],chung:string[]=[];
  for(let i=0;i<branches.length;i++) for(let j=i+1;j<branches.length;j++) {
    const a=branches[i],b=branches[j];
    for(const [x,y] of HAP_PAIRS) if((a===x&&b===y)||(a===y&&b===x)) hap.push(`${BK[a]}${BK[b]}합`);
    for(const [x,y] of CHUNG_PAIRS) if((a===x&&b===y)||(a===y&&b===x)) chung.push(`${BK[a]}${BK[b]}충`);
  }
  return {hap,chung};
}

// ── 신강/신약 판정 (간이) ──
function judgeStrength(dayEl: string, dist: Record<string,number>): string {
  const support = dist[dayEl] + (EG[dayEl] ? dist[Object.keys(EG).find(k=>EG[k]===dayEl)||""]||0 : 0);
  const total = Object.values(dist).reduce((a,b)=>a+b,0);
  return support >= total/2 ? "신강" : "신약";
}

// ── 점수 계산 (간이 v7 근사) ──
function calcScores(tenStars: string[], dist: Record<string,number>, strength: string):
  Record<string,number> {
  let base = 60;
  const hasJeongJae = tenStars.includes("정재"), hasEdJae = tenStars.includes("편재");
  const hasSiksin = tenStars.includes("식신"), hasSanggwan = tenStars.includes("상관");
  const hasJeongGwan = tenStars.includes("정관"), hasEdGwan = tenStars.includes("편관");
  const hasJeongIn = tenStars.includes("정인"), hasEdIn = tenStars.includes("편인");
  const hasBigyeon = tenStars.includes("비견"), hasGeupjae = tenStars.includes("겁재");

  const wealth = base + (hasJeongJae?8:0) + (hasEdJae?6:0) + (hasSiksin?4:0) - (hasBigyeon?6:0) - (hasGeupjae?7:0);
  const love = base + (hasJeongGwan||hasEdGwan?8:0) + (hasSiksin||hasSanggwan?4:0);
  const career = base + (hasJeongGwan?8:0) + (hasEdGwan?6:0) + (hasJeongIn||hasEdIn?6:0);
  const health = base + (Math.min(...Object.values(dist))>0?8:0) - (Math.max(...Object.values(dist))>=4?4:0);
  const social = base + (hasBigyeon?6:0) + (hasSiksin?4:0) - (hasGeupjae?4:0);

  const clamp = (v:number) => Math.max(35, Math.min(95, v));
  return { 재물운: clamp(wealth), 연애운: clamp(love), 직장운: clamp(career), 건강운: clamp(health), 대인운: clamp(social) };
}

function scoreToGrade(s: number): string {
  if(s>=85) return "S"; if(s>=78) return "A"; if(s>=68) return "B"; if(s>=56) return "C"; return "D";
}

// ── 일간관계 ──
function dayStemRelation(sA: string, sB: string): {type:string, detail:string} {
  const HAP: [string,string][] = [["甲","己"],["乙","庚"],["丙","辛"],["丁","壬"],["戊","癸"]];
  for(const [a,b] of HAP) if((sA===a&&sB===b)||(sA===b&&sB===a)) return {type:"합",detail:`${SK[sA]}${SK[sB]}합 — 천간합(天干合)`};
  const elA=SE[sA],elB=SE[sB];
  if(EG[elA]===elB) return {type:"생",detail:`${elA}→${elB} 상생`};
  if(EG[elB]===elA) return {type:"생",detail:`${elB}→${elA} 상생`};
  if(EC[elA]===elB) return {type:"극",detail:`${elA}→${elB} 상극`};
  if(EC[elB]===elA) return {type:"극",detail:`${elB}→${elA} 상극`};
  if(elA===elB) return {type:"비화",detail:`같은 오행(${elA})`};
  return {type:"기타",detail:"특별한 관계 없음"};
}

// ── 배틀 비교 ──
type CategoryKey = "재물운"|"연애운"|"직장운"|"건강운"|"대인운";
function compareBattle(sA: Record<string,number>, sB: Record<string,number>, nA: string, nB: string) {
  const cats: CategoryKey[] = ["재물운","연애운","직장운","건강운","대인운"];
  let wA=0,wB=0,draws=0;
  const matches = cats.map(c => {
    const a=sA[c],b=sB[c]; const diff=Math.abs(a-b);
    const w = a>b?"A":b>a?"B":"draw"; if(w==="A") wA++; else if(w==="B") wB++; else draws++;
    const intensity = diff>=15?"압도적":diff>=8?"확실한":diff>=3?"미세한":"초접전";
    return {category:c, scoreA:a, scoreB:b, winner:w, diff, intensity};
  });
  const compA = Math.round(Object.values(sA).reduce((a,b)=>a+b,0)/5);
  const compB = Math.round(Object.values(sB).reduce((a,b)=>a+b,0)/5);
  const overallWinner = wA>wB?"A":wB>wA?"B":compA>compB?"A":compB>compA?"B":"draw";
  const overallIntensity = Math.abs(wA-wB)>=3?"압도적":Math.abs(wA-wB)>=2?"확실한":"박빙";
  return { winsA:wA, winsB:wB, draws, matches, overallWinner, overallIntensity };
}

// ── chemistry 라벨 ──
function selectChemistry(relType: string, balance: string, relationship: string): {emoji:string,title:string,description:string} {
  const POOL: Record<string,Record<string,{emoji:string,title:string,description:string}>> = {
    lover: {
      "합_팽팽":{emoji:"🔥",title:"밀당의 정석 커플",description:"끌리는데 쉽게 안 넘어가는 사이"},
      "합_일방":{emoji:"🐶",title:"주인과 강아지",description:"한쪽이 따라가는데 그게 또 편한 관계"},
      "비화_팽팽":{emoji:"🪞",title:"거울 보는 느낌",description:"닮아서 편한데, 닮아서 지루해"},
      "비화_일방":{emoji:"📏",title:"같은 듯 다른 온도차",description:"비슷해 보이는데 체감 격차가 커"},
      "생_팽팽":{emoji:"⚡",title:"서로 충전해주는 배터리",description:"같이 있으면 에너지가 올라가"},
      "극_팽팽":{emoji:"🗡️",title:"칼 갈면서 성장하는 사이",description:"싸우면서 서로 단련돼"},
    },
    friend: {
      "합_팽팽":{emoji:"🍻",title:"평생 술친구",description:"안 만나도 보면 바로 통하는 사이"},
      "합_일방":{emoji:"🧸",title:"인형 뽑기 같은 우정",description:"한쪽이 더 매달리는 구조"},
      "비화_팽팽":{emoji:"🔄",title:"데칼코마니",description:"취향도 행동도 비슷해서 편해"},
      "생_팽팽":{emoji:"🌱",title:"같이 자라는 나무",description:"서로한테 좋은 영향"},
      "극_팽팽":{emoji:"🧊",title:"팩폭 주고받는 관계",description:"서로 까는데 그게 애정 표현"},
    },
  };
  const key = `${relType}_${balance}`;
  return POOL[relationship]?.[key] || {emoji:"🔗",title:"묘하게 연결된 사이",description:"이유 없이 자꾸 마주치는 인연"};
}

// ── 배틀 프롬프트 빌더 ──
// (battle-prompt.ts의 BATTLE_SYSTEM_PROMPT를 그대로 사용)
const BATTLE_SYSTEM_PROMPT = readFileSync(resolve(import.meta.dirname!, "../lib/battle-prompt.ts"), "utf-8")
  .match(/export const BATTLE_SYSTEM_PROMPT = `([\s\S]*?)`;/)?.[1] || "";

type PersonInput = { name:string; year:number; month:number; day:number; hour:number; minute:number; gender:"male"|"female"; location:string; };

async function computePersonData(p: PersonInput, adapter: any) {
  const bd = new Date(p.year, p.month-1, p.day, p.hour, p.minute);
  const dfd = { date: bd, timeZone: "Asia/Seoul" as const };
  const r = getFourPillars(dfd, { adapter, longitudeDeg: 126.9778 });
  const [ys,yb,ms,mb,ds,db,hs,hb] = [r.year[0],r.year[1],r.month[0],r.month[1],r.day[0],r.day[1],r.hour[0],r.hour[1]];
  const stems=[ys,ms,ds,hs], branches=[yb,mb,db,hb];

  const elDist = calcElDist(stems, branches);
  const tenStars = calcTenStars(ds, stems, branches);
  const strength = judgeStrength(SE[ds], elDist);
  const rels = findRels(branches);
  const scores = calcScores(tenStars, elDist, strength);
  const comp = Math.round(Object.values(scores).reduce((a,b)=>a+b,0)/5);
  const grade = scoreToGrade(comp);

  // 12운성
  const libStages = analyzeTwelveStages(ys+yb, ms+mb, ds+db, hs+hb);

  // enriched text (same format as formatEnrichedSajuText)
  const sajuText = [
    `년주: ${fmtP(ys,yb)} / 월주: ${fmtP(ms,mb)} / 일주: ${fmtP(ds,db)} / 시주: ${fmtP(hs,hb)}`,
    `일간: ${SK[ds]}(${SE[ds]}${SYY[ds]})`,
    `오행분포: ${Object.entries(elDist).map(([k,v])=>`${k}(${v})`).join(" ")}`,
    `신강/신약: ${strength}`,
    `십성: ${[...new Set(tenStars)].join(", ")}`,
    `합충: ${[...rels.hap,...rels.chung].join(", ")||"없음"}`,
    `12운성: 년=${libStages.year.korean} 월=${libStages.month.korean} 일=${libStages.day.korean} 시=${libStages.hour.korean}`,
  ].join("\n");

  // 대운/세운
  let fortuneBlock = "";
  try {
    const st = analyzeSolarTerms(dfd, { adapter });
    const ml: MajorLuckResult = calculateMajorLuck(dfd, p.gender as Gender, ys+yb, ms+mb, { adapter, count: 10, nextJieMillis: st.nextJieMillis, prevJieMillis: st.prevJieMillis });
    const currentYear = new Date().getFullYear();
    const age = currentYear - p.year;
    const daeunPillars = ml.pillars.map((lp: LuckPillar) => ({
      ...lp, tenStar: getTenGodForStem(ds, lp.stem).korean, twelveStage: getTwelveStageKr(ds, lp.branch),
    }));
    const currentDaeun = daeunPillars.find((d: any) => age >= d.startAge && age <= d.endAge);
    const yl: YearlyLuckResult[] = calculateYearlyLuck(p.year, currentYear-1, currentYear+9);
    const seunEntries = yl.map((y: YearlyLuckResult) => ({
      year: y.year, age: y.age, pillar: y.pillar, tenStar: getTenGodForStem(ds, y.stem).korean, twelveStage: getTwelveStageKr(ds, y.branch),
    }));
    const currentSeun = seunEntries.find((s: any) => s.year === currentYear);

    const lines = ["\n[현재 대운/세운]"];
    if(currentDaeun) lines.push(`현재 대운: ${currentDaeun.pillar} / ${currentDaeun.startAge}~${currentDaeun.endAge}세 / ${currentDaeun.tenStar}운 / 12운성: ${currentDaeun.twelveStage}`);
    if(currentSeun) lines.push(`올해 세운: ${currentSeun.pillar} / ${currentSeun.year}년 / ${currentSeun.tenStar}운`);
    lines.push("\n대운 흐름 (전체):");
    for(const d of daeunPillars) {
      const marker = currentDaeun && d.index === currentDaeun.index ? " ← 현재" : "";
      lines.push(`${d.startAge}~${d.endAge}세: ${d.pillar} ${d.tenStar} ${d.twelveStage}${marker}`);
    }
    lines.push("\n세운 흐름 (전후):");
    for(const s of seunEntries) {
      const marker = s.year===currentYear?" ← 올해":"";
      lines.push(`${s.year}: ${s.pillar} ${s.tenStar}${marker}`);
    }
    fortuneBlock = lines.join("\n");
  } catch(e) {
    console.warn(`[대운 실패] ${p.name}:`, (e as Error).message);
  }

  return { sajuText, scores, comp, grade, fortuneBlock, dayStem: ds, libStages, tenStars };
}

// ── Gemini API 직접 호출 ──
async function callGemini(userInfo: string, systemPrompt: string): Promise<{ok:boolean,text:string}> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userInfo }] }],
    generationConfig: { maxOutputTokens: 32768, responseMimeType: "application/json", temperature: 0.75 },
  };
  const res = await fetch(url, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.text(); return {ok:false,text:`HTTP ${res.status}: ${err}`}; }
  const data = await res.json() as any;
  const text = data?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("").trim();
  return text ? {ok:true,text} : {ok:false,text:"빈 응답"};
}

// ── 분석 함수 ──
function analyzeResult(rawJson: string, testLabel: string) {
  let parsed: any;
  try { parsed = JSON.parse(rawJson); } catch { console.error("JSON 파싱 실패"); return; }

  // 모든 텍스트 수집
  const allTexts: string[] = [];
  const cats = parsed.categoryResults || {};
  for(const key of ["wealth","love","career","health","social"]) {
    if(cats[key]) { allTexts.push(cats[key].killingLine||""); allTexts.push(cats[key].detail||""); }
  }
  const chem = parsed.chemistry || {};
  allTexts.push(chem.punchline||"", chem.analysis||"");
  if(chem.mainScenario) allTexts.push(chem.mainScenario.analysis||"");
  for(const bs of chem.bonusScenarios||[]) { allTexts.push(bs.punchline||""); allTexts.push(bs.analysis||""); }
  for(const sim of parsed.simulations||[]) { allTexts.push(sim.punchline||""); allTexts.push(sim.reasoning||""); }
  const fo = parsed.futureOutlook || {};
  allTexts.push(fo.punchline||"");
  for(const e of fo.timeline||[]) { allTexts.push(e.eventA||""); allTexts.push(e.eventB||""); allTexts.push(e.relationship||""); }
  const fv = parsed.finalVerdict || {};
  allTexts.push(fv.punchline||"", fv.verdict||"");
  allTexts.push(parsed.heroQuip||"");

  const combined = allTexts.join(" ");

  // 1. "묘" 글자 전체 카운트
  const rawMyoAll = (combined.match(/묘/g)||[]).length;

  // 2. 12운성 묘(墓) vs 지지 卯(묘) 구분
  const myo墓Pattern = /묘\s*\(墓\)|12운성\s*묘|일주\s*묘|묘\s*지에?\s*앉|대운\s*\(?\s*묘|묘\s*\(墓\)\s*지|운성\s*묘\s*\(|묘지\s*성향|묘\(墓\)/g;
  const myo墓Count = (combined.match(myo墓Pattern)||[]).length;
  const myo卯Pattern = /묘\s*\(卯\)|卯\s*\(묘\)|지지\s*묘/g;
  const myo卯Count = (combined.match(myo卯Pattern)||[]).length;
  const myoAmbiguous = rawMyoAll - myo墓Count - myo卯Count;

  console.log(`\n  ━━━ ${testLabel} 결과 분석 ━━━`);
  console.log(`  1) "묘" 글자 총 등장: ${rawMyoAll}회`);
  console.log(`     - 12운성 묘(墓) 확실: ${myo墓Count}회`);
  console.log(`     - 지지 卯(묘) 확실: ${myo卯Count}회`);
  console.log(`     - 구분 불명확: ${myoAmbiguous}회`);

  // 3. 가장 많이 반복되는 단어/표현 Top 3
  const TERMS = [
    "묘(墓)","건록","제왕","장생","목욕","관대","쇠","병","사(死)","절","태","양",
    "비견","겁재","식신","상관","정재","편재","정관","편관","정인","편인",
    "신강","신약","상생","상극",
    "역마살","홍염살","양인살","겁살","현침살","도화살",
    "토 과다","수 과다","목 과다","화 과다","금 과다",
    "감정을 삭","속으로 삭","통제","눈치","폭발","압박",
  ];
  const termCounts = new Map<string,number>();
  for(const term of TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cnt = (combined.match(new RegExp(escaped, "g"))||[]).length;
    if(cnt >= 2) termCounts.set(term, cnt);
  }

  // 2글자 이상 한글 단어 빈도도 체크
  const words = combined.match(/[가-힣]{2,}/g) || [];
  const wordFreq = new Map<string,number>();
  for(const w of words) wordFreq.set(w, (wordFreq.get(w)||0)+1);
  for(const [w,c] of wordFreq) if(c>=3 && w.length>=2) termCounts.set(w, c);

  const topTerms = [...termCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  console.log(`\n  2) 가장 많이 반복되는 표현 Top 5 (2회 이상):`);
  for(const [term,count] of topTerms) console.log(`     "${term}": ${count}회`);

  // 섹션별 묘 분포
  console.log(`\n  3) 섹션별 "묘" 분포:`);
  const sections: [string, string][] = [
    ["categoryResults.wealth", (cats.wealth?.detail||"")],
    ["categoryResults.love", (cats.love?.detail||"")],
    ["categoryResults.career", (cats.career?.detail||"")],
    ["categoryResults.health", (cats.health?.detail||"")],
    ["categoryResults.social", (cats.social?.detail||"")],
    ["chemistry.analysis", chem.analysis||""],
    ["simulations", (parsed.simulations||[]).map((s:any)=>`${s.punchline} ${s.reasoning}`).join(" ")],
    ["futureOutlook", (fo.timeline||[]).map((e:any)=>`${e.eventA} ${e.eventB} ${e.relationship}`).join(" ")],
    ["finalVerdict", fv.verdict||""],
  ];
  for(const [label,text] of sections) {
    const cnt = (text.match(/묘/g)||[]).length;
    if(cnt>0) console.log(`     ${label}: ${cnt}회`);
  }

  return { rawMyoAll, myo墓Count, myo卯Count, myoAmbiguous };
}

// ── 메인 ──

const adapter = await createDateFnsAdapter();

async function runBattle(
  label: string,
  pA: PersonInput,
  pB: PersonInput,
  relationship: "lover"|"friend",
) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"═".repeat(60)}`);

  const a = await computePersonData(pA, adapter);
  const b = await computePersonData(pB, adapter);

  console.log(`\n  ${pA.name} 사주:\n${a.sajuText}`);
  console.log(`  등급: ${a.grade} (${a.comp})`);
  console.log(`\n  ${pB.name} 사주:\n${b.sajuText}`);
  console.log(`  등급: ${b.grade} (${b.comp})`);

  const cmp = compareBattle(a.scores, b.scores, pA.name, pB.name);
  const rel = dayStemRelation(a.dayStem, b.dayStem);
  const balance = Math.abs(cmp.winsA - cmp.winsB) <= 1 ? "팽팽" : "일방";
  const chemLabel = selectChemistry(rel.type, balance, relationship);

  console.log(`\n  비교: ${pA.name} ${cmp.winsA}승 / ${pB.name} ${cmp.winsB}승 / 무 ${cmp.draws}`);
  console.log(`  일간관계: ${rel.type} (${rel.detail})`);
  console.log(`  상성라벨: ${chemLabel.title}`);

  // 프롬프트 빌드
  const fmtS = (s: Record<string,number>) => Object.entries(s).map(([k,v])=>`${k}: ${v}(${scoreToGrade(v)})`).join(" / ");
  const matchLines = cmp.matches.map(m => {
    const wl = m.winner==="A"?pA.name:m.winner==="B"?pB.name:"무승부";
    return `${m.category}: ${pA.name} ${m.scoreA} vs ${pB.name} ${m.scoreB} → ${wl} (${m.intensity}, 차이 ${m.diff})`;
  });
  const overall = cmp.overallWinner==="A"?pA.name:cmp.overallWinner==="B"?pB.name:"무승부";

  const simQuestions = [
    `🔥 둘이 여행 가면 누가 계획 짜고 누가 따라가?`,
    `💰 둘 중 누가 더 돈을 잘 모아?`,
    `😡 싸우면 누가 먼저 화내고 누가 먼저 풀어?`,
    `🎯 10년 후 커리어에서 누가 더 앞서 있어?`,
    `💔 이별 후 누가 더 오래 힘들어해?`,
  ];
  const simBlock = simQuestions.map((q,i) => `${i+1}. ${q} → 판정: ${i%2===0?pA.name:pB.name}가 해당`).join("\n");

  const relLabels: Record<string,string> = {lover:"연인",friend:"친구"};
  const userInfo = `
[甲] ${pA.name}
종합: ${a.grade}등급 (composite: ${a.comp}, 상위 ${100-a.comp}%)
${fmtS(a.scores)}
사주: ${a.sajuText}
${a.fortuneBlock}

[乙] ${pB.name}
종합: ${b.grade}등급 (composite: ${b.comp}, 상위 ${100-b.comp}%)
${fmtS(b.scores)}
사주: ${b.sajuText}
${b.fortuneBlock}

[두 사주 상호작용 분석]
일간 관계: ${rel.type} — ${rel.detail}

[카테고리별 대결 결과 (서버 확정)]
${matchLines.join("\n")}

[종합 판정 (서버 확정)]
${pA.name} ${cmp.winsA}승 / ${pB.name} ${cmp.winsB}승 / 무승부 ${cmp.draws}
최종 승자: ${overall} (${cmp.overallIntensity})

[상성 유형 라벨 — 서버 확정]
emoji: ${chemLabel.emoji}
title: ${chemLabel.title}
description: ${chemLabel.description}
→ 이 라벨을 chemistry.label에 그대로 복사해. 변경 금지.

[시뮬레이션 질문 — 서버 선택 + 주어 판정]
${simBlock}
★ 위 판정은 서버의 사주 분석 결과야. 절대 뒤집지 마.
→ 각 질문에 대해 punchline과 reasoning을 생성. question 필드에 질문 그대로 복사.

[미래 예측 연도 기준]
현재: ${new Date().getFullYear()}년
1년 후: ${new Date().getFullYear()+1}년
3년 후: ${new Date().getFullYear()+3}년
5년 후: ${new Date().getFullYear()+5}년

[메인 관계 유형: ${relLabels[relationship]}]

[보너스 시나리오]
다음 관계에 대해서도 짧은 시나리오를 작성해:
1. type: "friend", label: "친구였다면" — 4~5문장
2. type: "colleague", label: "직장동료였다면" — 4~5문장

위 서버 확정 결과를 바탕으로 배틀 판정 텍스트를 JSON으로 생성하라.
`.trim();

  console.log(`\n  ⏳ Gemini API 호출 중 (${GEMINI_MODEL})...`);
  const start = Date.now();
  const res = await callGemini(userInfo, BATTLE_SYSTEM_PROMPT);
  const elapsed = ((Date.now()-start)/1000).toFixed(1);

  if (!res.ok) {
    console.error(`  ❌ API 실패: ${res.text}`);
    return null;
  }

  console.log(`  ✅ 응답 수신 (${elapsed}s, ${res.text.length}자)`);

  // Gemini가 markdown fence로 감싸는 경우 제거
  let jsonText = res.text;
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    jsonText = fenceMatch[1];
    console.log(`  ⚠️ markdown fence 제거 (${res.text.length}자 → ${jsonText.length}자)`);
  }

  // ── BEFORE 후처리 분석 ──
  const beforeResult = analyzeResult(jsonText, `${label} — BEFORE 후처리`);

  // ── postprocessBattleResult 적용 ──
  let parsed: any;
  try { parsed = JSON.parse(jsonText); } catch (e) {
    console.error(`  ❌ JSON 파싱 실패 — 후처리 스킵\n  원인: ${(e as Error).message}\n  앞 200자: ${jsonText.slice(0, 200)}`);

    console.error("  ❌ JSON 파싱 실패 — 후처리 스킵");
    return beforeResult ? { before: beforeResult, after: beforeResult, ppWarnings: [] } : null;
  }

  const { result: processed, warnings: ppWarnings } = postprocessBattleResult(
    parsed,
    undefined,
    { nameA: pA.name, nameB: pB.name },
  );

  // 후처리 경고 출력
  const myoWarnings = ppWarnings.filter(w => w.includes("묘"));
  const otherWarnings = ppWarnings.filter(w => !w.includes("묘"));
  console.log(`\n  ━━━ postprocessBattleResult 결과 ━━━`);
  console.log(`  전체 warnings: ${ppWarnings.length}개 (묘 관련: ${myoWarnings.length}개)`);
  for (const w of myoWarnings) console.log(`    🔸 ${w}`);
  if (otherWarnings.length > 0) console.log(`    ... 그 외 ${otherWarnings.length}개 생략`);

  // ── AFTER 후처리 분석 ──
  const afterJson = JSON.stringify(processed);
  const afterResult = analyzeResult(afterJson, `${label} — AFTER 후처리`);

  // ── Before vs After 비교 ──
  if (beforeResult && afterResult) {
    const diff = beforeResult.rawMyoAll - afterResult.rawMyoAll;
    console.log(`\n  ━━━ Before vs After 비교 ━━━`);
    console.log(`  "묘" 총: ${beforeResult.rawMyoAll}회 → ${afterResult.rawMyoAll}회 (${diff > 0 ? `−${diff}` : "변화없음"})`);
    console.log(`  墓 확실: ${beforeResult.myo墓Count} → ${afterResult.myo墓Count}`);
    console.log(`  卯 확실: ${beforeResult.myo卯Count} → ${afterResult.myo卯Count}`);
    console.log(`  불명확: ${beforeResult.myoAmbiguous} → ${afterResult.myoAmbiguous}`);
  }

  // ── 미래 예측 timeline 확인 ──
  const timeline = processed.futureOutlook?.timeline || [];
  console.log(`\n  ━━━ 미래 예측 timeline ━━━`);
  console.log(`  timeline 항목 수: ${timeline.length}개 ${timeline.length === 3 ? "✅" : timeline.length > 0 ? "⚠️ (3개 기대)" : "❌ 없음"}`);
  for (const entry of timeline) {
    console.log(`    ${entry.year}: A="${(entry.eventA||"").slice(0,30)}" / B="${(entry.eventB||"").slice(0,30)}" / 관계="${(entry.relationship||"").slice(0,20)}" / ${entry.mood}`);
  }

  // ── 문맥 깨짐 체크 (제거된 곳 주변) ──
  const allAfterTexts: string[] = [];
  const cats2 = processed.categoryResults || {};
  for (const key of ["wealth","love","career","health","social"]) {
    if (cats2[key]) { allAfterTexts.push(cats2[key].killingLine||""); allAfterTexts.push(cats2[key].detail||""); }
  }
  const chem2 = processed.chemistry || {};
  allAfterTexts.push(chem2.analysis||"");
  if (chem2.mainScenario) allAfterTexts.push(chem2.mainScenario.analysis||"");
  for (const bs of chem2.bonusScenarios||[]) allAfterTexts.push(bs.analysis||"");
  for (const sim of processed.simulations||[]) allAfterTexts.push(sim.reasoning||"");
  for (const e of (processed.futureOutlook?.timeline||[])) {
    allAfterTexts.push(e.eventA||""); allAfterTexts.push(e.eventB||""); allAfterTexts.push(e.relationship||"");
  }
  allAfterTexts.push(processed.finalVerdict?.verdict||"");

  // 깨진 문맥 패턴 탐지
  const brokenPatterns: string[] = [];
  for (const t of allAfterTexts) {
    if (!t) continue;
    // 문장이 조사로 시작 (묘 제거 후 잔여)
    if (/^\s*[은는이가을를에서의도로]\s/.test(t)) brokenPatterns.push(`조사로 시작: "${t.slice(0,40)}..."`);
    // 빈 문장 (삭제 후 남은 것)
    const sentences = t.split(/[.!]\s*/).filter(s => s.trim().length > 0);
    for (const s of sentences) {
      if (s.trim().length < 3 && s.trim().length > 0) brokenPatterns.push(`초단문: "${s.trim()}" (전체 내에서)`);
      // 조사로 시작하는 문장 중간
      if (/^[은는이가을를에서의도로]\s/.test(s.trim())) brokenPatterns.push(`문장 내 조사 시작: "...${s.trim().slice(0,30)}..."`);
    }
    // 연속 구두점
    if (/[,]{2,}|\.{3,}|,\s*\./.test(t)) brokenPatterns.push(`구두점 깨짐: "${t.slice(0,40)}..."`);
  }

  if (brokenPatterns.length > 0) {
    console.log(`\n  ⚠️ 문맥 깨짐 의심: ${brokenPatterns.length}건`);
    for (const bp of brokenPatterns.slice(0, 5)) console.log(`    ${bp}`);
    if (brokenPatterns.length > 5) console.log(`    ... 외 ${brokenPatterns.length - 5}건`);
  } else {
    console.log(`\n  ✅ 문맥 깨짐 없음`);
  }

  return afterResult ? { before: beforeResult, after: afterResult, ppWarnings } : null;
}

console.log("====================================================");
console.log("  묘(墓) 후처리 검증 테스트");
console.log("====================================================");

// 테스트: 신건주 vs 김채현 (연인) — 원래 조합 재테스트
const r1 = await runBattle(
  "테스트 2: 신건주 vs 김채현 (연인) — 원래 조합",
  { name: "신건주", year: 1995, month: 6, day: 21, hour: 16, minute: 30, gender: "male", location: "서울" },
  { name: "김채현", year: 1998, month: 7, day: 24, hour: 12, minute: 30, gender: "female", location: "서울" },
  "lover",
);

console.log(`\n${"═".repeat(60)}`);
console.log("  최종 비교 (후처리 전 → 후)");
console.log(`${"═".repeat(60)}`);
type FullR = { before: { rawMyoAll: number; myo墓Count: number; myo卯Count: number; myoAmbiguous: number }; after: { rawMyoAll: number; myo墓Count: number; myo卯Count: number; myoAmbiguous: number }; ppWarnings: string[] } | null;
const results: [string, FullR][] = [
  ["신건주 vs 김채현 (연인)", r1],
];

for (const [label, r] of results) {
  if (r) {
    const b = r.before, a = r.after;
    const diff = b.rawMyoAll - a.rawMyoAll;
    console.log(`\n  ${label}:`);
    console.log(`    BEFORE: "묘" ${b.rawMyoAll}회 (墓 ${b.myo墓Count} / 卯 ${b.myo卯Count} / 불명 ${b.myoAmbiguous})`);
    console.log(`    AFTER:  "묘" ${a.rawMyoAll}회 (墓 ${a.myo墓Count} / 卯 ${a.myo卯Count} / 불명 ${a.myoAmbiguous})`);
    console.log(`    제거: ${diff > 0 ? `${diff}회` : "없음"}`);
    if (b.myo卯Count !== a.myo卯Count) console.log(`    ❌ 卯(지지) 변동 있음! ${b.myo卯Count} → ${a.myo卯Count}`);
    else console.log(`    ✅ 卯(지지) 보호 정상`);
    if (a.rawMyoAll <= 2) console.log(`    ✅ 최종 묘 2회 이하 — 정상`);
    else if (a.rawMyoAll <= 4) console.log(`    ⚠️ 최종 묘 ${a.rawMyoAll}회 — 경계선 (불명확 포함)`);
    else console.log(`    ❌ 최종 묘 ${a.rawMyoAll}회 — 과다 (추가 패턴 필요)`);
  }
}
