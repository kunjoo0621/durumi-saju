/**
 * 신건주 vs 랜덤 3명 배틀 테스트
 * — Gemini API 직접 호출 + postprocessBattleResult 적용
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

// ── 상수 ──
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

function judgeStrength(dayEl: string, dist: Record<string,number>): string {
  const support = dist[dayEl] + (EG[dayEl] ? dist[Object.keys(EG).find(k=>EG[k]===dayEl)||""]||0 : 0);
  const total = Object.values(dist).reduce((a,b)=>a+b,0);
  return support >= total/2 ? "신강" : "신약";
}

function calcScores(tenStars: string[], dist: Record<string,number>, strength: string): Record<string,number> {
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

  const libStages = analyzeTwelveStages(ys+yb, ms+mb, ds+db, hs+hb);

  const sajuText = [
    `년주: ${fmtP(ys,yb)} / 월주: ${fmtP(ms,mb)} / 일주: ${fmtP(ds,db)} / 시주: ${fmtP(hs,hb)}`,
    `일간: ${SK[ds]}(${SE[ds]}${SYY[ds]})`,
    `오행분포: ${Object.entries(elDist).map(([k,v])=>`${k}(${v})`).join(" ")}`,
    `신강/신약: ${strength}`,
    `십성: ${[...new Set(tenStars)].join(", ")}`,
    `합충: ${[...rels.hap,...rels.chung].join(", ")||"없음"}`,
    `12운성: 년=${libStages.year.korean} 월=${libStages.month.korean} 일=${libStages.day.korean} 시=${libStages.hour.korean}`,
  ].join("\n");

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

// ── Gemini API ──
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

// ── 시스템 프롬프트 로드 ──
const BATTLE_SYSTEM_PROMPT = readFileSync(resolve(import.meta.dirname!, "../lib/battle-prompt.ts"), "utf-8")
  .match(/export const BATTLE_SYSTEM_PROMPT = `([\s\S]*?)`;/)?.[1] || "";

const adapter = await createDateFnsAdapter();

// ── 배틀 실행 ──
async function runBattle(
  label: string,
  pA: PersonInput,
  pB: PersonInput,
  relationship: "lover"|"friend"|"colleague",
) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"═".repeat(60)}`);

  const a = await computePersonData(pA, adapter);
  const b = await computePersonData(pB, adapter);

  console.log(`\n  [${pA.name}] ${pA.year}.${pA.month}.${pA.day} ${pA.hour}:${String(pA.minute).padStart(2,"0")} ${pA.gender==="male"?"남":"여"}`);
  console.log(`  ${a.sajuText}`);
  console.log(`  점수: ${Object.entries(a.scores).map(([k,v])=>`${k}=${v}`).join(" / ")} → ${a.grade}등급 (${a.comp})`);

  console.log(`\n  [${pB.name}] ${pB.year}.${pB.month}.${pB.day} ${pB.hour}:${String(pB.minute).padStart(2,"0")} ${pB.gender==="male"?"남":"여"}`);
  console.log(`  ${b.sajuText}`);
  console.log(`  점수: ${Object.entries(b.scores).map(([k,v])=>`${k}=${v}`).join(" / ")} → ${b.grade}등급 (${b.comp})`);

  const cmp = compareBattle(a.scores, b.scores, pA.name, pB.name);
  const rel = dayStemRelation(a.dayStem, b.dayStem);

  console.log(`\n  ── 서버 비교 결과 ──`);
  for (const m of cmp.matches) {
    const wl = m.winner==="A"?pA.name:m.winner==="B"?pB.name:"무승부";
    console.log(`  ${m.category}: ${pA.name} ${m.scoreA} vs ${pB.name} ${m.scoreB} → ${wl} (${m.intensity}, 차이${m.diff})`);
  }
  const overall = cmp.overallWinner==="A"?pA.name:cmp.overallWinner==="B"?pB.name:"무승부";
  console.log(`  종합: ${pA.name} ${cmp.winsA}승 / ${pB.name} ${cmp.winsB}승 / 무 ${cmp.draws} → ${overall} (${cmp.overallIntensity})`);
  console.log(`  일간관계: ${rel.type} (${rel.detail})`);

  // 프롬프트 빌드
  const fmtS = (s: Record<string,number>) => Object.entries(s).map(([k,v])=>`${k}: ${v}(${scoreToGrade(v)})`).join(" / ");
  const matchLines = cmp.matches.map(m => {
    const wl = m.winner==="A"?pA.name:m.winner==="B"?pB.name:"무승부";
    return `${m.category}: ${pA.name} ${m.scoreA} vs ${pB.name} ${m.scoreB} → ${wl} (${m.intensity}, 차이 ${m.diff})`;
  });

  const balance = Math.abs(cmp.winsA - cmp.winsB) <= 1 ? "팽팽" : "일방";

  const simQuestions = [
    `🔥 둘이 여행 가면 누가 계획 짜고 누가 따라가?`,
    `💰 둘 중 누가 더 돈을 잘 모아?`,
    `😡 싸우면 누가 먼저 화내고 누가 먼저 풀어?`,
    `🎯 10년 후 커리어에서 누가 더 앞서 있어?`,
    `💔 이별 후 누가 더 오래 힘들어해?`,
  ];
  const simBlock = simQuestions.map((q,i) => `${i+1}. ${q} → 판정: ${i%2===0?pA.name:pB.name}가 해당`).join("\n");

  const relLabels: Record<string,string> = {lover:"연인",friend:"친구",colleague:"직장동료",family:"가족",other:"기타"};
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
    return;
  }

  console.log(`  ✅ 응답 수신 (${elapsed}s, ${res.text.length}자)`);

  let jsonText = res.text;
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) jsonText = fenceMatch[1];

  let parsed: any;
  try { parsed = JSON.parse(jsonText); } catch (e) {
    console.error(`  ❌ JSON 파싱 실패: ${(e as Error).message}`);
    console.error(`  앞 300자: ${jsonText.slice(0, 300)}`);
    return;
  }

  // 후처리
  const { result: processed, warnings: ppWarnings } = postprocessBattleResult(
    parsed, undefined, { nameA: pA.name, nameB: pB.name },
  );
  if (ppWarnings.length > 0) {
    console.log(`  ⚠️ 후처리 경고 ${ppWarnings.length}개`);
    for (const w of ppWarnings.slice(0, 5)) console.log(`    - ${w}`);
  }

  // ── 결과 출력 ──
  console.log(`\n  ══ LLM 결과 ══`);

  // heroQuip
  console.log(`\n  📢 한 줄 요약: "${processed.heroQuip || "(없음)"}"`);

  // 카테고리별
  const cats = processed.categoryResults || {};
  for (const [key, label2] of [["wealth","재물운"],["love","연애운"],["career","직장운"],["health","건강운"],["social","대인운"]]) {
    const c = cats[key];
    if (c) {
      console.log(`\n  [${label2}]`);
      console.log(`    킬링라인: ${c.killingLine}`);
      console.log(`    분석: ${c.detail?.slice(0, 150)}${(c.detail?.length||0) > 150 ? "..." : ""}`);
    }
  }

  // 케미스트리
  const chem = processed.chemistry || {};
  console.log(`\n  [케미스트리]`);
  console.log(`    한 줄: ${chem.punchline}`);
  console.log(`    분석: ${chem.analysis?.slice(0, 150)}${(chem.analysis?.length||0) > 150 ? "..." : ""}`);
  if (chem.bonusScenarios?.length) {
    for (const bs of chem.bonusScenarios) {
      console.log(`    보너스(${bs.label}): ${bs.punchline}`);
    }
  }

  // 시뮬레이션
  const sims = processed.simulations || [];
  console.log(`\n  [시뮬레이션] ${sims.length}개`);
  for (const s of sims) {
    console.log(`    Q: ${s.question}`);
    console.log(`    A: ${s.punchline}`);
  }

  // 미래 예측
  const fo = processed.futureOutlook || {};
  console.log(`\n  [미래 예측] ${fo.punchline || ""}`);
  for (const t of fo.timeline || []) {
    console.log(`    ${t.year}년(${t.label}): A=${t.eventA?.slice(0,40)} / B=${t.eventB?.slice(0,40)} / ${t.mood}`);
  }

  // 최종 판정
  const fv = processed.finalVerdict || {};
  console.log(`\n  [최종 판정]`);
  console.log(`    한 줄: ${fv.punchline}`);
  if (fv.verdictA) console.log(`    ${pA.name} 판정: ${fv.verdictA}`);
  if (fv.verdictB) console.log(`    ${pB.name} 판정: ${fv.verdictB}`);
  console.log(`    종합: ${fv.verdict?.slice(0, 200)}${(fv.verdict?.length||0) > 200 ? "..." : ""}`);

  console.log(`\n  ── 끝 ──`);
}

// ═══════════════════════════════════════════
//  테스트 케이스: 신건주 vs 랜덤 3명
// ═══════════════════════════════════════════

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  신건주 vs 랜덤 3명 배틀 테스트                            ║");
console.log("╚══════════════════════════════════════════════════════════╝");

const 신건주: PersonInput = {
  name: "신건주", year: 1995, month: 6, day: 21,
  hour: 16, minute: 30, gender: "male", location: "서울",
};

// 랜덤 상대 3명
const opponents: { person: PersonInput; relationship: "lover"|"friend"|"colleague" }[] = [
  {
    person: { name: "정하윤", year: 2000, month: 3, day: 12, hour: 9, minute: 15, gender: "female", location: "부산" },
    relationship: "lover",
  },
  {
    person: { name: "오민석", year: 1993, month: 11, day: 5, hour: 22, minute: 0, gender: "male", location: "대전" },
    relationship: "friend",
  },
  {
    person: { name: "한서진", year: 1997, month: 8, day: 28, hour: 6, minute: 45, gender: "female", location: "경기" },
    relationship: "colleague",
  },
];

for (let i = 0; i < opponents.length; i++) {
  const { person, relationship } = opponents[i];
  const relLabel: Record<string,string> = { lover: "연인", friend: "친구", colleague: "직장동료" };
  await runBattle(
    `매치 ${i+1}: 신건주 vs ${person.name} (${relLabel[relationship]})`,
    신건주,
    person,
    relationship,
  );
}

console.log(`\n\n${"═".repeat(60)}`);
console.log("  전체 테스트 완료");
console.log(`${"═".repeat(60)}`);
