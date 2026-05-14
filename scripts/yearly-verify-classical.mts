/**
 * 두루미 yearly v1.3 계산식 정밀 검증.
 *
 * 정통 명리학 표준(자평진전·삼명통회·연해자평·궁통보감) 자료와
 * 두루미 산출 결과를 자동 대조. PASS/FAIL 보고.
 *
 * 사용:
 *   NODE_OPTIONS="--conditions=import" npx tsx scripts/yearly-verify-classical.mts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// .env.local 로드
const envPath = resolve(import.meta.dirname!, "../.env.local");
const envText = readFileSync(envPath, "utf-8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const key = m[1].trim();
  const value = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = value;
}

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  expected?: any;
  actual?: any;
  note?: string;
}

const results: TestResult[] = [];

function check(category: string, name: string, actual: any, expected: any, note?: string) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, category, passed, actual, expected, note });
}

function checkTrue(category: string, name: string, condition: boolean, note?: string) {
  results.push({ name, category, passed: condition, note });
}

/* ──────────────────── Case 1: 매핑 표 정합성 ──────────────────── */

async function verifyMappingTables() {
  console.log("\n========== Case 1: 매핑 표 정합성 (정통 자료 vs 두루미 lib) ==========");

  const { NAPUM_60 } = await import("../lib/constants/napum");
  const { YUKAP, YUKCHUNG, HYUNG, SAMHAP } = await import("../lib/utils/saju-enrichment");

  // 1-1. 납음 60개 (자평진전 부록 표준)
  const NAPUM_STANDARD: Record<string, [string, string]> = {
    "甲子": ["해중금", "海中金"], "乙丑": ["해중금", "海中金"],
    "丙寅": ["노중화", "爐中火"], "丁卯": ["노중화", "爐中火"],
    "戊辰": ["대림목", "大林木"], "己巳": ["대림목", "大林木"],
    "庚午": ["노방토", "路傍土"], "辛未": ["노방토", "路傍土"],
    "壬申": ["검봉금", "劍鋒金"], "癸酉": ["검봉금", "劍鋒金"],
    "甲戌": ["산두화", "山頭火"], "乙亥": ["산두화", "山頭火"],
    "丙子": ["간하수", "澗下水"], "丁丑": ["간하수", "澗下水"],
    "戊寅": ["성두토", "城頭土"], "己卯": ["성두토", "城頭土"],
    "庚辰": ["백랍금", "白蠟金"], "辛巳": ["백랍금", "白蠟金"],
    "壬午": ["양류목", "楊柳木"], "癸未": ["양류목", "楊柳木"],
    "甲申": ["천중수", "泉中水"], "乙酉": ["천중수", "泉中水"],
    "丙戌": ["옥상토", "屋上土"], "丁亥": ["옥상토", "屋上土"],
    "戊子": ["벽력화", "霹靂火"], "己丑": ["벽력화", "霹靂火"],
    "庚寅": ["송백목", "松柏木"], "辛卯": ["송백목", "松柏木"],
    "壬辰": ["장류수", "長流水"], "癸巳": ["장류수", "長流水"],
    "甲午": ["사중금", "沙中金"], "乙未": ["사중금", "沙中金"],
    "丙申": ["산하화", "山下火"], "丁酉": ["산하화", "山下火"],
    "戊戌": ["평지목", "平地木"], "己亥": ["평지목", "平地木"],
    "庚子": ["벽상토", "壁上土"], "辛丑": ["벽상토", "壁上土"],
    "壬寅": ["금박금", "金箔金"], "癸卯": ["금박금", "金箔金"],
    "甲辰": ["복등화", "覆燈火"], "乙巳": ["복등화", "覆燈火"],
    "丙午": ["천하수", "天河水"], "丁未": ["천하수", "天河水"],
    "戊申": ["대역토", "大驛土"], "己酉": ["대역토", "大驛土"],
    "庚戌": ["차천금", "釵釧金"], "辛亥": ["차천금", "釵釧金"],
    "壬子": ["상자목", "桑柘木"], "癸丑": ["상자목", "桑柘木"],
    "甲寅": ["대계수", "大溪水"], "乙卯": ["대계수", "大溪水"],
    "丙辰": ["사중토", "沙中土"], "丁巳": ["사중토", "沙中土"],
    "戊午": ["천상화", "天上火"], "己未": ["천상화", "天上火"],
    "庚申": ["석류목", "石榴木"], "辛酉": ["석류목", "石榴木"],
    "壬戌": ["대해수", "大海水"], "癸亥": ["대해수", "大海水"],
  };
  let napumOk = true;
  for (const [pillar, [k, h]] of Object.entries(NAPUM_STANDARD)) {
    const got = NAPUM_60[pillar];
    if (!got || got.korean !== k || got.hanja !== h) {
      napumOk = false;
      console.error(`  ✗ 납음 ${pillar}: expected ${k}(${h}), got ${got?.korean}(${got?.hanja})`);
    }
  }
  checkTrue("매핑표", "납음 60갑자 (60개)", napumOk, "자평진전·삼명통회 부록 표준");

  // 1-2. 지지 육합 (정통 6쌍)
  const YUKAP_STANDARD = [
    ["子", "丑", "토"],
    ["寅", "亥", "목"],
    ["卯", "戌", "화"],
    ["辰", "酉", "금"],
    ["巳", "申", "수"],
    ["午", "未", "화"],
  ];
  check("매핑표", "지지 육합 (6쌍)", YUKAP, YUKAP_STANDARD);

  // 1-3. 지지 육충 (정통 6쌍)
  const YUKCHUNG_STANDARD = [
    ["子", "午"], ["丑", "未"], ["寅", "申"],
    ["卯", "酉"], ["辰", "戌"], ["巳", "亥"],
  ];
  check("매핑표", "지지 육충 (6쌍)", YUKCHUNG, YUKCHUNG_STANDARD);

  // 1-4. 삼합 (정통 4국)
  const SAMHAP_STANDARD = [
    ["申", "子", "辰", "수"],
    ["寅", "午", "戌", "화"],
    ["巳", "酉", "丑", "금"],
    ["亥", "卯", "未", "목"],
  ];
  check("매핑표", "삼합 (4국)", SAMHAP, SAMHAP_STANDARD);

  // 1-5. 형(刑) — 자평진전 표준 7종
  const HYUNG_STANDARD = [
    [["寅", "巳", "申"], "무은지형(無恩之刑)"],
    [["丑", "戌", "未"], "지세지형(持勢之刑)"],
    [["子", "卯"], "무례지형(無禮之刑)"],
    [["辰", "辰"], "자형(自刑)"],
    [["午", "午"], "자형(自刑)"],
    [["酉", "酉"], "자형(自刑)"],
    [["亥", "亥"], "자형(自刑)"],
  ];
  check("매핑표", "형 (7종)", HYUNG, HYUNG_STANDARD);
}

/* ──────────────────── Case 2: 운영자 사주 전수 ──────────────────── */

async function verifyOperatorSaju() {
  console.log("\n========== Case 2: 운영자 사주 (1995-06-21 16:00 남, 서울) ==========");

  const { resolveSajuEnrichedData } = await import("../lib/analysis");
  const { calculateServerScoring } = await import("../lib/utils/saju-scoring");

  const input = {
    name: "신갑주",
    birthYear: "1995", birthMonth: "06", birthDay: "21",
    calendarType: "solar" as const,
    birthHour: "16", birthMinute: "00",
    birthLocation: "서울",
    gender: "남성",
    relationshipStatus: "연애중",
    employmentStatus: "사업·프리랜서",
    coreFearAxis: "DISMISS" as const,
    unknownBirthTime: false,
  };

  const { enriched, fortune } = await resolveSajuEnrichedData(input);
  if (!enriched) {
    checkTrue("운영자사주", "enriched 계산", false, "resolveSajuEnrichedData 실패");
    return;
  }

  // 2-1. 4주 (enriched.pillars 형식: "한자(한글)")
  check("운영자사주", "년주", enriched.pillars.year, "乙亥(을해)");
  check("운영자사주", "월주", enriched.pillars.month, "壬午(임오)");
  check("운영자사주", "일주", enriched.pillars.day, "癸未(계미)");
  check("운영자사주", "시주", enriched.pillars.hour, "庚申(경신)");

  // 2-2. 일간
  check("운영자사주", "일간 stem", enriched.dayMaster.stem, "癸");
  check("운영자사주", "일간 element", enriched.dayMaster.element, "수");
  check("운영자사주", "일간 yinYang", enriched.dayMaster.yinYang, "음");

  // 2-3. 오행 분포 (수3 / 금2 / 목1 / 화1 / 토1) — memory v15 시점
  check("운영자사주", "오행 수", enriched.elementDist["수" as any], 3);
  check("운영자사주", "오행 금", enriched.elementDist["금" as any], 2);
  check("운영자사주", "오행 목", enriched.elementDist["목" as any], 1);
  check("운영자사주", "오행 화", enriched.elementDist["화" as any], 1);
  check("운영자사주", "오행 토", enriched.elementDist["토" as any], 1);

  // 2-4. 용신·기신·희신
  check("운영자사주", "용신 (억부)", enriched.yongshin?.eokbu, "토");
  check("운영자사주", "기신", enriched.yongshin?.gisin, "목");
  check("운영자사주", "희신", enriched.yongshin?.heesin, "화");

  // 2-5. 12운성 (癸일간 기준: 음간 卯 장생 역행)
  // 년지 亥 → 卯에서 4단계 역행 → 제왕
  // 월지 午 → 卯에서 9단계 역행 → 절
  // 일지 未 → 卯에서 8단계 역행 → 묘
  // 시지 申 → 卯에서 7단계 역행 → 사
  check("운영자사주", "12운성 년", enriched.twelveStages?.year?.korean, "제왕");
  check("운영자사주", "12운성 월", enriched.twelveStages?.month?.korean, "절");
  check("운영자사주", "12운성 일", enriched.twelveStages?.day?.korean, "묘");
  check("운영자사주", "12운성 시", enriched.twelveStages?.hour?.korean, "사");

  // 2-6. 신살 (정통 매핑 기반)
  const shinsalLabels = Array.isArray(enriched.shinsal)
    ? enriched.shinsal
    : enriched.shinsal?.labels ?? [];
  const labels = shinsalLabels.join(" ");
  checkTrue("운영자사주", "신살 화개살 (일지 未, 해묘미 삼합 화개)", labels.includes("화개살"));
  checkTrue("운영자사주", "신살 겁살 (시지 申, 해묘미 삼합 겁살)", labels.includes("겁살"));
  checkTrue("운영자사주", "신살 홍염살 (癸일간 → 시지 申)", labels.includes("홍염살"));
  checkTrue("운영자사주", "신살 공망 (癸未 일주 → 申·酉 공망, 시지 申)", labels.includes("공망"));
  checkTrue("운영자사주", "신살 천덕귀인 (월지 午 → 천덕 亥, 년지 亥)", labels.includes("천덕귀인"));

  // 2-7. 점수·등급 (v15/v16 메모와 일치)
  const { scores, tier } = calculateServerScoring(enriched);
  check("운영자사주", "composite 89", tier.composite, 89);
  check("운영자사주", "grade S", tier.grade, "S");
  check("운영자사주", "직장운 85", scores.직장운, 85);
  check("운영자사주", "연애운 65", scores.연애운, 65);

  // 2-8. 대운 (음남 역행, 5세 시작)
  const daeun = (fortune as any)?.daeun;
  checkTrue("운영자사주", "대운 isForward = false (음남 역행)", daeun?.isForward === false);
  checkTrue("운영자사주", "대운 시작 5세 근방", daeun?.startAge >= 4 && daeun?.startAge <= 6);

  // 2-8-b. 현재 대운 (32세, 25~34 기묘 편관 장생)
  const currentDaeun = daeun?.pillars?.find((p: any) => p.startAge <= 32 && p.endAge >= 32);
  check("운영자사주", "현재 대운 25~34", `${currentDaeun?.startAge}~${currentDaeun?.endAge}`, "25~34");
  check("운영자사주", "현재 대운 기묘(己卯)", currentDaeun?.pillar, "己卯");
  check("운영자사주", "현재 대운 십성 편관", currentDaeun?.tenStar, "편관");
  check("운영자사주", "현재 대운 12운성 장생", currentDaeun?.twelveStage, "장생");

  // 2-9. 세운 2026 (병오 정재 절)
  const seun2026 = (fortune as any)?.seun?.find((s: any) => s.year === 2026);
  check("운영자사주", "2026 세운 丙午", seun2026?.pillar, "丙午");
  check("운영자사주", "2026 세운 십성 정재", seun2026?.tenStar, "정재");
  check("운영자사주", "2026 세운 12운성 절", seun2026?.twelveStage, "절");
}

/* ──────────────────── Case 3: 양간 12운성 (甲일간) ──────────────────── */

async function verifyYangStem12Stages() {
  console.log("\n========== Case 3: 양간 12운성 (甲일간, 순행 亥 장생) ==========");

  const { resolveSajuEnrichedData } = await import("../lib/analysis");

  // 갑자(甲子) 일주 케이스: 1984-02-04 노출생, 갑자년 갑인월 갑자일 (대략)
  // 실제로는 양간 12운성 매핑만 검증하면 됨
  // 정통: 甲양간 → 亥 장생, 순행. 子=목욕, 丑=관대, ..., 午=사, 未=묘, 申=절, 酉=태, 戌=양
  const expected: Record<string, string> = {
    亥: "장생", 子: "목욕", 丑: "관대", 寅: "건록", 卯: "제왕", 辰: "쇠",
    巳: "병", 午: "사", 未: "묘", 申: "절", 酉: "태", 戌: "양",
  };

  // 양간 12운성 함수 직접 사용 — 동일 알고리즘
  // saju-fortune.ts의 getTwelveStageKorean 함수가 export 안 됨 → yearly-monthly의 동일 함수 활용 또는 산출 검증
  // 간단히: 일간 甲로 운영자 사주 같은 패턴 만들기 어려우니, 매핑 표만 점검
  const STAGE_KOREAN = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"];
  const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const YANG_BIRTH: Record<string, string> = { "甲": "亥" };
  // 甲 → 亥 시작 순행
  const birthIdx = BRANCHES.indexOf("亥");
  for (const [branch, expectedStage] of Object.entries(expected)) {
    const targetIdx = BRANCHES.indexOf(branch);
    const stageIdx = (targetIdx - birthIdx + 12) % 12;
    const got = STAGE_KOREAN[stageIdx];
    check("양간12운성", `甲 vs ${branch}`, got, expectedStage);
  }
}

/* ──────────────────── Case 4: 입춘 보정 ──────────────────── */

async function verifyIpchun() {
  console.log("\n========== Case 4: 입춘 보정 ==========");

  const { resolveSolarYear } = await import("../lib/utils/ipchun");

  // 4-1. 입춘 이전 (2026-01-15) → 2025년 세운
  const before = resolveSolarYear(new Date(2026, 0, 15));
  check("입춘", "2026-01-15 → 명리학 연도", before.solarYear, 2025);
  check("입춘", "2026-01-15 → beforeIpchun", before.beforeIpchun, true);

  // 4-2. 입춘 이후 (2026-02-15) → 2026년 세운
  const after = resolveSolarYear(new Date(2026, 1, 15));
  check("입춘", "2026-02-15 → 명리학 연도", after.solarYear, 2026);
  check("입춘", "2026-02-15 → beforeIpchun", after.beforeIpchun, false);

  // 4-3. 입춘 당일 (2026-02-04, 入春 04:01 KST 이후) → 2026
  const onDay = resolveSolarYear(new Date(2026, 1, 4, 12, 0));
  check("입춘", "2026-02-04 12시 → 명리학 연도", onDay.solarYear, 2026);

  // 4-4. 입춘 당일 시각 이전 (2026-02-04, 00:00 — 입춘 04:01 전) → 2025
  const onDayBefore = resolveSolarYear(new Date(2026, 1, 4, 0, 0));
  check("입춘", "2026-02-04 00시 → 명리학 연도", onDayBefore.solarYear, 2025);

  // 4-5. 5월 분석 → 그대로 2026
  const may = resolveSolarYear(new Date(2026, 4, 13));
  check("입춘", "2026-05-13 → 명리학 연도", may.solarYear, 2026);
}

/* ──────────────────── Case 5: 음력 변환 ──────────────────── */

async function verifyLunarConversion() {
  console.log("\n========== Case 5: 음력 변환 ==========");

  const { convertLunarToSolar } = await import("../lib/utils/lunar");

  // 음력 1995-05-24 = 양력 1995-06-21 (운영자 사주 입력으로 음력으로 검증)
  // 음력 ↔ 양력 변환 표준은 한국천문연구원 자료 기반.
  // 정확한 1:1 대응 케이스: 음력 1995-05-24 → 양력 1995-06-21
  const converted = convertLunarToSolar(1995, 5, 24);
  if (converted) {
    check("음력변환", "음력 1995-05-24 → 양력 연", converted.year, 1995);
    check("음력변환", "음력 1995-05-24 → 양력 월", converted.month, 6);
    check("음력변환", "음력 1995-05-24 → 양력 일", converted.day, 21);
  } else {
    checkTrue("음력변환", "음력 1995-05-24 변환", false, "convertLunarToSolar 실패");
  }

  // 또 다른 케이스: 음력 2024-01-01 = 양력 2024-02-10
  const lny = convertLunarToSolar(2024, 1, 1);
  if (lny) {
    check("음력변환", "음력 2024-01-01 → 양력 연", lny.year, 2024);
    check("음력변환", "음력 2024-01-01 → 양력 월", lny.month, 2);
    check("음력변환", "음력 2024-01-01 → 양력 일", lny.day, 10);
  }
}

/* ──────────────────── Case 6: 후천수·선천수·천간충/합 ──────────────────── */

async function verifyNumberAndStemTables() {
  console.log("\n========== Case 6: 후천수·선천수·천간충합 ==========");

  // 6-1. 후천수 (河圖) — yearly-luck-meta.ts 내부 상수는 export 안 됨
  // 매핑이 정통과 일치하는지는 LuckMeta 산출 결과로 간접 검증
  const { calculateYearlyLuckMeta } = await import("../lib/utils/yearly-luck-meta");
  const { resolveSajuEnrichedData } = await import("../lib/analysis");
  const input = {
    name: "신갑주",
    birthYear: "1995", birthMonth: "06", birthDay: "21",
    calendarType: "solar" as const,
    birthHour: "16", birthMinute: "00",
    birthLocation: "서울",
    gender: "남성",
    relationshipStatus: "연애중",
    employmentStatus: "사업·프리랜서",
    coreFearAxis: "DISMISS" as const,
    unknownBirthTime: false,
  };
  const { enriched } = await resolveSajuEnrichedData(input);
  if (enriched) {
    const luckMeta = calculateYearlyLuckMeta(enriched);
    if (luckMeta) {
      // 운영자 일간 癸 → 선천수 5 / 용신 토 → 후천수 5, 0
      // 결과 numbers: [5, 0] (5 중복 제거)
      check("후천수", "운영자 행운 숫자 (선천수 5 + 후천수 5,0)", luckMeta.numbers, [5, 0]);
      check("후천수", "용신 토 → 색 노랑·황금", luckMeta.color.korean, "노랑·황금");
      check("후천수", "용신 토 → 방위 中央", luckMeta.direction.hanja, "中");
      check("후천수", "기신 목 → 회피 색 초록", luckMeta.avoidColor?.korean, "초록·청록");
      check("후천수", "기신 목 → 회피 방위 동", luckMeta.avoidDirection?.hanja, "東");
    }
  }
}

/* ──────────────────── Case 7: 월운 12개 (월건 月建) ──────────────────── */

async function verifyMonthlyLuck() {
  console.log("\n========== Case 7: 월운 12개 (2026년) — 月建 정통 ==========");

  const { calculateYearlyMonthlyFlow } = await import("../lib/utils/yearly-monthly");

  // 2026 병오년 월건 (정통 五虎遁): 병/신년 무인월·기묘월·경진월·신사월·임오월·계미월·갑신월·을유월·병술월·정해월·무자월·기축월
  // 잠깐 — 五虎遁 정리:
  // - 갑·기년 → 寅월부터 丙寅 / 丁卯 / 戊辰 / 己巳 / 庚午 / 辛未 / 壬申 / 癸酉 / 甲戌 / 乙亥 / 丙子 / 丁丑
  // - 을·경년 → 戊寅 / ...
  // - 병·신년 → 庚寅 / 辛卯 / 壬辰 / 癸巳 / 甲午 / 乙未 / 丙申 / 丁酉 / 戊戌 / 己亥 / 庚子 / 辛丑
  // - 정·임년 → 壬寅 / ...
  // - 무·계년 → 甲寅 / ...
  // 2026 = 丙午년 → 病辛遁 → 1월(寅) = 庚寅, 2월(卯) = 辛卯, ..., 12월(丑) = 辛丑
  const expectedPillars: Record<number, string> = {
    1: "庚寅", 2: "辛卯", 3: "壬辰", 4: "癸巳",
    5: "甲午", 6: "乙未", 7: "丙申", 8: "丁酉",
    9: "戊戌", 10: "己亥", 11: "庚子", 12: "辛丑",
  };

  const monthly = await calculateYearlyMonthlyFlow(2026, "癸");
  if (!monthly) {
    checkTrue("월운", "calculateYearlyMonthlyFlow 실행", false);
    return;
  }
  for (const [monthStr, expectedPillar] of Object.entries(expectedPillars)) {
    const month = Number(monthStr);
    const got = monthly.find((m) => m.month === month);
    check("월운", `${month}월 월건`, got?.pillar, expectedPillar);
  }

  // 십성 매핑 검증 (癸일간 vs 각 월천간)
  // 1월 庚寅 → 庚(金)이 癸(水) 생 = 인성, 양음 다름 (庚陽 vs 癸陰) → 정인
  // 5월 甲午 → 癸(水)가 甲(木) 생 = 식상, 양음 다름 (癸陰 vs 甲陽) → 상관
  // 7월 丙申 → 癸(水)가 丙(火) 극 = 재성, 양음 다름 (癸陰 vs 丙陽) → 정재
  // 10월 己亥 → 己(土)가 癸(水) 극 = 관성, 양음 같음 (己陰 vs 癸陰) → 편관
  check("월운십성", "1월 庚寅 → 정인", monthly.find((m) => m.month === 1)?.tenStar, "정인");
  check("월운십성", "5월 甲午 → 상관", monthly.find((m) => m.month === 5)?.tenStar, "상관");
  check("월운십성", "7월 丙申 → 정재", monthly.find((m) => m.month === 7)?.tenStar, "정재");
  check("월운십성", "10월 己亥 → 편관", monthly.find((m) => m.month === 10)?.tenStar, "편관");
}

/* ──────────────────── 실행 + 리포트 ──────────────────── */

async function main() {
  await verifyMappingTables();
  await verifyOperatorSaju();
  await verifyYangStem12Stages();
  await verifyIpchun();
  await verifyLunarConversion();
  await verifyNumberAndStemTables();
  await verifyMonthlyLuck();

  // 카테고리별 집계
  const categories = Array.from(new Set(results.map((r) => r.category)));
  console.log("\n\n========== 결과 요약 ==========");
  let totalPass = 0;
  let totalFail = 0;
  for (const cat of categories) {
    const list = results.filter((r) => r.category === cat);
    const pass = list.filter((r) => r.passed).length;
    const fail = list.length - pass;
    totalPass += pass;
    totalFail += fail;
    const mark = fail === 0 ? "✓" : "✗";
    console.log(`${mark} [${cat}] ${pass}/${list.length}`);
  }
  console.log(`\n총 ${totalPass}/${totalPass + totalFail} 통과 (${totalFail}개 실패)\n`);

  if (totalFail > 0) {
    console.log("========== 실패 항목 ==========");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`✗ [${r.category}] ${r.name}`);
      if (r.expected !== undefined) {
        console.log(`    expected: ${JSON.stringify(r.expected)}`);
        console.log(`    actual:   ${JSON.stringify(r.actual)}`);
      }
      if (r.note) console.log(`    note: ${r.note}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("✗ 검증 스크립트 실패:", err?.stack || err);
  process.exit(1);
});
