// Phase 6 하네스 — 운영자 사주로 실제 커리어운 리포트 1건을 프로덕션 경로 그대로 생성.
// analyze 라우트의 4)~7) 단계(facts→prompt→generateWithQaRegen→가드)를 결제·DB 없이 재현.
// 실행: npx tsx scripts/career-report-probe.ts [situation]
import { config } from "dotenv";
config({ path: ".env.local" });

import { calculateSaju, enrichSajuData, formatSajuText } from "../lib/utils/saju";
import { calculateFortune } from "../lib/utils/saju-fortune";
import { deriveCareerFacts, type CareerSituation } from "../lib/career-facts";
import { computeCareerGrade, extractCareerScore } from "../lib/career-grade";
import { assertCareerConsistency } from "../lib/career-consistency";
import { buildCareerPrompt } from "../lib/career-prompt";
import { applyCareerGuards, validateCareerBlocks, validateCareerRichness } from "../lib/career-postprocess";
import { generateWithQaRegen } from "../lib/qa-regen";
import { buildCareerTimeline } from "../lib/fortune-timeline";
import { deriveSelfScores } from "../lib/self-input";
import { callGemini, DEFAULT_MODELS, shouldFallback } from "../lib/analysis";
import { parseJson5Loose } from "../lib/json5Utils";

const SYSTEM = "너는 지시받은 지침을 정확히 따르는 JSON 생성기다. 사용자 메시지에 포함된 규칙과 출력 스키마를 그대로 지켜라.";

async function main() {
  const situation = (process.argv[2] as CareerSituation) || "현직 성장";
  const currentYear = 2026;

  // 운영자 사주: 양력 1995-06-21, 申시(≈16시), 남성
  const saju = await calculateSaju(1995, 6, 21, 16, 0, {});
  if (!saju) throw new Error("saju 계산 실패");
  const enriched = enrichSajuData(saju, { isTimeUnknown: false });
  console.log("원국:", ["year", "month", "day", "hour"].map((p: any) => saju[p].heavenlyStem + saju[p].earthlyBranch).join(" "));
  console.log("강약:", enriched.strength.result, "| 용신:", enriched.yongshin.eokbu);

  let fortune = null;
  try {
    fortune = await calculateFortune({
      birthYear: 1995, birthMonth: 6, birthDay: 21, birthHour: 16, birthMinute: 0,
      gender: "male",
      yearPillar: saju.year.heavenlyStem + saju.year.earthlyBranch,
      monthPillar: saju.month.heavenlyStem + saju.month.earthlyBranch,
      dayPillar: saju.day.heavenlyStem + saju.day.earthlyBranch,
      hourPillar: saju.hour.heavenlyStem + saju.hour.earthlyBranch,
      isTimeUnknown: false,
    });
  } catch (e) { console.error("fortune 실패", e); }

  const facts = deriveCareerFacts(enriched, fortune, saju, situation, currentYear);
  const careerScore = extractCareerScore({ scores: deriveSelfScores(enriched) });
  if (careerScore === null) throw new Error("직장운 점수 결측");
  const { grade } = computeCareerGrade(careerScore);

  console.log(`\n상황: ${situation} | 직장운: ${careerScore} → 등급 ${grade}`);
  console.log("facts:", JSON.stringify({
    gwanseongType: facts.gwanseongType, careerGrip: facts.careerGrip,
    gwaninSangsaeng: facts.gwaninSangsaeng, sanggwanGyeongwan: facts.sanggwanGyeongwan,
    gwanseongAbsent: facts.gwanseongAbsent, timing: facts.timingWindows.length, daeun: facts.daeunCareerYears,
  }));

  const issues = assertCareerConsistency({
    grade, careerScore,
    facts: {
      gwanseongType: facts.gwanseongType, gwanseong: facts.gwanseong, gwandaSinyak: facts.gwandaSinyak,
      careerGrip: facts.careerGrip, sanggwanGyeongwan: facts.sanggwanGyeongwan, gwanseongAbsent: facts.gwanseongAbsent,
    },
  });
  console.log("consistency 이슈:", issues.length === 0 ? "없음 ✅" : issues);

  const sajuText = formatSajuText(saju, { isTimeUnknown: false });
  const prompt = buildCareerPrompt(facts, grade, sajuText, "직장인", currentYear);
  const envModels = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? [];
  const models = envModels.length > 0 ? envModels : DEFAULT_MODELS;

  console.log("\nGemini 생성 중...");
  const gen = await generateWithQaRegen<any>({
    prompt, systemPrompt: SYSTEM, models, temperature: 0.75,
    callModel: (m, p, s, c) => callGemini(m, p, s, c),
    shouldFallback,
    parse: (t) => parseJson5Loose<any>(t),
    validateBlocks: (c) => validateCareerBlocks(c),
    applyGuards: (c) => applyCareerGuards(c, facts, sajuText),
    softValidate: (b) => validateCareerRichness(b),
  });

  if (!gen.ok) { console.error("생성 실패:", gen.error); process.exit(1); }
  const blocks = gen.blocks;
  const tl = buildCareerTimeline(fortune, facts, currentYear);
  if (tl) blocks.serverTimeline = tl;

  console.log(`\n=== 가드 위반(${gen.violations.length}) ===`);
  gen.violations.forEach((v: string) => console.log(" -", v));
  console.log("\n=== 리포트 ===");
  for (const k of ["teaserSummary", "gradeHeadline", "gwanseongDiagnosis", "careerGripDiagnosis", "workStyle", "riskAndPace", "timingFlow"]) {
    console.log(`\n[${k}] (${(blocks[k] || "").length}자)\n${blocks[k]}`);
  }
  console.log("\n[advice]");
  (blocks.advice || []).forEach((a: any) => console.log(` - ${a.text}  ${a.tag}`));
  console.log(`\n[yearlyCta]\n${blocks.yearlyCta}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
