/**
 * Quality Gate — 품질 검증 파이프라인
 *
 * 개인 사주 + 배틀 결과를 DB에 저장하기 전에 품질 이슈를 감지.
 * 현재 단계: 로그만 찍고 저장은 차단하지 않음.
 */

export interface QualityIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  details?: string;
}

// ─── 공통 유틸 ──────────────────────────────────────

function detectStructuralRepetition(
  texts: string[],
  sectionLabels: string[],
): { phrase: string; count: number; sections: string[] }[] {
  const issues: { phrase: string; count: number; sections: string[] }[] = [];

  // NOTE: 묘(墓) 관련은 postprocess의 limitMyoMb()가 이미 ≤2회로 자동수정.
  //       여기서는 안전망으로만 유지 (postprocess 우회 시 감지용).
  const patterns = [
    { regex: /묘\(墓\)(?:지)?에\s*앉[아은]/g, label: "묘(墓)에 앉아" },
    { regex: /(?:제압|압도|누르는)\s*구조/g, label: "~제압/압도 구조" },
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

function detectTitleRepetition(
  sections: { title: string }[],
): string[] {
  const issues: string[] = [];
  const titleWords = sections.map((s) =>
    s.title
      .replace(/[,.\s·~!?]/g, " ")
      .split(" ")
      .filter((w) => w.length >= 2),
  );

  const wordToTitles = new Map<string, number>();
  titleWords.forEach((words) => {
    const unique = new Set(words);
    unique.forEach((w) => {
      wordToTitles.set(w, (wordToTitles.get(w) || 0) + 1);
    });
  });

  for (const [word, count] of wordToTitles) {
    if (count >= 3 && word.length >= 2) {
      issues.push(`타이틀 키워드 "${word}"가 ${count}개 섹션에서 반복`);
    }
  }

  return issues;
}

function detectSimulationCopypaste(
  simulations: { question: string; reasoning: string }[],
): string[] {
  const issues: string[] = [];

  const lastSentences = simulations.map((s) => {
    const sentences = s.reasoning
      .split(/[.!?\n]/)
      .filter((x) => x.trim().length > 5);
    return sentences[sentences.length - 1]?.trim() || "";
  });

  for (let i = 0; i < lastSentences.length; i++) {
    for (let j = i + 1; j < lastSentences.length; j++) {
      if (lastSentences[i] && lastSentences[i] === lastSentences[j]) {
        issues.push(
          `시뮬레이션 "${simulations[i].question}" ↔ "${simulations[j].question}" 마지막 문장 동일: "${lastSentences[i]}"`,
        );
      }
    }
  }

  for (let i = 0; i < simulations.length; i++) {
    for (let j = i + 1; j < simulations.length; j++) {
      const a = simulations[i].reasoning;
      const b = simulations[j].reasoning;
      const shorter = Math.min(a.length, b.length);
      if (shorter < 20) continue;

      let matches = 0;
      for (let k = 0; k < shorter; k++) {
        if (a[k] === b[k]) matches++;
      }
      const similarity = matches / shorter;
      if (similarity > 0.6) {
        issues.push(
          `시뮬레이션 "${simulations[i].question}" ↔ "${simulations[j].question}" 유사도 ${(similarity * 100).toFixed(0)}%`,
        );
      }
    }
  }

  return issues;
}

// ─── 개인 사주 검증 ──────────────────────────────────

export function validatePersonalResult(result: any): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const allTexts: string[] = [];
  const allLabels: string[] = [];

  if (result.sections && Array.isArray(result.sections)) {
    result.sections.forEach((s: any) => {
      allTexts.push(`${s.title || ""} ${s.content || ""}`);
      allLabels.push(s.title || "unknown");
    });
  }

  // 1. 구조적 반복 검사
  const repetitions = detectStructuralRepetition(allTexts, allLabels);
  for (const rep of repetitions) {
    issues.push({
      severity: rep.count >= 5 ? "error" : "warning",
      code: "REPETITION",
      message: `"${rep.phrase}" ${rep.count}회 반복`,
      details: `섹션: ${rep.sections.join(", ")}`,
    });
  }

  // 2. 타이틀 중복 검사
  if (result.sections) {
    const titleIssues = detectTitleRepetition(result.sections);
    for (const msg of titleIssues) {
      issues.push({
        severity: "error",
        code: "TITLE_REPEAT",
        message: msg,
      });
    }
  }

  // 3. 문어체 잔존 검사
  const formalPatterns = [/부른다/, /것이다/, /있다\./, /없다\./, /한다\./];
  for (let i = 0; i < allTexts.length; i++) {
    for (const pat of formalPatterns) {
      if (pat.test(allTexts[i])) {
        issues.push({
          severity: "warning",
          code: "FORMAL_TONE",
          message: `"${pat.source}" 문어체 잔존`,
          details: `섹션: ${allLabels[i]}`,
        });
      }
    }
  }

  // 4. "~해봐" 잔존 검사
  for (let i = 0; i < allTexts.length; i++) {
    if (/해봐/.test(allTexts[i])) {
      issues.push({
        severity: "warning",
        code: "HAEBWA",
        message: `"~해봐" 패턴 잔존`,
        details: `섹션: ${allLabels[i]}`,
      });
    }
  }

  return issues;
}

// ─── 배틀 검증 ──────────────────────────────────────

export function validateBattleResult(result: any): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const allTexts: string[] = [];
  const allLabels: string[] = [];

  // 카테고리 텍스트 수집
  if (result.categoryResults) {
    for (const [cat, data] of Object.entries(result.categoryResults)) {
      const d = data as any;
      allTexts.push(`${d.killingLine || ""} ${d.detail || ""}`);
      allLabels.push(`카테고리:${cat}`);
    }
  }

  // chemistry 텍스트 수집
  if (result.chemistry) {
    allTexts.push(
      `${result.chemistry.punchline || ""} ${result.chemistry.analysis || ""}`,
    );
    allLabels.push("상성진단");
    if (result.chemistry.bonusScenarios) {
      result.chemistry.bonusScenarios.forEach((s: any) => {
        allTexts.push(`${s.punchline || ""} ${s.analysis || ""}`);
        allLabels.push(`보너스:${s.label}`);
      });
    }
  }

  // 시뮬레이션 텍스트 수집
  if (result.simulations) {
    result.simulations.forEach((s: any) => {
      allTexts.push(`${s.punchline || ""} ${s.reasoning || ""}`);
      allLabels.push(`시뮬:${s.question}`);
    });
  }

  // 미래예측, 최종심판
  if (result.futureOutlook) {
    const fo = result.futureOutlook;
    const timelineText = Array.isArray(fo.timeline)
      ? fo.timeline
          .map((e: any) => `${e.eventA || ""} ${e.eventB || ""} ${e.relationship || ""}`)
          .join(" ")
      : `${fo.nextYear || ""} ${fo.threeYears || ""} ${fo.fiveYears || ""}`;
    allTexts.push(`${fo.punchline || ""} ${timelineText}`);
    allLabels.push("미래예측");
  }
  if (result.finalVerdict) {
    allTexts.push(
      `${result.finalVerdict.punchline || ""} ${result.finalVerdict.verdict || ""}`,
    );
    allLabels.push("최종심판");
  }

  // 1. 구조적 반복 검사
  const repetitions = detectStructuralRepetition(allTexts, allLabels);
  for (const rep of repetitions) {
    issues.push({
      severity: rep.count >= 5 ? "error" : "warning",
      code: "REPETITION",
      message: `"${rep.phrase}" ${rep.count}회 반복`,
      details: `섹션: ${rep.sections.join(", ")}`,
    });
  }

  // 2. 시뮬레이션 복붙 검사
  if (result.simulations && result.simulations.length > 1) {
    const copyIssues = detectSimulationCopypaste(result.simulations);
    for (const msg of copyIssues) {
      issues.push({
        severity: "error",
        code: "SIM_COPYPASTE",
        message: msg,
      });
    }
  }

  // 3. 카테고리 detail 패턴화 검사
  if (result.categoryResults) {
    const details = Object.values(result.categoryResults).map(
      (d: any) => d.detail || "",
    );
    const structureEnding = details.filter((d) =>
      /구조야[.\s]*$/.test(d.trim()),
    );
    if (structureEnding.length >= 3) {
      issues.push({
        severity: "error",
        code: "DETAIL_PATTERN",
        message: `${structureEnding.length}개 카테고리 detail이 "~구조야"로 끝남 (패턴화)`,
      });
    }
  }

  return issues;
}
