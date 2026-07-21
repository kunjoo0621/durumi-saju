// Phase 6 배치 하네스 — 여러 사주×상황으로 실제 커리어운 리포트를 프로덕션 경로 그대로 생성해
// 마크다운으로 저장(Fable 품질 검수용). 결제·DB 없이 facts→prompt→Gemini→가드 재현.
// 실행: npx tsx scripts/career-report-batch.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { calculateSaju, enrichSajuData, formatSajuText } from "../lib/utils/saju";
import { calculateFortune, type FortuneResult } from "../lib/utils/saju-fortune";
import type { SajuData } from "../lib/utils/saju";
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
import { writeFileSync } from "node:fs";

const SYSTEM = "너는 지시받은 지침을 정확히 따르는 JSON 생성기다. 사용자 메시지에 포함된 규칙과 출력 스키마를 그대로 지켜라.";
const YEAR = 2026;

// 지지 지장간(BRANCH_INFO 정본 순서) — 구성 차트용
const HS: Record<string, string[]> = {
  子: ["癸"], 丑: ["己", "癸", "辛"], 寅: ["甲", "丙", "戊"], 卯: ["乙"], 辰: ["戊", "乙", "癸"], 巳: ["丙", "庚", "戊"],
  午: ["丁", "己"], 未: ["己", "丁", "乙"], 申: ["庚", "壬", "戊"], 酉: ["辛"], 戌: ["戊", "辛", "丁"], 亥: ["壬", "甲"],
};
const P = (s: string, b: string) => ({ heavenlyStem: s, earthlyBranch: b, hiddenStems: HS[b] });
const chart = (y: string, m: string, d: string, h: string): SajuData =>
  ({ year: P(y[0], y[1]), month: P(m[0], m[1]), day: P(d[0], d[1]), hour: P(h[0], h[1]) }) as SajuData;

type Case = { label: string; situation: CareerSituation; birth?: [number, number, number, number, number, "male" | "female"]; saju?: SajuData };
const CASES: Case[] = [
  // 운영자 실사주(관살혼잡·신왕관왕·관인상생) × 4상황 — 상황 분기 검증
  { label: "운영자(관살혼잡·신왕관왕)·진로 탐색", situation: "진로 탐색", birth: [1995, 6, 21, 16, 0, "male"] },
  { label: "운영자·이직 고민", situation: "이직 고민", birth: [1995, 6, 21, 16, 0, "male"] },
  { label: "운영자·독립·사업", situation: "독립·사업", birth: [1995, 6, 21, 16, 0, "male"] },
  // 위험 구조 3종 — 안전 재해석 검증
  { label: "무관(관성 전무)·현직 성장", situation: "현직 성장", saju: chart("甲子", "乙卯", "甲子", "丙寅") },
  { label: "편관 과다·독립·사업(관다신약 재해석)", situation: "독립·사업", saju: chart("庚申", "庚申", "甲子", "戊辰") },
  { label: "상관견관·현직 성장(규칙8 재해석)", situation: "현직 성장", saju: chart("甲申", "丁卯", "甲子", "甲子") },
];

async function buildFortune(saju: SajuData, b: Case["birth"]): Promise<FortuneResult | null> {
  if (!b) return null;
  try {
    return await calculateFortune({
      birthYear: b[0], birthMonth: b[1], birthDay: b[2], birthHour: b[3], birthMinute: b[4], gender: b[5],
      yearPillar: saju.year.heavenlyStem + saju.year.earthlyBranch,
      monthPillar: saju.month.heavenlyStem + saju.month.earthlyBranch,
      dayPillar: saju.day.heavenlyStem + saju.day.earthlyBranch,
      hourPillar: saju.hour.heavenlyStem + saju.hour.earthlyBranch,
      isTimeUnknown: false,
    });
  } catch { return null; }
}

async function run() {
  const out: string[] = [`# 커리어운 리포트 실측 샘플 (${CASES.length}건, ${YEAR}) — Fable 검수용\n`];
  for (const c of CASES) {
    const saju = c.saju ?? (await calculateSaju(c.birth![0], c.birth![1], c.birth![2], c.birth![3], c.birth![4], {}))!;
    const enriched = enrichSajuData(saju, { isTimeUnknown: false });
    const fortune = c.birth ? await buildFortune(saju, c.birth) : null;
    const facts = deriveCareerFacts(enriched, fortune, saju, c.situation, YEAR);
    const careerScore = extractCareerScore({ scores: deriveSelfScores(enriched) })!;
    const { grade } = computeCareerGrade(careerScore);
    const issues = assertCareerConsistency({
      grade, careerScore,
      facts: { gwanseongType: facts.gwanseongType, gwanseong: facts.gwanseong, gwandaSinyak: facts.gwandaSinyak, careerGrip: facts.careerGrip, sanggwanGyeongwan: facts.sanggwanGyeongwan, gwanseongAbsent: facts.gwanseongAbsent },
    });
    const sajuText = formatSajuText(saju, { isTimeUnknown: false });
    const prompt = buildCareerPrompt(facts, grade, sajuText, "직장인", YEAR);
    const models = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? [];
    const gen = await generateWithQaRegen<any>({
      prompt, systemPrompt: SYSTEM, models: models.length ? models : DEFAULT_MODELS, temperature: 0.75,
      callModel: (m, p, s, cf) => callGemini(m, p, s, cf), shouldFallback,
      parse: (t) => parseJson5Loose<any>(t),
      validateBlocks: (x) => validateCareerBlocks(x),
      applyGuards: (x) => applyCareerGuards(x, facts, sajuText),
      softValidate: (b) => validateCareerRichness(b),
    });
    const pillars = ["year", "month", "day", "hour"].map((p: any) => saju[p].heavenlyStem + saju[p].earthlyBranch).join(" ");
    const b = gen.ok ? gen.blocks : null;
    out.push(`\n---\n\n## ${c.label}\n`);
    out.push(`- 원국: ${pillars} · 강약: ${enriched.strength.result} · 용신: ${enriched.yongshin.eokbu}`);
    out.push(`- facts: gwanseongType=${facts.gwanseongType}, careerGrip=${facts.careerGrip}, 관인상생=${facts.gwaninSangsaeng}, 상관견관=${facts.sanggwanGyeongwan}, 무관=${facts.gwanseongAbsent}, 간극=${JSON.stringify(facts).includes("gap") ? "" : ""}`);
    out.push(`- 직장운 ${careerScore} → ${grade} · consistency: ${issues.length ? issues.join("; ") : "OK"} · 가드위반: ${gen.ok ? gen.violations.length : "생성실패"}`);
    if (gen.ok && gen.violations.length) out.push(`  - 위반: ${gen.violations.join(" | ")}`);
    if (!b) { out.push(`\n**생성 실패: ${gen.error}**`); continue; }
    for (const k of ["teaserSummary", "gradeHeadline", "gwanseongDiagnosis", "careerGripDiagnosis", "workStyle", "riskAndPace", "timingFlow"]) {
      out.push(`\n**${k}** (${(b[k] || "").length}자)\n\n${b[k]}`);
    }
    out.push(`\n**advice**\n`);
    (b.advice || []).forEach((a: any) => out.push(`- ${a.text}  \`${a.tag}\``));
    out.push(`\n**yearlyCta**\n\n${b.yearlyCta}`);
    console.log(`✓ ${c.label} — ${grade}, 위반 ${gen.ok ? gen.violations.length : "?"}`);
  }
  const path = "docs/plans/career-report-samples-2026-07-21.md";
  writeFileSync(path, out.join("\n"));
  console.log(`\n저장: ${path}`);
}
run().catch((e) => { console.error(e); process.exit(1); });
