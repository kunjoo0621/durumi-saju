/**
 * 스코어링 과정 단계별 추적
 * dev 서버(localhost:3000)에서 enriched 데이터를 가져온 후 로컬에서 추적
 *
 * 실행: npx tsx scripts/test-score-trace.ts
 */

import * as path from "path";
import { register } from "tsconfig-paths";
import * as tsconfig from "../tsconfig.json";
register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths as Record<string, string[]>,
});

import {
  parseScoringInput,
  calculateScores,
  calculateTier,
  hasStar,
  getElementAnalysis,
  scoreToGrade,
  type ScoringInput,
} from "@/lib/utils/saju-scoring";
import { COMPOSITE_GRADE_CUTOFFS, GRADE_MAX } from "@/lib/gradeSystem";

// ─── dev 서버에서 enriched 데이터 가져오기 ────────────

async function fetchEnrichedData() {
  // 분석 API를 호출하면 내부적으로 enriched 데이터가 생성됨
  // 하지만 API 응답에는 enriched가 포함되지 않으므로,
  // 사주 계산 라이브러리를 직접 호출하는 내부 함수 대신
  // 분석 결과의 enriched를 받을 임시 방법이 필요

  // 대안: /api/battle/analyze 에서 두 사람 모두 같은 사람으로 보내면
  // scoring 결과를 받을 수 있음
  const res = await fetch("http://localhost:3000/api/battle/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nameA: "신건주",
      nameB: "테스트",
      birthYearA: "1995", birthMonthA: "6", birthDayA: "21",
      birthHourA: "16", birthMinuteA: "30",
      calendarTypeA: "solar", genderA: "M", birthLocationA: "서울",
      unknownBirthTimeA: false,
      birthYearB: "1990", birthMonthB: "1", birthDayB: "1",
      birthHourB: "12", birthMinuteB: "0",
      calendarTypeB: "solar", genderB: "F", birthLocationB: "서울",
      unknownBirthTimeB: false,
      relationshipType: "friend",
      skipLlm: true,
    }),
  });

  if (!res.ok) {
    // battle API가 안 되면 analyze API 사용
    const res2 = await fetch("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "신건주",
        birthYear: "1995", birthMonth: "6", birthDay: "21",
        calendarType: "solar", birthHour: "16", birthMinute: "30",
        birthLocation: "서울", gender: "M",
        relationshipStatus: "single", employmentStatus: "employed",
        coreFearAxis: "", unknownBirthTime: false,
        skipLlm: true,
      }),
    });
    return res2.json();
  }
  return res.json();
}

// ─── 트레이서 ──────────────────────────────────────

function traceCategory(
  label: string,
  input: ScoringInput,
  finalScore: number,
  elem: ReturnType<typeof getElementAnalysis>,
) {
  const hasChung = (input.relationships?.chung?.length || 0) > 0;
  const hasHyung = (input.relationships?.hyung?.length || 0) > 0;
  const hasHap = (input.relationships?.hap?.length || 0) > 0;
  const hapCount = input.relationships?.hap?.length || 0;
  const isSingang = input.strength === "신강" || input.strength === "추정 신강";
  const isSinyak = input.strength === "신약" || input.strength === "추정 신약";
  const bigyeobCount =
    (input.tenStars.filter((s) => s.includes("비견")).length) +
    (input.tenStars.filter((s) => s.includes("겁재")).length);
  const hasBigyeobOverload = bigyeobCount >= 3;
  const deficientCount = Object.values(input.elementDist).filter((v) => v === 0).length;
  const hasInSung = hasStar(input.tenStars, "정인") || hasStar(input.tenStars, "편인") || hasStar(input.tenStars, "인성");
  const hasGwanSung = hasStar(input.tenStars, "정관") || hasStar(input.tenStars, "편관");
  const hasSikSang = hasStar(input.tenStars, "식신") || hasStar(input.tenStars, "상관");
  const hasJaeSung = hasStar(input.tenStars, "정재") || hasStar(input.tenStars, "편재");

  const items: string[] = [];
  let running = 58;
  items.push(`58(base)`);

  const add = (cond: boolean, val: number, reason: string) => {
    if (cond) {
      running += val;
      items.push(`${val > 0 ? "+" : ""}${val}(${reason})`);
    }
  };

  if (label === "재물운") {
    add(hasStar(input.tenStars, "정재"), 8, "정재");
    add(hasStar(input.tenStars, "편재"), 6, "편재");
    add(hasStar(input.tenStars, "식신"), 4, "식신");
    add(hasStar(input.tenStars, "상관"), 2, "상관");
    add(hasSikSang && hasJaeSung, 6, "식상생재");
    add(elem.isBalanced, 4, "균형");
    add(isSingang, 3, "신강");
    add(hasHap, 2, "합");
    add(hasStar(input.tenStars, "비견"), -6, "비견");
    add(hasStar(input.tenStars, "겁재"), -7, "겁재");
    add(hasBigyeobOverload, -5, "비겁과다");
    add(hasChung && hasHyung, -3, "충+형");
    add(deficientCount >= 2, -3, "결핍2+");
    add(elem.hasDominance, -2, "편중");
    add(isSinyak, -2, "신약");
  } else if (label === "연애운") {
    add(input.shinsal.some((s) => s.includes("도화")), 8, "도화");
    add(input.shinsal.some((s) => s.includes("홍염")), 6, "홍염");
    add(hasStar(input.tenStars, "정관"), 5, "정관");
    add(hasStar(input.tenStars, "정재"), 3, "정재");
    add(hasHap, 7, "합");
    add(hapCount >= 2, 4, "합2+");
    add(elem.isBalanced, 3, "균형");
    add(input.shinsal.some((s) => s.includes("천을귀인")), 3, "천을귀인");
    add(input.tenStars.filter((s) => s.includes("비견")).length >= 2, -5, "비견2+");
    add(hasStar(input.tenStars, "겁재"), -6, "겁재");
    add(hasBigyeobOverload, -4, "비겁과다");
    add(hasChung, -4, "충");
    add(hasHyung, -2, "형");
    add(hasChung && hasHyung, -3, "충+형");
    add(hasStar(input.tenStars, "상관"), -4, "상관");
    add(elem.hasDeficiency, -1, "결핍");
    add(elem.hasDominance, -3, "편중");
    add(input.shinsalBadCount >= 2, -3, "흉신살2+");
  } else if (label === "직장운") {
    add(hasStar(input.tenStars, "정관"), 8, "정관");
    add(hasStar(input.tenStars, "편관"), 5, "편관");
    add(hasInSung, 4, "인성");
    add(hasGwanSung && hasInSung, 7, "관인상생");
    add(hasStar(input.tenStars, "식신"), 3, "식신");
    add(isSingang, 3, "신강");
    add(hasHap, 2, "합");
    add(elem.isBalanced, 3, "균형");
    add(hasStar(input.tenStars, "상관"), -5, "상관");
    add(hasStar(input.tenStars, "상관") && hasGwanSung, -5, "상관견관");
    add(hasBigyeobOverload, -5, "비겁과다");
    add(hasStar(input.tenStars, "편관") && (hasChung || hasHyung), -4, "편관+충형");
    add(hasChung, -2, "충");
    add(hasHyung, -2, "형");
    add(deficientCount >= 2, -3, "결핍2+");
    add(isSinyak, -3, "신약");
    add(input.shinsal.some((s) => s.includes("장성")), 4, "장성");
    add(input.shinsal.some((s) => s.includes("괴강")), 3, "괴강");
    add(input.shinsal.some((s) => s.includes("학당")), 3, "학당");
  } else if (label === "건강운") {
    add(elem.isBalanced, 10, "균형");
    add(elem.isBalanced && elem.diff <= 1 && !elem.hasDeficiency, 5, "극균형");
    add(hasStar(input.tenStars, "식신"), 5, "식신");
    add(hasInSung, 3, "인성");
    add(isSingang, 3, "신강");
    add(hasHap, 2, "합");
    add(input.shinsal.some((s) => s.includes("천을귀인")), 2, "천을귀인");
    if (deficientCount > 0) add(true, -deficientCount * 6, `결핍×${deficientCount}`);
    add(elem.max >= 4, -6, "편중");
    add(elem.max >= 5, -5, "극편중");
    add(hasStar(input.tenStars, "편관") && (hasChung || hasHyung), -5, "편관+충형");
    add(hasHyung, -4, "형살");
    add(isSinyak, -4, "신약");
    add(input.shinsalBadCount >= 2, -3, "흉신살2+");
    add(input.shinsal.some((s) => s.includes("천덕") || s.includes("월덕")), 3, "천덕/월덕");
    add(input.shinsal.some((s) => s.includes("백호")), -4, "백호");
    add(input.shinsal.some((s) => s.includes("재살")), -2, "재살");
  } else if (label === "대인운") {
    add(hasInSung, 4, "인성");
    add(hasStar(input.tenStars, "정관"), 4, "정관");
    add(hasStar(input.tenStars, "식신"), 3, "식신");
    add(hasStar(input.tenStars, "상관"), 2, "상관");
    add(bigyeobCount >= 1 && bigyeobCount <= 2, 5, "비겁적절");
    add(hasBigyeobOverload, -8, "비겁과다");
    add(hasHap, 5, "합");
    add(hapCount >= 2, 3, "합2+");
    add(input.shinsal.some((s) => s.includes("천을귀인")), 5, "천을귀인");
    add(input.shinsal.some((s) => s.includes("문창")), 3, "문창");
    add(elem.isBalanced, 3, "균형");
    add(hasStar(input.tenStars, "겁재") && !hasBigyeobOverload, -6, "겁재");
    add(hasStar(input.tenStars, "상관") && hasGwanSung, -4, "상관견관");
    add(hasChung, -5, "충");
    add(hasHyung, -5, "형");
    const chungHyungCount = (input.relationships?.chung?.length || 0) + (input.relationships?.hyung?.length || 0);
    add(chungHyungCount >= 3, -4, "충형3+");
    add(elem.hasDeficiency, -2, "결핍");
    add(elem.hasDominance, -2, "편중");
  }

  console.log(`\n  [${label}] = ${finalScore}점 (${scoreToGrade(finalScore)}등급)`);
  console.log(`    ${items.join(" ")}`);
  console.log(`    → 계산값 ${running}, clamp 후 = ${finalScore}`);
}

// ─── 메인 ──────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  신건주 스코어링 과정 추적                       ║");
  console.log("║  1995.06.21 16:30 남자                           ║");
  console.log("╚══════════════════════════════════════════════════╝");

  // Dev 서버 디버그 엔드포인트에서 enriched + scoringInput 가져오기
  console.log("\n⏳ dev 서버에서 사주 데이터 가져오는 중...");

  const res = await fetch("http://localhost:3000/api/debug/scoring", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "신건주",
      birthYear: "1995", birthMonth: "6", birthDay: "21",
      calendarType: "solar", birthHour: "16", birthMinute: "30",
      birthLocation: "서울", gender: "M",
      relationshipStatus: "single", employmentStatus: "employed",
      coreFearAxis: "", unknownBirthTime: false,
    }),
  });
  const apiResult = await res.json();
  const enriched = apiResult.enriched;
  const input = parseScoringInput(enriched);
  const elem = getElementAnalysis(input.elementDist);
  const scores = calculateScores(input);

  console.log("✅ 데이터 수신 완료");

  // STEP 1: 사주 원본 데이터
  console.log("\n" + "═".repeat(55));
  console.log("  STEP 1: 신건주의 사주 원본 데이터");
  console.log("═".repeat(55));

  console.log(`\n  사주: ${enriched.pillars?.year} ${enriched.pillars?.month} ${enriched.pillars?.day} ${enriched.pillars?.hour}`);

  console.log(`\n  오행 분포:`);
  for (const [el, count] of Object.entries(input.elementDist)) {
    const bar = "█".repeat(count as number) + "░".repeat(Math.max(0, 5 - (count as number)));
    console.log(`    ${el}: ${bar} (${count}개)`);
  }
  console.log(`    → 균형: ${elem.isBalanced ? "✅ (4종 이상 보유)" : "❌"}  결핍: ${elem.hasDeficiency ? "⚠️ 있음" : "없음"}  편중: ${elem.hasDominance ? "⚠️ 4개 이상" : "없음"}`);
  console.log(`  신강/신약: ${input.strength}`);

  console.log(`\n  십성 (이 사람이 가진 에너지):`);
  for (const star of input.tenStars) console.log(`    • ${star}`);

  console.log(`\n  관계:`);
  console.log(`    합(조화): ${input.relationships.hap.length > 0 ? input.relationships.hap.join(", ") : "없음"}`);
  console.log(`    충(충돌): ${input.relationships.chung.length > 0 ? input.relationships.chung.join(", ") : "없음"}`);
  console.log(`    형(마찰): ${input.relationships.hyung.length > 0 ? input.relationships.hyung.join(", ") : "없음"}`);

  console.log(`\n  신살: ${input.shinsal.length > 0 ? input.shinsal.join(", ") : "없음"}`);
  console.log(`  흉신살: ${input.shinsalBadCount}개`);
  console.log(`  가점: 건록/제왕(${input.has건록제왕 ? "✅" : "❌"}) 용신투출(${input.hasYongshinInStems ? "✅" : "❌"}) 용신월근(${input.hasYongshinMonthRoot ? "✅" : "❌"}) 삼합(${input.hasSamhap ? "✅" : "❌"}) 길신살(${input.goodShinsalCount}개)`);

  // STEP 2: 카테고리 점수
  console.log("\n" + "═".repeat(55));
  console.log("  STEP 2: 카테고리 점수 (모두 58점에서 시작)");
  console.log("═".repeat(55));

  traceCategory("재물운", input, scores.재물운, elem);
  traceCategory("연애운", input, scores.연애운, elem);
  traceCategory("직장운", input, scores.직장운, elem);
  traceCategory("건강운", input, scores.건강운, elem);
  traceCategory("대인운", input, scores.대인운, elem);

  // STEP 3: 종합 점수
  console.log("\n" + "═".repeat(55));
  console.log("  STEP 3: 종합 (composite) 계산");
  console.log("═".repeat(55));

  const catAvg = Math.round(
    0.25 * scores.재물운 + 0.20 * scores.연애운 + 0.25 * scores.직장운 +
    0.15 * scores.건강운 + 0.15 * scores.대인운,
  );
  console.log(`\n  가중평균 (catAvg):`);
  console.log(`    재물 ${scores.재물운} × 25% = ${(scores.재물운 * 0.25).toFixed(1)}`);
  console.log(`    연애 ${scores.연애운} × 20% = ${(scores.연애운 * 0.20).toFixed(1)}`);
  console.log(`    직장 ${scores.직장운} × 25% = ${(scores.직장운 * 0.25).toFixed(1)}`);
  console.log(`    건강 ${scores.건강운} × 15% = ${(scores.건강운 * 0.15).toFixed(1)}`);
  console.log(`    대인 ${scores.대인운} × 15% = ${(scores.대인운 * 0.15).toFixed(1)}`);
  console.log(`    → catAvg = ${catAvg}`);

  const tier = calculateTier(input, scores);
  const axisAdj = tier.composite - catAvg;
  console.log(`\n  3축 보정 (잠재력/안정성/리스크):`);
  console.log(`    catAvg(${catAvg}) + axisAdj(${axisAdj >= 0 ? "+" : ""}${axisAdj}) = composite ${tier.composite}`);
  console.log(`\n  ★ 최종: ${tier.grade}등급 (composite ${tier.composite}, 상위 ${tier.topPercent}%)`);
  console.log(`    등급 기준: S≥86, A≥76, B≥64, C≥50, D<50`);

  // 게이트
  const scoreValues = Object.values(scores);
  const dCount = scoreValues.filter((v) => v <= GRADE_MAX.D).length;
  const minScore = Math.min(...scoreValues);
  console.log(`\n  안전 게이트:`);
  console.log(`    게이트1 (D카테고리 ${dCount}개 ≥ 3?): ${dCount >= 3 ? "⚠️ 캡 적용" : "✅ 통과"}`);
  console.log(`    게이트3 (최저 ${minScore}점 ≤ 39?): ${minScore <= 39 ? "⚠️ 1등급 하락" : "✅ 통과"}`);
}

main().catch((err) => {
  console.error("❌ 에러:", err.message);
  process.exit(1);
});
