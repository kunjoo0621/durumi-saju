const FORBIDDEN_PREDICTIONS = [/이혼수?/, /사별/, /외도/, /바람(을|이|날)/, /혼자 늙/, /팔자가 세/];
const FORBIDDEN_SHINSAL = [/과숙살/, /고신살/, /상부살/, /홍란/, /천희/];

export interface MarriageGuardResult { blocks: any; violations: string[]; }

export function applyMarriageGuards(parsed: any, facts: any, _primarySummary: string): MarriageGuardResult {
  const violations: string[] = [];
  const blocks = JSON.parse(JSON.stringify(parsed ?? {}));

  // 1) 금지 신살 언급 스크럽 (모든 문자열 필드)
  const scrub = (s: string): string => {
    let out = s;
    for (const re of FORBIDDEN_SHINSAL) {
      if (re.test(out)) { violations.push(`금지신살: ${re}`); out = out.replace(new RegExp(re.source, "g"), "").replace(/\s{2,}/g, " ").trim(); }
    }
    return out;
  };
  const walk = (o: any) => {
    if (typeof o === "string") return scrub(o);
    if (Array.isArray(o)) return o.map(walk);
    if (o && typeof o === "object") { for (const k of Object.keys(o)) o[k] = walk(o[k]); return o; }
    return o;
  };
  walk(blocks);

  // 2) 조언: 근거 태그 필수 + 단정 예언 제거
  if (Array.isArray(blocks.advice)) {
    blocks.advice = blocks.advice.filter((a: any) => {
      const text = String(a?.text ?? "");
      if (FORBIDDEN_PREDICTIONS.some(re => re.test(text))) { violations.push(`단정 예언 제거: ${text.slice(0,20)}`); return false; }
      if (!a?.tag || !/\[근거:.+\]/.test(a.tag)) { violations.push(`근거태그 없음 컷: ${text.slice(0,20)}`); return false; }
      return true;
    });
  }

  // 3) 단정 예언: 일반 블록 문자열에서도 문장 제거
  for (const key of Object.keys(blocks)) {
    if (typeof blocks[key] === "string") {
      const kept = blocks[key].split(/(?<=[.!?。])\s+/).filter((sent: string) => {
        if (FORBIDDEN_PREDICTIONS.some(re => re.test(sent))) { violations.push(`단정 예언 제거(${key})`); return false; }
        return true;
      });
      blocks[key] = kept.join(" ").trim();
    }
  }

  return { blocks, violations };
}
