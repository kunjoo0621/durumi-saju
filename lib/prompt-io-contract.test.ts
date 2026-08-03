// 프롬프트 입출력 계약 테스트 (2026-08-03)
//
// 배경: 2026-08-03 조사(docs/SAJU_FACT_INTEGRITY_PLAN.md §3-1)에서 "LLM에게 입력의
// [X] 블록을 보고 쓰라고 지시해 놓고 그 블록을 실제로는 주지 않는" 죽은 참조가
// 4개 제품에서 발견됐다 (개인 [12신살] · 배틀 [신살 감지 결과] · 연간 태극귀인 ·
// 투데이 입력 스키마). LLM 입장에서는 "없는 자료를 근거로 쓰라"는 지시라 환각으로만
// 채울 수 있다. 4건은 당일 수정했고, 이 테스트는 **재발을 기계로 잡기 위한 것**이다.
//
// 검사 2종:
//   ① 블록 참조 계약 — 지시문이 참조하는 [블록명]이 빌더 실출력에 실제로 존재하는가
//   ② 명리 개념 계약 — 지시문이 "활용하라"고 지목한 신살·귀인을 엔진이 실제로 검출하는가
//
// 방법: 정적 grep만으로는 조건부 블록을 못 보므로 **빌더를 실제 호출**해 출력 문자열을
// 검사한다. 빌더가 export되지 않은 제품(개인·투데이)은 호출 가능한 하위 빌더의 실출력 +
// 모듈 소스의 문자열 리터럴 안 헤더 선언을 합집합으로 쓴다(거짓 실패 방지).
//
// known-drift: 지금 당장 못 고치는 항목은 KNOWN_DRIFT에 사유·해소 시점과 함께 등록하면
// 통과한다. 목록에 없는 새 위반은 실패한다.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { enrichSajuData, type SajuData } from "./utils/saju";
import {
  formatEnrichedSajuText,
  getPillar12Shinsal,
  type EnrichedSajuData,
} from "./utils/saju-enrichment";
import { calculateServerScoring } from "./utils/saju-scoring";
import { buildFortunePromptBlock, buildCoreFearAxisBlock } from "./analysis";
import { BATTLE_SYSTEM_PROMPT, buildBattleUserInfo } from "./battle-prompt";
import { buildYearlyUserInfo } from "./yearly-prompt";
import { analyzeTodayServer } from "./today-prompt";
import { buildMarriagePrompt } from "./marriage-prompt";
import { buildWealthPrompt } from "./wealth-prompt";
import { buildCareerPrompt } from "./career-prompt";
import { buildPetCompatSystemPrompt, buildPetCompatUserInfo } from "./pet-compat";
import { deriveMarriageFacts } from "./marriage-facts";
import { calculateYearlyInteraction } from "./utils/yearly-interaction";
import { calculateYearlyLuckMeta } from "./utils/yearly-luck-meta";
import { compareBattle } from "./utils/battle-compare";
import type { FortuneResult, SeunEntry } from "./utils/saju-fortune";

const ROOT = process.cwd();
const src = (p: string) => readFileSync(join(ROOT, p), "utf-8");

// ────────────────────────────────────────────────────────
// 소스에서 최상위 템플릿 리터럴 추출
// (SYSTEM_PROMPT 등 export 안 된 지시문 상수를 프롬프트 변경 없이 읽기 위함)
// ────────────────────────────────────────────────────────

function extractTemplateLiteral(source: string, constName: string): string {
  const marker = `const ${constName} = \``;
  const at = source.indexOf(marker);
  assert.ok(at >= 0, `${constName} 템플릿 리터럴을 찾지 못함 — 테스트 앵커가 낡았다`);
  let i = at + marker.length;
  const start = i;
  let depth = 0; // ${ } 중첩 깊이
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") { i += 2; continue; }
    if (ch === "$" && source[i + 1] === "{") { depth++; i += 2; continue; }
    if (ch === "}" && depth > 0) { depth--; i++; continue; }
    if (ch === "`" && depth === 0) return source.slice(start, i);
    i++;
  }
  throw new Error(`${constName} 템플릿 리터럴 종료 백틱을 찾지 못함`);
}

/** 템플릿 리터럴에서 ${...} 보간을 제거해 "정적 골격"만 남긴다 */
function literalSkeleton(tpl: string): string {
  let out = "";
  let depth = 0;
  for (let i = 0; i < tpl.length; i++) {
    const ch = tpl[i];
    if (ch === "\\") { out += depth === 0 ? tpl.slice(i, i + 2) : ""; i++; continue; }
    if (ch === "$" && tpl[i + 1] === "{") { depth++; i++; continue; }
    if (ch === "{" && depth > 0) { depth++; continue; }
    if (ch === "}" && depth > 0) { depth--; continue; }
    if (depth === 0) out += ch;
  }
  return out;
}

// ────────────────────────────────────────────────────────
// 참조 / 헤더 추출
// ────────────────────────────────────────────────────────

/** "[X] 블록에", "입력의 [X]", '"X" 블록' 처럼 **입력 자료를 가리키는** 참조만 뽑는다.
 *  프롬프트 자기 목차([섹션 8], [톤 규칙])는 뽑지 않는다. */
const REF_CUES = [
  "블록", "텍스트", "에 명시", "에 있는", "에 없", "만 사용", "에 해당",
  "를 참조", "에 나열", "가 입력에", "의 \"", "값을",
];

function extractBlockRefs(instructions: string): string[] {
  const found = new Set<string>();

  // ① 대괄호 형태
  const re = /\[([^\[\]\n]{1,40})\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(instructions))) {
    const after = instructions.slice(m.index + m[0].length, m.index + m[0].length + 16);
    const before = instructions.slice(Math.max(0, m.index - 14), m.index);
    const cueHit = REF_CUES.some((c) => after.trimStart().startsWith(c));
    const inputHit = /입력|컨텍스트/.test(before);
    if (cueHit || inputHit) found.add(m[1]);
  }

  // ② 따옴표 형태 — 펫 프롬프트가 '"★ 관계의 명리 근거" 블록' 식으로 참조
  const q = /["“]([^"”\n]{2,40})["”]\s*(?:블록|항목)/g;
  while ((m = q.exec(instructions))) found.add(m[1]);

  // 구두점만 남는 잡음 제거 (비교 자체가 불가능한 참조)
  return [...found].filter((r) => normalizeName(r).length >= 2);
}

/** 빌더 실출력에서 블록 헤더·필드 라벨을 뽑는다
 *  (줄머리 [X] / ===== X ===== / ■ X / "X: 값" 라벨) */
function extractEmittedHeaders(emitted: string): string[] {
  const found = new Set<string>();
  for (const raw of emitted.split("\n")) {
    const line = raw.replace(/^[\s\-·•★■▸□]+/, "").trim();
    let m = /^\[([^\[\]]{1,80})\]/.exec(line);
    if (m) found.add(m[1]);
    m = /^=+\s*(.+?)\s*=+$/.exec(line);
    if (m) found.add(m[1]);
    // 사실 블록·사주 텍스트의 "라벨: 값" 형태도 참조 대상이다 ("신살:", "대운 중 재성이 들어오는 구간:")
    m = /^([가-힣][^:\n]{0,40}):\s/.exec(line);
    if (m) found.add(m[1]);
  }
  return [...found];
}

/** 빌더 소스의 **문자열 리터럴 안**에 선언된 헤더 (조건부로만 방출되는 블록 보정용).
 *  `arr[0]` · `string[]` 같은 코드 대괄호를 피하려고 따옴표/개행 이스케이프 뒤만 인정. */
function extractDeclaredHeaders(source: string): string[] {
  const found = new Set<string>();
  const re = /(?:["'`]|\\n)\s*\[([^\[\]\n]{1,60})\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) found.add(m[1]);
  const eq = /(?:["'`]|\\n)\s*=====\s*(.+?)\s*=====/g;
  while ((m = eq.exec(source))) found.add(m[1]);
  return [...found];
}

/** 괄호 부기·꾸밈표·설명 꼬리를 떨어내 비교 가능한 형태로 */
function normalizeName(s: string): string {
  return s
    .replace(/[★☆■▸]/g, " ")
    .split(/[(（—\-–:：]/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

function isSatisfied(ref: string, headers: string[]): boolean {
  const r = normalizeName(ref);
  if (!r) return true;
  return headers.some((h) => {
    const n = normalizeName(h);
    return n === r || n.startsWith(r) || r.startsWith(n);
  });
}

// ────────────────────────────────────────────────────────
// 픽스처 — 더미 원국 2개
// ────────────────────────────────────────────────────────

// A: 甲 일간, 관살혼잡 (marriage-prompt.test.ts / marriage-facts.test.ts 와 동일 차트)
const CHART_A: SajuData = {
  year:  { heavenlyStem: "辛", earthlyBranch: "酉", hiddenStems: ["辛"] },
  month: { heavenlyStem: "庚", earthlyBranch: "申", hiddenStems: ["庚", "壬", "戊"] },
  day:   { heavenlyStem: "甲", earthlyBranch: "子", hiddenStems: ["癸"] },
  hour:  { heavenlyStem: "丙", earthlyBranch: "寅", hiddenStems: ["甲", "丙", "戊"] },
};

// B: 戊 일간, 백호(戊辰)·화개 등 다른 신살 계열이 걸리는 차트
const CHART_B: SajuData = {
  year:  { heavenlyStem: "丁", earthlyBranch: "卯", hiddenStems: ["乙"] },
  month: { heavenlyStem: "壬", earthlyBranch: "戌", hiddenStems: ["戊", "辛", "丁"] },
  day:   { heavenlyStem: "戊", earthlyBranch: "辰", hiddenStems: ["戊", "乙", "癸"] },
  hour:  { heavenlyStem: "甲", earthlyBranch: "午", hiddenStems: ["丙", "己", "丁"] },
};

const ENRICHED_A = enrichSajuData(CHART_A, { isTimeUnknown: false });
const ENRICHED_B = enrichSajuData(CHART_B, { isTimeUnknown: false });
const SAJU_TEXT_A = formatEnrichedSajuText(ENRICHED_A as EnrichedSajuData);
const SAJU_TEXT_B = formatEnrichedSajuText(ENRICHED_B as EnrichedSajuData);

const CURRENT_YEAR = new Date().getFullYear();

const SEUN_2026: SeunEntry = {
  year: CURRENT_YEAR, age: 32, pillar: "丙午", stem: "丙", branch: "午",
  tenStar: "식신", twelveStage: "사",
};

const FORTUNE: FortuneResult = {
  daeun: {
    gender: "female",
    isForward: true,
    startAge: 3,
    startAgeDetail: { years: 3, months: 2, days: 0 },
    daysToTerm: 9,
    pillars: [
      { index: 0, startAge: 3, endAge: 12, pillar: "辛酉", stem: "辛", branch: "酉", tenStar: "정관", twelveStage: "태" },
      { index: 1, startAge: 13, endAge: 22, pillar: "壬戌", stem: "壬", branch: "戌", tenStar: "편인", twelveStage: "양" },
      { index: 2, startAge: 23, endAge: 32, pillar: "癸亥", stem: "癸", branch: "亥", tenStar: "정인", twelveStage: "장생" },
      { index: 3, startAge: 33, endAge: 42, pillar: "甲子", stem: "甲", branch: "子", tenStar: "비견", twelveStage: "목욕" },
    ],
  },
  seun: [
    { ...SEUN_2026, year: CURRENT_YEAR - 1, pillar: "乙巳", stem: "乙", branch: "巳", tenStar: "겁재", twelveStage: "병" },
    SEUN_2026,
    { ...SEUN_2026, year: CURRENT_YEAR + 1, pillar: "丁未", stem: "丁", branch: "未", tenStar: "상관", twelveStage: "묘" },
  ],
};

const INPUT_A: any = {
  name: "테스트",
  birthYear: String(CURRENT_YEAR - 32),
  birthMonth: "6", birthDay: "21",
  birthHour: "10", birthMinute: "30",
  calendarType: "solar",
  unknownBirthTime: false,
  gender: "female",
  relationshipStatus: "솔로",
  employmentStatus: "직장인",
  coreFearAxis: "DISMISS",
};

// ────────────────────────────────────────────────────────
// 지시문(instructions) 수집
// ────────────────────────────────────────────────────────

const ANALYSIS_SRC = src("lib/analysis.ts");
const YEARLY_SRC = src("lib/yearly-prompt.ts");
const TODAY_SRC = src("lib/today-prompt.ts");
const MARRIAGE_SRC = src("lib/marriage-prompt.ts");
const WEALTH_SRC = src("lib/wealth-prompt.ts");
const CAREER_SRC = src("lib/career-prompt.ts");
const BATTLE_SRC = src("lib/battle-prompt.ts");
const PET_SRC = src("lib/pet-compat.ts");

const ANALYSIS_SYSTEM_PROMPT = extractTemplateLiteral(ANALYSIS_SRC, "SYSTEM_PROMPT");
const ANALYSIS_TEASER_PROMPT = extractTemplateLiteral(ANALYSIS_SRC, "TEASER_PROMPT");
const YEARLY_SYSTEM_PROMPT = extractTemplateLiteral(YEARLY_SRC, "YEARLY_SYSTEM_PROMPT");
// today는 지시문이 별도 md 문서다. 버전이 오르면(v1.7→v1.8) 조용히 낡지 않도록
// 실제 빌더가 읽는 경로를 소스에서 뽑아 쓴다.
const TODAY_PROMPT_FILE = (() => {
  const m = /join\(process\.cwd\(\),\s*"prompts",\s*"([^"]+)"\)/.exec(TODAY_SRC);
  assert.ok(m, "today-prompt.ts의 system prompt 경로를 찾지 못함 — 테스트 앵커가 낡았다");
  return m![1];
})();
const TODAY_SYSTEM_PROMPT = src(join("prompts", TODAY_PROMPT_FILE));

const MARRIAGE_RULES = extractTemplateLiteral(MARRIAGE_SRC, "SYSTEM_RULES");
const MARRIAGE_SCHEMA = extractTemplateLiteral(MARRIAGE_SRC, "OUTPUT_SCHEMA");
const WEALTH_RULES = extractTemplateLiteral(WEALTH_SRC, "SYSTEM_RULES");
const WEALTH_SCHEMA = extractTemplateLiteral(WEALTH_SRC, "OUTPUT_SCHEMA");
const CAREER_RULES = extractTemplateLiteral(CAREER_SRC, "SYSTEM_RULES");
const CAREER_SCHEMA = extractTemplateLiteral(CAREER_SRC, "OUTPUT_SCHEMA");

const PET_SYSTEM_PROMPT = buildPetCompatSystemPrompt("dog") + "\n" + buildPetCompatSystemPrompt("cat");

// ────────────────────────────────────────────────────────
// 빌더 실호출 — 실제로 LLM에 가는 user message
// ────────────────────────────────────────────────────────

function buildAnalysisEmitted(): string {
  // runFullAnalysis의 userInfo는 export되지 않은 인라인 템플릿이라
  // (a) 템플릿 정적 골격 + (b) 호출 가능한 하위 빌더 실출력을 합친다.
  // 슬라이스는 runFullAnalysis 안의 `const userInfo = \`` 를 정확히 집기 위한 것
  const skeleton = literalSkeleton(
    extractTemplateLiteral(ANALYSIS_SRC.slice(ANALYSIS_SRC.indexOf("export async function runFullAnalysis")), "userInfo"),
  );
  const teaserSkeleton = literalSkeleton(
    extractTemplateLiteral(ANALYSIS_SRC.slice(ANALYSIS_SRC.indexOf("export async function runTeaserAnalysis")), "userInfo"),
  );
  return [
    skeleton,
    teaserSkeleton,
    SAJU_TEXT_A,
    buildFortunePromptBlock(FORTUNE, Number(INPUT_A.birthYear)),
    ...(["DISMISS", "ABANDON", "INCOMPETENT", "LOSS_OF_CONTROL"] as const).map((axis) =>
      buildCoreFearAxisBlock(axis, INPUT_A.relationshipStatus, INPUT_A.employmentStatus)),
  ].join("\n");
}

function buildYearlyEmitted(): string {
  const out: string[] = [];
  for (const enriched of [ENRICHED_A, ENRICHED_B]) {
    const { tier, scores } = calculateServerScoring(enriched as any);
    out.push(
      buildYearlyUserInfo({
        input: INPUT_A,
        sajuText: formatEnrichedSajuText(enriched as EnrichedSajuData),
        enriched,
        fortune: FORTUNE,
        interaction: calculateYearlyInteraction(enriched as any, SEUN_2026),
        tier,
        scores,
        luckyMeta: calculateYearlyLuckMeta(enriched as any),
        monthlyFlow: null,
      }),
    );
  }
  return out.join("\n");
}

function buildBattleEmitted(): string {
  const a = calculateServerScoring(ENRICHED_A as any);
  const b = calculateServerScoring(ENRICHED_B as any);
  const comparison = compareBattle(a.scores, b.scores, a.tier, b.tier, "가나", "다라");
  const common = {
    nameA: "가나", nameB: "다라",
    scoresA: a.scores, scoresB: b.scores,
    tierA: a.tier, tierB: b.tier,
    comparison,
    sajuTextA: SAJU_TEXT_A, sajuTextB: SAJU_TEXT_B,
    fortuneBlockA: buildFortunePromptBlock(FORTUNE, Number(INPUT_A.birthYear)),
    fortuneBlockB: buildFortunePromptBlock(FORTUNE, Number(INPUT_A.birthYear)),
    simulationQuestions: [
      { icon: "🍜", question: "둘이 여행 가면 누가 계획 짜?", subject: "A", subjectLabel: "계획러" },
      { icon: "💸", question: "돈 관리는 누가?", subject: "B", subjectLabel: "재무담당" },
    ] as any,
  };
  // 관계 유형별로 조건부 블록(시뮬레이션·결정타)이 달라지므로 전부 합집합
  const types = ["lover", "friend", "colleague", "family", "other"] as const;
  return types
    .map((t) => buildBattleUserInfo({ ...common, relationshipType: t as any }))
    .join("\n");
}

async function buildTodayEmitted(): Promise<string> {
  const { todayContext, ownerSajuText } = await analyzeTodayServer(INPUT_A, "2026-08-03");
  const skeleton = literalSkeleton(
    extractTemplateLiteral(TODAY_SRC.slice(TODAY_SRC.indexOf("export async function runTodayAnalysis")), "userInfo"),
  );
  return [skeleton, todayContext, ownerSajuText].join("\n");
}

function stripInstructions(prompt: string, instructions: string[]): string {
  let out = prompt;
  for (const inst of instructions) {
    const applied = inst
      .replace(/\{\{CURRENT_YEAR\}\}/g, String(CURRENT_YEAR))
      .replace(/\{\{PREV_YEAR\}\}/g, String(CURRENT_YEAR - 1))
      .trim();
    out = out.split(applied).join("\n");
  }
  return out;
}

function buildMarriageEmitted(): string {
  const parts: string[] = [];
  for (const gender of ["female", "male"] as const) {
    for (const status of ["솔로", "연애중", "기혼", "다시 혼자"] as const) {
      const facts = deriveMarriageFacts(ENRICHED_A as any, FORTUNE as any, CHART_A, gender, status, CURRENT_YEAR);
      parts.push(buildMarriagePrompt(facts, "B", SAJU_TEXT_A, CURRENT_YEAR));
    }
  }
  return stripInstructions(parts.join("\n"), [MARRIAGE_RULES, MARRIAGE_SCHEMA]);
}

const WEALTH_FACTS: any = {
  interest: "목돈·노후 준비", dayStem: "甲",
  jaeseong: [
    { pillar: "month", source: "천간", star: "편재" },
    { pillar: "hour", source: "지장간", star: "정재" },
  ],
  jaeseongType: "재성혼재", jaeseongAbsent: false, jaeseongStrength: 6,
  bigeopStrength: 2, strengthLevel: "신강", jaeGrip: "신왕재왕",
  jaedaShinyak: false, sikssangSaengjae: true, gunggeobJaengjae: false,
  bigeopTaljae: false, jaego: false, yongshinFavorsWealth: true,
  timingWindows: [
    { year: CURRENT_YEAR + 1, age: 33, triggers: ["재성투출"], isPast: false },
  ],
  daeunWealthYears: [{ startAge: 33, endAge: 42, star: "정재" }],
};

const CAREER_FACTS: any = {
  situation: "현직 성장", dayStem: "甲",
  gwanseong: [
    { pillar: "month", source: "천간", star: "정관" },
    { pillar: "hour", source: "지장간", star: "편관" },
  ],
  gwanseongType: "관살혼잡", gwanseongAbsent: false, gwanseongStrength: 6,
  siksinStrength: 2, sanggwanStrength: 0, siksangType: "식신우세",
  inseongStrength: 5, inseongAbsent: false, strengthLevel: "신강",
  careerGrip: "신왕관왕", gwandaSinyak: false, gwaninSangsaeng: true,
  sanggwanGyeongwan: false, yongshinFavorsCareer: true,
  timingWindows: [
    { year: CURRENT_YEAR + 1, age: 33, triggers: ["관성투출"], isPast: false },
  ],
  daeunCareerYears: [{ startAge: 33, endAge: 42, star: "정관" }],
};

function buildWealthEmitted(): string {
  const p = buildWealthPrompt(WEALTH_FACTS, "B", SAJU_TEXT_A, "직장인", CURRENT_YEAR);
  return stripInstructions(p, [WEALTH_RULES, WEALTH_SCHEMA]);
}

function buildCareerEmitted(): string {
  const p = buildCareerPrompt(CAREER_FACTS, "B", SAJU_TEXT_A, "직장인", CURRENT_YEAR);
  return stripInstructions(p, [CAREER_RULES, CAREER_SCHEMA]);
}

const PET_INPUT: any = {
  owner: {
    name: "보호자", gender: "female",
    birthYear: CURRENT_YEAR - 32, birthMonth: 6, birthDay: 21,
    birthHour: 10, birthMinute: 30, calendarType: "solar",
    unknownBirthTime: false, birthLocation: "서울",
  },
  pet: {
    name: "두부", species: "dog", breed: "닥스훈트", gender: "male",
    birthTier: 1, birthDate: "2020-03-03", birthTime: "09:00",
  },
  ownerSajuText: SAJU_TEXT_A,
  petSajuText: SAJU_TEXT_B,
  petSpec: "5세 · 쥐띠 · 수",
  precomputedScores: {
    composite: 72, sync: 70, ruler: 55, lover: 80, loyalty: 66, conflict: 30,
    grade: "B", labelText: "티격태격 단짝",
  },
  signals: {
    dayBranchSamhap: true, dayBranchHap: false, dayBranchBanghap: false,
    dayBranchChung: false, dayBranchHyeong: false, dayBranchWonjin: false,
    yearBranchHap: true, yearBranchChung: false,
    dayMasterRelation: "saeng_to_pet", isSpeciesIncompat: false,
    petDayMasterElement: "토", petTwelveStage: "관대", petStrength: "strong",
    petGwanseong: 1, petInseong: 1, petSikSang: 1, petJaeseong: 0, petBigeop: 1,
    petShinsal: ["역마살(驛馬殺)"], ownerShinsal: [],
    ownerDaeun: "癸亥 정인운", petHasDohwa: false,
  },
};

function buildPetEmitted(): string {
  return [
    buildPetCompatUserInfo(PET_INPUT),
    buildPetCompatUserInfo({ ...PET_INPUT, pet: { ...PET_INPUT.pet, species: "cat" } }),
  ].join("\n");
}

// ────────────────────────────────────────────────────────
// 제품 스펙
// ────────────────────────────────────────────────────────

type Spec = {
  product: string;
  instructions: string;
  emitted: () => string | Promise<string>;
  /** 조건부 블록 보정용 — 빌더 모듈 소스(지시문 상수 제외) */
  declaredIn: string[];
};

const SPECS: Spec[] = [
  {
    product: "개인(analysis)",
    instructions: ANALYSIS_SYSTEM_PROMPT + "\n" + ANALYSIS_TEASER_PROMPT,
    emitted: buildAnalysisEmitted,
    declaredIn: [stripInstructions(ANALYSIS_SRC, [ANALYSIS_SYSTEM_PROMPT, ANALYSIS_TEASER_PROMPT])],
  },
  {
    product: "연간(yearly)",
    instructions: YEARLY_SYSTEM_PROMPT,
    emitted: buildYearlyEmitted,
    declaredIn: [
      stripInstructions(YEARLY_SRC, [YEARLY_SYSTEM_PROMPT]),
      src("lib/utils/yearly-interaction.ts"),
      src("lib/utils/yearly-luck-meta.ts"),
      src("lib/utils/yearly-monthly.ts"),
    ],
  },
  {
    product: "배틀(battle)",
    instructions: BATTLE_SYSTEM_PROMPT,
    emitted: buildBattleEmitted,
    declaredIn: [stripInstructions(BATTLE_SRC, [BATTLE_SYSTEM_PROMPT])],
  },
  {
    product: "투데이(today)",
    instructions: TODAY_SYSTEM_PROMPT,
    emitted: buildTodayEmitted,
    declaredIn: [TODAY_SRC],
  },
  {
    product: "결혼(marriage)",
    instructions: MARRIAGE_RULES + "\n" + MARRIAGE_SCHEMA,
    emitted: buildMarriageEmitted,
    declaredIn: [stripInstructions(MARRIAGE_SRC, [MARRIAGE_RULES, MARRIAGE_SCHEMA])],
  },
  {
    product: "재물(wealth)",
    instructions: WEALTH_RULES + "\n" + WEALTH_SCHEMA,
    emitted: buildWealthEmitted,
    declaredIn: [stripInstructions(WEALTH_SRC, [WEALTH_RULES, WEALTH_SCHEMA])],
  },
  {
    product: "커리어(career)",
    instructions: CAREER_RULES + "\n" + CAREER_SCHEMA,
    emitted: buildCareerEmitted,
    declaredIn: [stripInstructions(CAREER_SRC, [CAREER_RULES, CAREER_SCHEMA])],
  },
  {
    product: "펫(pet-compat)",
    instructions: PET_SYSTEM_PROMPT,
    emitted: buildPetEmitted,
    declaredIn: [PET_SRC],
  },
];

// ────────────────────────────────────────────────────────
// known-drift 허용 목록
// 형식: "제품 :: 참조명" → 사유 + 해소 시점
// 목록에 없는 새 위반은 실패한다.
// ────────────────────────────────────────────────────────

const KNOWN_DRIFT_BLOCKS: Record<string, string> = {
  // 이 테스트를 만들며 새로 발견(2026-08-03). 치명도는 낮다 — 블록 자체는 존재하고
  // 이름만 축약형이라 LLM이 문맥으로 이어붙일 수 있다. 다만 이름이 어긋난 상태다.
  // 실제 방출 라벨: "대운 중 관성이 들어오는 구간" (career-prompt.ts:202)
  // 지시문 표기:   "[대운 중 관성 구간]"        (career-prompt.ts:272,281,310)
  // 해소: 지시문 표기를 실제 라벨로 통일 — 프롬프트 문자열 변경이라 하네스 검증과
  //       묶어서 처리. 목표 시점 = 커리어 프롬프트 다음 개정분.
  "커리어(career) :: 대운 중 관성 구간":
    "지시문 축약 표기 ≠ 사실블록 라벨(대운 중 관성이 들어오는 구간). 다음 커리어 프롬프트 개정 때 표기 통일",
};

const KNOWN_DRIFT_CONCEPTS: Record<string, string> = {
};

// ────────────────────────────────────────────────────────
// ① 블록 참조 계약
// ────────────────────────────────────────────────────────

for (const spec of SPECS) {
  test(`[블록 참조 계약] ${spec.product} — 지시문이 참조하는 블록은 빌더가 실제로 방출한다`, async () => {
    const emitted = await spec.emitted();
    const headers = [
      ...extractEmittedHeaders(emitted),
      ...spec.declaredIn.flatMap(extractDeclaredHeaders),
    ];
    const refs = extractBlockRefs(spec.instructions);
    assert.ok(refs.length > 0, `${spec.product}: 참조를 하나도 못 뽑았다 — 추출기가 낡았을 가능성`);
    if (process.env.PROMPT_IO_VERBOSE) {
      console.log(`  ${spec.product}: 참조 ${refs.length}건 ${JSON.stringify(refs)} / 방출 헤더 ${extractEmittedHeaders(emitted).length}건`);
    }

    const dead: string[] = [];
    for (const ref of refs) {
      if (isSatisfied(ref, headers)) continue;
      const key = `${spec.product} :: ${ref}`;
      if (KNOWN_DRIFT_BLOCKS[key]) continue;
      dead.push(ref);
    }
    assert.deepEqual(
      dead, [],
      `${spec.product}: 지시문이 참조하지만 빌더가 만들지 않는 블록 ${JSON.stringify(dead)}\n` +
      `→ 블록을 실제로 넣거나 지시문을 지워라. 유예가 필요하면 KNOWN_DRIFT_BLOCKS에 사유·해소 시점과 함께 등록.\n` +
      `실제 방출 헤더: ${JSON.stringify(extractEmittedHeaders(emitted))}`,
    );
  });
}

// ────────────────────────────────────────────────────────
// ② 명리 개념 참조 계약 — "○○귀인/○○살을 활용하라"고 지목하면 엔진에 검출기가 있어야 한다
// ────────────────────────────────────────────────────────

const ENRICHMENT_SRC = src("lib/utils/saju-enrichment.ts");

/** 엔진이 실제로 만들어낼 수 있는 신살 이름 인벤토리 */
function engineShinsalInventory(): Set<string> {
  const inv = new Set<string>();

  // (a) SHINSAL_DEFS 의 label 선언 — 조건이 까다로워 스윕으로 안 잡히는 검출기까지 포함
  const re = /label:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ENRICHMENT_SRC))) inv.add(normalizeName(m[1]));

  // (b) 12신살 — 실제 산출값 전수 스윕(년지 × 월지 12×12)
  const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  for (const y of BRANCHES) {
    for (const b of BRANCHES) {
      const r = getPillar12Shinsal([y, b, b, b], false);
      for (const e of [r.year, r.month, r.day, r.hour]) if (e) inv.add(normalizeName(e.name));
    }
  }

  // (c) 실제 enrichment 산출 라벨 (스윕)
  for (const enriched of [ENRICHED_A, ENRICHED_B]) {
    for (const label of (enriched as any).shinsal?.labels ?? []) inv.add(normalizeName(label));
  }
  return inv;
}

const ENGINE_SHINSAL = engineShinsalInventory();

/** 사이트 사전(lib/dict)이 신살로 인정하는 이름 — "명리 개념인가"의 판별 기준.
 *  "완전압살"·"칠살"(편관 별칭) 같은 일반어·십성 별칭을 신살로 오인하지 않기 위함. */
function dictShinsalNames(): Set<string> {
  const names = new Set<string>();
  for (const dir of ["lib/dict/data/sinsal", "lib/dict/data/sipisinsal"]) {
    for (const f of readdirSync(join(ROOT, dir))) {
      if (!f.endsWith(".ts")) continue;
      const re = /name:\s*"([^"]+)"/g;
      let m: RegExpExecArray | null;
      const body = src(join(dir, f));
      while ((m = re.exec(body))) names.add(normalizeName(m[1]));
    }
  }
  return names;
}

const DICT_SHINSAL = dictShinsalNames();

/** 신살처럼 보이지만 신살이 아닌 일반 명사 */
const NOT_A_SHINSAL = new Set(["신살", "흉살", "길신", "길살", "잡살", "살"]);

/** 부정 문맥(= 쓰지 마라)이면 검출기 존재를 요구하지 않는다 */
const NEGATIVE_CUES = /금지|마라|말 것|말고|배제|쓰지|않는다|없으면|없는|없다|제외|❌|절대|아니다|오류|잘못|위반|실패다/;

/** 검사 대상 개념인가?
 *  - "○○귀인"은 항상 신살 주장이므로 무조건 검사 (태극귀인 사고 유형이 여기)
 *  - "○○살"은 사전·엔진이 신살로 인정하는 이름일 때만 검사 */
function isShinsalConcept(name: string): boolean {
  if (NOT_A_SHINSAL.has(name)) return false;
  if (name.endsWith("귀인")) return true;
  return DICT_SHINSAL.has(name) || ENGINE_SHINSAL.has(name);
}

function extractPositiveConcepts(instructions: string): string[] {
  const found = new Set<string>();
  for (const line of instructions.split("\n")) {
    if (NEGATIVE_CUES.test(line)) continue;
    // 조사가 붙어도("태극귀인이") 잡히도록 뒤쪽 lookahead를 두지 않는다.
    // 과잉 추출은 isShinsalConcept(사전·엔진 인벤토리)가 걸러낸다.
    const re = /([가-힣]{1,4}(?:귀인|살))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      if (!isShinsalConcept(m[1])) continue;
      found.add(m[1]);
    }
  }
  return [...found];
}

for (const spec of SPECS) {
  test(`[명리 개념 계약] ${spec.product} — 지시문이 지목한 신살·귀인은 엔진에 검출기가 있다`, () => {
    const concepts = extractPositiveConcepts(spec.instructions);
    if (process.env.PROMPT_IO_VERBOSE) {
      console.log(`  ${spec.product}: 개념 ${concepts.length}건 ${JSON.stringify(concepts)}`);
    }
    const missing: string[] = [];
    for (const c of concepts) {
      if (ENGINE_SHINSAL.has(c)) continue;
      const key = `${spec.product} :: ${c}`;
      if (KNOWN_DRIFT_CONCEPTS[key]) continue;
      missing.push(c);
    }
    assert.deepEqual(
      missing, [],
      `${spec.product}: 엔진에 검출기가 없는 명리 개념을 지시문이 쓰라고 지목함 ${JSON.stringify(missing)}\n` +
      `(태극귀인 사고 유형 — LLM은 이 이름을 환각으로만 만들 수 있다)\n` +
      `→ 지시문에서 빼거나 엔진에 검출기를 넣어라. 유예는 KNOWN_DRIFT_CONCEPTS에 등록.\n` +
      `엔진 인벤토리: ${JSON.stringify([...ENGINE_SHINSAL].sort())}`,
    );
  });
}

// ────────────────────────────────────────────────────────
// ③ 추출기 자체가 죽지 않았는지 — 메타 가드
// (프롬프트 구조가 바뀌어 참조를 0개 뽑으면 위 테스트가 조용히 무력화된다)
// ────────────────────────────────────────────────────────

test("[메타] 참조 추출기는 알려진 참조 패턴을 잡는다", () => {
  const sample = [
    "중요: 입력에 [서버 계산 결과] 블록이 포함되어 있다.",
    "아래 [결혼 사실(엔진 확정값)] 블록에 있는 값만 근거로 써라.",
    '모든 판정은 입력의 "★ 관계의 명리 근거" 블록에서 출발한다.',
    "- 입력의 [12신살] 블록을 보고 1~2개를 녹여라.",   // ← 과거 사고 문장
    "[섹션 8] 경고/리스크에 1회(hard)",                 // ← 자기 목차: 참조 아님
  ].join("\n");
  const refs = extractBlockRefs(sample);
  assert.ok(refs.includes("서버 계산 결과"));
  assert.ok(refs.includes("결혼 사실(엔진 확정값)"));
  assert.ok(refs.includes("★ 관계의 명리 근거"));
  assert.ok(refs.includes("12신살"), "죽은 참조 유형을 못 잡으면 이 테스트는 무의미하다");
  assert.ok(!refs.includes("섹션 8"), "프롬프트 자기 목차를 참조로 오인하면 안 됨");
});

test("[메타] 엔진 신살 인벤토리가 비어 있지 않다", () => {
  assert.ok(ENGINE_SHINSAL.size >= 20, `인벤토리 ${ENGINE_SHINSAL.size}종 — 추출기가 깨졌다`);
  assert.ok(ENGINE_SHINSAL.has("도화살"));
  assert.ok(ENGINE_SHINSAL.has("천을귀인"));
  assert.ok(ENGINE_SHINSAL.has("반안살"), "12신살 스윕이 동작해야 함");
  assert.ok(!ENGINE_SHINSAL.has("태극귀인"), "엔진에 없는 검출기가 인벤토리에 있으면 ②가 무력화된다");
});
