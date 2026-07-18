// 재물운 심층 검사 — 품질 가드(후처리)
// lib/marriage-postprocess.ts 구조 미러 — 재귀 스크럽(중첩 문자열 전부, advice/최상위만이 아니라)을
// 그대로 유지한다. 결혼운 리뷰에서 확정된 FIXED 버전(2026-07-18)을 그대로 상속.
// 설계 근거: docs/superpowers/specs/2026-07-18-wealth-luck-test-design.md §6 + §10(Fable 안전장치)

// 숙명론·공포·서열화 금지 (§6-1, §10 "재물 안전장치").
// "재다신약"은 여기서 컷하지 않는다 — 그 자체는 유효한 진단이고, 프롬프트가 "그릇·관리가 관건"으로
// 재해석하도록 강제한다(lib/wealth-prompt.ts 절대 규칙 3-2). 여기서 잡는 건 그 재해석을 무시하고
// LLM이 새어버린 낙인 문장이다.
const FORBIDDEN_PREDICTIONS = [
  /가난할\s*팔자/,
  /거지\s*사주/,
  /돈복(이|은|도)?\s*없/,
  /평생\s*(돈|재물).{0,4}(못|없)/,
  /쪽박/,
  /파산할\s*(팔자|운명)/,
  /반드시\s*(손해|이득|대박|입재)/,
  /무조건\s*(대박|망|손해)/,
];

// 결혼운과 동일 금지 리스트 계승(스펙 §3 "신살 정책" — 근거 얇은 흉살·공포성 신살은 도메인 무관하게
// 영구 배제). 재물운 콘텐츠에도 이 신살들이 등장할 이유가 없다(엔진이 애초에 산출하지 않음) — 만에
// 하나 LLM이 학습 데이터에서 끌어와도 여기서 스크럽한다.
const FORBIDDEN_SHINSAL = [/과숙살/, /고신살/, /상부살/, /홍란/, /천희/];

// 재무자문 스크럽 (§6-4, §10 "재무자문 아님" — 법적 선긋기는 LLM 재량이 아니라 결정론 후처리로).
// 종목/코인/부동산/금융상품명 + "사라/투자/매수/추천" 패턴이 같은 문장에 함께 나오면 그 문장을 컷한다.
const FINANCIAL_ADVICE_PATTERN =
  /(주식|코인|비트코인|이더리움|부동산|아파트|펀드|ETF|채권|금\s?현물).{0,10}(사|투자|매수|추천)/;

export interface WealthGuardResult {
  blocks: any;
  violations: string[];
}

export function applyWealthGuards(parsed: any, _facts: any, _primarySummary: string): WealthGuardResult {
  const violations: string[] = [];
  const blocks = JSON.parse(JSON.stringify(parsed ?? {}));

  // 1) 조언: 근거 태그 필수 + 단정 예언/재무자문이 있는 항목은 통째로 컷 (원문 기준 판정)
  if (Array.isArray(blocks.advice)) {
    blocks.advice = blocks.advice.filter((a: any) => {
      const text = String(a?.text ?? "");
      if (FORBIDDEN_PREDICTIONS.some((re) => re.test(text))) {
        violations.push(`단정 예언 제거: ${text.slice(0, 20)}`);
        return false;
      }
      if (FINANCIAL_ADVICE_PATTERN.test(text)) {
        violations.push(`재무자문 제거: ${text.slice(0, 20)}`);
        return false;
      }
      if (!a?.tag || !/\[근거:.+\]/.test(a.tag)) {
        violations.push(`근거태그 없음 컷: ${text.slice(0, 20)}`);
        return false;
      }
      return true;
    });
  }

  // 2) 금지 신살 언급 스크럽 (부분 문자열 제거)
  const scrubShinsal = (s: string): string => {
    let out = s;
    for (const re of FORBIDDEN_SHINSAL) {
      if (re.test(out)) {
        violations.push(`금지신살: ${re}`);
        out = out.replace(new RegExp(re.source, "g"), "").replace(/\s{2,}/g, " ").trim();
      }
    }
    return out;
  };

  // 3) 단정 예언 + 재무자문: 줄바꿈 + 문장부호 단위로 쪼개서, 문제되는 줄/문장만 제거 (나머지는 보존)
  const scrubForbiddenSentences = (s: string, label: string): string => {
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
        if (FINANCIAL_ADVICE_PATTERN.test(sent)) {
          violations.push(`재무자문 제거(${label})`);
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
      return scrubForbiddenSentences(afterShinsal, label);
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
