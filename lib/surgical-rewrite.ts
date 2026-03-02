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

❌ 나쁜 예시 (어순/유의어만 변경 — 이건 안 됨):
  BEFORE: "건주가 8점 차이로 연애운 이겼어"
  AFTER: "연애운, 건주가 8점 차이로 승리했어"

✅ 좋은 예시 (장면 묘사형 — 이런 수준으로 바꿔야 해):
  - "건주 웃을 때 테스트는 속으로 끙끙대"
  - "채연 통장이 신건주 통장을 삼켜버렸어"
  - "체력 하나는 신건주가 채연 압도해"
  - "인맥 싸움, 신건주가 1점 차로 간신히 살았어"
  - "승진 축하는 채연이 먼저 받아"

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
  // 개인사주 경로
  "tier.description",
  ...Array.from({ length: 10 }, (_, i) => `sections.${i}.title`),
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
  for (const t of request.targets) {
    prompt += `- path: "${t.path}"\n  현재: "${t.currentText}"\n`;
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
  "권위", "권리", "황당", "황금", "안정", "안쪽", "안녕", "송이", "홍수", "홍보",
  "임시", "윤리", "독보", "독특", "유리", "유독", "진짜", "진심", "진행", "지금",
  "지난", "지점", "나름",
]);

/**
 * 리라이트 텍스트에 원본 + knownNames에 없는 고유명사가 있는지 검사.
 * 한국 성씨로 시작하는 2-3음절 한글 토큰 중,
 * 원본에도 없고 knownNames에도 없고 흔한 일반 단어도 아니면 → 환각 이름으로 판정.
 */
function containsUnknownName(
  newText: string,
  originalText: string,
  knownNames: string[],
): string | null {
  const knownSet = new Set(knownNames.filter(Boolean));
  const origTokens = new Set(originalText.match(/[\uAC00-\uD7A3]{2,3}/g) || []);
  const newTokens = newText.match(/[\uAC00-\uD7A3]{2,3}/g) || [];

  for (const token of newTokens) {
    if (knownSet.has(token)) continue;
    if (origTokens.has(token)) continue;
    if (COMMON_NON_NAME_WORDS.has(token)) continue;
    // "민수는" 같이 knownName+조사 형태 허용 (이름이 토큰 접두어인 경우)
    if (knownNames.some((n) => n && n.length >= 2 && token.startsWith(n))) continue;
    if (KOREAN_SURNAMES.has(token[0])) {
      return token; // 환각 이름 후보 반환
    }
  }
  return null;
}

// ─── Gemini 호출 + 패치 ──────────────────────────

async function callRewrite(
  userPrompt: string,
  warnings: string[],
): Promise<{ path: string; newText: string }[] | null> {
  const model = DEFAULT_MODELS[0]; // gemini-2.5-flash-lite
  try {
    const res = await callGemini(model, userPrompt, REWRITE_SYSTEM, {
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
): T {
  const patched = structuredClone(original);
  for (const rw of rewrites) {
    if (!ALLOWED_PATHS.has(rw.path)) {
      warnings.push(`[surgical-rewrite] 허용되지 않은 경로 skip: ${rw.path}`);
      continue;
    }
    if (typeof rw.newText !== "string" || rw.newText.length < 5 || rw.newText.length > 500) {
      warnings.push(`[surgical-rewrite] 텍스트 길이 이상 skip: ${rw.path} (${rw.newText?.length ?? 0}자)`);
      continue;
    }
    const existing = getByPath(patched, rw.path);
    if (typeof existing !== "string") {
      warnings.push(`[surgical-rewrite] 원본 경로에 문자열 없음 skip: ${rw.path}`);
      continue;
    }
    // 이름 환각 검증: 원본+knownNames에 없는 고유명사 감지
    if (knownNames && knownNames.length > 0) {
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

  return patchResults(result, rewrites, warnings, names);
}

// ─── 메인 엔트리: 개인사주 ──────────────────────

export async function surgicalRewritePersonal(
  result: AnalysisResult,
  warnings: string[],
  context: { name: string },
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

  const userPrompt = buildRewriteUserPrompt({
    targets: mergedTargets,
    avoidPattern: patterns.join("\n"),
    preservedTexts: [...new Set(mergedPreserved)],
  });

  warnings.push(`[surgical-rewrite] 개인사주 리라이트 발동: ${mergedTargets.length}개 필드`);

  const rewrites = await callRewrite(userPrompt, warnings);
  if (!rewrites) return result;

  return patchResults(result, rewrites, warnings, [context.name]);
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
