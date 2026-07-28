import { collapseEchoParens, makeScrubGradeAlpha, makeScrubGripTerms, scrubHanja, scrubStrayDecimals } from "./report-scrub";
// 커리어운 심층 검사 — 품질 가드(후처리)
// lib/wealth-postprocess.ts(main) 구조 미러 — 재귀 스크럽(중첩 문자열 전부) 그대로 유지.
// 십성 축만 커리어로 치환하고, 재무자문 스크럽 자리에 "인생 중대 결정 실행 단정" 스크럽을 둔다.
// 설계 근거: docs/plans/2026-07-20-career-luck-design.md §Phase 3

// 숙명론·공포·서열화 + 성사·실패 단정 금지 (프롬프트 절대 규칙 3·4의 결정론 2차 방어).
// "관다신약/상관견관/무관"은 여기서 컷하지 않는다 — 유효한 진단이고 프롬프트가 재해석을 강제한다.
// 여기서 잡는 건 그 재해석을 무시하고 새어버린 낙인·단정 문장이다.
const FORBIDDEN_PREDICTIONS = [
  /잘린다|잘릴|짤린|짤릴|해고|퇴출/,
  /좌천/,
  /승진.{0,6}(못|안\s*된|안\s*돼|불가)/,
  /(승진|출세).{0,4}(못할|못\s*할)\s*팔자/,
  /(백수|무능|무직).{0,4}(팔자|사주)/,
  /조직생활.{0,6}(못|안\s*된|안\s*돼)/,
  /조직.{0,8}(못\s*붙|안\s*붙|못\s*버티|못\s*견디)/,
  /(사업|창업|장사).{0,6}(망한|망해|망할)/,
  /(리더|관리자).{0,4}(못\s*된|못된|안\s*된|무리)/,
  /평생\s*(승진|출세|성공).{0,4}(못|없)/,
  /직장운.{0,5}(없|약[하한해]|부족)/,
  // 절대 규칙 4 성사·실패 단정
  /반드시\s*(승진|합격|성공|잘\s*된)/,
  /무조건\s*(승진|합격|성공|잘\s*된|피[하해])/,
  /분명\s*(잘린|해고|승진|합격|실패)/,
  /번아웃.{0,3}(온다|와|올\s*거|불가피|피할\s*수\s*없)/,
  // 과장 단정
  /(무조건|반드시)\s*(성공|출세|대성)/,
  // ── Fable 검수(2026-07-21) 실측 누출 성사보장 — FORBIDDEN이 못 잡던 변형 ──
  /(반드시|무조건|꼭)\s*(따라오|따라온|따라올|이어진|이어질|열린다|열릴)/, // "명예·직함은 반드시 따라오는"
  /절대\s*(지나치|놓치|비껴|피해\s*가|외면하)/, // "기회는 너를 절대 지나치지 않아"
  /(제안|기회|자리|러브콜).{0,12}(쏟아진|쏟아질|밀려온|밀려올|넘쳐난|넘쳐날)/, // "제안이 여기저기서 쏟아질 거야"
];

// 인생 중대 결정(퇴사·이직·창업)의 실행을 "당장/지금/무조건" 단정 지시하는 문장(절대 규칙 5).
// 재물운의 FINANCIAL_ADVICE 자리 — 커리어는 실행 단정이 손익 단정보다 신뢰 리스크가 크다.
const EXECUTION_DIRECTIVE =
  /((당장|지금)\s*(회사\s*)?(그만둬|그만두|퇴사|사표)|(무조건|당장|지금|반드시|꼭)\s*(이직|창업)\s*(해|하)|그만둬라|그만두라|(창업|이직|퇴사)\s*해라|사표\s*(내|던져|써))/;

// EXECUTION_DIRECTIVE 오탐 방지: "그만두라는 뜻이 아니야", "그만두지 마" 같은 안심 문장은 실제
// 지시가 아니다. bare /아니/·/마/는 역방향 구멍이라 쓰지 않고, 실행 동사에 인접한 부정형만 한정한다.
const EXECUTION_NEGATION =
  /((그만두|이직하|창업하|퇴사하)(라는|란)\s*(뜻|말|건|게|소리)?\s*(은|이)?\s*아니|(그만두|이직하|창업하|퇴사하)지\s*마|그만둘\s*필요\s*(는)?\s*없|서두르지\s*마)/;

const isExecutionDirective = (text: string): boolean =>
  EXECUTION_DIRECTIVE.test(text) && !EXECUTION_NEGATION.test(text);

// 근거 얇은 흉살·공포성 신살 영구 배제(재물운·결혼운 계승) + 일주 파생 fabrication 신살.
// ★커리어 특별: 괴강살·장성살·학당귀인은 개인사주 채점엔 있지만 커리어 facts엔 없다 — LLM이
// "괴강이라 리더십" 류로 가장 끌어오고 싶어 하는 함정(프롬프트 규칙 1이 1차 방어, 여기가 2차망).
const FORBIDDEN_SHINSAL = [
  /과숙살/, /고신살/, /상부살/, /홍란/, /천희/,
  /괴강살/, /백호살/, /양인살/, /장성살/, /학당귀인/, /학당/,
];

// 그릇 4상한 용어 본문 노출 방지(프롬프트 규칙 1 위반 누출 2차망, Fable 검수 2026-07-21).
// 문장 컷이 아니라 용어만 중립어로 치환 — 재해석 문장 전체가 날아가지 않게. "관다신약처럼 ~"
// 비교 서열화도 함께 잡힌다.
const GRIP_TERMS = /신왕관왕|신왕관쇠|관다신약|신약관소|신약관다/g;
// teaser 등급 알파벳 노출 방지(유료 전 스포일러+서열화). "S등급다운/S등급의" 접미까지 제거.

export interface CareerGuardResult {
  blocks: any;
  violations: string[];
}

// F-2: Gemini 출력이 필수 블록을 다 채웠는지 검증. ★gradeHeadline minLen은 8 — 결혼운/재물운의
// 80을 복사하면 "35자 이내 한 문장" 정상 출력이 전부 반려되는 포팅 함정(889b83d F-2, 절대 8 금지 아님 8 유지).
const REQUIRED_TEXT_BLOCKS: Array<[string, number]> = [
  ["teaserSummary", 10], ["gradeHeadline", 8], ["gwanseongDiagnosis", 80],
  ["careerGripDiagnosis", 80], ["workStyle", 80], ["riskAndPace", 80],
  ["timingFlow", 80], ["yearlyCta", 30],
];

export function validateCareerBlocks(parsed: any, opts?: { minAdvice?: number }): string[] {
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


export function applyCareerGuards(parsed: any, _facts: any, _primarySummary: string): CareerGuardResult {
  const violations: string[] = [];
  const blocks = JSON.parse(JSON.stringify(parsed ?? {}));

  // 1) 조언: 근거 태그 필수 + 단정 예언/실행 단정이 있는 항목은 통째로 컷 (원문 기준 판정)
  if (Array.isArray(blocks.advice)) {
    blocks.advice = blocks.advice.filter((a: any) => {
      const text = String(a?.text ?? "");
      const hit = FORBIDDEN_PREDICTIONS.find((re) => re.test(text));
      if (hit) {
        violations.push(`단정 예언 제거: ${text.slice(0, 20)} /${hit.source}/`);
        return false;
      }
      if (isExecutionDirective(text)) {
        violations.push(`실행 단정 제거: ${text.slice(0, 20)}`);
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

  // 3) 단정 예언 + 실행 단정: 줄바꿈 + 문장부호 단위로 쪼개 문제 문장만 제거(나머지 보존)
  const scrubForbiddenSentences = (s: string, label: string): string => {
    const lines = s.split(/\r?\n/);
    const keptLines: string[] = [];
    for (const line of lines) {
      const sentences = line.split(/(?<=[.!?。])\s+/);
      const allBlank = sentences.every((sent) => sent.trim() === "");
      const keptSentences = sentences.filter((sent) => {
        if (sent.trim() === "") return true;
        const hit = FORBIDDEN_PREDICTIONS.find((re) => re.test(sent));
        if (hit) {
          violations.push(`단정 예언 제거(${label}): /${hit.source}/`);
          return false;
        }
        if (isExecutionDirective(sent)) {
          violations.push(`실행 단정 제거(${label})`);
          return false;
        }
        return true;
      });
      const rejoined = keptSentences.join(" ").replace(/\s{2,}/g, " ").trim();
      if (rejoined !== "" || allBlank) keptLines.push(rejoined);
    }
    return keptLines.join("\n").trim();
  };

  // scrubHanja·collapseEchoParens·scrubStrayDecimals 는 순수 함수라 공용 모듈에서 직접 쓴다.
  // violations 를 닫아야 하는 것만 팩토리로 만든다. → lib/report-scrub.ts
  const scrubGripTerms = makeScrubGripTerms(GRIP_TERMS, violations);
  const scrubGradeAlpha = makeScrubGradeAlpha(violations);

  // 4) 위 스크럽들을 blocks 전체(배열/객체 중첩 어디든)에 재귀 적용.
  // ★advice[].tag(라벨이 .tag로 끝남)에는 GRIP/GRADE 스크럽을 적용하지 않는다 — 프롬프트 tag
  //  예시(`[근거:관다신약]`)와 자기모순으로 정상 태그가 매번 "[근거:이런 구조]"로 변형돼 상시
  //  violation·불필요 재생성을 유발하던 결함(2026-07-21). 신살·한자·단정예언 스크럽은 tag에도 유지.
  const walk = (o: any, label: string): any => {
    if (typeof o === "string") {
      const isTag = label.endsWith(".tag");
      const afterShinsal = isTag ? scrubShinsal(o) : scrubGradeAlpha(scrubGripTerms(scrubShinsal(o)));
      const afterHanja = scrubStrayDecimals(collapseEchoParens(scrubHanja(afterShinsal)));
      return scrubForbiddenSentences(afterHanja, label);
    }
    if (Array.isArray(o)) return o.map((item, idx) => walk(item, `${label}[${idx}]`));
    if (o && typeof o === "object") {
      for (const k of Object.keys(o)) o[k] = walk(o[k], label ? `${label}.${k}` : k);
      return o;
    }
    return o;
  };
  walk(blocks, "");

  // 5) walk 스크럽 후 advice 재검증 — 스크럽이 text/tag를 비웠으면 항목 통째 컷(빈 근거태그 출고 방지).
  // step 1의 원문 기준 필터는 유지(스크럽으로 위반이 가려진 항목을 살리지 않으려는 의도)하고, 여기서
  // 스크럽 부작용(빈 태그)만 잡는다. violation이 찍혀 qa-regen 1회 재생성 유도 → 정상 태그면 무손실.
  if (Array.isArray(blocks.advice)) {
    blocks.advice = blocks.advice.filter((a: any) => {
      const ok =
        typeof a?.text === "string" && a.text.trim().length >= 10 &&
        typeof a?.tag === "string" && /\[근거:.+\]/.test(a.tag);
      if (!ok) violations.push(`스크럽 후 조언 재검증 컷: ${String(a?.text ?? "").slice(0, 20)}`);
      return ok;
    });
  }

  return { blocks, violations };
}

// 총량 soft 하한 — "채워졌지만 얇은" 리포트를 QA 재생성 루프로 한 번 더 쓰게 만든다.
// 분량은 재료(궁위·타이밍)로만 늘린다. 최종 출고는 막지 않는다(환불 사유 아님).
const CAREER_PROSE_KEYS = ["gwanseongDiagnosis", "careerGripDiagnosis", "workStyle", "riskAndPace", "timingFlow"] as const;
const CAREER_RICHNESS_MIN_TOTAL = 1900;

export function validateCareerRichness(blocks: any): string[] {
  const total = CAREER_PROSE_KEYS.reduce(
    (sum, k) => sum + (typeof blocks?.[k] === "string" ? blocks[k].trim().length : 0),
    0,
  );
  if (total >= CAREER_RICHNESS_MIN_TOTAL) return [];
  return [
    `본문 5블록 총량 부족(${total}자 < ${CAREER_RICHNESS_MIN_TOTAL}자) — 같은 말 반복·패러프레이즈로 늘리지 말고, [관성 궁위 해석]의 인생 국면 번역과 [타이밍 창]·[대운 중 관성 구간]의 구체 연도를 근거로 각 블록에 새 정보를 1~2문장씩 추가하라. 재미 기법(생생한 비유·펀치라인)도 아직 얇은 블록에 더 얹어라`,
  ];
}
