/**
 * 커리어운 facts 몬테카를로 발화율 점검 (career-facts.ts 임계값 튜닝용).
 *
 * ★환경 우회: 현재 레포는 @gracefullight/saju 1.2.0(ESM-only)와 Node24+tsx CJS 충돌로
 * lib/utils/saju.ts(enrichSajuData)를 CLI에서 import하지 못한다(레포 전역 선재 이슈).
 * career-facts가 실제로 읽는 enriched 필드는 dayMaster.element / strength.result /
 * yongshin.eokbu 3개뿐이고, 그 재료(judgeStrength·determineYongshin·
 * calculateElementDistribution)는 전부 clean한 saju-enrichment.ts에 있으므로,
 * saju.ts를 거치지 않는 경량 enrich로 동일 값을 재구성한다(12운성만 빠지는데 미사용).
 *
 * 실행: npx tsx scripts/career-mc.mts [N]
 * 합격 기준(계획서 Phase1 완료기준2): careerGrip 4상한 각 ≥8%, 상관견관 5~35%,
 * 관인상생 10~50%, 무관 5~25%. 범위 밖이면 career-facts 임계값 재조정 후 재실행.
 */
import {
  STEM_ELEMENT,
  BRANCH_INFO,
  calculateElementDistribution,
  judgeStrength,
  determineYongshin,
  type EnrichedSajuData,
} from "../lib/utils/saju-enrichment";
import { deriveCareerFacts, type CareerSituation } from "../lib/career-facts";
import type { SajuData } from "../lib/utils/saju";

const STEMS = Object.keys(STEM_ELEMENT);
const BRANCHES = Object.keys(BRANCH_INFO);
const SITUATIONS: CareerSituation[] = ["진로 탐색", "현직 성장", "이직 고민", "독립·사업"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPillar() {
  const branch = pick(BRANCHES);
  return {
    heavenlyStem: pick(STEMS),
    earthlyBranch: branch,
    hiddenStems: BRANCH_INFO[branch].jijanggan.map((j) => j.stem),
  };
}

function randomChart(): SajuData {
  return {
    year: randomPillar(),
    month: randomPillar(),
    day: randomPillar(),
    hour: randomPillar(),
  } as SajuData;
}

// saju.ts enrichSajuData(491~523)의 career 관련 3필드만 재현(12운성/신살 생략).
function lightEnrich(chart: SajuData): EnrichedSajuData {
  const stems = [chart.year.heavenlyStem, chart.month.heavenlyStem, chart.day.heavenlyStem, chart.hour.heavenlyStem];
  const branches = [chart.year.earthlyBranch, chart.month.earthlyBranch, chart.day.earthlyBranch, chart.hour.earthlyBranch];
  const dayMaster = STEM_ELEMENT[chart.day.heavenlyStem];
  const elementDist = calculateElementDistribution(stems, branches);
  const strength = judgeStrength(dayMaster.element, elementDist, stems.length + branches.length, false, {
    monthBranch: chart.month.earthlyBranch,
    dayBranch: chart.day.earthlyBranch,
    hourBranch: chart.hour.earthlyBranch,
    allBranches: branches,
    allStems: stems,
    dayStem: chart.day.heavenlyStem,
  });
  const yongshin = determineYongshin(dayMaster.element, strength, elementDist, chart.month.earthlyBranch);
  return { dayMaster, strength, yongshin } as unknown as EnrichedSajuData;
}

const N = Number(process.argv[2] || 2000);
const grip: Record<string, number> = { 신왕관왕: 0, 신왕관쇠: 0, 관다신약: 0, 신약관소: 0 };
const gtype: Record<string, number> = { 정관우세: 0, 편관우세: 0, 관살혼잡: 0, 무관: 0 };
let sanggwanGyeongwan = 0;
let gwaninSangsaeng = 0;
let yongshinFavors = 0;
let gwaninAbsent = 0;

for (let i = 0; i < N; i++) {
  const chart = randomChart();
  const enriched = lightEnrich(chart);
  const facts = deriveCareerFacts(enriched, null, chart, SITUATIONS[i % 4], 2026);
  grip[facts.careerGrip]++;
  gtype[facts.gwanseongType]++;
  if (facts.sanggwanGyeongwan) sanggwanGyeongwan++;
  if (facts.gwaninSangsaeng) gwaninSangsaeng++;
  if (facts.yongshinFavorsCareer) yongshinFavors++;
  if (facts.inseongAbsent) gwaninAbsent++;
}

const pct = (n: number) => ((n / N) * 100).toFixed(1) + "%";
console.log(`\n=== 커리어 facts 몬테카를로 (N=${N}, 균등랜덤 합성차트) ===`);
console.log("\n[careerGrip 4상한] — 각 ≥8% 합격");
for (const k of Object.keys(grip)) console.log(`  ${k}: ${pct(grip[k])}`);
console.log("\n[gwanseongType]");
for (const k of Object.keys(gtype)) console.log(`  ${k}: ${pct(gtype[k])}`);
console.log("\n[보조 신호]");
console.log(`  상관견관(위치극): ${pct(sanggwanGyeongwan)}  (합격 5~35%)`);
console.log(`  관인상생: ${pct(gwaninSangsaeng)}  (합격 10~50%)`);
console.log(`  무관: ${pct(gtype["무관"])}  (합격 5~25%)`);
console.log(`  인성부재: ${pct(gwaninAbsent)}`);
console.log(`  용신이 관/인: ${pct(yongshinFavors)}`);
