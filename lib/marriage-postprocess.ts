import { findAdviceEchoes, findProminenceFabrications, findTimingFabrications } from "./report-fact-guard";
import { collapseEchoParens, makeScrubGradeAlpha, scrubHanja, scrubStrayDecimals } from "./report-scrub";
// 단정 예언 금지어 — 문장 단위로만 컷하므로(scrubForbiddenPredictions) 긍정 맥락 문장은
// 안전하다. 예: "이별의 아픔을 딛고"는 /이별수/에 안 걸린다. 결측/빈 블록은 F-2가 후단에서 잡는다.
// ★관계상태 분기(2026-07-19): "다시 혼자"(이혼·사별) 사용자에게 /재혼/·/사별/·/이혼/ 무조건
// 컷은 정당 문맥(재혼 타이밍 = 이 세그먼트의 핵심 콘텐츠, "이혼 후"라는 상태 서술)까지 잘라
// 리포트를 얇게 만들던 구멍 — 예언·낙인형 패턴만 남기고 상태 서술은 허용한다.
const FORBIDDEN_PREDICTIONS_BASE = [
  /외도/, /바람(을|이|날)/, /혼자 늙/, /팔자가 세/,
  /이별수/, /곧\s*헤어/, /헤어질\s*(수|운명|팔자)/, /파혼/, /갈라서|갈라설/,
  /결혼\s*운이?\s*없/, /불임/, /자식\s*(이|은|을)?\s*없/, /자식\s*복이?\s*없/,
  /바람\s*(기|피)/, /과부/, /독수공방/, /(일찍|먼저)\s*(떠나|떠날|여의)/,
  // ── 긍정 성사단정(2026-07-21 실측 누출) — 손해 방향만 잡고 성사 보장이 새던 구멍 ──
  /만나게?\s*될\s*운명/,                                  // "다정한 사람을 만나게 될 운명이야"
  /(반드시|무조건|꼭|분명)\s*(결혼하|만나게?\s*[된돼될]|이어[진질]|맺어[진질])/,
  /(결혼|결실|인연).{0,6}(보장|확실해|틀림없)/,
  /절대\s*(놓치|지나치|비껴가)지\s*않/,                    // 단정 보장형만("놓치지 마" 조언형 미매치)
];
// 기본(솔로·연애중·기혼): 이 단어들이 등장할 정당 맥락이 없다 — 단어 자체를 컷(기존 동작 유지).
const FORBIDDEN_DEFAULT_EXTRA = [/이혼수?/, /사별/, /재혼/];
// 다시 혼자: 예언·낙인형만 컷. "재혼 시기", "이혼 후", "사별의 아픔을 딛고"는 정당 문맥.
const FORBIDDEN_REMARRIED_EXTRA = [
  /이혼수/,                       // 예언형만 ("이혼 후"는 통과)
  /사별(수|할|하게)/,             // 예언형만 ("사별의 아픔"은 통과)
  /재혼.{0,6}(못|없|힘들|어렵)/,  // "재혼 못 한다" 낙인만 (재혼 자체는 핵심 소재)
];

export function forbiddenPredictionsFor(maritalStatus?: string): RegExp[] {
  return maritalStatus === "다시 혼자"
    ? [...FORBIDDEN_PREDICTIONS_BASE, ...FORBIDDEN_REMARRIED_EXTRA]
    : [...FORBIDDEN_PREDICTIONS_BASE, ...FORBIDDEN_DEFAULT_EXTRA];
}
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

// 본문에서 제거할 한자(CJK 통합한자) — 순수 한글 원칙. 신살명 한자병기·오타 방지.
// \ud55c\uc790\u00b7\uac15\ub3c4\uac12\u00b7\ub3c5\uc74c\uad04\ud638\u00b7\ub4f1\uae09\uc54c\ud30c\ubcb3 \uc2a4\ud06c\ub7fd\uc740 3\uac80\uc0ac \uacf5\uc6a9 \u2192 lib/report-scrub.ts \ub2e8\uc77c \uc18c\uc2a4.

export function applyMarriageGuards(parsed: any, facts: any, _primarySummary: string): MarriageGuardResult {
  const violations: string[] = [];
  const blocks = JSON.parse(JSON.stringify(parsed ?? {}));
  const forbidden = forbiddenPredictionsFor(facts?.maritalStatus); // ★ status-aware

  // scrubHanja·collapseEchoParens·scrubStrayDecimals 는 순수 함수라 공용 모듈에서 직접 쓴다.
  // violations 를 닫아야 하는 것만 팩토리로 만든다. → lib/report-scrub.ts
  const scrubGradeAlpha = makeScrubGradeAlpha(violations);

  // 1) 조언: 근거 태그 필수 + 단정 예언이 있는 항목은 통째로 컷 (원문 기준 판정)
  if (Array.isArray(blocks.advice)) {
    blocks.advice = blocks.advice.filter((a: any) => {
      const text = String(a?.text ?? "");
      const hit = forbidden.find(re => re.test(text)); if (hit) { violations.push(`단정 예언 제거: ${text.slice(0,20)} /${hit.source}/`); return false; }
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
        const hit = forbidden.find((re) => re.test(sent));
        if (hit) {
          violations.push(`단정 예언 제거(${label}): /${hit.source}/`);
          return false;
        }
        return true;
      });
      const rejoined = keptSentences.join(" ").replace(/\s{2,}/g, " ").trim();
      if (rejoined !== "" || allBlank) keptLines.push(rejoined);
    }
    return keptLines.join("\n").trim();
  };

  // 4) 위 스크럽을 blocks 전체(배열/객체 어디에 중첩돼 있든)에 재귀 적용.
  // ★advice[].tag(.tag로 끝남)에는 GRADE 스크럽 제외(등급 근거태그 오변형 방지). 신살·한자·단정예언은 tag에도 유지.
  const walk = (o: any, label: string): any => {
    if (typeof o === "string") {
      const isTag = label.endsWith(".tag");
      const afterShinsal = isTag ? scrubShinsal(o) : scrubGradeAlpha(scrubShinsal(o));
      const afterHanja = scrubStrayDecimals(collapseEchoParens(scrubHanja(afterShinsal)));
      return scrubForbiddenPredictions(afterHanja, label);
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
    const proseForFacts = ["spousePalace", "spouseStar", "partnerProfile", "relationshipPattern", "timingFlow"]
      .map((k) => (typeof (blocks as any)?.[k] === "string" ? (blocks as any)[k] : ""))
      .filter(Boolean)
      .join(" ");
    if (proseForFacts) {
      violations.push(
        ...findProminenceFabrications(proseForFacts, (facts as any)?.spouseStars ?? [])
      );
      violations.push(
        ...findTimingFabrications(
          proseForFacts,
          (facts as any)?.timingWindows ?? [],
          // ★근거는 facts 의 대운 구간 전체를 쓴다(2026-08-06 수정).
          //   serverTimeline 은 이 가드가 끝난 뒤에야 route 에서 붙어 여기선 항상 undefined 였고,
          //   upcoming 필터까지 걸려 있어 "이미 지나온 대운"을 정확히 말한 문장도 걸렸다.
          (facts as any)?.daeunSpouseYears ?? []
        )
      );
      violations.push(...findAdviceEchoes((blocks as any)?.advice));
    }
  }

  return { blocks, violations };
}

// Phase 5: 총량 soft 하한 (wealth와 동일 구조). 채움경로=지장간 층위·타이밍·대운.
const MARRIAGE_PROSE_KEYS = ["spousePalace", "spouseStar", "partnerProfile", "relationshipPattern", "timingFlow"] as const;
const MARRIAGE_RICHNESS_MIN_TOTAL = 1900;

export function validateMarriageRichness(blocks: any): string[] {
  const total = MARRIAGE_PROSE_KEYS.reduce(
    (sum, k) => sum + (typeof blocks?.[k] === "string" ? blocks[k].trim().length : 0),
    0,
  );
  if (total >= MARRIAGE_RICHNESS_MIN_TOTAL) return [];
  return [
    `본문 5블록 총량 부족(${total}자 < ${MARRIAGE_RICHNESS_MIN_TOTAL}자) — 같은 말 반복·패러프레이즈로 늘리지 말고, [일지 지장간 구조]의 본기/속결 층위(속결이 없으면 본기를 겉/속 두 면으로)와 [타이밍 창]·[대운 중 배우자성이 들어오는 구간]의 구체 연도를 근거로 각 블록에 새 정보를 1~2문장씩 추가하라. 재미 기법(생생한 비유·펀치라인)도 아직 얇은 블록에 더 얹어라`,
  ];
}
