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

// ─── 문어체 → 반말 치환 ──────────────────────────────────────

const FORMAL_TO_CASUAL: [RegExp, string][] = [
  [/부른다/g, "불러"],
  [/반복될\s*것이다/g, "반복될 거야"],
  [/가져다줄\s*수\s*있다/g, "가져다줄 수 있어"],
  [/필요하다(?=[.,\s]|$)/g, "필요해"],
  [/중요하다(?=[.,\s]|$)/g, "중요해"],
  [/어렵다(?=[.,\s]|$)/g, "어려워"],
  [/있다\.\s/g, "있어. "],
  [/있다\.$/gm, "있어."],
  [/없다\.\s/g, "없어. "],
  [/없다\.$/gm, "없어."],
  [/한다\.\s/g, "해. "],
  [/한다\.$/gm, "해."],
  [/된다\.\s/g, "돼. "],
  [/된다\.$/gm, "돼."],
  [/이다\.\s/g, "이야. "],
  [/이다\.$/gm, "이야."],
];

function fixFormalToCasual(text: string): { text: string; count: number } {
  let count = 0;
  let result = text;
  for (const [pattern, replacement] of FORMAL_TO_CASUAL) {
    result = result.replace(pattern, () => {
      count++;
      return replacement;
    });
  }
  return { text: result, count };
}

// ─── 묘(墓) 반복 제한 (battle-postprocess.ts와 동일 로직) ──

// 지지 卯(묘) 보호: 간지 조합 + 卯 한자 병기
const MYO_MAO_PROTECT = /(?:을묘|정묘|기묘|신묘|계묘|묘\s*\(卯\)|卯\s*\(묘\)|지지\s*묘)/g;

// 12운성 묘(墓) 마스터 패턴
const MYO_MB_MASTER = new RegExp(
  [
    "일주\\s+[^\\s,.]+(?:이|가|의)\\s*묘\\s*\\(墓\\)\\s*(?:에\\s*)?앉[아은]\\s*(?:있[어으](?:니|서|면|며)?\\s*)?",
    "일주\\s+[^\\s,.]+(?:이|가|의)\\s*묘\\s*(?:에\\s*)?앉[아은]\\s*(?:있[어으](?:니|서|면|며)?\\s*)?",
    "일주\\s*묘\\s*(?:\\(墓\\))?\\s*(?:에\\s*)?앉[아은]\\s*(?:있[어으](?:니|서|면|며)?\\s*)?",
    "묘\\s*\\(墓\\)\\s*속\\s*[가-힣]+",
    "묘\\s*\\(墓\\)\\s*(?:에\\s*)?앉[아은]\\s*(?:있[어으](?:니|서|면|며)?\\s*)?",
    "묘(?:지에?|에)\\s*앉[아은]\\s*(?:있[어으](?:니|서|면|며)?\\s*)?",
    "墓\\s*\\(묘\\)\\s*지에?\\s*앉[아은]?\\s*",
    "묘지\\s*성향",
    "12운성\\s*묘\\s*(?:의|에서?|은|는)?",
    "일주\\s*묘\\s*(?:의|에서?|은|는)?",
    "대운\\s*\\(?\\s*묘\\s*(?:의|에서?)?",
    "운성\\s*묘\\s*\\(",
    "묘\\s*\\(墓\\)\\s*(?:의|에서?|은|는|이|가|도)?",
  ].join("|"),
  "g",
);

const MYO_MB_SOK_TEST = /묘\s*\(墓\)\s*속/;
const KOREAN_PARTICLES = new Set(["이","가","은","는","을","를","의","에","도"]);

function limitMyoMb(
  text: string,
  counter: { count: number },
): { text: string; removed: number } {
  if (!text) return { text, removed: 0 };
  let removed = 0;

  // 1) 지지 卯 패턴 보호
  const saved: [string, string][] = [];
  let si = 0;
  let work = text.replace(MYO_MAO_PROTECT, (m) => {
    const ph = `\x00M${si++}\x00`;
    saved.push([ph, m]);
    return ph;
  });

  // 2) 12운성 묘(墓) 패턴 제한
  work = work.replace(MYO_MB_MASTER, (match) => {
    counter.count++;
    if (counter.count <= 2) return match;
    removed++;
    if (MYO_MB_SOK_TEST.test(match)) {
      const lastChar = match.trim().slice(-1);
      return KOREAN_PARTICLES.has(lastChar) ? "속마음" + lastChar : "속마음";
    }
    return "";
  });

  // 3) 보호 패턴 복원
  for (const [ph, orig] of saved) {
    work = work.replace(ph, orig);
  }

  // 4) 삭제로 생긴 공백/구두점 정리
  if (removed > 0) {
    work = work
      .replace(/\s{2,}/g, " ")
      .replace(/^\s+/, "")
      .replace(/\s+([.,])/g, "$1")
      .replace(/,\s*,/g, ",")
      .trim();
  }

  return { text: work, removed };
}

// ─── 구조적 반복 감지 ──────────────────────────────────────

function detectStructuralRepetition(
  texts: string[],
  sectionLabels: string[],
): { phrase: string; count: number; sections: string[] }[] {
  const issues: { phrase: string; count: number; sections: string[] }[] = [];

  // NOTE: 묘(墓) 관련 패턴은 limitMyoMb()가 이미 ≤2회로 자동수정하므로 여기서 제외
  const patterns = [
    { regex: /하는\s*구조야/g, label: "~하는 구조야" },
    { regex: /하는\s*패턴이야/g, label: "~하는 패턴이야" },
    { regex: /가능성이\s*(?:높아|커|있어)/g, label: "가능성이 높아/커" },
  ];

  for (const { regex, label } of patterns) {
    const found: string[] = [];
    texts.forEach((text, i) => {
      const matches = text.match(new RegExp(regex.source, "g"));
      if (matches) {
        matches.forEach(() => found.push(sectionLabels[i]));
      }
    });
    if (found.length >= 3) {
      issues.push({ phrase: label, count: found.length, sections: found });
    }
  }

  // N-gram 기반 반복 감지 (7글자 이상 동일 구절이 3개+ 섹션)
  const N = 7;
  const ngramCounts = new Map<string, { count: number; sections: Set<string> }>();

  texts.forEach((text, i) => {
    for (let j = 0; j <= text.length - N; j++) {
      const ngram = text.substring(j, j + N);
      if (/^[\s,.\u3000]+$/.test(ngram)) continue;
      if (!ngramCounts.has(ngram)) {
        ngramCounts.set(ngram, { count: 0, sections: new Set() });
      }
      const entry = ngramCounts.get(ngram)!;
      entry.count++;
      entry.sections.add(sectionLabels[i]);
    }
  });

  for (const [ngram, { count, sections }] of ngramCounts) {
    if (sections.size >= 3 && count >= 3) {
      const alreadyCaught = issues.some(
        (i) => ngram.includes(i.phrase) || i.phrase.includes(ngram),
      );
      if (!alreadyCaught) {
        issues.push({ phrase: ngram, count, sections: Array.from(sections) });
      }
    }
  }

  return issues;
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

  // 2-1. 문어체 → 반말 치환 (섹션 + tier description)
  let totalFormalToCasual = 0;
  result.sections = result.sections.map((section) => {
    const { text, count } = fixFormalToCasual(section.content);
    totalFormalToCasual += count;
    return { ...section, content: text };
  });
  {
    const { text, count } = fixFormalToCasual(result.tier.description);
    totalFormalToCasual += count;
    result.tier = { ...result.tier, description: text };
  }
  if (totalFormalToCasual > 0) {
    warnings.push(`[FIX] 문어체→반말 ${totalFormalToCasual}회 치환됨`);
  }

  // 3. 묘(墓) 반복 제한 (전역 카운터, 첫 2회 유지 → 3회부터 제거)
  const myoCounter = { count: 0 };
  let totalMyoRemoved = 0;
  result.sections = result.sections.map((section) => {
    const r = limitMyoMb(section.content, myoCounter);
    totalMyoRemoved += r.removed;
    return { ...section, content: r.text };
  });
  {
    const r = limitMyoMb(result.tier.description, myoCounter);
    totalMyoRemoved += r.removed;
    result.tier = { ...result.tier, description: r.text };
  }
  if (totalMyoRemoved > 0) {
    warnings.push(
      `[FIX] 묘(墓) 반복 제한: ${totalMyoRemoved}회 제거 (총 탐지 ${myoCounter.count}회, 첫 2회 유지)`,
    );
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

  // === 구조적 반복 감지 (Layer 2) ===
  {
    const structTexts = result.sections.map((s) => `${s.title} ${s.content}`);
    const structLabels = result.sections.map((s) => s.title);
    const structIssues = detectStructuralRepetition(structTexts, structLabels);
    for (const issue of structIssues) {
      warnings.push(
        `[WARN] 구조적 반복: "${issue.phrase}" ${issue.count}회 — [${issue.sections.join(", ")}]`,
      );
    }
  }

  // === 경고 로그 출력 ===
  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`[사주분석 후처리] ${w}`);
    }
  }

  return { result, warnings };
}
