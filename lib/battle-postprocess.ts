import type { BattleLlmAnalysis } from "@/types/battle";

// ─── 자동 치환 ──────────────────────────────────────

function fixSseusro(text: string): { text: string; count: number } {
  let count = 0;
  const fixed = text.replace(/스스로/g, () => { count++; return "자기 자신에게"; });
  return { text: fixed, count };
}

const HONORIFIC_PATTERNS: [RegExp, string][] = [
  [/입니다(?=[.,\s]|$)/g, "이야"],
  [/습니다(?=[.,\s]|$)/g, "어"],
  [/해요(?=[.,\s]|$)/g, "해"],
  [/거예요(?=[.,\s]|$)/g, "거야"],
  [/돼요(?=[.,\s]|$)/g, "돼"],
  [/있어요(?=[.,\s]|$)/g, "있어"],
];

function fixHonorifics(text: string): { text: string; count: number } {
  let count = 0;
  let result = text;
  for (const [pattern, replacement] of HONORIFIC_PATTERNS) {
    result = result.replace(pattern, () => { count++; return replacement; });
  }
  return { text: result, count };
}

function applyTextFixes(text: string, warnings: string[], label: string): string {
  if (!text) return text;

  const s = fixSseusro(text);
  if (s.count > 0) warnings.push(`[FIX] '스스로' ${s.count}회 치환: ${label}`);

  const h = fixHonorifics(s.text);
  if (h.count > 0) warnings.push(`[FIX] 존댓말 ${h.count}회 치환: ${label}`);

  return h.text;
}

// ─── 탐지 (경고만) ──────────────────────────────────

function detectIssues(text: string, label: string, warnings: string[]): void {
  if (!text) return;

  // "~해봐" 패턴
  const haebwaPattern = /[가-힣]+해\s?봐/g;
  let match: RegExpExecArray | null;
  while ((match = haebwaPattern.exec(text)) !== null) {
    warnings.push(`[WARN] '~해봐' 패턴: ${label} - '${match[0]}'`);
  }

  // "궁합" 단어
  if (text.includes("궁합")) {
    warnings.push(`[WARN] '궁합' 사용: ${label}`);
  }
}

function detectLengthIssues(result: BattleLlmAnalysis, warnings: string[]): void {
  const cats = result.categoryResults;
  for (const [key, cat] of Object.entries(cats)) {
    if (cat.killingLine && cat.killingLine.length > 30) {
      warnings.push(`[WARN] killingLine 30자 초과: ${key} (${cat.killingLine.length}자)`);
    }
    if (cat.detail && cat.detail.length > 150) {
      warnings.push(`[WARN] detail 150자 초과: ${key} (${cat.detail.length}자)`);
    }
  }
}

// ─── 메인 후처리 ────────────────────────────────────

export function postprocessBattleResult(result: BattleLlmAnalysis): {
  result: BattleLlmAnalysis;
  warnings: string[];
} {
  const warnings: string[] = [];

  // heroQuip
  result.heroQuip = applyTextFixes(result.heroQuip, warnings, "heroQuip");
  detectIssues(result.heroQuip, "heroQuip", warnings);

  // categoryResults
  const cats = result.categoryResults;
  for (const key of ["wealth", "love", "career", "health", "social"] as const) {
    cats[key].killingLine = applyTextFixes(cats[key].killingLine, warnings, `${key}.killingLine`);
    cats[key].detail = applyTextFixes(cats[key].detail, warnings, `${key}.detail`);
    detectIssues(cats[key].killingLine, `${key}.killingLine`, warnings);
    detectIssues(cats[key].detail, `${key}.detail`, warnings);
  }

  // chemistry
  result.chemistry.analysis = applyTextFixes(result.chemistry.analysis, warnings, "chemistry.analysis");
  detectIssues(result.chemistry.analysis, "chemistry.analysis", warnings);

  result.chemistry.mainScenario.analysis = applyTextFixes(
    result.chemistry.mainScenario.analysis, warnings, "chemistry.mainScenario",
  );
  detectIssues(result.chemistry.mainScenario.analysis, "chemistry.mainScenario", warnings);

  for (let i = 0; i < result.chemistry.bonusScenarios.length; i++) {
    result.chemistry.bonusScenarios[i].analysis = applyTextFixes(
      result.chemistry.bonusScenarios[i].analysis, warnings, `bonusScenario[${i}]`,
    );
    detectIssues(result.chemistry.bonusScenarios[i].analysis, `bonusScenario[${i}]`, warnings);
  }

  // simulations
  for (let i = 0; i < result.simulations.length; i++) {
    result.simulations[i].answer = applyTextFixes(
      result.simulations[i].answer, warnings, `simulation[${i}]`,
    );
    detectIssues(result.simulations[i].answer, `simulation[${i}]`, warnings);
  }

  // futureOutlook
  result.futureOutlook.nextYear = applyTextFixes(result.futureOutlook.nextYear, warnings, "futureOutlook.nextYear");
  result.futureOutlook.threeYears = applyTextFixes(result.futureOutlook.threeYears, warnings, "futureOutlook.threeYears");
  detectIssues(result.futureOutlook.nextYear, "futureOutlook.nextYear", warnings);
  detectIssues(result.futureOutlook.threeYears, "futureOutlook.threeYears", warnings);

  // finalVerdict
  result.finalVerdict = applyTextFixes(result.finalVerdict, warnings, "finalVerdict");
  detectIssues(result.finalVerdict, "finalVerdict", warnings);

  // Length checks
  detectLengthIssues(result, warnings);

  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`[배틀 후처리] ${w}`);
    }
  }

  return { result, warnings };
}
