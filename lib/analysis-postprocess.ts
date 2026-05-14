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

// ─── "~해봐" 자동 치환 ──────────────────────────────────────

const HAEBWA_FIX_PATTERNS: [RegExp, string][] = [
  [/해보는\s*게\s*어때/g, "하는 게 중요해"],
  [/고려해봐/g, "고려해"],
  [/들여봐/g, "들여"],
  [/해\s?봐/g, "해"],
];

function fixHaebwa(text: string): { text: string; count: number } {
  let count = 0;
  let result = text;
  for (const [pattern, replacement] of HAEBWA_FIX_PATTERNS) {
    result = result.replace(pattern, () => {
      count++;
      return replacement;
    });
  }
  return { text: result, count };
}

// ─── 오탈자 치환 ──────────────────────────────────────────────

const TYPO_PATTERNS: [RegExp, string][] = [
  [/자기 자신에게에게/g, "자기 자신에게"],
  [/낚았아/g, "낚았어"],
  [/필숴/g, "필수야"],
  [/丁財運/g, "正財運"],
  [/(\S+)\(\1\)/g, "$1"], // 괄호 반복: "직장인(직장인)" → "직장인"
];

function fixTypos(text: string): { text: string; count: number } {
  let count = 0;
  let result = text;
  for (const [pattern, replacement] of TYPO_PATTERNS) {
    result = result.replace(pattern, (...args) => {
      count++;
      // 캡처 그룹이 있는 패턴은 $1 치환 직접 처리
      if (replacement.includes("$1") && args.length > 2) {
        return replacement.replace("$1", args[1]);
      }
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
): { text: string; removed: number; hasExcess: boolean } {
  if (!text) return { text, removed: 0, hasExcess: false };

  // 1) 지지 卯 패턴 보호
  const saved: [string, string][] = [];
  let si = 0;
  let work = text.replace(MYO_MAO_PROTECT, (m) => {
    const ph = `\x00M${si++}\x00`;
    saved.push([ph, m]);
    return ph;
  });

  // 2) 12운성 묘(墓) 패턴 감지 (detect-only, 텍스트 미수정)
  let hasExcess = false;
  work = work.replace(MYO_MB_MASTER, (match) => {
    counter.count++;
    if (counter.count <= 2) return match;
    hasExcess = true; // 감지만 하고 텍스트는 유지
    return match;
  });

  // 3) 보호 패턴 복원
  for (const [ph, orig] of saved) {
    work = work.replace(ph, orig);
  }

  return { text: work, removed: 0, hasExcess };
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

// ─── 이름 변형 교정 ─────────────────────────────────────────
//
// Gemini가 이름을 1글자 변형하는 현상 교정 (예: 김채연 → 김채현)
//
// 사이드이펙트 가드: 이름이 사주 한글 용어와 1글자 차이일 때
// (예: 이름 "경니" vs 일간 "경금") 본문의 사주 용어가 이름으로 잘못
// 치환되는 사고 방지. 화이트리스트 + 한자 부연 패턴 두 단계로 보호.
const SAJU_TERMS_KO = new Set([
  // 천간 음양오행
  "갑목", "을목", "병화", "정화", "무토", "기토", "경금", "신금", "임수", "계수",
  // 지지 음양오행
  "자수", "축토", "인목", "묘목", "진토", "사화", "오화", "미토", "유금", "술토", "해수",
  // 십성 (한자 병기 누락 시 대비)
  "비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인",
]);

function isFollowedByHanjaParen(jsonStr: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped + "\\([\\u4E00-\\u9FFF]").test(jsonStr);
}

function fixNameVariationsGeneric<T>(
  result: T,
  knownNames: string[],
  warnings: string[],
): T {
  const validNames = knownNames.filter((n) => n && n.length >= 2);
  if (validNames.length === 0) return result;

  let jsonStr = JSON.stringify(result);
  const allTokens = new Set(jsonStr.match(/[\uAC00-\uD7A3]{2,3}/g) || []);
  const replacements = new Map<string, string>();

  for (const token of allTokens) {
    if (validNames.includes(token)) continue;
    // 사주 용어 보호: 화이트리스트 또는 한자 부연(예: "경금(庚)") 따라오면 skip
    if (SAJU_TERMS_KO.has(token)) continue;
    if (isFollowedByHanjaParen(jsonStr, token)) continue;
    for (const name of validNames) {
      if (token.length !== name.length) continue;
      let diff = 0;
      for (let i = 0; i < token.length; i++) {
        if (token[i] !== name[i]) diff++;
      }
      if (diff === 1 && token[0] === name[0]) {
        replacements.set(token, name);
        break;
      }
    }
  }

  if (replacements.size === 0) return result;

  for (const [from, to] of replacements) {
    const count = (jsonStr.match(new RegExp(from, "g")) || []).length;
    jsonStr = jsonStr.replaceAll(from, to);
    warnings.push(`[FIX] 이름 변형 교정: "${from}" → "${to}" (${count}회)`);
  }

  return JSON.parse(jsonStr);
}

// ─── 메인 후처리 함수 ──────────────────────────────────────

export function postprocessAnalysisResult(
  result: AnalysisResult,
  name?: string,
): {
  result: AnalysisResult;
  warnings: string[];
  myoExcessTargets: { path: string; currentText: string }[];
} {
  const warnings: string[] = [];

  // ── 이름 변형 교정 (가장 먼저 실행) ──
  if (name) {
    result = fixNameVariationsGeneric(result, [name], warnings);
  }

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

  // 3. 묘(墓) 반복 감지 (detect-only, 첫 2회 유지 → 3회부터 surgical rewrite 대상)
  const myoCounter = { count: 0 };
  const myoExcessTargets: { path: string; currentText: string }[] = [];
  for (let i = 0; i < result.sections.length; i++) {
    const r = limitMyoMb(result.sections[i].content, myoCounter);
    if (r.hasExcess) {
      myoExcessTargets.push({ path: `sections.${i}.content`, currentText: result.sections[i].content });
    }
    result.sections[i] = { ...result.sections[i], content: r.text };
  }
  {
    const r = limitMyoMb(result.tier.description, myoCounter);
    if (r.hasExcess) {
      myoExcessTargets.push({ path: "tier.description", currentText: result.tier.description });
    }
    result.tier = { ...result.tier, description: r.text };
  }
  if (myoExcessTargets.length > 0) {
    warnings.push(
      `[DETECT] 묘(墓) 초과 감지: ${myoExcessTargets.length}개 필드 → surgical rewrite 대상 (총 탐지 ${myoCounter.count}회, 첫 2회 유지)`,
    );
  }

  // === "~해봐" 자동 치환 (탐지 전에 실행) ===
  let totalHaebwa = 0;
  result.sections = result.sections.map((section) => {
    const { text, count } = fixHaebwa(section.content);
    totalHaebwa += count;
    return { ...section, content: text };
  });
  {
    const { text, count } = fixHaebwa(result.tier.description);
    totalHaebwa += count;
    result.tier = { ...result.tier, description: text };
  }
  if (totalHaebwa > 0) {
    warnings.push(`[FIX] '~해봐' ${totalHaebwa}회 자동 치환됨`);
  }

  // === 오탈자 치환 ===
  let totalTypos = 0;
  result.sections = result.sections.map((section) => {
    const { text, count } = fixTypos(section.content);
    totalTypos += count;
    return { ...section, content: text };
  });
  {
    const { text, count } = fixTypos(result.tier.description);
    totalTypos += count;
    result.tier = { ...result.tier, description: text };
  }
  if (totalTypos > 0) {
    warnings.push(`[FIX] 오탈자 ${totalTypos}회 치환됨`);
  }

  // === 탐지 + 경고 ===

  // 3. "~해봐" 패턴 (치환 후 잔존 감지)
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

  return { result, warnings, myoExcessTargets };
}
