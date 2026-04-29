/**
 * 전체 파이프라인 테스트: 개인사주 + 배틀
 *
 * - 실제 사주 계산 → 서버 스코어링 → LLM 분석 → surgical rewrite
 * - DB 저장/인증 없이 핵심 로직만 테스트
 *
 * 실행: npx tsx scripts/test-full-pipeline.ts
 */

import * as fs from "fs";
import * as path from "path";

// .env.local 수동 로드
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

// tsconfig paths가 안 먹으므로 직접 등록
import { register } from "tsconfig-paths";
import * as tsconfig from "../tsconfig.json";
register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths as Record<string, string[]>,
});

import { resolveSajuEnrichedData, buildFortunePromptBlock } from "@/lib/analysis";
import type { InputPayload } from "@/lib/analysis";
import { calculateServerScoring } from "@/lib/utils/saju-scoring";
import { compareBattle } from "@/lib/utils/battle-compare";
import { runBattleAnalysis } from "@/lib/battle-prompt";
import { selectSimulations } from "@/lib/battle-simulations";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { calculateBattleInteraction } from "@/lib/utils/battle-interaction";
import { runFullAnalysis } from "@/lib/analysis";

// ─── 테스트 데이터 ────────────────────────────────

const PLAYER_A: InputPayload = {
  name: "신건주",
  birthYear: "1995",
  birthMonth: "6",
  birthDay: "21",
  calendarType: "solar",
  birthHour: "16",
  birthMinute: "30",
  birthLocation: "서울",
  gender: "M",
  relationshipStatus: "single",
  employmentStatus: "employed",
  coreFearAxis: "",
  unknownBirthTime: false,
};

const PLAYER_B: InputPayload = {
  name: "김채연",
  birthYear: "1997",
  birthMonth: "3",
  birthDay: "15",
  calendarType: "solar",
  birthHour: "9",
  birthMinute: "0",
  birthLocation: "서울",
  gender: "F",
  relationshipStatus: "single",
  employmentStatus: "employed",
  coreFearAxis: "",
  unknownBirthTime: false,
};

// ─── 유틸 ─────────────────────────────────────────

function hr(title: string) {
  console.log("\n" + "═".repeat(70));
  console.log(`  ${title}`);
  console.log("═".repeat(70));
}

function section(title: string) {
  console.log("\n" + "─".repeat(50));
  console.log(`  ${title}`);
  console.log("─".repeat(50));
}

// ─── PART 1: 개인사주 분석 테스트 ─────────────────

async function testPersonalAnalysis() {
  hr("PART 1: 개인사주 분석 — 신건주 (1995.06.21 16:30)");

  console.log("\n⏳ 사주 분석 중... (Gemini API 호출)");
  const startTime = Date.now();

  const result = await runFullAnalysis(PLAYER_A);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ 분석 완료 (${elapsed}초)`);

  // 등급 & 점수
  section("등급 & 점수");
  console.log(`  등급: ${result.tier.grade} (composite: ${result.tier.composite})`);
  console.log(`  상위: ${result.tier.topPercent}%`);
  console.log(`  타이틀: ${result.tier.title}`);
  console.log(`  설명: ${result.tier.description.slice(0, 80)}...`);
  console.log(`  점수:`, result.scores);

  // 섹션 타이틀 확인
  section("섹션 목록 (10개 확인)");
  for (let i = 0; i < result.sections.length; i++) {
    const s = result.sections[i];
    const preview = s.content.slice(0, 50).replace(/\n/g, " ");
    console.log(`  [${i}] ${s.icon} ${s.title}`);
    console.log(`      "${preview}..."`);
  }

  // 운세 확인
  if (result.fortune) {
    section("운세");
    console.log(`  연운: ${result.fortune.yearFortune?.slice(0, 60)}...`);
  }

  // 결과 구조 검증
  section("구조 검증");
  const checks = [
    ["tier.grade 존재", !!result.tier.grade],
    ["tier.description 존재", !!result.tier.description],
    ["sections 10개", result.sections.length === 10],
    ["모든 section에 content", result.sections.every(s => s.content && s.content.length > 20)],
    ["scores 5개 카테고리", Object.keys(result.scores).length >= 5],
  ];
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✅" : "❌"} ${label}`);
  }

  return result;
}

// ─── PART 2: 배틀 분석 테스트 ─────────────────────

async function testBattleAnalysis() {
  hr("PART 2: 배틀 분석 — 신건주 vs 김채연");

  // Step 1: 양쪽 사주 계산 + 스코어링
  console.log("\n⏳ 양쪽 사주 데이터 계산 중...");

  const [enrichedDataA, enrichedDataB] = await Promise.all([
    resolveSajuEnrichedData(PLAYER_A),
    resolveSajuEnrichedData(PLAYER_B),
  ]);

  const scoringA = calculateServerScoring(enrichedDataA.enriched);
  const scoringB = calculateServerScoring(enrichedDataB.enriched);

  section("서버 스코어링 결과");
  console.log(`  ${PLAYER_A.name}: ${scoringA.tier.grade}등급 (${scoringA.tier.composite}점)`);
  console.log(`    점수:`, scoringA.scores);
  console.log(`  ${PLAYER_B.name}: ${scoringB.tier.grade}등급 (${scoringB.tier.composite}점)`);
  console.log(`    점수:`, scoringB.scores);

  // Step 2: 운세 계산
  const birthYearA = Number(PLAYER_A.birthYear);
  const birthYearB = Number(PLAYER_B.birthYear);

  const [fortuneA, fortuneB] = await Promise.all([
    calculateFortune({
      birthYear: birthYearA,
      birthMonth: Number(PLAYER_A.birthMonth),
      birthDay: Number(PLAYER_A.birthDay),
      birthHour: Number(PLAYER_A.birthHour),
      birthMinute: Number(PLAYER_A.birthMinute),
      gender: PLAYER_A.gender as "M" | "F",
      birthLocation: PLAYER_A.birthLocation,
      yearPillar: enrichedDataA.enriched.pillars.year,
      monthPillar: enrichedDataA.enriched.pillars.month,
      dayPillar: enrichedDataA.enriched.pillars.day,
      hourPillar: enrichedDataA.enriched.pillars.hour ?? "",
      isTimeUnknown: false,
    }),
    calculateFortune({
      birthYear: birthYearB,
      birthMonth: Number(PLAYER_B.birthMonth),
      birthDay: Number(PLAYER_B.birthDay),
      birthHour: Number(PLAYER_B.birthHour),
      birthMinute: Number(PLAYER_B.birthMinute),
      gender: PLAYER_B.gender as "M" | "F",
      birthLocation: PLAYER_B.birthLocation,
      yearPillar: enrichedDataB.enriched.pillars.year,
      monthPillar: enrichedDataB.enriched.pillars.month,
      dayPillar: enrichedDataB.enriched.pillars.day,
      hourPillar: enrichedDataB.enriched.pillars.hour ?? "",
      isTimeUnknown: false,
    }),
  ]);

  const fortuneBlockA = buildFortunePromptBlock(fortuneA, birthYearA);
  const fortuneBlockB = buildFortunePromptBlock(fortuneB, birthYearB);

  // Step 3: 상호작용 분석
  const interaction = calculateBattleInteraction(
    enrichedDataA.enriched, enrichedDataB.enriched,
    fortuneA, fortuneB,
    birthYearA, birthYearB,
  );

  // Step 4: 비교
  const comparison = compareBattle(
    scoringA.scores, scoringB.scores,
    scoringA.tier, scoringB.tier,
    PLAYER_A.name, PLAYER_B.name,
  );

  section("배틀 비교 결과");
  console.log(`  전체 승자: ${comparison.overallWinner || "무승부"}`);
  console.log(`  승수: ${PLAYER_A.name} ${comparison.winsA}승 / ${PLAYER_B.name} ${comparison.winsB}승 / 무 ${comparison.draws}`);
  for (const cat of comparison.categories) {
    console.log(`  ${cat.label}: ${cat.winner || "무승부"} (${cat.scoreA} vs ${cat.scoreB})`);
  }

  // Step 5: 시뮬레이션 질문
  const simulationQuestions = selectSimulations(
    enrichedDataA.enriched, enrichedDataB.enriched,
    "friend", 5,
    { A: scoringA.scores, B: scoringB.scores },
  );

  section("시뮬레이션 질문");
  for (const sq of simulationQuestions) {
    console.log(`  ${sq.icon} ${sq.question}`);
  }

  // Step 6: LLM 배틀 분석 (surgical rewrite 포함)
  console.log("\n⏳ Gemini 배틀 분석 중... (surgical rewrite 포함)");
  const startTime = Date.now();

  const llmAnalysis = await runBattleAnalysis({
    nameA: PLAYER_A.name,
    nameB: PLAYER_B.name,
    scoresA: scoringA.scores,
    scoresB: scoringB.scores,
    tierA: scoringA.tier,
    tierB: scoringB.tier,
    comparison,
    relationshipType: "friend",
    sajuTextA: enrichedDataA.sajuText,
    sajuTextB: enrichedDataB.sajuText,
    interaction,
    fortuneBlockA,
    fortuneBlockB,
    simulationQuestions,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ 배틀 분석 완료 (${elapsed}초)`);

  // 결과 출력
  section("heroQuip");
  console.log(`  "${llmAnalysis.heroQuip}"`);

  section("카테고리별 결과");
  const cats = ["wealth", "love", "career", "health", "social"] as const;
  for (const cat of cats) {
    const r = llmAnalysis.categoryResults[cat];
    const catLabel = { wealth: "재물", love: "연애", career: "직장", health: "건강", social: "대인" }[cat];
    console.log(`\n  [${catLabel}운]`);
    console.log(`    killingLine: "${r.killingLine}"`);
    console.log(`    detail: "${r.detail.slice(0, 80)}..."`);
  }

  section("케미스트리");
  console.log(`  punchline: "${llmAnalysis.chemistry.punchline}"`);
  console.log(`  analysis: "${llmAnalysis.chemistry.analysis.slice(0, 80)}..."`);
  if (llmAnalysis.chemistry.bonusScenarios?.length > 0) {
    for (const bs of llmAnalysis.chemistry.bonusScenarios) {
      console.log(`  [${bs.label}] "${bs.punchline}"`);
    }
  }

  section("시뮬레이션 결과");
  for (const sim of llmAnalysis.simulations) {
    console.log(`  Q: ${sim.question}`);
    console.log(`    → "${sim.punchline}"`);
  }

  section("미래 전망");
  console.log(`  punchline: "${llmAnalysis.futureOutlook.punchline}"`);
  for (const t of llmAnalysis.futureOutlook.timeline) {
    console.log(`  ${t.year} [${t.label}] ${t.mood} — A: ${t.eventA} / B: ${t.eventB} / 관계: ${t.relationship}`);
  }

  section("최종 판정");
  console.log(`  punchline: "${llmAnalysis.finalVerdict.punchline}"`);
  console.log(`  verdict: "${llmAnalysis.finalVerdict.verdict}"`);

  // 구조 검증
  section("구조 검증");
  const checks = [
    ["heroQuip 존재", !!llmAnalysis.heroQuip],
    ["5개 카테고리 모두 존재", cats.every(c => llmAnalysis.categoryResults[c])],
    ["모든 killingLine 존재", cats.every(c => llmAnalysis.categoryResults[c].killingLine?.length > 5)],
    ["모든 detail 존재", cats.every(c => llmAnalysis.categoryResults[c].detail?.length > 20)],
    ["chemistry 존재", !!llmAnalysis.chemistry?.punchline],
    ["bonusScenarios 2개", llmAnalysis.chemistry?.bonusScenarios?.length === 2],
    ["simulations 5개", llmAnalysis.simulations?.length === 5],
    ["timeline 3개", llmAnalysis.futureOutlook?.timeline?.length === 3],
    ["finalVerdict 존재", !!llmAnalysis.finalVerdict?.verdict],
  ];
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✅" : "❌"} ${label}`);
  }

  // killingLine 반복 체크
  section("killingLine 반복 체크 (동일 어미)");
  const endings = cats.map(c => {
    const kl = llmAnalysis.categoryResults[c].killingLine.trim();
    return { cat: c, ending: kl.slice(-3), text: kl };
  });
  const endingCounts = new Map<string, string[]>();
  for (const e of endings) {
    if (!endingCounts.has(e.ending)) endingCounts.set(e.ending, []);
    endingCounts.get(e.ending)!.push(e.cat);
  }
  let hasRepetition = false;
  for (const [ending, catList] of endingCounts) {
    if (catList.length >= 3) {
      console.log(`  ⚠️ 어미 "${ending}" 반복: ${catList.join(", ")}`);
      hasRepetition = true;
    }
  }
  if (!hasRepetition) {
    console.log("  ✅ killingLine 어미 반복 없음 (3개 미만)");
  }
  for (const e of endings) {
    console.log(`    ${e.cat.padEnd(8)} → 어미 "${e.ending}" → "${e.text}"`);
  }

  return llmAnalysis;
}

// ─── 메인 ─────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  전체 파이프라인 테스트 — 개인사주 + 배틀                         ║");
  console.log("║  신건주 (1995.06.21 16:30)                                       ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  try {
    const personalResult = await testPersonalAnalysis();
    const battleResult = await testBattleAnalysis();

    hr("전체 테스트 완료");
    console.log("  ✅ 개인사주: 정상");
    console.log("  ✅ 배틀: 정상");
  } catch (err: any) {
    console.error("\n❌ 테스트 실패:", err?.message || err);
    console.error(err?.stack);
    process.exit(1);
  }
}

main();
