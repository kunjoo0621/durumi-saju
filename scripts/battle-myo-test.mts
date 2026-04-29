/**
 * 묘(墓) 반복 문제 테스트 — 사주 조합별 12운성 확인 (standalone)
 *
 * 테스트 1: 묘(墓)가 없는 조합
 *   A: 1990-03-15 10:00 남성 (이준호)
 *   B: 1992-07-22 14:00 여성 (박서연)
 *   관계: 연인
 *
 * 테스트 2: 한쪽만 묘가 있을 수 있는 조합
 *   A: 1988-12-05 06:00 남성 (최민수)
 *   B: 1995-01-18 20:00 여성 (한소희)
 *   관계: 친구
 */

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

// ── 12운성 한글 계산 (saju-fortune.ts와 동일) ──

const STAGE_KOREAN = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"] as const;
const BRANCHES_LIST = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);
const YANG_BIRTH: Record<string, string> = { "甲": "亥", "丙": "寅", "戊": "寅", "庚": "巳", "壬": "申" };
const YIN_BIRTH: Record<string, string> = { "乙": "午", "丁": "酉", "己": "酉", "辛": "子", "癸": "卯" };

function getTwelveStageKorean(dayStem: string, branch: string): string {
  const isYang = YANG_STEMS.has(dayStem);
  const birthBranch = isYang ? YANG_BIRTH[dayStem] : YIN_BIRTH[dayStem];
  if (!birthBranch) return "알수없음";
  const birthIdx = BRANCHES_LIST.indexOf(birthBranch as typeof BRANCHES_LIST[number]);
  const targetIdx = BRANCHES_LIST.indexOf(branch as typeof BRANCHES_LIST[number]);
  if (birthIdx < 0 || targetIdx < 0) return "알수없음";
  const stageIdx = isYang
    ? (targetIdx - birthIdx + 12) % 12
    : (birthIdx - targetIdx + 12) % 12;
  return STAGE_KOREAN[stageIdx];
}

// ── 천간/지지 한글 ──

const STEM_KR: Record<string, string> = {
  "甲": "갑", "乙": "을", "丙": "병", "丁": "정", "戊": "무",
  "己": "기", "庚": "경", "辛": "신", "壬": "임", "癸": "계",
};
const BRANCH_KR: Record<string, string> = {
  "子": "자", "丑": "축", "寅": "인", "卯": "묘", "辰": "진", "巳": "사",
  "午": "오", "未": "미", "申": "신", "酉": "유", "戌": "술", "亥": "해",
};
const STEM_ELEMENT: Record<string, string> = {
  "甲": "목", "乙": "목", "丙": "화", "丁": "화", "戊": "토",
  "己": "토", "庚": "금", "辛": "금", "壬": "수", "癸": "수",
};
const STEM_YINYANG: Record<string, string> = {
  "甲": "양", "乙": "음", "丙": "양", "丁": "음", "戊": "양",
  "己": "음", "庚": "양", "辛": "음", "壬": "양", "癸": "음",
};

function formatPillar(stem: string, branch: string): string {
  return `${stem}${branch}(${STEM_KR[stem] || "?"}${BRANCH_KR[branch] || "?"})`;
}

// ── 오행 분포 계산 ──

const BRANCH_ELEMENT: Record<string, string> = {
  "子": "수", "丑": "토", "寅": "목", "卯": "목", "辰": "토", "巳": "화",
  "午": "화", "未": "토", "申": "금", "酉": "금", "戌": "토", "亥": "수",
};

function calcElementDist(stems: string[], branches: string[]): Record<string, number> {
  const dist: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const s of stems) dist[STEM_ELEMENT[s] || "토"]++;
  for (const b of branches) dist[BRANCH_ELEMENT[b] || "토"]++;
  return dist;
}

// ── 십성 계산 ──

const ELEMENT_GENERATES: Record<string, string> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
const ELEMENT_CONTROLS: Record<string, string> = { 목: "토", 화: "금", 토: "수", 금: "목", 수: "화" };

function getTenGod(dayStem: string, targetStem: string): string {
  const dayEl = STEM_ELEMENT[dayStem]; const targetEl = STEM_ELEMENT[targetStem];
  const dayYY = STEM_YINYANG[dayStem]; const targetYY = STEM_YINYANG[targetStem];
  if (!dayEl || !targetEl) return "?";
  const same = dayYY === targetYY;
  if (dayEl === targetEl) return same ? "비견" : "겁재";
  if (ELEMENT_GENERATES[dayEl] === targetEl) return same ? "식신" : "상관";
  if (ELEMENT_GENERATES[targetEl] === dayEl) return same ? "편인" : "정인";
  if (ELEMENT_CONTROLS[dayEl] === targetEl) return same ? "편재" : "정재";
  if (ELEMENT_CONTROLS[targetEl] === dayEl) return same ? "편관" : "정관";
  return "?";
}

function calcTenStars(dayStem: string, stems: string[], branches: string[]): string[] {
  const stars: string[] = [];
  const HIDDEN: Record<string, string[]> = {
    "子": ["癸"], "丑": ["己","癸","辛"], "寅": ["甲","丙","戊"], "卯": ["乙"],
    "辰": ["戊","乙","癸"], "巳": ["丙","戊","庚"], "午": ["丁","己"],
    "未": ["己","丁","乙"], "申": ["庚","壬","戊"], "酉": ["辛"],
    "戌": ["戊","辛","丁"], "亥": ["壬","甲"],
  };
  for (const s of stems) {
    if (s !== dayStem) stars.push(getTenGod(dayStem, s));
  }
  for (const b of branches) {
    const main = HIDDEN[b]?.[0];
    if (main) stars.push(getTenGod(dayStem, main));
  }
  return stars;
}

// ── 타입 ──

type PersonInput = {
  name: string;
  year: number; month: number; day: number;
  hour: number; minute: number;
  gender: "male" | "female";
  location: string;
};

type PersonResult = {
  name: string;
  pillars: { year: string; month: string; day: string; hour: string };
  rawPillars: { year: [string,string]; month: [string,string]; day: [string,string]; hour: [string,string] };
  dayStem: string;
  twelveStages: { year: string; month: string; day: string; hour: string };
  elementDist: Record<string, number>;
  tenStars: string[];
  daeun: { startAge: number; endAge: number; pillar: string; tenStar: string; twelveStage: string }[] | null;
  seun: { year: number; age: number; pillar: string; tenStar: string; twelveStage: string }[] | null;
};

// ── 분석 함수 ──

async function analyzePerson(person: PersonInput, adapter: any): Promise<PersonResult> {
  const birthDate = new Date(person.year, person.month - 1, person.day, person.hour, person.minute);
  const dateFnsDate = { date: birthDate, timeZone: "Asia/Seoul" as const };

  const result = getFourPillars(dateFnsDate, { adapter, longitudeDeg: 126.9778 });

  const yearStem = result.year[0], yearBranch = result.year[1];
  const monthStem = result.month[0], monthBranch = result.month[1];
  const dayStem = result.day[0], dayBranch = result.day[1];
  const hourStem = result.hour[0], hourBranch = result.hour[1];

  // 12운성 (일간 기준)
  const twelveStages = {
    year: getTwelveStageKorean(dayStem, yearBranch),
    month: getTwelveStageKorean(dayStem, monthBranch),
    day: getTwelveStageKorean(dayStem, dayBranch),
    hour: getTwelveStageKorean(dayStem, hourBranch),
  };

  // 라이브러리 12운성 (확인용)
  const libStages = analyzeTwelveStages(
    yearStem + yearBranch,
    monthStem + monthBranch,
    dayStem + dayBranch,
    hourStem + hourBranch,
  );

  // 오행 분포
  const stems = [yearStem, monthStem, dayStem, hourStem];
  const branches = [yearBranch, monthBranch, dayBranch, hourBranch];
  const elementDist = calcElementDist(stems, branches);

  // 십성
  const tenStars = calcTenStars(dayStem, stems, branches);

  // 대운
  let daeun: PersonResult["daeun"] = null;
  let seun: PersonResult["seun"] = null;
  try {
    const solarTermInfo = analyzeSolarTerms(dateFnsDate, { adapter });
    const majorLuck: MajorLuckResult = calculateMajorLuck(
      dateFnsDate,
      person.gender as Gender,
      yearStem + yearBranch,
      monthStem + monthBranch,
      {
        adapter,
        count: 10,
        nextJieMillis: solarTermInfo.nextJieMillis,
        prevJieMillis: solarTermInfo.prevJieMillis,
      },
    );

    daeun = majorLuck.pillars.map((p: LuckPillar) => ({
      startAge: p.startAge,
      endAge: p.endAge,
      pillar: p.pillar,
      tenStar: getTenGodForStem(dayStem, p.stem).korean,
      twelveStage: getTwelveStageKorean(dayStem, p.branch),
    }));

    const currentYear = new Date().getFullYear();
    const yearlyLuck: YearlyLuckResult[] = calculateYearlyLuck(person.year, currentYear - 1, currentYear + 5);
    seun = yearlyLuck.map((y: YearlyLuckResult) => ({
      year: y.year,
      age: y.age,
      pillar: y.pillar,
      tenStar: getTenGodForStem(dayStem, y.stem).korean,
      twelveStage: getTwelveStageKorean(dayStem, y.branch),
    }));
  } catch (e) {
    console.warn(`[대운 계산 실패] ${person.name}:`, (e as Error).message);
  }

  return {
    name: person.name,
    pillars: {
      year: formatPillar(yearStem, yearBranch),
      month: formatPillar(monthStem, monthBranch),
      day: formatPillar(dayStem, dayBranch),
      hour: formatPillar(hourStem, hourBranch),
    },
    rawPillars: {
      year: [yearStem, yearBranch],
      month: [monthStem, monthBranch],
      day: [dayStem, dayBranch],
      hour: [hourStem, hourBranch],
    },
    dayStem,
    twelveStages: {
      year: twelveStages.year,
      month: twelveStages.month,
      day: libStages.day.korean,  // 라이브러리 결과 사용
      hour: twelveStages.hour,
    },
    elementDist,
    tenStars,
    daeun,
    seun,
  };
}

// ── 출력 함수 ──

function printPerson(p: PersonResult) {
  console.log(`\n── ${p.name} 사주 정보 ──`);
  console.log(`  년주: ${p.pillars.year}`);
  console.log(`  월주: ${p.pillars.month}`);
  console.log(`  일주: ${p.pillars.day}`);
  console.log(`  시주: ${p.pillars.hour}`);
  console.log(`  일간: ${p.dayStem} (${STEM_KR[p.dayStem]} / ${STEM_ELEMENT[p.dayStem]}${STEM_YINYANG[p.dayStem]})`);

  console.log(`\n  오행분포: ${Object.entries(p.elementDist).map(([k,v]) => `${k}(${v})`).join(" ")}`);
  console.log(`  십성: ${[...new Set(p.tenStars)].join(", ")}`);

  console.log(`\n  ★ 12운성 (일간 ${STEM_KR[p.dayStem]}${p.dayStem} 기준):`);
  console.log(`    년주 ${p.pillars.year} → ${p.twelveStages.year}`);
  console.log(`    월주 ${p.pillars.month} → ${p.twelveStages.month}`);
  console.log(`    일주 ${p.pillars.day} → ${p.twelveStages.day}`);
  console.log(`    시주 ${p.pillars.hour} → ${p.twelveStages.hour}`);

  const stageValues = Object.values(p.twelveStages);
  const has묘 = stageValues.includes("묘");
  const 묘count = stageValues.filter(s => s === "묘").length;
  console.log(`    → 원국 묘(墓) 존재: ${has묘 ? `✅ 있음 (${묘count}개)` : "❌ 없음"}`);

  if (p.daeun) {
    console.log(`\n  대운 흐름:`);
    const currentAge = new Date().getFullYear() - 0; // placeholder
    for (const d of p.daeun) {
      const isMyo = d.twelveStage === "묘" ? " ◀ 묘(墓)" : "";
      console.log(`    ${d.startAge}~${d.endAge}세: ${d.pillar} ${d.tenStar} ${d.twelveStage}${isMyo}`);
    }
    const myoDaeun = p.daeun.filter(d => d.twelveStage === "묘");
    if (myoDaeun.length > 0) {
      console.log(`    → 대운 묘(墓): ${myoDaeun.map(d => `${d.startAge}~${d.endAge}세`).join(", ")}`);
    } else {
      console.log(`    → 대운 묘(墓): 없음`);
    }
  }

  if (p.seun) {
    console.log(`\n  세운 (최근~향후):`);
    for (const s of p.seun) {
      const isMyo = s.twelveStage === "묘" ? " ◀ 묘(墓)" : "";
      console.log(`    ${s.year}년 (${s.age}세): ${s.pillar} ${s.tenStar} ${s.twelveStage}${isMyo}`);
    }
  }
}

// ── 일간 관계 계산 ──

function getDayStemRelation(stemA: string, stemB: string): string {
  const HAP_PAIRS: [string,string][] = [["甲","己"],["乙","庚"],["丙","辛"],["丁","壬"],["戊","癸"]];
  const CHUNG_PAIRS: [string,string][] = [["甲","庚"],["乙","辛"],["丙","壬"],["丁","癸"]];

  for (const [a,b] of HAP_PAIRS) {
    if ((stemA === a && stemB === b) || (stemA === b && stemB === a)) return "천간합(合)";
  }
  for (const [a,b] of CHUNG_PAIRS) {
    if ((stemA === a && stemB === b) || (stemA === b && stemB === a)) return "천간충(沖)";
  }

  const elA = STEM_ELEMENT[stemA]; const elB = STEM_ELEMENT[stemB];
  if (ELEMENT_GENERATES[elA] === elB) return `상생(${elA}→${elB})`;
  if (ELEMENT_GENERATES[elB] === elA) return `상생(${elB}→${elA})`;
  if (ELEMENT_CONTROLS[elA] === elB) return `상극(${elA}→${elB})`;
  if (ELEMENT_CONTROLS[elB] === elA) return `상극(${elB}→${elA})`;
  if (elA === elB) return `비화(같은 오행: ${elA})`;
  return "기타";
}

// ── 메인 실행 ──

async function runBattleTest(
  label: string,
  personA: PersonInput,
  personB: PersonInput,
  relationship: string,
  adapter: any,
) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`  관계: ${relationship}`);
  console.log(`${"═".repeat(60)}`);

  const a = await analyzePerson(personA, adapter);
  const b = await analyzePerson(personB, adapter);

  printPerson(a);
  printPerson(b);

  // 일간 관계
  const relation = getDayStemRelation(a.dayStem, b.dayStem);
  console.log(`\n── 두 사람 관계 분석 ──`);
  console.log(`  일간 관계: ${STEM_KR[a.dayStem]}${a.dayStem} ↔ ${STEM_KR[b.dayStem]}${b.dayStem} → ${relation}`);

  // 묘(墓) 종합 분석
  console.log(`\n── 묘(墓) 종합 진단 ──`);

  const allStagesA = Object.values(a.twelveStages);
  const allStagesB = Object.values(b.twelveStages);
  const 원국묘A = allStagesA.filter(s => s === "묘").length;
  const 원국묘B = allStagesB.filter(s => s === "묘").length;
  const 대운묘A = a.daeun?.filter(d => d.twelveStage === "묘").length ?? 0;
  const 대운묘B = b.daeun?.filter(d => d.twelveStage === "묘").length ?? 0;
  const 세운묘A = a.seun?.filter(s => s.twelveStage === "묘").length ?? 0;
  const 세운묘B = b.seun?.filter(s => s.twelveStage === "묘").length ?? 0;

  // 지지 묘(卯) 존재 여부
  const branches_A = [a.rawPillars.year[1], a.rawPillars.month[1], a.rawPillars.day[1], a.rawPillars.hour[1]];
  const branches_B = [b.rawPillars.year[1], b.rawPillars.month[1], b.rawPillars.day[1], b.rawPillars.hour[1]];
  const 지지묘A = branches_A.filter(b => b === "卯").length;
  const 지지묘B = branches_B.filter(b => b === "卯").length;

  console.log(`  ${personA.name}:`);
  console.log(`    원국 12운성 묘(墓): ${원국묘A}개`);
  console.log(`    대운 묘(墓): ${대운묘A}개`);
  console.log(`    세운 묘(墓): ${세운묘A}개`);
  console.log(`    지지 묘(卯): ${지지묘A}개`);

  console.log(`  ${personB.name}:`);
  console.log(`    원국 12운성 묘(墓): ${원국묘B}개`);
  console.log(`    대운 묘(墓): ${대운묘B}개`);
  console.log(`    세운 묘(墓): ${세운묘B}개`);
  console.log(`    지지 묘(卯): ${지지묘B}개`);

  const total묘 = 원국묘A + 원국묘B + 대운묘A + 대운묘B + 세운묘A + 세운묘B;
  console.log(`\n  → 총 묘(墓) 데이터 노출 포인트: ${total묘}개`);

  if (total묘 === 0) {
    console.log(`  → ❌ 이 조합에 묘(墓)가 전혀 없음.`);
    console.log(`    LLM이 묘(墓)를 언급하면 → 입력 데이터 무관 LLM 습관 문제 확정.`);
  } else if (total묘 <= 2) {
    console.log(`  → ⚠️  묘(墓) 소량 존재. LLM이 2회 이하 언급은 정상, 3회 이상이면 반복 문제.`);
  } else {
    console.log(`  → ✅ 묘(墓) 다수 존재. LLM이 여러 번 언급할 근거가 있는 조합.`);
  }

  // 가장 많이 반복되는 12운성 Top 3
  const allStages = [...allStagesA, ...allStagesB];
  const stageCounts = new Map<string, number>();
  for (const s of allStages) {
    stageCounts.set(s, (stageCounts.get(s) || 0) + 1);
  }
  const topStages = [...stageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log(`\n  원국 12운성 빈도 Top 3:`);
  for (const [stage, count] of topStages) {
    console.log(`    ${stage}: ${count}회`);
  }

  // 전체 사주 용어 Top 3 (대운/세운 포함)
  const allText = [
    ...allStagesA, ...allStagesB,
    ...a.tenStars, ...b.tenStars,
    ...(a.daeun?.map(d => `${d.tenStar} ${d.twelveStage}`) ?? []),
    ...(b.daeun?.map(d => `${d.tenStar} ${d.twelveStage}`) ?? []),
  ].join(" ");

  const TERMS = ["건록","제왕","장생","목욕","관대","쇠","병","사","묘","절","태","양",
    "비견","겁재","식신","상관","정재","편재","정관","편관","정인","편인"];
  const termCounts = new Map<string, number>();
  for (const term of TERMS) {
    const re = new RegExp(term, "g");
    const count = (allText.match(re) || []).length;
    if (count > 0) termCounts.set(term, count);
  }
  const topTerms = [...termCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log(`\n  전체 사주 용어 빈도 Top 3 (원국+대운+세운):`);
  for (const [term, count] of topTerms) {
    console.log(`    ${term}: ${count}회`);
  }

  return { a, b, total묘 };
}

// ── 실행 ──

const adapter = await createDateFnsAdapter();

console.log("====================================================");
console.log("  묘(墓) 반복 문제 진단 — 사주 조합별 배틀 테스트");
console.log("====================================================");

const test1 = await runBattleTest(
  "테스트 1: 묘(墓)가 없을 것으로 예상되는 조합",
  { name: "이준호", year: 1990, month: 3, day: 15, hour: 10, minute: 0, gender: "male", location: "서울" },
  { name: "박서연", year: 1992, month: 7, day: 22, hour: 14, minute: 0, gender: "female", location: "서울" },
  "연인",
  adapter,
);

const test2 = await runBattleTest(
  "테스트 2: 한쪽만 묘가 있을 수 있는 조합",
  { name: "최민수", year: 1988, month: 12, day: 5, hour: 6, minute: 0, gender: "male", location: "서울" },
  { name: "한소희", year: 1995, month: 1, day: 18, hour: 20, minute: 0, gender: "female", location: "서울" },
  "친구",
  adapter,
);

// ── 종합 결론 ──

console.log(`\n${"═".repeat(60)}`);
console.log("  종합 결론");
console.log(`${"═".repeat(60)}`);
console.log(`\n  테스트 1 (이준호 vs 박서연): 묘(墓) 데이터 포인트 = ${test1.total묘}개`);
console.log(`  테스트 2 (최민수 vs 한소희): 묘(墓) 데이터 포인트 = ${test2.total묘}개`);
console.log(`\n  → 이 결과로 LLM에 보내지는 입력 데이터에 묘(墓)가 얼마나 있는지 파악 가능.`);
console.log(`  → 묘(墓)가 없는 조합에서도 LLM이 반복한다면 프롬프트/모델 습관 문제.`);
console.log(`  → 묘(墓)가 있는 조합에서만 반복된다면 입력 데이터 트리거 문제.\n`);
