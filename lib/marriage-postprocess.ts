// 단정 예언 금지어 — 문장 단위로만 컷하므로(scrubForbiddenPredictions) 긍정 맥락 문장은
// 안전하다. 예: "이별의 아픔을 딛고"는 /이별수/에 안 걸린다. 결측/빈 블록은 F-2가 후단에서 잡는다.
const FORBIDDEN_PREDICTIONS = [
  /이혼수?/, /사별/, /외도/, /바람(을|이|날)/, /혼자 늙/, /팔자가 세/,
  /이별수/, /곧\s*헤어/, /헤어질\s*(수|운명|팔자)/, /파혼/, /갈라서|갈라설/, /재혼/,
  /결혼\s*운이?\s*없/, /불임/, /자식\s*(이|은|을)?\s*없/, /자식\s*복이?\s*없/,
  /바람\s*(기|피)/, /과부/, /독수공방/, /(일찍|먼저)\s*(떠나|떠날|여의)/,
];
// 괴강살·백호살·양인살은 일주/일지만 보면 계산 가능해 보여 LLM이 학습 데이터에서 끌어와 지어내기 쉬운
// 일주 파생 신살이다(프롬프트 절대 규칙 1이 1차 방어). 여기선 그 누수를 잡는 2차 안전망.
const FORBIDDEN_SHINSAL = [/과숙살/, /고신살/, /상부살/, /홍란/, /천희/, /괴강살/, /백호살/, /양인살/];

export interface MarriageGuardResult { blocks: any; violations: string[]; }

// F-2: Gemini 출력이 필수 블록을 다 채웠는지 검증. 가드가 문장을 스크럽한 뒤 빈 블록이 남는
// 경우(무료 리포트 취약점)와 모델이 스키마를 어긴 경우를 잡는다. 이슈 배열이 비면 통과.
const REQUIRED_TEXT_BLOCKS: Array<[string, number]> = [
  // gradeHeadline은 35자 이내 짧은 한 문장(재물운과 통일) → 최소길이는 "빈칸 감지" 바닥만(8자).
  ["teaserSummary", 10], ["gradeHeadline", 8], ["spousePalace", 80], ["spouseStar", 80],
  ["partnerProfile", 80], ["relationshipPattern", 80], ["timingFlow", 80], ["gunghapCta", 30],
];

export function validateMarriageBlocks(parsed: any, opts?: { minAdvice?: number }): string[] {
  const minAdvice = opts?.minAdvice ?? 2;
  const issues: string[] = [];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return ["루트가 객체 아님"];
  for (const [key, minLen] of REQUIRED_TEXT_BLOCKS) {
    const v = parsed[key];
    if (typeof v !== "string" || v.trim().length < minLen) issues.push(`${key} 누락/부족(<${minLen}자)`);
  }
  const advice = parsed.advice;
  if (!Array.isArray(advice)) issues.push("advice 배열 아님");
  else {
    const valid = advice.filter((a: any) => typeof a?.text === "string" && a.text.trim().length >= 10 && typeof a?.tag === "string");
    if (valid.length < minAdvice) issues.push(`advice 유효 항목 ${valid.length} < ${minAdvice}`);
  }
  return issues;
}

export function applyMarriageGuards(parsed: any, facts: any, _primarySummary: string): MarriageGuardResult {
  const violations: string[] = [];
  const blocks = JSON.parse(JSON.stringify(parsed ?? {}));

  // 1) 조언: 근거 태그 필수 + 단정 예언이 있는 항목은 통째로 컷 (원문 기준 판정)
  if (Array.isArray(blocks.advice)) {
    blocks.advice = blocks.advice.filter((a: any) => {
      const text = String(a?.text ?? "");
      if (FORBIDDEN_PREDICTIONS.some(re => re.test(text))) { violations.push(`단정 예언 제거: ${text.slice(0,20)}`); return false; }
      if (!a?.tag || !/\[근거:.+\]/.test(a.tag)) { violations.push(`근거태그 없음 컷: ${text.slice(0,20)}`); return false; }
      return true;
    });
  }

  // 2) 금지 신살 언급 스크럽 (부분 문자열 제거)
  const scrubShinsal = (s: string): string => {
    let out = s;
    for (const re of FORBIDDEN_SHINSAL) {
      if (re.test(out)) { violations.push(`금지신살: ${re}`); out = out.replace(new RegExp(re.source, "g"), "").replace(/\s{2,}/g, " ").trim(); }
    }
    return out;
  };

  // 3) 단정 예언: 줄바꿈 + 문장부호 단위로 쪼개서, 문제되는 줄/문장만 제거 (나머지는 보존)
  const scrubForbiddenPredictions = (s: string, label: string): string => {
    const lines = s.split(/\r?\n/);
    const keptLines: string[] = [];
    for (const line of lines) {
      const sentences = line.split(/(?<=[.!?。])\s+/);
      const allBlank = sentences.every((sent) => sent.trim() === "");
      const keptSentences = sentences.filter((sent) => {
        if (sent.trim() === "") return true;
        if (FORBIDDEN_PREDICTIONS.some((re) => re.test(sent))) {
          violations.push(`단정 예언 제거(${label})`);
          return false;
        }
        return true;
      });
      const rejoined = keptSentences.join(" ").replace(/\s{2,}/g, " ").trim();
      if (rejoined !== "" || allBlank) keptLines.push(rejoined);
    }
    return keptLines.join("\n").trim();
  };

  // 4) 위 두 스크럽을 blocks 전체(배열/객체 어디에 중첩돼 있든)에 재귀 적용
  const walk = (o: any, label: string): any => {
    if (typeof o === "string") {
      const afterShinsal = scrubShinsal(o);
      return scrubForbiddenPredictions(afterShinsal, label);
    }
    if (Array.isArray(o)) return o.map((item, idx) => walk(item, `${label}[${idx}]`));
    if (o && typeof o === "object") {
      for (const k of Object.keys(o)) o[k] = walk(o[k], label ? `${label}.${k}` : k);
      return o;
    }
    return o;
  };
  walk(blocks, "");

  return { blocks, violations };
}
