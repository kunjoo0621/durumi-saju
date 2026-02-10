import * as scoring from "../lib/utils/saju-scoring";

function printRow(label: string, value: any) {
  // eslint-disable-next-line no-console
  console.log(`${label}:`, JSON.stringify(value, null, 2));
}

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

// 1) 경계값 grade/percentileRank/topPercent 단조/클램프 확인
const composites = [0, 55, 56, 57, 58, 67, 68, 77, 78, 85, 86, 100];
const ranks: number[] = [];
for (const c of composites) {
  // percentileRankFromComposite / topPercentFromPercentileRank는 lib/gradeSystem에 있으므로,
  // 여기서는 Tier 계산 흐름이 아닌 "단일 소스" 경계값은 build 시 테스트로 커버한다.
  // 이 스크립트는 서버 스코어링 레벨의 정합성만 빠르게 확인한다.
  ranks.push(c);
}

// 2) "카테고리 4개 D면 종합 최대 C" 강제 체크
const fakeEnrichedHighPotential = {
  elementDist: { 목: 1, 화: 1, 토: 1, 금: 1, 수: 1 },
  strength: { result: "신강" },
  tenStars: ["정관(正官)", "정재(正財)", "식신(食神)", "정인(正印)"],
  relationships: { hap: ["자축합토(子丑合土)"], chung: [], hyung: [] },
  shinsal: [],
  isTimeUnknown: false,
};

const scoringModule: any = (scoring as any).default || scoring;
const scoringInput = scoringModule.parseScoringInput(fakeEnrichedHighPotential as any);
const lowScores = {
  재물운: 50,
  연애운: 50,
  직장운: 50,
  건강운: 50,
  대인운: 60,
};

const tier = scoringModule.calculateTier(scoringInput, lowScores);
printRow("lowScores", {
  ...lowScores,
  grades: Object.fromEntries(Object.entries(lowScores).map(([k, v]) => [k, scoringModule.scoreToGrade(v)])),
});
printRow("tierFromLowScores", tier);

assert(["C", "D"].includes(tier.grade), "dCount>=4인데 종합 등급이 C/D가 아님");
assert(tier.percentileRank >= 1 && tier.percentileRank <= 99, "percentileRank out of [1,99]");
assert(tier.topPercent >= 1 && tier.topPercent <= 99, "topPercent out of [1,99]");

// 3) 재현성(결정론) 체크: 같은 입력이면 같은 tier
const tier2 = scoringModule.calculateTier(scoringInput, lowScores);
assert(JSON.stringify(tier) === JSON.stringify(tier2), "동일 입력인데 tier 결과가 다름");

// eslint-disable-next-line no-console
console.log("All saju scoring checks passed.");
