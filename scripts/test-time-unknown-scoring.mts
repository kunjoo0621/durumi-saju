/**
 * 시간 미입력(isTimeUnknown) 시 점수 하락 비교 테스트
 *
 * 같은 사주를 시간O / 시간X 두 버전으로 계산하여 점수 차이를 분석한다.
 * tsx scripts/test-time-unknown-scoring.mts
 */

const enrichModule = await import("../lib/utils/saju-enrichment");
const enrich: typeof import("../lib/utils/saju-enrichment") =
  ((enrichModule as any).default ?? enrichModule) as any;

const scoringModule = await import("../lib/utils/saju-scoring");
const scoring: typeof import("../lib/utils/saju-scoring") =
  ((scoringModule as any).default ?? scoringModule) as any;

// ── 테스트 케이스 (4주 모두 있는 사주 5건) ──
type Pillars = { year: string; month: string; day: string; hour: string };

const cases: { label: string; pillars: Pillars }[] = [
  { label: "케이스1(갑자-을축-병인-정묘)", pillars: { year: "甲子", month: "乙丑", day: "丙寅", hour: "丁卯" } },
  { label: "케이스2(경신-임자-을유-무오)", pillars: { year: "庚申", month: "壬子", day: "乙酉", hour: "戊午" } },
  { label: "케이스3(계해-신유-갑자-병인)", pillars: { year: "癸亥", month: "辛酉", day: "甲子", hour: "丙寅" } },
  { label: "케이스4(무진-갑인-경오-임술)", pillars: { year: "戊辰", month: "甲寅", day: "庚午", hour: "壬戌" } },
  { label: "케이스5(신사-기해-정미-을사)", pillars: { year: "辛巳", month: "己亥", day: "丁未", hour: "乙巳" } },
];

function splitPillar(p: string) {
  return { stem: p[0]!, branch: p[1]! };
}

function formatPillar(p: string) {
  const { stem, branch } = splitPillar(p);
  const stemK = enrich.STEM_ELEMENT[stem]?.korean ?? "";
  const branchK = enrich.BRANCH_INFO[branch]?.korean ?? "";
  return `${stem}${branch}(${stemK}${branchK})`;
}

function buildEnriched(pillars: Pillars, isTimeUnknown: boolean): enrich.EnrichedSajuData {
  const year = splitPillar(pillars.year);
  const month = splitPillar(pillars.month);
  const day = splitPillar(pillars.day);
  const hour = splitPillar(pillars.hour);

  const stems = [year.stem, month.stem, day.stem];
  const branches = [year.branch, month.branch, day.branch];
  if (!isTimeUnknown) {
    stems.push(hour.stem);
    branches.push(hour.branch);
  }

  const dayMaster = enrich.STEM_ELEMENT[day.stem]!;
  const elementDist = enrich.calculateElementDistribution(stems, branches);
  const elementAnalysis = enrich.analyzeElementBalance(elementDist);
  const strength = enrich.judgeStrength(
    dayMaster.element,
    elementDist,
    stems.length + branches.length,
    isTimeUnknown,
    {
      monthBranch: month.branch,
      dayBranch: day.branch,
      hourBranch: isTimeUnknown ? undefined : hour.branch,
      allBranches: branches,
      allStems: stems,
      dayStem: day.stem,
    },
  );
  const tenStars = enrich.calculateTenStars(stems, branches);
  const relationships = enrich.findRelationships(branches);
  const shinsal = enrich.findShinsal(day.branch, day.stem, month.branch, branches, isTimeUnknown, stems);

  // 12운성
  const yearP = pillars.year;
  const monthP = pillars.month;
  const dayP = pillars.day;
  const hourP = pillars.hour;
  let twelveStages: any = null;
  if (typeof enrich.analyzeTwelveStages === "function") {
    const raw = enrich.analyzeTwelveStages(yearP, monthP, dayP, hourP);
    const toEntry = (s: any) => s ? { korean: s.korean, hanja: s.hanja, meaning: s.meaning, strength: s.strength } : null;
    twelveStages = {
      year: toEntry(raw.year),
      month: toEntry(raw.month),
      day: toEntry(raw.day),
      hour: isTimeUnknown ? null : toEntry(raw.hour),
    };
  }

  // 용신
  let yongshin: any = null;
  if (typeof enrich.determineYongshin === "function") {
    yongshin = enrich.determineYongshin(dayMaster.element, strength, elementDist, month.branch);
  }

  // 12신살 위치별
  let pillar12Shinsal: any = undefined;
  if (typeof enrich.getPillar12Shinsal === "function") {
    pillar12Shinsal = enrich.getPillar12Shinsal(branches, isTimeUnknown);
  }

  return {
    pillars: {
      year: formatPillar(pillars.year),
      month: formatPillar(pillars.month),
      day: formatPillar(pillars.day),
      hour: isTimeUnknown ? null : formatPillar(pillars.hour),
    },
    dayMaster: {
      stem: day.stem,
      element: dayMaster.element,
      yinYang: dayMaster.yin_yang,
      korean: dayMaster.korean,
    },
    elementDist,
    elementAnalysis,
    strength,
    tenStars,
    relationships,
    shinsal,
    twelveStages,
    yongshin,
    pillar12Shinsal,
    isTimeUnknown,
  } as enrich.EnrichedSajuData;
}

type CategoryKey = "재물운" | "연애운" | "직장운" | "건강운" | "대인운";
const CATEGORIES: CategoryKey[] = ["재물운", "연애운", "직장운", "건강운", "대인운"];

console.log("=" .repeat(100));
console.log("시간 미입력(isTimeUnknown) 시 점수 차이 비교 분석");
console.log("=".repeat(100));

// ── 종합 비교표 ──
const summaryRows: string[] = [];
summaryRows.push(
  "| 케이스 | 시간O 종합 | 시간X 종합 | 차이 | 시간O 등급 | 시간X 등급 | confidence O | confidence X |"
);
summaryRows.push(
  "|--------|-----------|-----------|------|-----------|-----------|-------------|-------------|"
);

for (const c of cases) {
  const enrichedWithTime = buildEnriched(c.pillars, false);
  const enrichedNoTime = buildEnriched(c.pillars, true);

  const inputWithTime = scoring.parseScoringInput(enrichedWithTime);
  const inputNoTime = scoring.parseScoringInput(enrichedNoTime);

  const scoresWithTime = scoring.calculateScores(inputWithTime);
  const scoresNoTime = scoring.calculateScores(inputNoTime);

  const tierWithTime = scoring.calculateTier(inputWithTime, scoresWithTime);
  const tierNoTime = scoring.calculateTier(inputNoTime, scoresNoTime);

  const elemWithTime = scoring.getElementAnalysis(inputWithTime.elementDist);
  const elemNoTime = scoring.getElementAnalysis(inputNoTime.elementDist);

  const defWithTime = Object.values(inputWithTime.elementDist).filter((v: number) => v === 0).length;
  const defNoTime = Object.values(inputNoTime.elementDist).filter((v: number) => v === 0).length;

  // 종합표 행
  const diff = tierNoTime.composite - tierWithTime.composite;
  summaryRows.push(
    `| ${c.label} | ${tierWithTime.composite} | ${tierNoTime.composite} | ${diff >= 0 ? "+" : ""}${diff} | ${tierWithTime.grade} | ${tierNoTime.grade} | ${tierWithTime.confidence} | ${tierNoTime.confidence} |`
  );

  // 카테고리별 상세
  console.log(`\n${"─".repeat(80)}`);
  console.log(`▶ ${c.label}`);
  console.log(`${"─".repeat(80)}`);

  console.log("\n[오행분포]");
  console.log(`  시간O: ${JSON.stringify(inputWithTime.elementDist)} (합계: ${Object.values(inputWithTime.elementDist).reduce((a: number, b: number) => a + b, 0)})`);
  console.log(`  시간X: ${JSON.stringify(inputNoTime.elementDist)} (합계: ${Object.values(inputNoTime.elementDist).reduce((a: number, b: number) => a + b, 0)})`);
  console.log(`  결핍수: 시간O=${defWithTime}, 시간X=${defNoTime} (차이: ${defNoTime - defWithTime})`);
  console.log(`  isBalanced: 시간O=${elemWithTime.isBalanced}, 시간X=${elemNoTime.isBalanced}`);
  console.log(`  hasDeficiency: 시간O=${elemWithTime.hasDeficiency}, 시간X=${elemNoTime.hasDeficiency}`);
  console.log(`  hasDominance: 시간O=${elemWithTime.hasDominance}, 시간X=${elemNoTime.hasDominance}`);

  console.log("\n[십성]");
  console.log(`  시간O: [${inputWithTime.tenStars.join(", ")}]`);
  console.log(`  시간X: [${inputNoTime.tenStars.join(", ")}]`);
  const missingStars = inputWithTime.tenStars.filter((s: string) => !inputNoTime.tenStars.includes(s));
  if (missingStars.length > 0) {
    console.log(`  ⚠ 시간X에서 누락: [${missingStars.join(", ")}]`);
  }

  console.log("\n[지지관계]");
  console.log(`  시간O 합: [${inputWithTime.relationships.hap.join(", ")}]`);
  console.log(`  시간X 합: [${inputNoTime.relationships.hap.join(", ")}]`);
  console.log(`  시간O 충: [${inputWithTime.relationships.chung.join(", ")}]`);
  console.log(`  시간X 충: [${inputNoTime.relationships.chung.join(", ")}]`);

  console.log("\n[신강/신약]");
  console.log(`  시간O: ${inputWithTime.strength}`);
  console.log(`  시간X: ${inputNoTime.strength}`);

  console.log("\n[카테고리 점수 비교]");
  console.log("  | 카테고리 | 시간O | 시간X | 차이 |");
  console.log("  |---------|-------|-------|------|");
  for (const cat of CATEGORIES) {
    const d = scoresNoTime[cat] - scoresWithTime[cat];
    console.log(`  | ${cat} | ${scoresWithTime[cat]} | ${scoresNoTime[cat]} | ${d >= 0 ? "+" : ""}${d} |`);
  }

  console.log(`\n[종합] composite: ${tierWithTime.composite} → ${tierNoTime.composite} (${diff >= 0 ? "+" : ""}${diff}), grade: ${tierWithTime.grade} → ${tierNoTime.grade}`);
}

// ── 종합 비교표 출력 ──
console.log("\n\n" + "=".repeat(100));
console.log("종합 비교표");
console.log("=".repeat(100));
console.log(summaryRows.join("\n"));

// ── 보정 시뮬레이션 ──
console.log("\n\n" + "=".repeat(100));
console.log("보정 시뮬레이션: deficientCount 0.75 스케일링 + isBalanced 완화 (>=3)");
console.log("=".repeat(100));

const correctedRows: string[] = [];
correctedRows.push(
  "| 케이스 | 현재(시간X) | 보정후(시간X) | 보정효과 | 시간O(기준) | 시간O대비차이 |"
);
correctedRows.push(
  "|--------|-----------|-------------|---------|-----------|-------------|"
);

for (const c of cases) {
  const enrichedWithTime = buildEnriched(c.pillars, false);
  const enrichedNoTime = buildEnriched(c.pillars, true);

  const inputWithTime = scoring.parseScoringInput(enrichedWithTime);
  const inputNoTime = scoring.parseScoringInput(enrichedNoTime);

  const scoresWithTime = scoring.calculateScores(inputWithTime);
  const tierWithTime = scoring.calculateTier(inputWithTime, scoresWithTime);

  // 현재 시간X 점수
  const scoresNoTimeCurrent = scoring.calculateScores(inputNoTime);
  const tierNoTimeCurrent = scoring.calculateTier(inputNoTime, scoresNoTimeCurrent);

  // 보정 시뮬: getElementAnalysis를 오버라이드하여 isBalanced 기준 완화 시뮬
  // → 직접 scoring 함수를 호출할 수 없으므로, 수동으로 보정 효과를 계산
  const elemNoTime = scoring.getElementAnalysis(inputNoTime.elementDist);
  const defCountNoTime = Object.values(inputNoTime.elementDist).filter((v: number) => v === 0).length;

  // isBalanced 완화: 4개 이상 → 3개 이상
  const nonZeroCount = Object.values(inputNoTime.elementDist).filter((v: number) => v >= 1).length;
  const wasBalanced = elemNoTime.isBalanced; // >= 4
  const wouldBeBalanced = nonZeroCount >= 3; // 완화 기준

  // deficient 스케일링으로 인한 점수 변화 추정
  let estimatedBoost = 0;

  // 건강운: deficientCount * 6 → deficientCount * 4.5 (차이: deficientCount * 1.5)
  if (defCountNoTime > 0) {
    estimatedBoost += Math.round(defCountNoTime * 1.5);
  }
  // 재물운: deficientCount >= 2 시 -3 → 보정 없음 (기준은 동일, 스케일링 대상 아님)
  // 직장운: deficientCount >= 2 시 -3 → 보정 없음 (기준은 동일, 스케일링 대상 아님)

  // isBalanced 완화로 인한 가점 복원
  if (!wasBalanced && wouldBeBalanced) {
    // 재물운 +4, 연애운 +3, 직장운 +3, 건강운 +10, 대인운 +3 = 평균 ~4.6
    // composite에 반영되는 가중평균 효과
    estimatedBoost += Math.round(0.25 * 4 + 0.20 * 3 + 0.25 * 3 + 0.15 * 10 + 0.15 * 3);
  }

  const correctedComposite = tierNoTimeCurrent.composite + estimatedBoost;
  const diffFromWithTime = correctedComposite - tierWithTime.composite;

  correctedRows.push(
    `| ${c.label} | ${tierNoTimeCurrent.composite} | ${correctedComposite} | +${estimatedBoost} | ${tierWithTime.composite} | ${diffFromWithTime >= 0 ? "+" : ""}${diffFromWithTime} |`
  );

  // 상세 보정 내역
  console.log(`\n▶ ${c.label} 보정 상세:`);
  console.log(`  deficientCount: ${defCountNoTime} → 건강운 보정: +${Math.round(defCountNoTime * 1.5)}`);
  console.log(`  isBalanced 현재: ${wasBalanced}, 완화(>=3) 적용시: ${wouldBeBalanced} (nonZero=${nonZeroCount})`);
  if (!wasBalanced && wouldBeBalanced) {
    console.log(`  → isBalanced 복원 효과: 재물+4, 연애+3, 직장+3, 건강+10, 대인+3`);
  }
}

console.log("\n" + correctedRows.join("\n"));

console.log("\n\n✅ 분석 완료");
