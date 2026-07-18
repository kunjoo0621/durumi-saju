const FORBIDDEN_PREDICTIONS = [/이혼수?/, /사별/, /외도/, /바람(을|이|날)/, /혼자 늙/, /팔자가 세/];
const FORBIDDEN_SHINSAL = [/과숙살/, /고신살/, /상부살/, /홍란/, /천희/];

export interface MarriageGuardResult { blocks: any; violations: string[]; }

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
