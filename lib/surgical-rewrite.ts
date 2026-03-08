/**
 * Surgical Rewrite — 반복 필드 수술적 리라이트
 *
 * 감지된 필드만 골라서 Gemini에게 리라이트 요청.
 * - 감지된 필드만 보냄 (전체 JSON X)
 * - JSON 구조 변경 없음 (문자열 값만 교체)
 * - 실패 시 원본 그대로 사용
 * - 1회만 시도, 재귀 없음
 */

import { callGemini, DEFAULT_MODELS } from "@/lib/analysis";
import { parseJson5Loose } from "@/lib/json5Utils";
import type { BattleLlmAnalysis } from "@/types/battle";
import type { AnalysisResult } from "@/lib/analysis";

// ─── 타입 ────────────────────────────────────────

type BattleCategoryKey = "wealth" | "love" | "career" | "health" | "social";

const BATTLE_CATEGORIES: BattleCategoryKey[] = [
  "wealth", "love", "career", "health", "social",
];

// ─── 리라이트 시스템 프롬프트 ────────────────────

const REWRITE_SYSTEM = `너는 사주 분석 결과의 텍스트 교정기야.
주어진 필드들이 서로 비슷한 표현을 쓰고 있어서, 각각 다른 문장 구조로 다시 써야 해.

[절대 규칙]
1. 반말(~야, ~거든, ~지, ~거야) 유지. 존댓말/문어체 금지
2. 의미/판정/승패/이름은 절대 변경 금지
3. 각 필드는 서로 완전히 다른 문장 구조를 써야 해
4. punchline은 한 문장, 임팩트 있게
5. detail은 원래 분량 유지
6. 원본에 등장하는 이름만 사용. 새로운 이름을 만들지 마

[killingLine 리라이트 규칙]
- 40자 이내
- 점수(N점 차이)는 넣어도 되고 안 넣어도 됨
- "이겼어/승리했어/앞섰어/제쳤어" 같은 승패 동사 금지
- 대신 구체적 일상 장면이나 행동으로 승패를 보여줘
- 어순만 바꾸거나 유의어 치환은 리라이트가 아님
- 해당 카테고리의 주제에 맞는 장면을 써야 해:
  재물(wealth) → 돈/소비/투자/월급 관련
  연애(love) → 연애/감정/매력 관련
  직장(career) → 일/승진/직장생활 관련
  건강(health) → 체력/건강/몸 관련
  대인(social) → 사람/인맥/인기 관련
- 아래 예시는 참고만 해. 그대로 복사하면 안 돼. 너만의 새로운 문장을 만들어

❌ 나쁜 예시 (어순/유의어만 변경):
  BEFORE: "A가 8점 차이로 연애운 이겼어"
  AFTER: "연애운, A가 8점 차이로 승리했어"

✅ 좋은 방향 (장면 묘사형, 카테고리별 다른 소재):
  재물: 통장 잔고, 지갑, 투자 수익 등 돈 관련 장면
  연애: 고백, 심쿵, 눈빛, 감정 표현 등 연애 장면
  직장: 승진, 상사 인정, 프로젝트, 야근 등 직장 장면
  건강: 체력, 마라톤, 컨디션, 활력 등 건강 장면
  대인: 모임, 인기투표, 연락, 약속 등 인맥 장면

[묘(墓) 과다 리라이트 규칙]
- 묘(墓)라는 용어를 다른 12운성 이름으로 1:1 치환하지 마. 실제 사주가 묘(墓)인 사람이야.
- 대신 묘(墓)의 특성(내향, 잠복, 저장, 숨김, 에너지 수렴)을 "묘(墓)"라는 단어 없이 일상 언어로 풀어서 설명해.
- 변환 예시:
  "묘(墓)에 앉아 있어" → "에너지가 안으로 숨는 구조야" 또는 "속으로 삭이는 기질이야"
  "묘(墓)의 기운으로" → "감정을 꾹꾹 눌러담는 성향 때문에"
  "대운 묘 시기에" → "에너지가 내면으로 수렴하는 시기에"
  "12운성 묘가 겹치면서" → "내면에 쌓이는 기운이 겹치면서"
  "묘(墓) 속에서" → "깊이 묻어둔 내면에서"
- 핵심: 묘(墓)의 의미를 살리되, "묘"/"墓" 글자 자체를 쓰지 않는 것이 목표
- 문장 구조, 톤, 분량은 원본과 동일하게 유지해

응답 형식 (JSON):
{
  "rewrites": [
    { "path": "필드경로", "newText": "새 텍스트" }
  ]
}`;

// ─── 허용된 패치 경로 (화이트리스트) ─────────────

const ALLOWED_PATHS = new Set([
  // killingLine 5개
  ...BATTLE_CATEGORIES.map((c) => `categoryResults.${c}.killingLine`),
  // detail 5개
  ...BATTLE_CATEGORIES.map((c) => `categoryResults.${c}.detail`),
  // punchline 경로들
  "chemistry.punchline",
  "chemistry.bonusScenarios.0.punchline",
  "chemistry.bonusScenarios.1.punchline",
  "futureOutlook.punchline",
  "finalVerdict.punchline",
  "heroQuip",
  // simulation punchline (최대 5개)
  ...Array.from({ length: 5 }, (_, i) => `simulations.${i}.punchline`),
  // chemistry analysis
  "chemistry.analysis",
  "chemistry.bonusScenarios.0.analysis",
  "chemistry.bonusScenarios.1.analysis",
  // simulation reasoning (최대 5개)
  ...Array.from({ length: 5 }, (_, i) => `simulations.${i}.reasoning`),
  // finalVerdict
  "finalVerdict.verdictA",
  "finalVerdict.verdictB",
  "finalVerdict.verdict",
  // futureOutlook timeline (최대 5개 시점)
  ...Array.from({ length: 5 }, (_, i) => `futureOutlook.timeline.${i}.eventA`),
  ...Array.from({ length: 5 }, (_, i) => `futureOutlook.timeline.${i}.eventB`),
  ...Array.from({ length: 5 }, (_, i) => `futureOutlook.timeline.${i}.relationship`),
  // 개인사주 경로
  "tier.description",
  ...Array.from({ length: 10 }, (_, i) => `sections.${i}.title`),
  ...Array.from({ length: 10 }, (_, i) => `sections.${i}.content`),
]);

// ─── 유틸리티 ────────────────────────────────────

/** 이름 마스킹: nameA/nameB를 "__NAME__"으로 치환 */
function maskNames(text: string, names: string[]): string {
  let masked = text;
  for (const name of names) {
    if (name) masked = masked.replaceAll(name, "__NAME__");
  }
  return masked;
}

/** 글자 유사도 (Sørensen–Dice coefficient on bigrams) */
export function charSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (s: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      map.set(bg, (map.get(bg) || 0) + 1);
    }
    return map;
  };

  const biA = bigrams(a);
  const biB = bigrams(b);
  let intersection = 0;
  for (const [bg, countA] of biA) {
    const countB = biB.get(bg) || 0;
    intersection += Math.min(countA, countB);
  }
  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

/** 마지막 N글자 어미 추출 */
function extractEnding(text: string, n = 3): string {
  const trimmed = text.trim();
  return trimmed.slice(Math.max(0, trimmed.length - n));
}

/** 첫 문장 추출 ('.' 또는 '!' 기준) */
function extractFirstSentence(text: string): string {
  const match = text.match(/^[^.!]+[.!]/);
  return match ? match[0].trim() : text.trim().slice(0, 60);
}

/** dot-path로 객체에서 값 읽기 */
function getByPath(obj: any, path: string): any {
  const keys = path.split(".");
  let cur = obj;
  for (const k of keys) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

/** dot-path로 객체에 값 쓰기 */
function setByPath(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) return;
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

/** 한국어 조사 제거용 스톱워드 */
const KOREAN_STOPWORDS = new Set([
  "의", "가", "이", "를", "을", "에", "와", "과", "도", "는", "은",
  "로", "으로", "에서", "까지", "부터", "에게", "한테", "께",
  "처럼", "만큼", "보다", "라는", "이라는", "에서의",
]);

/** 타이틀에서 2글자 이상 키워드 추출 (조사 제외) */
function extractKeywords(title: string): string[] {
  const tokens = title.replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s]/g, " ").split(/\s+/);
  return tokens.filter((t) => t.length >= 2 && !KOREAN_STOPWORDS.has(t));
}

// ─── 감지 함수들 (export for testing) ────────────

/**
 * 타겟 1: killingLine 문형 반복 (배틀 전용)
 * 5개 killingLine의 어미 반복 + 마스킹 유사도 체크
 */
export function detectKillingLinePattern(
  cats: BattleLlmAnalysis["categoryResults"],
  names: string[],
): { needsRewrite: boolean; targets: BattleCategoryKey[]; pattern: string } {
  const entries = BATTLE_CATEGORIES.map((key) => ({
    key,
    text: cats[key].killingLine,
    masked: maskNames(cats[key].killingLine, names),
  }));

  // 어미 기반 감지
  const endingGroups = new Map<string, BattleCategoryKey[]>();
  for (const e of entries) {
    const ending = extractEnding(e.masked);
    if (!endingGroups.has(ending)) endingGroups.set(ending, []);
    endingGroups.get(ending)!.push(e.key);
  }

  for (const [ending, keys] of endingGroups) {
    if (keys.length >= 3) {
      // 첫 번째 유지, 나머지가 리라이트 대상
      return {
        needsRewrite: true,
        targets: keys.slice(1),
        pattern: `"~${ending}"로 끝나는 문형이 반복됨`,
      };
    }
  }

  // 보조 체크: 마스킹 후 pairwise 글자 유사도 > 50% 그룹
  const similarPairs: BattleCategoryKey[] = [];
  for (let i = 0; i < entries.length; i++) {
    let similarCount = 0;
    for (let j = 0; j < entries.length; j++) {
      if (i === j) continue;
      if (charSimilarity(entries[i].masked, entries[j].masked) > 0.5) {
        similarCount++;
      }
    }
    if (similarCount >= 2) similarPairs.push(entries[i].key);
  }

  if (similarPairs.length >= 3) {
    return {
      needsRewrite: true,
      targets: similarPairs.slice(1),
      pattern: "killingLine 간 글자 유사도가 50%를 초과하는 그룹이 3개 이상",
    };
  }

  return { needsRewrite: false, targets: [], pattern: "" };
}

/**
 * 타겟 2: punchline 표현 중복 (배틀 전용)
 * 모든 punchline을 pairwise 비교
 */
export function detectPunchlineDuplicates(
  result: BattleLlmAnalysis,
  names: string[],
): { needsRewrite: boolean; targets: { path: string; text: string }[] } {
  // 모든 punchline 수집
  const punchlines: { path: string; text: string }[] = [];

  // killingLine 5개
  for (const cat of BATTLE_CATEGORIES) {
    punchlines.push({
      path: `categoryResults.${cat}.killingLine`,
      text: result.categoryResults[cat].killingLine,
    });
  }

  // chemistry punchline
  if (result.chemistry?.punchline) {
    punchlines.push({ path: "chemistry.punchline", text: result.chemistry.punchline });
  }

  // bonusScenarios punchline
  if (result.chemistry?.bonusScenarios) {
    result.chemistry.bonusScenarios.forEach((bs, i) => {
      if (bs.punchline) {
        punchlines.push({ path: `chemistry.bonusScenarios.${i}.punchline`, text: bs.punchline });
      }
    });
  }

  // simulation punchlines
  if (result.simulations) {
    result.simulations.forEach((sim, i) => {
      if (sim.punchline) {
        punchlines.push({ path: `simulations.${i}.punchline`, text: sim.punchline });
      }
    });
  }

  // futureOutlook punchline
  if (result.futureOutlook?.punchline) {
    punchlines.push({ path: "futureOutlook.punchline", text: result.futureOutlook.punchline });
  }

  // finalVerdict punchline
  if (result.finalVerdict?.punchline) {
    punchlines.push({ path: "finalVerdict.punchline", text: result.finalVerdict.punchline });
  }

  // heroQuip
  if (result.heroQuip) {
    punchlines.push({ path: "heroQuip", text: result.heroQuip });
  }

  // pairwise 비교
  const duplicateIndices = new Set<number>();
  for (let i = 0; i < punchlines.length; i++) {
    for (let j = i + 1; j < punchlines.length; j++) {
      const a = punchlines[i].text;
      const b = punchlines[j].text;

      // 완전 일치
      if (a === b) {
        duplicateIndices.add(j);
        continue;
      }

      // 짧은 쪽이 긴 쪽에 80%+ 포함
      const shorter = a.length <= b.length ? a : b;
      const longer = a.length <= b.length ? b : a;
      if (shorter.length > 0 && longer.includes(shorter.slice(0, Math.ceil(shorter.length * 0.8)))) {
        duplicateIndices.add(j);
        continue;
      }

      // 이름 마스킹 후 글자 유사도 > 60%
      const maskedA = maskNames(a, names);
      const maskedB = maskNames(b, names);
      if (charSimilarity(maskedA, maskedB) > 0.6) {
        duplicateIndices.add(j);
      }
    }
  }

  const targets = Array.from(duplicateIndices).map((i) => punchlines[i]);
  return { needsRewrite: targets.length > 0, targets };
}

/**
 * 타겟 3: detail 첫 문장 반복 (배틀 전용)
 * 각 detail 첫 문장의 pairwise 유사도 체크
 */
export function detectDetailFirstSentence(
  cats: BattleLlmAnalysis["categoryResults"],
): { needsRewrite: boolean; targets: BattleCategoryKey[]; pattern: string } {
  const entries = BATTLE_CATEGORIES.map((key) => ({
    key,
    firstSentence: extractFirstSentence(cats[key].detail),
  }));

  // 유사도 > 60% 쌍 카운트
  const similarCounts = new Map<BattleCategoryKey, number>();
  for (const cat of BATTLE_CATEGORIES) similarCounts.set(cat, 0);

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (charSimilarity(entries[i].firstSentence, entries[j].firstSentence) > 0.6) {
        similarCounts.set(entries[i].key, (similarCounts.get(entries[i].key) || 0) + 1);
        similarCounts.set(entries[j].key, (similarCounts.get(entries[j].key) || 0) + 1);
      }
    }
  }

  // 유사도 쌍이 있는 카테고리 그룹 찾기 (3개 이상 조합)
  const similarGroup = entries.filter((e) => (similarCounts.get(e.key) || 0) >= 2);
  if (similarGroup.length >= 3) {
    // 첫 번째 유지, 나머지가 대상
    const targets = similarGroup.slice(1).map((e) => e.key);
    return {
      needsRewrite: true,
      targets,
      pattern: "detail 첫 문장이 유사한 패턴을 반복함",
    };
  }

  return { needsRewrite: false, targets: [], pattern: "" };
}

/**
 * 개인사주 P1: tier.description ↔ 종합 복붙
 */
export function detectTierSummaryCopypaste(
  result: AnalysisResult,
): { needsRewrite: boolean; similarity: number } {
  const desc = result.tier?.description || "";
  const lastSection = result.sections?.[result.sections.length - 1];
  if (!desc || !lastSection?.content) return { needsRewrite: false, similarity: 0 };

  // 첫 문단 추출 (\n\n 기준)
  const firstParagraph = lastSection.content.split("\n\n")[0].trim();
  if (!firstParagraph) return { needsRewrite: false, similarity: 0 };

  const similarity = charSimilarity(desc, firstParagraph);
  return { needsRewrite: similarity > 0.6, similarity };
}

/**
 * 개인사주 P2: 섹션 타이틀 키워드 중복
 */
export function detectTitleKeywordOverlap(
  result: AnalysisResult,
): { needsRewrite: boolean; targets: number[]; keyword: string } {
  const titles = (result.sections || []).map((s) => s.title || "");

  // 각 타이틀의 키워드
  const titleKeywords = titles.map((t) => extractKeywords(t));

  // 키워드별 등장 타이틀 인덱스
  const keywordToIndices = new Map<string, number[]>();
  titleKeywords.forEach((kws, idx) => {
    for (const kw of kws) {
      if (!keywordToIndices.has(kw)) keywordToIndices.set(kw, []);
      keywordToIndices.get(kw)!.push(idx);
    }
  });

  // 3개+ 타이틀에 등장하는 키워드 찾기
  for (const [kw, indices] of keywordToIndices) {
    if (indices.length >= 3) {
      // 첫 번째 유지, 나머지가 대상
      return {
        needsRewrite: true,
        targets: indices.slice(1),
        keyword: kw,
      };
    }
  }

  return { needsRewrite: false, targets: [], keyword: "" };
}

// ─── 개인사주 P4: 섹션 간 문장 반복 감지 ─────────

export interface CrossSectionRepetition {
  sectionIndexA: number;
  sectionIndexB: number;
  similarPairs: { sentenceA: string; sentenceB: string; similarity: number }[];
}

/**
 * 섹션 content 본문 간 유사 문장 반복 감지.
 * - 각 섹션 content를 문장 분리 후 pairwise 비교
 * - 기본: 유사도 50%+ 문장 쌍 3쌍+ → 반복 판정
 * - 종합(index 9) 관련: 60%+ 문장 쌍 4쌍+ (종합은 요약 역할이므로 완화)
 */
export function detectCrossSectionRepetition(
  result: AnalysisResult,
): CrossSectionRepetition[] {
  const sections = result.sections || [];
  if (sections.length < 2) return [];

  // 각 섹션의 문장 분리 (5자 이상만)
  const sectionSentences: string[][] = sections.map((s) =>
    s.content
      .split(/[.?!]\s+/)
      .map((sent) => sent.trim())
      .filter((sent) => sent.length >= 5),
  );

  const results: CrossSectionRepetition[] = [];

  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const sentencesA = sectionSentences[i];
      const sentencesB = sectionSentences[j];
      if (sentencesA.length === 0 || sentencesB.length === 0) continue;

      // 종합(index 9) 관련 조합은 기준 완화
      const involvesConclusion = i === 9 || j === 9;
      const similarityThreshold = involvesConclusion ? 0.6 : 0.5;
      const minPairs = involvesConclusion ? 4 : 3;

      const similarPairs: CrossSectionRepetition["similarPairs"] = [];

      for (const sentA of sentencesA) {
        for (const sentB of sentencesB) {
          const sim = charSimilarity(sentA, sentB);
          if (sim >= similarityThreshold) {
            similarPairs.push({ sentenceA: sentA, sentenceB: sentB, similarity: sim });
          }
        }
      }

      if (similarPairs.length >= minPairs) {
        results.push({
          sectionIndexA: i,
          sectionIndexB: j,
          similarPairs,
        });
      }
    }
  }

  return results;
}

// ─── cross-section 전용 리라이트 프롬프트 ────────

const CROSS_SECTION_REWRITE_SYSTEM = `너는 사주 분석 결과의 텍스트 교정기야.
아래 텍스트는 사주 분석 결과의 특정 섹션인데, 다른 섹션과 내용이 중복돼 있어.
중복된 문장들을 제거하고, 이 섹션 고유의 관점에서 완전히 새로운 내용으로 다시 써.

[절대 규칙]
1. 반말(~야, ~거든, ~지, ~거야) 유지
2. 위로/격려 금지
3. 사주 용어는 자연스럽게 사용
4. 800~1200자
5. 3문단 구조 유지
6. 중복으로 지적된 문장은 절대 반복하지 마
7. 해당 섹션의 주제에 맞는 고유한 내용만 써

응답 형식 (JSON):
{
  "rewrites": [
    { "path": "필드경로", "newText": "새 텍스트" }
  ]
}`;

// ─── 리라이트 프롬프트 빌더 ──────────────────────

interface RewriteTarget {
  path: string;
  currentText: string;
}

interface RewriteRequest {
  targets: RewriteTarget[];
  avoidPattern: string;
  preservedTexts: string[];
}

function buildRewriteUserPrompt(request: RewriteRequest): string {
  let prompt = "";

  if (request.avoidPattern) {
    prompt += `[피해야 할 패턴]\n${request.avoidPattern}\n\n`;
  }

  prompt += "[리라이트 대상]\n";
  const CATEGORY_LABEL: Record<string, string> = {
    wealth: "재물운", love: "연애운", career: "직장운",
    health: "건강운", social: "대인운",
  };
  for (const t of request.targets) {
    // path에서 카테고리 추출 (categoryResults.love.killingLine → love)
    const catMatch = t.path.match(/categoryResults\.(\w+)\./);
    const catLabel = catMatch ? ` (${CATEGORY_LABEL[catMatch[1]] || catMatch[1]})` : "";
    prompt += `- path: "${t.path}"${catLabel}\n  현재: "${t.currentText}"\n`;
  }

  if (request.preservedTexts.length > 0) {
    prompt += "\n[이것들과 달라야 하는 기존 텍스트]\n";
    for (const pt of request.preservedTexts) {
      prompt += `- "${pt}" (유지됨)\n`;
    }
  }

  return prompt;
}

// ─── 이름 환각 검증 ─────────────────────────────

/** 한국 성씨 (인구 99%+ 커버) */
const KOREAN_SURNAMES = new Set(
  "김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구민류나진지".split(""),
);

/**
 * 성씨로 시작하지만 이름이 아닌 흔한 한국어 단어.
 * false positive 방지용 — 사주/배틀 도메인 위주.
 */
const COMMON_NON_NAME_WORDS = new Set([
  // 사주/배틀 도메인
  "재물", "연애", "직장", "건강", "대인", "사주", "기운", "통장", "체력", "인맥",
  "승리", "승부", "압도", "압승", "판정", "차이", "차원", "차례", "구조", "성격",
  "성공", "성과", "성적",
  // 이(李) 시작
  "이미", "이제", "이건", "이번", "이후", "이상", "이런", "이것", "이날", "이전",
  // 최(崔) 시작
  "최고", "최근", "최대", "최소", "최선", "최초", "최악", "최적",
  // 정(鄭) 시작
  "정말", "정도", "정확", "정신", "정면", "정상", "정리", "정체",
  // 강(姜) 시작
  "강해", "강한", "강력", "강점", "강세", "강조",
  // 한(韓) 시작
  "한번", "한참", "한쪽", "한숨", "한발", "한방", "한판", "한수", "한테",
  // 기타 흔한 단어
  "서로", "서운", "장면", "장점", "장난", "장기", "조금", "조건", "조차", "조용",
  "오히", "오래", "오직", "전혀", "전부", "전체", "전력", "고민", "고작", "문제",
  "문득", "주로", "주위", "주목", "우위", "우선", "우세", "구석", "구간", "민감",
  "남자", "남녀", "남쪽", "심한", "심각", "심리", "노력", "하나", "하지", "하루",
  "하필", "배로", "배경", "배치", "박수", "박력", "박차", "신경", "신나", "신비",
  "권위", "권리", "황당", "황금", "송이", "홍수", "홍보",
  // 안(安) 시작
  "안정", "안쪽", "안녕", "안으로", "안에서", "안에", "안으로는",
  "안전", "안내", "안심", "안부", "안색", "안목", "안개", "안팎", "안타",
  "임시", "윤리", "독보", "독특", "유리", "유독", "진짜", "진심", "진행", "지금",
  "지난", "지점", "나름",
]);

/**
 * 리라이트 텍스트에 원본 + knownNames에 없는 고유명사가 있는지 검사.
 *
 * 방안 B: 독립된 2-3음절 한글 단어만 추출 (앞뒤 한글이 없는 경계).
 *   "강해지다"(4음절)는 토큰에 안 잡히고, "차곡차곡"도 안 잡힘.
 * 방안 C: 환각 후보가 2개 이상일 때만 skip (1개는 오탐 가능성이 높으므로 통과).
 */
function containsUnknownName(
  newText: string,
  originalText: string,
  knownNames: string[],
): string | null {
  const knownSet = new Set(knownNames.filter(Boolean));
  // 독립된 2-3음절 한글 단어만 추출 (앞뒤가 한글이 아닌 경계)
  const wordBoundaryRegex = /(?<![가-힣])[가-힣]{2,3}(?![가-힣])/g;
  const origTokens = new Set(originalText.match(wordBoundaryRegex) || []);
  const newTokens = newText.match(wordBoundaryRegex) || [];

  const suspects: string[] = [];
  for (const token of newTokens) {
    if (knownSet.has(token)) continue;
    if (origTokens.has(token)) continue;
    if (COMMON_NON_NAME_WORDS.has(token)) continue;
    // "민수는" 같이 knownName+조사 형태 허용 (이름이 토큰 접두어인 경우)
    if (knownNames.some((n) => n && n.length >= 2 && token.startsWith(n))) continue;
    if (KOREAN_SURNAMES.has(token[0])) {
      suspects.push(token);
    }
  }
  // 2개 이상일 때만 환각 판정 (1개는 일반 단어 오탐 가능성 높음)
  return suspects.length >= 2 ? suspects[0] : null;
}

// ─── Gemini 호출 + 패치 ──────────────────────────

async function callRewrite(
  userPrompt: string,
  warnings: string[],
  systemPrompt: string = REWRITE_SYSTEM,
): Promise<{ path: string; newText: string }[] | null> {
  const model = DEFAULT_MODELS[0]; // gemini-2.5-flash-lite
  try {
    const res = await callGemini(model, userPrompt, systemPrompt, {
      temperature: 0.85,
      maxOutputTokens: 2048,
    });
    if (!res.ok) {
      warnings.push(`[surgical-rewrite] Gemini API 실패: ${res.message}`);
      return null;
    }
    const parsed = parseJson5Loose<{ rewrites?: { path: string; newText: string }[] }>(res.text);
    if (!parsed?.rewrites || !Array.isArray(parsed.rewrites)) {
      warnings.push("[surgical-rewrite] 응답 JSON 파싱 실패: rewrites 배열 없음");
      return null;
    }
    return parsed.rewrites;
  } catch (err: any) {
    warnings.push(`[surgical-rewrite] 리라이트 호출 에러: ${err?.message || err}`);
    return null;
  }
}

function patchResults<T>(
  original: T,
  rewrites: { path: string; newText: string }[],
  warnings: string[],
  knownNames?: string[],
  skipNameCheckPaths?: Set<string>,
): T {
  const patched = structuredClone(original);
  for (const rw of rewrites) {
    if (!ALLOWED_PATHS.has(rw.path)) {
      warnings.push(`[surgical-rewrite] 허용되지 않은 경로 skip: ${rw.path}`);
      continue;
    }
    const existing = getByPath(patched, rw.path);
    if (typeof existing !== "string") {
      warnings.push(`[surgical-rewrite] 원본 경로에 문자열 없음 skip: ${rw.path}`);
      continue;
    }
    const maxLen = Math.max(500, Math.round(existing.length * 1.5));
    if (typeof rw.newText !== "string" || rw.newText.length < 5 || rw.newText.length > maxLen) {
      warnings.push(`[surgical-rewrite] 텍스트 길이 이상 skip: ${rw.path} (${rw.newText?.length ?? 0}자, max=${maxLen})`);
      continue;
    }
    // 이름 환각 검증: 원본+knownNames에 없는 고유명사 감지
    // 묘(墓) 초과 리라이트 타겟은 이름 체크 스킵 (패러프레이즈 시 오탐 빈발)
    if (knownNames && knownNames.length > 0 && !skipNameCheckPaths?.has(rw.path)) {
      const hallucinated = containsUnknownName(rw.newText, existing, knownNames);
      if (hallucinated) {
        warnings.push(`[surgical-rewrite] 알 수 없는 이름 "${hallucinated}" 감지 skip: ${rw.path}`);
        continue;
      }
    }
    setByPath(patched, rw.path, rw.newText);
  }
  return patched;
}

// ─── 메인 엔트리: 배틀 ──────────────────────────

export async function surgicalRewriteBattle(
  result: BattleLlmAnalysis,
  warnings: string[],
  context: { nameA: string; nameB: string; relationshipType: string },
  myoExcessTargets?: { path: string; currentText: string }[],
): Promise<BattleLlmAnalysis> {
  const names = [context.nameA, context.nameB];
  const allRequests: RewriteRequest[] = [];

  // 타겟 1: killingLine 문형 반복
  const klDetect = detectKillingLinePattern(result.categoryResults, names);
  if (klDetect.needsRewrite) {
    const targets: RewriteTarget[] = klDetect.targets.map((cat) => ({
      path: `categoryResults.${cat}.killingLine`,
      currentText: result.categoryResults[cat].killingLine,
    }));
    const preservedCats = BATTLE_CATEGORIES.filter((c) => !klDetect.targets.includes(c));
    const preserved = preservedCats.map((c) => result.categoryResults[c].killingLine);

    allRequests.push({
      targets,
      avoidPattern: klDetect.pattern,
      preservedTexts: preserved,
    });
  }

  // 타겟 2: punchline 표현 중복
  const plDetect = detectPunchlineDuplicates(result, names);
  if (plDetect.needsRewrite) {
    // 리라이트 대상이 아닌 punchline들 (보존 대상)
    const targetPaths = new Set(plDetect.targets.map((t) => t.path));
    const allPunchlines = collectAllPunchlines(result);
    const preserved = allPunchlines
      .filter((p) => !targetPaths.has(p.path))
      .map((p) => p.text);

    allRequests.push({
      targets: plDetect.targets.map((t) => ({ path: t.path, currentText: t.text })),
      avoidPattern: "punchline 간 표현이 중복됨",
      preservedTexts: preserved,
    });
  }

  // 타겟 3: detail 첫 문장 반복
  const dtDetect = detectDetailFirstSentence(result.categoryResults);
  if (dtDetect.needsRewrite) {
    const targets: RewriteTarget[] = dtDetect.targets.map((cat) => ({
      path: `categoryResults.${cat}.detail`,
      currentText: result.categoryResults[cat].detail,
    }));
    const preservedCats = BATTLE_CATEGORIES.filter((c) => !dtDetect.targets.includes(c));
    const preserved = preservedCats.map((c) => result.categoryResults[c].detail);

    allRequests.push({
      targets,
      avoidPattern: dtDetect.pattern,
      preservedTexts: preserved,
    });
  }

  // 타겟 4: 묘(墓) 초과 — detect-only 모드에서 넘어온 필드
  if (myoExcessTargets && myoExcessTargets.length > 0) {
    allRequests.push({
      targets: myoExcessTargets.map((t) => ({
        path: t.path,
        currentText: t.currentText,
      })),
      avoidPattern:
        "이 필드에서 묘(墓) 언급이 과도해. 묘(墓)를 다른 사주 근거(다른 12운성: 장생/목욕/관대/건록/제왕/쇠/병/사/절/태/양, 신살, 오행 등)로 자연스럽게 바꿔서 다시 써. 문장 구조와 톤은 유지해.",
      preservedTexts: [],
    });
  }

  // 리라이트 대상이 없으면 원본 반환
  if (allRequests.length === 0) return result;

  // 모든 request를 하나의 프롬프트로 합침
  const mergedTargets: RewriteTarget[] = [];
  const mergedPreserved: string[] = [];
  const patterns: string[] = [];

  for (const req of allRequests) {
    mergedTargets.push(...req.targets);
    mergedPreserved.push(...req.preservedTexts);
    if (req.avoidPattern) patterns.push(req.avoidPattern);
  }

  // 중복 타겟 제거 (path 기준)
  const seen = new Set<string>();
  const uniqueTargets = mergedTargets.filter((t) => {
    if (seen.has(t.path)) return false;
    seen.add(t.path);
    return true;
  });

  const userPrompt = buildRewriteUserPrompt({
    targets: uniqueTargets,
    avoidPattern: patterns.join("\n"),
    preservedTexts: [...new Set(mergedPreserved)],
  });

  warnings.push(`[surgical-rewrite] 배틀 리라이트 발동: ${uniqueTargets.length}개 필드`);

  const rewrites = await callRewrite(userPrompt, warnings);
  if (!rewrites) return result;

  const myoSkipPaths = new Set(
    myoExcessTargets?.map((t) => t.path) ?? [],
  );
  return patchResults(result, rewrites, warnings, names, myoSkipPaths);
}

// ─── 메인 엔트리: 개인사주 ──────────────────────

export async function surgicalRewritePersonal(
  result: AnalysisResult,
  warnings: string[],
  context: { name: string },
  myoExcessTargets?: { path: string; currentText: string }[],
): Promise<AnalysisResult> {
  const allRequests: RewriteRequest[] = [];

  // P1: tier.description ↔ 종합 복붙
  const tierDetect = detectTierSummaryCopypaste(result);
  if (tierDetect.needsRewrite) {
    const lastSection = result.sections[result.sections.length - 1];
    const firstParagraph = lastSection.content.split("\n\n")[0].trim();

    allRequests.push({
      targets: [{ path: "tier.description", currentText: result.tier.description }],
      avoidPattern: "tier.description이 마지막 섹션 내용과 너무 유사함",
      preservedTexts: [firstParagraph],
    });
  }

  // P2: 섹션 타이틀 키워드 중복
  const titleDetect = detectTitleKeywordOverlap(result);
  if (titleDetect.needsRewrite) {
    const targets: RewriteTarget[] = titleDetect.targets.map((idx) => ({
      path: `sections.${idx}.title`,
      currentText: result.sections[idx].title,
    }));
    const preservedIndices = result.sections
      .map((_, i) => i)
      .filter((i) => !titleDetect.targets.includes(i));
    const preserved = preservedIndices.map((i) => result.sections[i].title);

    allRequests.push({
      targets,
      avoidPattern: `"${titleDetect.keyword}" 키워드가 여러 타이틀에 반복됨`,
      preservedTexts: preserved,
    });
  }

  // P3: 묘(墓) 초과 — detect-only 모드에서 넘어온 필드
  if (myoExcessTargets && myoExcessTargets.length > 0) {
    allRequests.push({
      targets: myoExcessTargets.map((t) => ({
        path: t.path,
        currentText: t.currentText,
      })),
      avoidPattern:
        "이 필드에서 묘(墓) 언급이 과도해. 묘(墓)를 다른 사주 근거(다른 12운성: 장생/목욕/관대/건록/제왕/쇠/병/사/절/태/양, 신살, 오행 등)로 자연스럽게 바꿔서 다시 써. 문장 구조와 톤은 유지해.",
      preservedTexts: [],
    });
  }

  // P4: 섹션 간 문장 반복
  const crossSectionRequests: RewriteRequest[] = [];
  const crossDetect = detectCrossSectionRepetition(result);
  if (crossDetect.length > 0) {
    for (const rep of crossDetect) {
      // index가 큰 쪽을 rewrite 대상으로
      const targetIdx = Math.max(rep.sectionIndexA, rep.sectionIndexB);
      const sourceIdx = Math.min(rep.sectionIndexA, rep.sectionIndexB);
      const duplicatedSentences = rep.similarPairs.map((p) =>
        targetIdx === rep.sectionIndexB ? p.sentenceB : p.sentenceA,
      );

      crossSectionRequests.push({
        targets: [
          {
            path: `sections.${targetIdx}.content`,
            currentText: result.sections[targetIdx].content,
          },
        ],
        avoidPattern: `이 섹션이 섹션 ${sourceIdx}와 내용이 중복됨.\n중복된 문장들:\n${duplicatedSentences.map((s) => `- "${s}"`).join("\n")}\n위 내용을 반복하지 말고 이 섹션 고유의 관점에서 새로 써.`,
        preservedTexts: [result.sections[sourceIdx].content.slice(0, 300)],
      });
    }
  }

  // 리라이트 대상이 없으면 원본 반환
  if (allRequests.length === 0 && crossSectionRequests.length === 0) return result;

  let patched = result;

  // P1~P3: 기존 프롬프트로 합쳐서 호출
  if (allRequests.length > 0) {
    const mergedTargets: RewriteTarget[] = [];
    const mergedPreserved: string[] = [];
    const patterns: string[] = [];

    for (const req of allRequests) {
      mergedTargets.push(...req.targets);
      mergedPreserved.push(...req.preservedTexts);
      if (req.avoidPattern) patterns.push(req.avoidPattern);
    }

    const userPrompt = buildRewriteUserPrompt({
      targets: mergedTargets,
      avoidPattern: patterns.join("\n"),
      preservedTexts: [...new Set(mergedPreserved)],
    });

    warnings.push(`[surgical-rewrite] 개인사주 리라이트 발동: ${mergedTargets.length}개 필드`);

    const rewrites = await callRewrite(userPrompt, warnings);
    if (rewrites) {
      const myoSkipPaths = new Set(
        myoExcessTargets?.map((t) => t.path) ?? [],
      );
      patched = patchResults(patched, rewrites, warnings, [context.name], myoSkipPaths);
    }
  }

  // P4: cross-section 전용 프롬프트로 별도 호출
  if (crossSectionRequests.length > 0) {
    const crossTargets: RewriteTarget[] = [];
    const crossPreserved: string[] = [];
    const crossPatterns: string[] = [];

    for (const req of crossSectionRequests) {
      crossTargets.push(...req.targets);
      crossPreserved.push(...req.preservedTexts);
      if (req.avoidPattern) crossPatterns.push(req.avoidPattern);
    }

    // 중복 타겟 제거 (path 기준)
    const seen = new Set<string>();
    const uniqueCrossTargets = crossTargets.filter((t) => {
      if (seen.has(t.path)) return false;
      seen.add(t.path);
      return true;
    });

    const crossUserPrompt = buildRewriteUserPrompt({
      targets: uniqueCrossTargets,
      avoidPattern: crossPatterns.join("\n"),
      preservedTexts: [...new Set(crossPreserved)],
    });

    warnings.push(`[surgical-rewrite] 섹션 간 반복 리라이트 발동: ${uniqueCrossTargets.length}개 필드`);

    const crossRewrites = await callRewrite(crossUserPrompt, warnings, CROSS_SECTION_REWRITE_SYSTEM);
    if (crossRewrites) {
      patched = patchResults(patched, crossRewrites, warnings, [context.name]);
    }
  }

  return patched;
}

// ─── 헬퍼: 모든 punchline 수집 ──────────────────

function collectAllPunchlines(
  result: BattleLlmAnalysis,
): { path: string; text: string }[] {
  const punchlines: { path: string; text: string }[] = [];

  for (const cat of BATTLE_CATEGORIES) {
    punchlines.push({
      path: `categoryResults.${cat}.killingLine`,
      text: result.categoryResults[cat].killingLine,
    });
  }

  if (result.chemistry?.punchline) {
    punchlines.push({ path: "chemistry.punchline", text: result.chemistry.punchline });
  }

  if (result.chemistry?.bonusScenarios) {
    result.chemistry.bonusScenarios.forEach((bs, i) => {
      if (bs.punchline) {
        punchlines.push({ path: `chemistry.bonusScenarios.${i}.punchline`, text: bs.punchline });
      }
    });
  }

  if (result.simulations) {
    result.simulations.forEach((sim, i) => {
      if (sim.punchline) {
        punchlines.push({ path: `simulations.${i}.punchline`, text: sim.punchline });
      }
    });
  }

  if (result.futureOutlook?.punchline) {
    punchlines.push({ path: "futureOutlook.punchline", text: result.futureOutlook.punchline });
  }

  if (result.finalVerdict?.punchline) {
    punchlines.push({ path: "finalVerdict.punchline", text: result.finalVerdict.punchline });
  }

  if (result.heroQuip) {
    punchlines.push({ path: "heroQuip", text: result.heroQuip });
  }

  return punchlines;
}
