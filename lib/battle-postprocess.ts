import type { BattleLlmAnalysis } from "@/types/battle";

// ─── 자동 치환 ──────────────────────────────────────

function fixSseusro(text: string): { text: string; count: number } {
  let count = 0;
  const fixed = text
    .replace(/스스로를/g, () => { count++; return "본인을"; })
    .replace(/스스로의/g, () => { count++; return "본인의"; })
    .replace(/스스로가/g, () => { count++; return "본인이"; })
    .replace(/스스로/g, () => { count++; return "혼자서"; });
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

// ─── Korean Unicode helpers ────────────────────────

function decomposeKorean(ch: string): { cho: number; jung: number; jong: number } | null {
  const code = ch.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return null;
  const offset = code - 0xAC00;
  return {
    cho: Math.floor(offset / (21 * 28)),
    jung: Math.floor((offset % (21 * 28)) / 28),
    jong: offset % 28,
  };
}

function composeKorean(cho: number, jung: number, jong: number = 0): string {
  return String.fromCharCode(0xAC00 + cho * 21 * 28 + jung * 28 + jong);
}

// ─── 격식체 → 반말 치환 (5단계) ────────────────────
//
// Stage 1: Compound (수 있다, 기 쉽다, ...)
// Stage 2: Specific safe patterns (한다→해, 된다→돼, 관계다→관계야, ...)
// Stage 3: Generic 는다 (consonant stems: 먹는다→먹어, 잡는다→잡아)
// Stage 4: Generic ㄴ다 + ㅂ다 + catch-all (Unicode: 긴다→겨, 높다→높아)
// Stage 5: Post-conversion cleanup (하.→해., 쓰어→써)

const COMPOUND_FORMAL: [RegExp, string][] = [
  [/수 있다\./g, "수 있어."],
  [/수 없다\./g, "수 없어."],
  [/기 쉽다\./g, "기 쉬워."],
  [/기 어렵다\./g, "기 어려워."],
  [/기 힘들다\./g, "기 힘들어."],
  [/기 마련이다\./g, "기 마련이야."],
];

const SPECIFIC_FORMAL: [RegExp, string][] = [
  [/([가-힣])한다\./g, "$1해."],
  [/([가-힣])된다\./g, "$1돼."],
  [/([가-힣])이다\./g, "$1이야."],
  [/하다\./g, "해."],
  [/있다\./g, "있어."],
  [/없다\./g, "없어."],
  [/크다\./g, "커."],
  // copula (이다 축약)
  [/관계다\./g, "관계야."],
  // ㄹ탈락 불규칙
  [/만든다\./g, "만들어."],
  // 르 불규칙
  [/따른다\./g, "따라."],
  [/모른다\./g, "몰라."],
  // 아니다 (불규칙)
  [/아니다\./g, "아니야."],
];

function fixHonorifics(text: string): { text: string; count: number } {
  let count = 0;
  let result = text;
  for (const [pattern, replacement] of HONORIFIC_PATTERNS) {
    result = result.replace(pattern, () => { count++; return replacement; });
  }
  return { text: result, count };
}

function fixFormalEndings(text: string): { text: string; count: number } {
  let count = 0;
  let result = text;

  // Stage 1: Compound patterns (highest priority)
  for (const [pattern, replacement] of COMPOUND_FORMAL) {
    result = result.replace(pattern, () => { count++; return replacement; });
  }

  // Stage 2: Specific patterns
  for (const [pattern, replacement] of SPECIFIC_FORMAL) {
    result = result.replace(pattern, (...args) => {
      count++;
      return replacement.replace("$1", args[1] || "");
    });
  }

  // Stage 3: Generic 는다 (consonant-stem verbs: 먹는다→먹어, 잡는다→잡아)
  result = result.replace(/([가-힣])는다\./g, (match, stemChar) => {
    const d = decomposeKorean(stemChar);
    if (!d || d.jong === 0) return match; // must have batchim (consonant stem)
    count++;
    const suffix = (d.jung === 0 || d.jung === 8) ? "아" : "어"; // ㅏ/ㅗ→아, else→어
    return stemChar + suffix + ".";
  });

  // Stage 4: Generic ㄴ다 (vowel-stem verbs) + ㅂ다 (ㅂ-irregular adjectives)
  result = result.replace(/([가-힣])다\./g, (match, char) => {
    const d = decomposeKorean(char);
    if (!d) return match;

    // ㄴ batchim (jong=4): 긴다→겨, 진다→져, 본다→봐, 쓴다→써
    if (d.jong === 4) {
      count++;
      switch (d.jung) {
        case 0: return composeKorean(d.cho, 0, 0) + ".";    // ㅏ: 간→가
        case 4: return composeKorean(d.cho, 4, 0) + ".";    // ㅓ: 건→거
        case 8: return composeKorean(d.cho, 9, 0) + ".";    // ㅗ: 본→봐
        case 13: return composeKorean(d.cho, 14, 0) + ".";  // ㅜ: 준→줘
        case 18: return composeKorean(d.cho, 4, 0) + ".";   // ㅡ: 쓴→써, 끈→꺼 (ㅡ탈락)
        case 20: return composeKorean(d.cho, 6, 0) + ".";   // ㅣ: 긴→겨, 진→져
        default: return composeKorean(d.cho, d.jung, 0) + "어.";
      }
    }

    // ㅂ batchim (jong=17): 어렵다→어려워, 쉽다→쉬워
    if (d.jong === 17) {
      count++;
      return composeKorean(d.cho, d.jung, 0) + "워.";
    }

    // Catch-all: other batchim — vowel harmony (높다→높아, 많다→많아, 좋다→좋아, 작다→작아)
    if (d.jong !== 0) {
      count++;
      const suffix = (d.jung === 0 || d.jung === 8) ? "아" : "어"; // ㅏ/ㅗ→아, else→어
      return char + suffix + ".";
    }

    // Vowel-stem (no batchim): 뛰어나다→뛰어나, 보다→봐, 주다→줘
    if (d.jong === 0) {
      count++;
      switch (d.jung) {
        case 0: return char + ".";   // ㅏ: 나다→나, 가다→가
        case 4: return char + ".";   // ㅓ: 서다→서
        case 8: return composeKorean(d.cho, 9, 0) + ".";   // ㅗ: 보다→봐
        case 13: return composeKorean(d.cho, 14, 0) + ".";  // ㅜ: 주다→줘
        case 18: return composeKorean(d.cho, 4, 0) + ".";   // ㅡ: 쓰다→써
        case 20: return composeKorean(d.cho, 6, 0) + ".";   // ㅣ: 지다→져
        default: return char + ".";
      }
    }

    return match;
  });

  // Stage 5: Post-conversion cleanup (orphan endings + contractions)
  const CLEANUP: [RegExp, string][] = [
    [/ 하\./g, " 해."],       // "잡으려 하." → "잡으려 해."
    [/쓰어\./g, "써."],        // ㅡ탈락 contraction
    [/쓰어 /g, "써 "],
    [/쓰어,/g, "써,"],
  ];
  for (const [pattern, replacement] of CLEANUP) {
    result = result.replace(pattern, () => { count++; return replacement; });
  }

  return { text: result, count };
}

const SPECULATION_PATTERNS: [RegExp, string][] = [
  [/가능성이 매우 높아/g, "거야"],
  [/가능성이 높아/g, "거야"],
  [/가능성이 더 높아/g, "거야"],
  [/가능성이 커/g, "거야"],
  [/가능성이 크지만/g, "크지만"],
  [/것이야/g, "거야"],
];

function fixSpeculation(text: string): { text: string; count: number } {
  let count = 0;
  let result = text;
  for (const [pattern, replacement] of SPECULATION_PATTERNS) {
    result = result.replace(pattern, () => { count++; return replacement; });
  }
  // '수 있어' → '거야' (verb stem preserved, '수 있지'/'수 있는' 제외)
  result = result.replace(/([가-힣]+)\s*수 있어(?=[.,\s]|$)/g, (_, stem) => {
    count++;
    return `${stem} 거야`;
  });
  return { text: result, count };
}

// ─── futureOutlook 전용: 사주 용어 강제 제거 ─────

const SAJU_STRIP_PATTERNS: [RegExp, string][] = [
  // 1. 한자 괄호 병기 모두 제거: (偏財), (建祿), (傷官), （乙卯）등
  [/[（(][^\x00-\x7Fa-zA-Z0-9\uAC00-\uD7AF]+[)）]/g, ""],
  // 2. 십성 용어 (한자 제거 후 남은 것 + 원래 한글만인 것): 편재운, 정인운, 상관운 등
  [/(편재|정재|정인|편인|식신|상관|정관|편관|비견|겁재)(운)?\s*(으로|을|이|에|의|과|와|도|은|는|타고|만나면서)?\s*/g, ""],
  // 3. 12운성 관련: "12운성 건록", "12운성 양(養)지에서" 등
  [/12운성\s*[가-힣]+\s*/g, ""],
  // 4. 대운/세운 표현: "대운 X", "세운 X"
  [/(대운|세운)\s+[가-힣]{1,4}\s*/g, ""],
  // 5. 오행+과다/부족: "토 과다", "수 부족"
  [/(목|화|토|금|수)\s*(과다|부족|과잉)\s*/g, ""],
  // 6. 남은 간지 한자 직접 표기: 甲乙...壬癸 + 子丑...戌亥
  [/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g, ""],
  // 7. 기질/성향과 결합된 십성: "상관 기질", "겁재 성향" 등
  [/(편재|정재|정인|편인|식신|상관|정관|편관|비견|겁재)\s*(기질|성향|기운|체질)/g, ""],
  // 8. 한글 간지: (경술), 기유년, (갑진)년 등
  [/\s*[（(]?(?:갑|을|병|정|무|기|경|신|임|계)(?:자|축|인|묘|진|사|오|미|신|유|술|해)[)）]?\s*(?:년)?\s*/g, " "],
];

function stripSajuTermsFromFuture(text: string): { text: string; count: number } {
  let count = 0;
  let result = text;
  for (const [pattern] of SAJU_STRIP_PATTERNS) {
    result = result.replace(pattern, () => { count++; return ""; });
  }
  // 정리: 연속 공백, 문두 조사/쉼표, 빈 괄호
  result = result
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[,，]\s*/, "")
    .replace(/\(\s*\)/g, "")
    .trim();
  return { text: result, count };
}

function applyTextFixes(text: string, warnings: string[], label: string): string {
  if (!text) return text;

  const s = fixSseusro(text);
  if (s.count > 0) warnings.push(`[FIX] '스스로' ${s.count}회 치환: ${label}`);

  const sp = fixSpeculation(s.text);
  if (sp.count > 0) warnings.push(`[FIX] 추측 표현 ${sp.count}회 치환: ${label}`);

  const h = fixHonorifics(sp.text);
  if (h.count > 0) warnings.push(`[FIX] 존댓말 ${h.count}회 치환: ${label}`);

  const f = fixFormalEndings(h.text);
  if (f.count > 0) warnings.push(`[FIX] 격식체 ${f.count}회 치환: ${label}`);

  return f.text;
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

  // "수 있지만" / "수 있는" 추측 표현 탐지
  const suItjimanCount = (text.match(/수 있지만/g) || []).length;
  if (suItjimanCount > 0) {
    warnings.push(`[WARN] '수 있지만' ${suItjimanCount}회: ${label}`);
  }
  const suItneunCount = (text.match(/수 있는/g) || []).length;
  if (suItneunCount > 0) {
    warnings.push(`[WARN] '수 있는' ${suItneunCount}회: ${label}`);
  }

  // 조언/격려/처방 표현
  const advicePatterns = /맞춰주고|인정해야|노력해야|배려하면|이해하면|존중하면|조절하면|존중해주고|연습을 해야|연습이 필요|지속되려면|유지하려면|챙겨주지 않으면/g;
  let adviceMatch: RegExpExecArray | null;
  while ((adviceMatch = advicePatterns.exec(text)) !== null) {
    warnings.push(`[WARN] 조언/처방 표현: ${label} - '${adviceMatch[0]}'`);
  }

  // 미치환 격식체 탐지 (치환 후에도 남은 "X다." 패턴)
  const remaining = text.match(/[가-힣]다\./g);
  if (remaining && remaining.length > 0) {
    warnings.push(`[WARN] 미치환 격식체: ${label} — ${remaining.join(", ")}`);
  }
}

function detectLengthIssues(result: BattleLlmAnalysis, warnings: string[]): void {
  const cats = result.categoryResults;
  for (const [key, cat] of Object.entries(cats)) {
    if (cat.killingLine && cat.killingLine.length > 40) {
      warnings.push(`[WARN] killingLine 40자 초과: ${key} (${cat.killingLine.length}자)`);
    }
    if (cat.detail && cat.detail.length > 300) {
      warnings.push(`[WARN] detail 300자 초과: ${key} (${cat.detail.length}자)`);
    }
  }
}

// ─── 전역 반복 탐지 ─────────────────────────────────

function detectRepetition(result: BattleLlmAnalysis, warnings: string[]): void {
  // 모든 텍스트 필드를 합쳐서 검사
  const allTexts: string[] = [];

  // categoryResults
  for (const [, cat] of Object.entries(result.categoryResults)) {
    allTexts.push(cat.detail);
  }
  // chemistry
  allTexts.push(result.chemistry.analysis);
  allTexts.push(result.chemistry.mainScenario.analysis);
  for (const bs of result.chemistry.bonusScenarios) {
    allTexts.push(bs.analysis);
  }
  // simulations
  for (const sim of result.simulations) {
    allTexts.push(sim.reasoning);
  }
  // futureOutlook
  for (const entry of result.futureOutlook.timeline) {
    allTexts.push(entry.eventA);
    allTexts.push(entry.eventB);
    allTexts.push(entry.relationship);
  }
  // finalVerdict
  allTexts.push(result.finalVerdict.verdict);

  const combined = allTexts.join(" ");

  // 묘(墓) 모든 변형 포괄 — '묘' 글자가 사주 맥락에서 쓰이는 모든 경우
  const myoCount = (combined.match(/묘\s*\(墓\)|12운성\s*묘|일주\s*묘|묘\s*지에?\s*앉|대운\s*\(?\s*묘|묘\s*\(墓\)\s*지|운성\s*묘\s*\(|묘지\s*성향/g) || []).length;
  if (myoCount > 3) {
    warnings.push(`[WARN] 묘(墓) 전역 ${myoCount}회 반복 (상한 3회) — 변형 포함`);
  }

  // 특정 패턴 반복 체크
  const patterns: [RegExp, string][] = [
    [/편관 대운|편관운/g, "편관 대운"],
    [/토 과다/g, "토 과다"],
    [/수 과다/g, "수 과다"],
    [/감정을? (속으로 )?삭이/g, "감정 삭임"],
    [/통제하려/g, "통제하려"],
    [/눈치를? 보/g, "눈치"],
    [/편관[과\(]?[과偏]?[官官]?\)?\s*(과|와)?\s*정관[과\(]?[正]?[官]?\)?\s*(이|가)?\s*혼잡/g, "편관/정관 혼잡"],
    [/가능성이\s*(더\s*)?(높|커|크)/g, "가능성 추측"],
    [/12운성\s*[가-힣]+\s*\([가-힣]+\)\s*지?에\s*앉아/g, "12운성 X에 앉아 템플릿"],
  ];

  for (const [regex, label] of patterns) {
    const count = (combined.match(regex) || []).length;
    if (count > 3) {
      warnings.push(`[WARN] '${label}' 전역 ${count}회 반복 (상한 3회)`);
    }
  }
}

// ─── punchline/killingLine 중복 탐지 ────────────────

function detectPunchlineDuplicates(result: BattleLlmAnalysis, warnings: string[]): void {
  const allPunchlines: { label: string; text: string }[] = [];

  // killingLines
  for (const [key, cat] of Object.entries(result.categoryResults)) {
    if (cat.killingLine) allPunchlines.push({ label: `${key}.killingLine`, text: cat.killingLine });
  }
  // chemistry punchline
  if (result.chemistry.punchline) {
    allPunchlines.push({ label: "chemistry.punchline", text: result.chemistry.punchline });
  }
  // bonusScenarios punchlines
  for (let i = 0; i < result.chemistry.bonusScenarios.length; i++) {
    const p = result.chemistry.bonusScenarios[i].punchline;
    if (p) allPunchlines.push({ label: `bonusScenario[${i}].punchline`, text: p });
  }
  // simulation punchlines
  for (let i = 0; i < result.simulations.length; i++) {
    const p = result.simulations[i].punchline;
    if (p) allPunchlines.push({ label: `simulation[${i}].punchline`, text: p });
  }
  // futureOutlook, finalVerdict
  if (result.futureOutlook.punchline) {
    allPunchlines.push({ label: "futureOutlook.punchline", text: result.futureOutlook.punchline });
  }
  if (result.finalVerdict.punchline) {
    allPunchlines.push({ label: "finalVerdict.punchline", text: result.finalVerdict.punchline });
  }
  // heroQuip
  if (result.heroQuip) {
    allPunchlines.push({ label: "heroQuip", text: result.heroQuip });
  }

  // 완전 일치 또는 80%+ 포함 관계 탐지
  for (let i = 0; i < allPunchlines.length; i++) {
    for (let j = i + 1; j < allPunchlines.length; j++) {
      const a = allPunchlines[i].text;
      const b = allPunchlines[j].text;
      if (a === b) {
        warnings.push(`[WARN] punchline 완전 중복: ${allPunchlines[i].label} === ${allPunchlines[j].label}`);
      } else if (a.length > 10 && b.length > 10) {
        // 짧은 쪽이 긴 쪽에 포함되는지
        const shorter = a.length <= b.length ? a : b;
        const longer = a.length > b.length ? a : b;
        if (longer.includes(shorter)) {
          warnings.push(`[WARN] punchline 포함 중복: ${allPunchlines[i].label} ⊂ ${allPunchlines[j].label}`);
        }
      }
    }
  }
  // killingLine에 점수/숫자 차이 언급 탐지
  for (const [key, cat] of Object.entries(result.categoryResults)) {
    if (cat.killingLine && /\d+점\s*차이/.test(cat.killingLine)) {
      warnings.push(`[WARN] killingLine에 점수 차이 언급: ${key} — "${cat.killingLine}"`);
    }
    if (cat.killingLine && /이겼지만|졌지만|이긴|진/.test(cat.killingLine)) {
      warnings.push(`[WARN] killingLine에 승패 서술: ${key} — 장면이 아닌 결과 보고`);
    }
  }
}

// ─── 어미 연속 탐지 ─────────────────────────────────

function detectEndingRepetition(result: BattleLlmAnalysis, warnings: string[]): void {
  // simulation reasoning 마지막 어미 수집
  const endings: string[] = [];
  for (const sim of result.simulations) {
    if (!sim.reasoning) continue;
    const sentences = sim.reasoning.split(/[.!]\s*/).filter(s => s.trim().length > 0);
    const last = sentences[sentences.length - 1]?.trim();
    if (last) {
      // 마지막 2~3글자 추출
      const ending = last.slice(-3);
      endings.push(ending);
    }
  }

  if (endings.length >= 3) {
    const unique = new Set(endings);
    if (unique.size === 1) {
      warnings.push(`[WARN] simulation reasoning 어미 전부 동일: "${endings[0]}" (${endings.length}개)`);
    } else if (unique.size < 3 && endings.length >= 4) {
      warnings.push(`[WARN] simulation reasoning 어미 다양성 부족: ${unique.size}종류 / ${endings.length}개`);
    }
  }

  // bonusScenarios analysis 마지막 어미도 체크
  const bonusEndings: string[] = [];
  for (const bs of result.chemistry.bonusScenarios) {
    if (!bs.analysis) continue;
    const sentences = bs.analysis.split(/[.!]\s*/).filter(s => s.trim().length > 0);
    const last = sentences[sentences.length - 1]?.trim();
    if (last) bonusEndings.push(last.slice(-3));
  }

  if (bonusEndings.length >= 2 && new Set(bonusEndings).size === 1) {
    warnings.push(`[WARN] bonusScenarios 어미 전부 동일: "${bonusEndings[0]}"`);
  }
}

// ─── 시뮬레이션 주어 불일치 탐지 ────────────────────

export type SubjectVerification = {
  nameA: string;
  nameB: string;
  expectedSubjects: ("A" | "B")[];
};

function detectSubjectMismatch(
  result: BattleLlmAnalysis,
  sv: SubjectVerification,
  warnings: string[],
): void {
  const { nameA, nameB, expectedSubjects } = sv;

  for (let i = 0; i < result.simulations.length; i++) {
    const punchline = result.simulations[i].punchline;
    if (!punchline || i >= expectedSubjects.length) continue;

    const expected = expectedSubjects[i];
    const expectedName = expected === "A" ? nameA : nameB;
    const otherName = expected === "A" ? nameB : nameA;

    // punchline에서 각 이름의 첫 등장 위치
    const posExpected = punchline.indexOf(expectedName);
    const posOther = punchline.indexOf(otherName);

    // 서버 판정 이름이 아예 없고, 상대 이름만 먼저 등장하면 경고
    if (posExpected === -1 && posOther >= 0) {
      warnings.push(
        `[WARN] 시뮬레이션[${i}] 주어 불일치: 서버 판정=${expectedName} but punchline에 ${expectedName} 없음, ${otherName}만 등장`,
      );
    } else if (posExpected >= 0 && posOther >= 0 && posOther < posExpected) {
      // 상대 이름이 먼저 등장 → 주어가 뒤집혔을 가능성
      warnings.push(
        `[WARN] 시뮬레이션[${i}] 주어 의심: 서버 판정=${expectedName} but punchline에서 ${otherName}가 먼저 등장`,
      );
    }
  }
}

// ─── 재시도 판정 ────────────────────────────────────

function checkShouldRetry(result: BattleLlmAnalysis, warnings: string[]): boolean {
  // 조건 1: 묘(墓) 5회 초과
  const allTexts: string[] = [];
  for (const cat of Object.values(result.categoryResults)) {
    allTexts.push(cat.detail);
  }
  allTexts.push(result.chemistry.analysis);
  allTexts.push(result.chemistry.mainScenario.analysis);
  for (const bs of result.chemistry.bonusScenarios) {
    allTexts.push(bs.analysis);
  }
  for (const sim of result.simulations) {
    allTexts.push(sim.reasoning);
  }
  for (const entry of result.futureOutlook.timeline) {
    allTexts.push(entry.eventA);
    allTexts.push(entry.eventB);
    allTexts.push(entry.relationship);
  }
  allTexts.push(result.finalVerdict.verdict);

  const combined = allTexts.join(" ");
  const myoCount = (combined.match(/묘\s*\(墓\)|12운성\s*묘|일주\s*묘|묘\s*지에?\s*앉|대운\s*\(?\s*묘|묘\s*\(墓\)\s*지|운성\s*묘\s*\(|묘지\s*성향/g) || []).length;

  if (myoCount > 4) {
    console.warn(`[BATTLE_RETRY] 묘(墓) ${myoCount}회 — 재시도 트리거`);
    return true;
  }

  // 조건 2: 시뮬레이션 편향 (부정 패턴이 5개 이상 집중)
  if (result.simulations.length >= 5) {
    const punchlines = result.simulations.map(s => s.punchline).join(" ");
    const negativePatterns = /폭발|당해|뺏|잡아|차이고|그리워|참다|삐져|눈치|용돈제/g;
    const matches = punchlines.match(negativePatterns) || [];
    if (matches.length >= 5) {
      console.warn(`[BATTLE_RETRY] 시뮬레이션 편향 의심 (부정 패턴 ${matches.length}개) — 재시도 트리거`);
      return true;
    }
  }

  return false;
}

// ─── 메인 후처리 ────────────────────────────────────

export function postprocessBattleResult(
  result: BattleLlmAnalysis,
  subjectVerification?: SubjectVerification,
  names?: { nameA: string; nameB: string },
): {
  result: BattleLlmAnalysis;
  warnings: string[];
  shouldRetry: boolean;
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
  result.chemistry.punchline = applyTextFixes(result.chemistry.punchline, warnings, "chemistry.punchline");
  detectIssues(result.chemistry.punchline, "chemistry.punchline", warnings);

  result.chemistry.analysis = applyTextFixes(result.chemistry.analysis, warnings, "chemistry.analysis");
  detectIssues(result.chemistry.analysis, "chemistry.analysis", warnings);

  result.chemistry.mainScenario.analysis = applyTextFixes(
    result.chemistry.mainScenario.analysis, warnings, "chemistry.mainScenario",
  );
  detectIssues(result.chemistry.mainScenario.analysis, "chemistry.mainScenario", warnings);

  for (let i = 0; i < result.chemistry.bonusScenarios.length; i++) {
    result.chemistry.bonusScenarios[i].punchline = applyTextFixes(
      result.chemistry.bonusScenarios[i].punchline, warnings, `bonusScenario[${i}].punchline`,
    );
    result.chemistry.bonusScenarios[i].analysis = applyTextFixes(
      result.chemistry.bonusScenarios[i].analysis, warnings, `bonusScenario[${i}]`,
    );
    detectIssues(result.chemistry.bonusScenarios[i].punchline, `bonusScenario[${i}].punchline`, warnings);
    detectIssues(result.chemistry.bonusScenarios[i].analysis, `bonusScenario[${i}]`, warnings);
  }

  // simulations
  for (let i = 0; i < result.simulations.length; i++) {
    result.simulations[i].punchline = applyTextFixes(
      result.simulations[i].punchline, warnings, `simulation[${i}].punchline`,
    );
    result.simulations[i].reasoning = applyTextFixes(
      result.simulations[i].reasoning, warnings, `simulation[${i}].reasoning`,
    );
    detectIssues(result.simulations[i].punchline, `simulation[${i}].punchline`, warnings);
    detectIssues(result.simulations[i].reasoning, `simulation[${i}].reasoning`, warnings);
  }

  // futureOutlook
  result.futureOutlook.punchline = applyTextFixes(result.futureOutlook.punchline, warnings, "futureOutlook.punchline");
  detectIssues(result.futureOutlook.punchline, "futureOutlook.punchline", warnings);

  // futureOutlook eventA/B 이름 교차 자동 교정 (swap)
  if (names) {
    for (const entry of result.futureOutlook.timeline) {
      const aStartsWithB = entry.eventA.startsWith(names.nameB);
      const bStartsWithA = entry.eventB.startsWith(names.nameA);
      if (aStartsWithB && bStartsWithA) {
        warnings.push(`[FIX] futureOutlook ${entry.year}년: eventA/B 이름 교차 → swap`);
        const temp = entry.eventA;
        entry.eventA = entry.eventB;
        entry.eventB = temp;
      }
    }
  }

  for (let i = 0; i < result.futureOutlook.timeline.length; i++) {
    const entry = result.futureOutlook.timeline[i];
    const prefix = `futureOutlook.timeline[${i}]`;

    // 사주 용어 강제 제거 (futureOutlook 전용)
    for (const field of ["eventA", "eventB", "relationship"] as const) {
      const stripped = stripSajuTermsFromFuture(entry[field]);
      if (stripped.count > 0) {
        warnings.push(`[FIX] 사주 용어 ${stripped.count}회 제거: ${prefix}.${field}`);
        entry[field] = stripped.text;
      }
    }

    entry.eventA = applyTextFixes(entry.eventA, warnings, `${prefix}.eventA`);
    entry.eventB = applyTextFixes(entry.eventB, warnings, `${prefix}.eventB`);
    entry.relationship = applyTextFixes(entry.relationship, warnings, `${prefix}.relationship`);
    detectIssues(entry.eventA, `${prefix}.eventA`, warnings);
    detectIssues(entry.eventB, `${prefix}.eventB`, warnings);
    detectIssues(entry.relationship, `${prefix}.relationship`, warnings);
  }

  // finalVerdict
  result.finalVerdict.punchline = applyTextFixes(result.finalVerdict.punchline, warnings, "finalVerdict.punchline");
  detectIssues(result.finalVerdict.punchline, "finalVerdict.punchline", warnings);
  result.finalVerdict.verdict = applyTextFixes(result.finalVerdict.verdict, warnings, "finalVerdict.verdict");
  detectIssues(result.finalVerdict.verdict, "finalVerdict.verdict", warnings);

  // Length checks
  detectLengthIssues(result, warnings);

  // Global pattern detection
  detectRepetition(result, warnings);
  detectPunchlineDuplicates(result, warnings);
  detectEndingRepetition(result, warnings);

  // Subject verification (탐지만, 자동 수정 안 함)
  if (subjectVerification) {
    detectSubjectMismatch(result, subjectVerification, warnings);
  }

  // mood 다양성 체크 — 전부 같은 방향이면 경고
  const moods = result.futureOutlook.timeline.map(e => e.mood);
  const uniqueMoods = new Set(moods);
  if (uniqueMoods.size === 1 && moods.length >= 3) {
    warnings.push(`[WARN] futureOutlook mood 전부 "${moods[0]}" — 다양성 부족`);
  }

  // 재시도 판정
  const shouldRetry = checkShouldRetry(result, warnings);

  return { result, warnings, shouldRetry };
}
