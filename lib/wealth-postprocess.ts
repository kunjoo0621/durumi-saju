import { findAdviceEchoes, findProminenceFabrications, findTimingFabrications } from "./report-fact-guard";
import { collapseEchoParens, makeScrubGradeAlpha, makeScrubGripTerms, scrubHanja, scrubStrayDecimals } from "./report-scrub";
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
  /무조건\s*(대박|망|손해|이득|이익)/,
  // §10 프롬프트 절대 규칙 3-2 금지 예시("재물운이 없는 사주예요" / "재물운이 약하다") 커버.
  // '약[하한해]'로 활용형('약한 사주')까지 잡는다 — '약하'만으론 '약한'이 새던 구멍 보강.
  /재물운.{0,5}(없|약[하한해]|부족)/,
  // §10 절대 규칙 4 금지 예시("2027년에 반드시 큰돈이 들어옵니다") 커버 — 이익 단정
  /반드시\s*(큰돈|재물|돈).{0,6}(들어|생기|들어와|온다|옵니)/,
  // §10 절대 규칙 4 금지 예시("그 해엔 분명 손해를 봅니다") 커버 — 손익 단정
  /분명\s*(손해|이득|대박|손실)/,
  // ── 2026-07-18 검증 probe에서 통과 확인된 구멍 보강 (문장단위 컷이라 안전) ──
  /(돈|재물).{0,4}잃(을|는)\s*팔자/, // "돈 잃을 팔자"
  /파산/, // "파산한다" 등 활용형 전부(리포트에 '파산'이 정당하게 등장할 맥락 없음)
  /빚더미/,
  /대박\s*(난다|날|나|터진다|터질)/, // 단정형 대박
  /떼돈/,
  /(손실|손해).{0,4}확정|확정된\s*(손실|손해)/, // "손실 확정"
  /큰돈이?\s*(들어온다|들어와|굴러)/, // 단정형 입재("들어올 수 있어"는 미매치 — 허용 프레임 보존)
  /가난(을|에서)?.{0,6}(못\s*벗어|벗어나지\s*못)/, // "가난을 못 벗어나"
  /(망한다|망해|망할)/, // "동업하면 망해"
  /로또/,
  /도박/,
  /(재물복|금전복)(이|은|도)?\s*없/, // 돈복은 기존 커버, 변형 보강
  // ── 긍정 성사단정(2026-07-21 실측 누출) — 손해 방향만 잡고 이익 보장이 새던 구멍 보강 ──
  /(돈|재물|기회|큰돈).{0,12}(쏟아진|쏟아질|밀려온|밀려올|넘쳐난|넘쳐날)/, // "기회가 쏟아질 거야"
  /절대\s*(잃|새|손해\s*보)지\s*않/,
];

// 결혼운과 동일 금지 리스트 계승(스펙 §3 "신살 정책" — 근거 얇은 흉살·공포성 신살은 도메인 무관하게
// 영구 배제). 재물운 콘텐츠에도 이 신살들이 등장할 이유가 없다(엔진이 애초에 산출하지 않음) — 만에
// 하나 LLM이 학습 데이터에서 끌어와도 여기서 스크럽한다.
// 괴강살·백호살·양인살은 일주/일지만 보면 계산 가능해 보여 LLM이 학습 데이터에서 끌어와 지어내기 쉬운
// 일주 파생 신살이다(프롬프트 절대 규칙 1이 1차 방어). 여기선 그 누수를 잡는 2차 안전망.
const FORBIDDEN_SHINSAL = [/과숙살/, /고신살/, /상부살/, /홍란/, /천희/, /괴강살/, /백호살/, /양인살/];

// 재무자문 스크럽 (§6-4, §10 "재무자문 아님" — 법적 선긋기는 LLM 재량이 아니라 결정론 후처리로).
// 종목/코인/부동산/금융상품명 + "사라/투자/매수/추천" 패턴이 같은 문장에 함께 나오면 그 문장을 컷한다.
// 종목명/자산 명사 + 투자권유 동사 활용형. 종목명 전수 나열은 불가능하므로(프롬프트 절대 규칙 5가
// 1차 방어) 대표 종목명 몇 개 + '종목'을 추가하고, 동사는 '사둬/살/넣어/노려' 같은 활용형까지 포함.
const FINANCIAL_ADVICE_PATTERN =
  /(주식|종목|코인|비트코인|이더리움|부동산|아파트|펀드|ETF|채권|금\s?현물|삼성전자|테슬라|엔비디아|급등주|우량주).{0,10}(사|살|삽|매수|투자|추천|넣|노려|담|들어가)/;

// FINANCIAL_ADVICE_PATTERN 오탐 방지: "특정 주식이나 부동산을 추천하지 않습니다" 같은 준법 면책 문장은
// 추천 동사가 부정형이라 실제 자문이 아니다. 이런 부정형/금지형 서술만 스크럽 대상에서 제외한다.
// ★bare /아니/·/말라/는 역방향 구멍이라 뺀다("…나쁜 선택이 아니야" 같은 실제 권유가 '아니'로 탈출).
// 부정을 권유 동사에 인접한 형태로만 한정한다.
const FINANCIAL_ADVICE_NEGATION =
  /(추천하(지|진)\s*않|추천하는\s*게?\s*아니|(사|투자하|매수하|넣으)라는\s*(게|말|뜻)?이?\s*아니|사지\s*마|투자하(지|진)\s*(않|마)|매수하(지|진)\s*않|넣지\s*마|금지)/;

const isFinancialAdvice = (text: string): boolean =>
  FINANCIAL_ADVICE_PATTERN.test(text) && !FINANCIAL_ADVICE_NEGATION.test(text);

export interface WealthGuardResult {
  blocks: any;
  violations: string[];
}

// F-2: Gemini 출력이 필수 블록을 다 채웠는지 검증. 가드 스크럽 후 빈 블록이 남는 경우
// (유료 리포트가 비는 사고)와 모델이 스키마를 어긴 경우를 잡는다. 이슈 배열이 비면 통과.
// ★최소길이는 프롬프트 분량 규칙(lib/wealth-prompt.ts OUTPUT_SCHEMA)의 하한보다 넉넉히 낮게 —
//   gradeHeadline은 "35자 이내 한 문장"이라 8자(결혼운의 80자를 그대로 복사하면 정상 출력이 전부
//   반려되는 포팅 함정이라 절대 80으로 두지 말 것).
const REQUIRED_TEXT_BLOCKS: Array<[string, number]> = [
  ["teaserSummary", 10], ["gradeHeadline", 8], ["jaeseongDiagnosis", 80],
  ["jaeGripDiagnosis", 80], ["savingStyle", 80], ["riskAndPace", 80],
  ["timingFlow", 80], ["yearlyCta", 30],
];

export function validateWealthBlocks(parsed: any, opts?: { minAdvice?: number }): string[] {
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

// 본문에서 제거할 한자(CJK 통합한자) — 순수 한글 원칙. test용(비-global)과 replace용(global) 분리.

// \uadf8\ub987 4\uc0c1\ud55c \uc6a9\uc5b4 \ubcf8\ubb38 \ub178\ucd9c \ubc29\uc9c0(\ud504\ub86c\ud504\ud2b8 \uaddc\uce59 wealth-prompt.ts:245 \uc704\ubc18 \ub204\ucd9c 2\ucc28\ub9dd, 2026-07-21
// \ucee4\ub9ac\uc5b4\uc6b4 \uc5ed\ud3ec\ud305). \ubb38\uc7a5 \ucef7 \uc544\ub2c8\ub77c \uc6a9\uc5b4\ub9cc \uc911\ub9bd\uc5b4 \uce58\ud658 \u2014 \uc7ac\ud574\uc11d \ubb38\uc7a5 \ubcf4\uc874. \uc624\uae30 \ubcc0\ud615(\uc2e0\uc655\uc7ac\uc1e0\u2192\uc2e0\uc655\uc7ac\uc18c)\ub3c4 \ud3ec\ud568.
const WEALTH_GRIP_TERMS = /\uc2e0\uc655\uc7ac\uc655|\uc2e0\uc655\uc7ac\uc1e0|\uc2e0\uc655\uc7ac\uc18c|\uc7ac\ub2e4\uc2e0\uc57d|\uc2e0\uc57d\uc7ac\uc18c/g;
// teaser \ub4f1\uae09 \uc54c\ud30c\ubcb3 \ub178\ucd9c \ubc29\uc9c0(\uc720\ub8cc \uc804 \uc2a4\ud3ec\uc77c\ub7ec+\uc11c\uc5f4\ud654). "S\ub4f1\uae09\uc758/S\ub4f1\uae09\ub2e4\uc6b4" \uc811\ubbf8\uae4c\uc9c0 \uc81c\uac70.

export function applyWealthGuards(parsed: any, facts: any, _primarySummary: string): WealthGuardResult {
  const violations: string[] = [];
  const blocks = JSON.parse(JSON.stringify(parsed ?? {}));

  // 1) 조언: 근거 태그 필수 + 단정 예언/재무자문이 있는 항목은 통째로 컷 (원문 기준 판정)
  if (Array.isArray(blocks.advice)) {
    blocks.advice = blocks.advice.filter((a: any) => {
      const text = String(a?.text ?? "");
      const hit = FORBIDDEN_PREDICTIONS.find((re) => re.test(text));
      if (hit) {
        violations.push(`단정 예언 제거: ${text.slice(0, 20)} /${hit.source}/`);
        return false;
      }
      if (isFinancialAdvice(text)) {
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
        const hit = FORBIDDEN_PREDICTIONS.find((re) => re.test(sent));
        if (hit) {
          violations.push(`단정 예언 제거(${label}): /${hit.source}/`);
          return false;
        }
        if (isFinancialAdvice(sent)) {
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

  // scrubHanja·collapseEchoParens·scrubStrayDecimals 는 순수 함수라 공용 모듈에서 직접 쓴다.
  // violations 를 닫아야 하는 것만 팩토리로 만든다. → lib/report-scrub.ts
  const scrubGripTerms = makeScrubGripTerms(WEALTH_GRIP_TERMS, violations);
  const scrubGradeAlpha = makeScrubGradeAlpha(violations);

  // 4) 위 스크럽들을 blocks 전체(배열/객체 어디에 중첩돼 있든)에 재귀 적용.
  // ★advice[].tag(.tag로 끝남)에는 GRIP/GRADE 스크럽 제외 — 프롬프트 tag 예시(`[근거:재다신약]`)와의
  //  자기모순으로 정상 태그가 매번 변형돼 상시 violation·불필요 재생성을 유발하던 결함(2026-07-21).
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
  if (Array.isArray(blocks.advice)) {
    blocks.advice = blocks.advice.filter((a: any) => {
      const ok =
        typeof a?.text === "string" && a.text.trim().length >= 10 &&
        typeof a?.tag === "string" && /\[근거:.+\]/.test(a.tag);
      if (!ok) violations.push(`스크럽 후 조언 재검증 컷: ${String(a?.text ?? "").slice(0, 20)}`);
      return ok;
    });
  }

  // ── 명리 사실성 대조(2026-07-28 3차 사이클) ──
  // 지장간 hit 를 "떠 있다"로 승격하는 궁위 과장 + 근거 없는 매력의 해·대운 주장을
  // 엔진 ground truth 와 대조해 violations 로만 흘린다(문장은 안 고침 — 조사 파손 리스크).
  {
    const proseForFacts = ["jaeseongDiagnosis", "jaeGripDiagnosis", "savingStyle", "riskAndPace", "timingFlow"]
      .map((k) => (typeof (blocks as any)?.[k] === "string" ? (blocks as any)[k] : ""))
      .filter(Boolean)
      .join(" ");
    if (proseForFacts) {
      violations.push(
        ...findProminenceFabrications(proseForFacts, (facts as any)?.jaeseong ?? [])
      );
      violations.push(
        ...findTimingFabrications(
          proseForFacts,
          (facts as any)?.timingWindows ?? [],
          (blocks as any)?.serverTimeline?.daeun ?? []
        )
      );
      violations.push(...findAdviceEchoes((blocks as any)?.advice));
    }
  }

  return { blocks, violations };
}

// Phase 5: 총량 soft 하한 — REQUIRED_TEXT_BLOCKS(빈 리포트 방지 hard 하한)와 별개로,
// "채워졌지만 얇은" 리포트를 QA 재생성 루프(softValidate)로 한 번 더 쓰게 만든다.
// 원칙: 분량은 재료(궁위·타이밍)로만 늘린다 — 이슈 문장 자체가 재생성 프롬프트에 실리므로
// 채움경로를 여기 명시한다. 최종 출고는 절대 막지 않는다(환불 사유 아님).
const WEALTH_PROSE_KEYS = ["jaeseongDiagnosis", "jaeGripDiagnosis", "savingStyle", "riskAndPace", "timingFlow"] as const;
const WEALTH_RICHNESS_MIN_TOTAL = 1900; // 5블록 합 (상향된 목표범위 350~550×5의 바닥 근처)

export function validateWealthRichness(blocks: any): string[] {
  const total = WEALTH_PROSE_KEYS.reduce(
    (sum, k) => sum + (typeof blocks?.[k] === "string" ? blocks[k].trim().length : 0),
    0,
  );
  if (total >= WEALTH_RICHNESS_MIN_TOTAL) return [];
  return [
    `본문 5블록 총량 부족(${total}자 < ${WEALTH_RICHNESS_MIN_TOTAL}자) — 같은 말 반복·패러프레이즈로 늘리지 말고, [재성 궁위 해석]의 인생 국면 번역과 [타이밍 창]·[대운 중 재성이 들어오는 구간]의 구체 연도를 근거로 각 블록에 새 정보를 1~2문장씩 추가하라. 재미 기법(생생한 비유·펀치라인)도 아직 얇은 블록에 더 얹어라`,
  ];
}
