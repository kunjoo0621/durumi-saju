import type { AnalysisResult } from "./analysis";

// ─── 자동 치환 ──────────────────────────────────────────────

/** "스스로" → "자기 자신에게" 치환 */
function fixSseusro(text: string): { text: string; count: number } {
  let count = 0;
  const fixed = text.replace(/스스로/g, () => {
    count++;
    return "자기 자신에게";
  });
  return { text: fixed, count };
}

/** 존댓말 어미 → 반말 치환 */
const HONORIFIC_PATTERNS: [RegExp, string][] = [
  [/입니다(?=[.,\s]|$)/g, "이야"],
  [/습니다(?=[.,\s]|$)/g, "어"],
  [/해요(?=[.,\s]|$)/g, "해"],
  [/거예요(?=[.,\s]|$)/g, "거야"],
  [/돼요(?=[.,\s]|$)/g, "돼"],
];

function fixHonorifics(text: string): { text: string; count: number } {
  let count = 0;
  let result = text;
  for (const [pattern, replacement] of HONORIFIC_PATTERNS) {
    result = result.replace(pattern, () => {
      count++;
      return replacement;
    });
  }
  return { text: result, count };
}

// ─── 탐지 (경고만) ──────────────────────────────────────────

/** "~해봐" 패턴 탐지 */
function detectHaebwa(sections: AnalysisResult["sections"]): string[] {
  const warnings: string[] = [];
  const pattern = /[가-힣]+해\s?봐/g;
  sections.forEach((section, index) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(section.content)) !== null) {
      warnings.push(`[WARN] '~해봐' 패턴 발견: 섹션 ${index} - '${match[0]}'`);
    }
  });
  return warnings;
}

/** title 25자 초과 탐지 */
function detectTitleOverflow(sections: AnalysisResult["sections"]): string[] {
  const warnings: string[] = [];
  sections.forEach((section, index) => {
    if (section.title.length > 25) {
      warnings.push(
        `[WARN] title 초과: 섹션 ${index} - '${section.title}' (${section.title.length}자)`,
      );
    }
  });
  return warnings;
}

/** content 700자 미만 탐지 */
function detectShortContent(sections: AnalysisResult["sections"]): string[] {
  const warnings: string[] = [];
  sections.forEach((section, index) => {
    if (section.content.length < 700) {
      warnings.push(
        `[WARN] content 부족: 섹션 ${index} - ${section.content.length}자 (최소 700자)`,
      );
    }
  });
  return warnings;
}

/** title 키워드 중복 탐지 */
const STOPWORDS = new Set([
  "의", "은", "는", "이", "가", "에서", "으로", "와", "과", "를", "을",
  "도", "에", "로", "한", "할", "된", "더", "안", "못", "그", "이런",
  "저", "그건", "네", "내", "왜", "뭐",
]);

function extractKeywords(text: string): string[] {
  return text
    .replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

function detectTitleKeywordDuplication(
  tierTitle: string,
  sections: AnalysisResult["sections"],
): string[] {
  const allTitles = [tierTitle, ...sections.map((s) => s.title)];
  const wordCount = new Map<string, number>();

  for (const title of allTitles) {
    for (const word of extractKeywords(title)) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }
  }

  const warnings: string[] = [];
  for (const [word, count] of wordCount) {
    if (count >= 2) {
      warnings.push(`[WARN] title 키워드 중복: '${word}' ${count}회`);
    }
  }
  return warnings;
}

// ─── 메인 후처리 함수 ──────────────────────────────────────

export function postprocessAnalysisResult(result: AnalysisResult): {
  result: AnalysisResult;
  warnings: string[];
} {
  const warnings: string[] = [];

  // === 자동 치환 ===

  // 1. "스스로" → "자기 자신에게"
  let totalSseusro = 0;
  result.sections = result.sections.map((section) => {
    const { text, count } = fixSseusro(section.content);
    totalSseusro += count;
    return { ...section, content: text };
  });
  {
    const { text, count } = fixSseusro(result.tier.description);
    totalSseusro += count;
    result.tier = { ...result.tier, description: text };
  }
  if (totalSseusro > 0) {
    warnings.push(`[FIX] '스스로' ${totalSseusro}회 치환됨`);
  }

  // 2. 존댓말 어미 치환
  let totalHonorific = 0;
  result.sections = result.sections.map((section) => {
    const { text, count } = fixHonorifics(section.content);
    totalHonorific += count;
    return { ...section, content: text };
  });
  if (totalHonorific > 0) {
    warnings.push(`[FIX] 존댓말 어미 ${totalHonorific}회 치환됨`);
  }

  // === 탐지 + 경고 ===

  // 3. "~해봐" 패턴
  warnings.push(...detectHaebwa(result.sections));

  // 4. title 25자 초과
  warnings.push(...detectTitleOverflow(result.sections));

  // 5. content 700자 미만
  warnings.push(...detectShortContent(result.sections));

  // 6. title 키워드 중복
  warnings.push(...detectTitleKeywordDuplication(result.tier.title, result.sections));

  // === 경고 로그 출력 ===
  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`[사주분석 후처리] ${w}`);
    }
  }

  return { result, warnings };
}
