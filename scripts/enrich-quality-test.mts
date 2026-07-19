// 재물운·결혼운 풍부화 품질 테스트 — 실제 파이프라인(facts→prompt→Gemini→guards)으로
// 5명 사주(운영자 본인 포함)의 결과를 생성해 길이·재미를 실측한다.
// 실행: npx tsx --env-file=.env scripts/enrich-quality-test.mts [limit]
import * as _saju from "../lib/utils/saju";
import * as _fortune from "../lib/utils/saju-fortune";
import * as _self from "../lib/self-input";
import * as _wf from "../lib/wealth-facts";
import * as _mf from "../lib/marriage-facts";
import * as _wg from "../lib/wealth-grade";
import * as _mg from "../lib/marriage-grade";
import * as _wp from "../lib/wealth-prompt";
import * as _mp from "../lib/marriage-prompt";
import * as _wpost from "../lib/wealth-postprocess";
import * as _mpost from "../lib/marriage-postprocess";
import * as _tl from "../lib/fortune-timeline";
import * as _qa from "../lib/qa-regen";
import * as _an from "../lib/analysis";
import * as _js from "../lib/json5Utils";
import { writeFileSync, readFileSync } from "node:fs";
import type { WealthInterest } from "../lib/wealth-facts";
import type { MaritalStatus } from "../lib/marriage-facts";

// tsx가 일부 .ts를 CJS로 로드해 named binding이 깨지므로 ESM(m[n])/CJS(m.default[n]) 양쪽 흡수.
const G = (m: any, n: string) => m?.[n] ?? m?.default?.[n];
const calculateSaju = G(_saju, "calculateSaju");
const enrichSajuData = G(_saju, "enrichSajuData");
const formatSajuText = G(_saju, "formatSajuText");
const calculateFortune = G(_fortune, "calculateFortune");
const deriveSelfScores = G(_self, "deriveSelfScores");
const deriveWealthFacts = G(_wf, "deriveWealthFacts");
const deriveMarriageFacts = G(_mf, "deriveMarriageFacts");
const computeWealthGrade = G(_wg, "computeWealthGrade");
const extractWealthScore = G(_wg, "extractWealthScore");
const computeMarriageGrade = G(_mg, "computeMarriageGrade");
const extractLoveScore = G(_mg, "extractLoveScore");
const buildWealthPrompt = G(_wp, "buildWealthPrompt");
const buildMarriagePrompt = G(_mp, "buildMarriagePrompt");
const applyWealthGuards = G(_wpost, "applyWealthGuards");
const validateWealthBlocks = G(_wpost, "validateWealthBlocks");
const validateWealthRichness = G(_wpost, "validateWealthRichness");
const applyMarriageGuards = G(_mpost, "applyMarriageGuards");
const validateMarriageBlocks = G(_mpost, "validateMarriageBlocks");
const validateMarriageRichness = G(_mpost, "validateMarriageRichness");
const buildWealthTimeline = G(_tl, "buildWealthTimeline");
const buildMarriageTimeline = G(_tl, "buildMarriageTimeline");
const generateWithQaRegen = G(_qa, "generateWithQaRegen");
const callGemini = G(_an, "callGemini");
const DEFAULT_MODELS = G(_an, "DEFAULT_MODELS");
const shouldFallback = G(_an, "shouldFallback");
const parseJson5Loose = G(_js, "parseJson5Loose");

const SYS = "너는 지시받은 지침을 정확히 따르는 JSON 생성기다. 사용자 메시지에 포함된 규칙과 출력 스키마를 그대로 지켜라.";
const models = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? DEFAULT_MODELS;
const YEAR = 2026;

type Person = {
  label: string; y: number; m: number; d: number; hh?: number; mm?: number;
  unknown?: boolean; gender: "남성" | "여성"; marital: MaritalStatus; interest: WealthInterest;
};

const PEOPLE: Person[] = [
  { label: "운영자(1995-06-21 계미)", y: 1995, m: 6, d: 21, hh: 14, mm: 30, gender: "남성", marital: "솔로", interest: "투자로 불리기" },
  { label: "기혼여성(1988-03-15)", y: 1988, m: 3, d: 15, hh: 9, mm: 0, gender: "여성", marital: "기혼", interest: "목돈·노후 준비" },
  { label: "다시혼자여성(1975-11-02)", y: 1975, m: 11, d: 2, hh: 22, mm: 0, gender: "여성", marital: "다시 혼자", interest: "지출·빚 관리" },
  { label: "연애중남성(1992-07-20)", y: 1992, m: 7, d: 20, hh: 6, mm: 30, gender: "남성", marital: "연애중", interest: "사업·수입 키우기" },
  { label: "시간모름여성(2000-01-10)", y: 2000, m: 1, d: 10, unknown: true, gender: "여성", marital: "솔로", interest: "목돈·노후 준비" },
];

const argN = process.argv.find((a) => /^\d+$/.test(a));
const LIMIT = Number(argN ?? PEOPLE.length);
const clen = (s: unknown) => (typeof s === "string" ? s.trim().length : 0);

// --reuse: 기존 결과의 블록을 재활용(Gemini 0호출). facts는 매번 새로 계산.
let REUSE_MAP: Record<string, any> | null = null;
if (process.argv.includes("--reuse")) {
  try {
    const prev = JSON.parse(readFileSync("scripts/enrich-quality-output.json", "utf8"));
    REUSE_MAP = Object.fromEntries(prev.map((r: any) => [r.label, {
      wb: r.wealth?.blocks ?? null, mb: r.marriage?.blocks ?? null,
      wAtt: r.wealth?.attempts, mAtt: r.marriage?.attempts,
    }]));
    console.log("♻️  reuse 모드 — 저장된 블록 재활용(Gemini 0호출)");
  } catch { console.error("reuse 실패 — 기존 출력 없음"); }
}

async function genOne(p: Person) {
  const hour = p.unknown ? undefined : p.hh;
  const minute = p.unknown ? undefined : p.mm;
  const saju = await calculateSaju(p.y, p.m, p.d, hour, minute, {});
  if (!saju) throw new Error("사주 계산 실패");
  const enriched = enrichSajuData(saju, { isTimeUnknown: !!p.unknown });
  const gender = p.gender === "남성" ? "male" : "female";
  let fortune = null;
  try {
    fortune = await calculateFortune({
      birthYear: p.y, birthMonth: p.m, birthDay: p.d, birthHour: hour, birthMinute: minute,
      gender, isTimeUnknown: !!p.unknown,
      yearPillar: saju.year.heavenlyStem + saju.year.earthlyBranch,
      monthPillar: saju.month.heavenlyStem + saju.month.earthlyBranch,
      dayPillar: saju.day.heavenlyStem + saju.day.earthlyBranch,
      hourPillar: saju.hour.heavenlyStem + saju.hour.earthlyBranch,
    } as any);
  } catch (e) { console.error("fortune 실패", e); }

  const sajuText = formatSajuText(saju, { isTimeUnknown: !!p.unknown });
  const scores = deriveSelfScores(enriched);
  const wGrade = computeWealthGrade(extractWealthScore({ scores })!).grade;
  const mGrade = computeMarriageGrade(extractLoveScore({ scores })!).grade;

  const wFacts = deriveWealthFacts(enriched, fortune, saju, p.interest, YEAR);
  const mFacts = deriveMarriageFacts(enriched, fortune, saju, gender, p.marital, YEAR);

  // --reuse: Gemini 재호출 없이 저장된 블록 재활용(facts는 결정론이라 위에서 새로 계산됨).
  const reuse = REUSE_MAP && REUSE_MAP[p.label];
  const wGen = reuse
    ? { ok: !!reuse.wb, blocks: reuse.wb, attempts: reuse.wAtt ?? 1 }
    : await generateWithQaRegen<any>({
        prompt: buildWealthPrompt(wFacts, wGrade, sajuText), systemPrompt: SYS, models, temperature: 0.75,
        callModel: (mo, pr, sy, cfg) => callGemini(mo, pr, sy, cfg), shouldFallback,
        parse: (t) => parseJson5Loose<any>(t), validateBlocks: (c) => validateWealthBlocks(c),
        applyGuards: (c) => applyWealthGuards(c, wFacts, sajuText), softValidate: (b) => validateWealthRichness(b),
      });
  const mGen = reuse
    ? { ok: !!reuse.mb, blocks: reuse.mb, attempts: reuse.mAtt ?? 1 }
    : await generateWithQaRegen<any>({
        prompt: buildMarriagePrompt(mFacts, mGrade, sajuText), systemPrompt: SYS, models, temperature: 0.75,
        callModel: (mo, pr, sy, cfg) => callGemini(mo, pr, sy, cfg), shouldFallback,
        parse: (t) => parseJson5Loose<any>(t), validateBlocks: (c) => validateMarriageBlocks(c),
        applyGuards: (c) => applyMarriageGuards(c, mFacts, sajuText), softValidate: (b) => validateMarriageRichness(b),
      });

  const wb = wGen.ok ? wGen.blocks : null;
  const mb = mGen.ok ? mGen.blocks : null;
  if (wb) wb.serverTimeline = buildWealthTimeline(fortune, wFacts, YEAR);
  if (mb) mb.serverTimeline = buildMarriageTimeline(fortune, mFacts, YEAR);

  const wKeys = ["jaeseongDiagnosis", "jaeGripDiagnosis", "savingStyle", "riskAndPace", "timingFlow"];
  const mKeys = ["spousePalace", "spouseStar", "partnerProfile", "relationshipPattern", "timingFlow"];
  const wTotal = wb ? wKeys.reduce((s, k) => s + clen(wb[k]), 0) : 0;
  const mTotal = mb ? mKeys.reduce((s, k) => s + clen(mb[k]), 0) : 0;

  // 실제 결과 컴포넌트(WealthResultBody/MarriageResultBody)에 그대로 먹일 ApiResponse mock.
  const nowIso = "2026-07-19T00:00:00.000Z";
  const apiWealth = wb ? {
    status: "completed", resultId: "mock", interest: p.interest, wealthGrade: wGrade,
    jaeseongType: wFacts.jaeseongType, jaedaShinyak: wFacts.jaedaShinyak,
    sikssangSaengjae: wFacts.sikssangSaengjae, gunggeobJaengjae: wFacts.gunggeobJaengjae,
    jaeGrip: wFacts.jaeGrip, result: wb, createdAt: nowIso,
  } : null;
  const apiMarriage = mb ? {
    status: "completed", resultId: "mock", maritalStatus: p.marital, marriageGrade: mGrade,
    spouseStarType: mFacts.spouseStarType, gwansalHonjap: mFacts.gwansalHonjap,
    spouseStarAbsent: mFacts.spouseStarAbsent, spousePalaceStability: mFacts.spousePalaceStability,
    result: mb, createdAt: nowIso,
  } : null;

  return {
    label: p.label, marital: p.marital, interest: p.interest,
    apiWealth, apiMarriage,
    wealth: { grade: wGrade, ok: wGen.ok, attempts: wGen.ok ? wGen.attempts : 0, total: wTotal,
      per: Object.fromEntries(wKeys.map((k) => [k, clen(wb?.[k])])), blocks: wb },
    marriage: { grade: mGrade, ok: mGen.ok, attempts: mGen.ok ? mGen.attempts : 0, total: mTotal,
      per: Object.fromEntries(mKeys.map((k) => [k, clen(mb?.[k])])), blocks: mb },
  };
}

const results = [];
for (const p of PEOPLE.slice(0, LIMIT)) {
  console.log(`\n▶ 생성 중: ${p.label} …`);
  try {
    const r = await genOne(p);
    results.push(r);
    console.log(`  재물 등급 ${r.wealth.grade} · 총 ${r.wealth.total}자 (재생성 ${r.wealth.attempts}회) · 블록 ${JSON.stringify(r.wealth.per)}`);
    console.log(`  결혼 등급 ${r.marriage.grade} · 총 ${r.marriage.total}자 (재생성 ${r.marriage.attempts}회) · 블록 ${JSON.stringify(r.marriage.per)}`);
  } catch (e) {
    console.error(`  실패:`, e);
  }
}
const out = "scripts/enrich-quality-output.json";
writeFileSync(out, JSON.stringify(results, null, 2));
// dev 결과 미리보기 라우트(app/dev/enrich-result-ui)가 import하는 mock — ApiResponse 형태.
const META: Record<string, string> = {
  "운영자(1995-06-21 계미)": "운영자 · 1995 · 계미 · 솔로",
  "기혼여성(1988-03-15)": "기혼여성 · 1988",
  "다시혼자여성(1975-11-02)": "다시혼자 · 1975",
  "연애중남성(1992-07-20)": "연애중 · 1992",
  "시간모름여성(2000-01-10)": "시간모름 · 2000",
};
const preview = results.map((r: any) => ({ label: r.label, sub: META[r.label] ?? r.label, apiWealth: r.apiWealth, apiMarriage: r.apiMarriage }));
writeFileSync("lib/mockEnrichPreview.json", JSON.stringify(preview, null, 2));
console.log(`\n✅ 전체 저장: ${out} + lib/mockEnrichPreview.json (${results.length}명)`);
