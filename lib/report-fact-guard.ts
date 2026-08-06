/**
 * 심층 리포트 명리 사실성 가드 — LLM 출력을 **엔진이 계산한 ground truth** 와 대조한다.
 *
 * 왜 필요: 2026-07-28 실사용 15건 검수에서 최우선 결함이 나왔다.
 * 지장간에만 있거나 원국에 아예 없는 십성을 "월주에 뚜렷하게 떠 있다"고
 * **투출처럼** 서술하는 패턴이 15건 중 7건. 궁위→인생국면 번역("초년부터",
 * "중년기에")이 리포트 서사의 뼈대라, 뿌리가 틀리면 해석 전체가 허구가 된다.
 *
 * ★근본원인은 데이터 부재가 아니었다. facts 는 이미 `{pillar, source}` 로
 *   천간/지장간 층위를 정확히 넘기고 있었다. 진짜 병목은 프롬프트의 좋은-예시가
 *   출처 조건 없이 "월주에 떡 하니 떠 있어" 를 프라이밍한 것(Task 9에서 수정).
 *   이 모듈은 그 프롬프트 수정이 안 지켜졌을 때를 잡는 **결정론 백스톱**이다.
 *
 * 설계 원칙: **오탐으로 상시 재생성을 유발하지 않는다.** 한 문장에 기둥이 둘 이상
 * 섞이면 판정을 보류하고, 강조어가 없는 단순 위치 언급은 통과시킨다.
 * 위반은 violations 로만 흘려보내 qa-regen 이 다시 쓰게 하고, 문장을 직접
 * 고치지 않는다(한국어 조사 파손 리스크 — 1차 사이클 교훈).
 */

export type PillarPos = "year" | "month" | "day" | "hour";

export type StarHit = {
  pillar: PillarPos;
  source: "천간" | "지장간";
  star: string;
};

const KO_TO_POS: Record<string, PillarPos> = {
  년주: "year",
  월주: "month",
  일주: "day",
  시주: "hour",
};

/** 투출(천간에 드러남)을 뜻하는 강조 표현 — 지장간 근거에 붙으면 과장이다. */
const PROMINENCE_RE =
  /(떠\s*있|투출|자리\s*를?\s*잡|앉아\s*있|박혀\s*있|드러나\s*있)/;

/** 강조 부사 — 있으면 투출 뉘앙스가 더 강해진다(단독으로도 판정에 쓰인다). */
const EMPHASIS_RE = /(뚜렷|떡\s*하니|선명|강하게|확실히|한껏)/;

/** 지장간을 올바르게 지칭하는 표현 — 있으면 정상 서술이라 판정에서 제외 */
const HIDDEN_OK_RE = /(지장간|숨어\s*있|속결|숨은|암장)/;

const STAR_RE =
  /(정재|편재|정관|편관|정인|편인|식신|상관|비견|겁재|재성|관성|인성|식상|비겁)/g;

/**
 * "{기둥}주에 {십성}이 떠 있다" 류 주장을 엔진 hits 와 대조한다.
 * 천간 hit 가 없으면 위반(지장간에만 있음 / 원국에 없음 구분해서 기록).
 */
export function findProminenceFabrications(
  text: string,
  hits: StarHit[]
): string[] {
  if (!text) return [];
  const violations: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sent of sentences) {
    // 올바른 지장간 서술이면 통과
    if (HIDDEN_OK_RE.test(sent)) continue;
    // 투출 뉘앙스가 없으면 위치 언급만으로는 문제 삼지 않는다
    if (!PROMINENCE_RE.test(sent) && !EMPHASIS_RE.test(sent)) continue;

    const pillarWords = [...new Set(sent.match(/[년월일시]주/g) ?? [])];
    // ★기둥이 둘 이상이면 어느 별이 어디에 걸린 주장인지 확정 불가 → 보류(오탐 방지)
    if (pillarWords.length !== 1) continue;
    const pos = KO_TO_POS[pillarWords[0]];
    if (!pos) continue;

    // 투출 동사가 아예 없으면(강조부사만) 넘어간다 — "뚜렷한 성격" 같은 오탐 방지
    if (!PROMINENCE_RE.test(sent)) continue;

    for (const star of new Set(sent.match(STAR_RE) ?? [])) {
      const stem = hits.some(
        (h) => h.pillar === pos && h.source === "천간" && h.star === star
      );
      if (stem) continue;
      const hidden = hits.some(
        (h) => h.pillar === pos && h.source === "지장간" && h.star === star
      );
      violations.push(
        `궁위 투출 과장: ${pillarWords[0]} ${star}(${hidden ? "지장간에만 있음" : "원국에 없음"})`
      );
    }
  }
  return violations;
}

/** "매력이 부각/최고조" 류 — 도화·홍염 트리거가 있는 해에만 허용 */
const CHARM_RE = /매력[이가]?\s*(한껏\s*)?(부각|최고조|널리\s*퍼지|돋보|드러나)/;
const YEAR_RE = /(20\d{2})\s*년?/g;
/**
 * 대운 "구체 주장"만 데이터를 요구한다.
 * ★단어 /대운/ 만으로 걸면 안 된다(2026-08-06 독립 검수 지적). 프롬프트는 배우자성 대운이
 *   없는 사람에게 "인연은 대운·세운의 흐름을 더 타는 편"이라고 쓰라고 **지시한다**
 *   (marriage-prompt.ts:201 · career-prompt.ts:60 · wealth-prompt.ts:61 동일 구조).
 *   그 지시대로 쓴 문장을 가드가 잡으면 프롬프트와 가드가 서로 모순한다.
 * 근거가 필요한 건 십성을 특정하거나 나이 구간을 붙인 주장뿐이다
 * (원 사례: wealth-4 "편재 대운을 지나왔거나" — 빈 배열인데 십성을 특정했다).
 */
const TEN_STAR_WORD = "정관|편관|정재|편재|정인|편인|비견|겁재|식신|상관|관성|재성|인성|식상|비겁";
/** 구체 주장의 표지 — 십성 특정 / N세 / 연도 / N0대. 실측 우회 사례를 반영해 넓혔다. */
const DAEUN_ANCHOR = `(?:${TEN_STAR_WORD})|\\d{1,3}\\s*세|20\\d{2}\\s*년|\\d0\\s*대`;
// 문장 안에서 '대운' 과 표지가 같이 나오면 구체 주장으로 본다(거리 제한 없음 —
// 12자 제한을 두니 "다음 대운은 …인데, 그 주인공이 바로 편재야" 가 통과했다).
const DAEUN_CLAIM_RE = new RegExp(`(?:${DAEUN_ANCHOR})[^.!?]*대운|대운[^.!?]*(?:${DAEUN_ANCHOR})`);

/**
 * 연도·대운 주장 검증.
 * - "매력 부각" 문장의 연도는 timingWindows 에서 도화홍염 트리거가 있어야 한다.
 * - 대운 데이터가 비었는데 대운을 주장하면 위반(wealth-4 실측: 빈 배열인데 "편재 대운을 지나왔거나").
 * 그 외 연도 인용(세운 십성 계산 등)은 전수 정확했으므로 건드리지 않는다.
 */
export function findTimingFabrications(
  text: string,
  windows: Array<{ year: number; triggers: string[] }>,
  daeun: Array<unknown>
): string[] {
  if (!text) return [];
  const violations: string[] = [];
  const charmYears = new Set(
    windows.filter((w) => w.triggers?.includes("도화홍염")).map((w) => w.year)
  );

  for (const sent of text.split(/(?<=[.!?])\s+/)) {
    if (CHARM_RE.test(sent)) {
      for (const m of sent.matchAll(YEAR_RE)) {
        const y = Number(m[1]);
        if (!charmYears.has(y)) {
          violations.push(`타이밍 근거없음: ${y}년 매력 부각(도화·홍염 트리거 없음)`);
        }
      }
    }
    if (DAEUN_CLAIM_RE.test(sent) && (!daeun || daeun.length === 0)) {
      violations.push("타이밍 근거없음: 대운 데이터가 비었는데 대운을 주장");
    }
  }
  return violations;
}

/**
 * advice 재탕 탐지 — "근거는 tag 가 담당, text 는 '어떻게'만" 규칙의 결정론 백스톱.
 *
 * 왜: 프롬프트가 "왜 이 조언인지 사주 근거가 문장 안에 드러나야 한다"고 시켜서
 * 모델이 성실히 따른 결과가 본문 재탕이었다(2026-07-28 실측: 리포트당 조언 4개 중 2~3개).
 * 근거는 이미 `[근거:...]` 태그가 담고 있어 문장에서 또 말할 이유가 없다.
 *
 * ★12자 문자열 겹침으로는 안 잡힌다(표현만 바꾸면 통과) — 그래서 "명리 용어가 text 에
 * 들어있으면 근거 재진술"이라는 프록시로 잡는다. tag 는 검사 대상이 아니다(교훈: tag 스크럽은
 * 상시 재생성을 유발한다).
 */
const MYEONGRI_TERMS =
  /(겁재탈재|재다신약|식상생재|군겁쟁재|신왕재왕|신왕재쇠|신약재소|관인상생|상관견관|관다신약|신왕관왕|신약관소|관살혼잡|비겁극재|충거|정편재혼잡)/;

/** 행동·기한·수량이 하나도 없으면 '어떻게'가 아니라 '왜'만 말한 조언이다. */
// ★한글 수사·조건 마커 포함(실측 오탐 교정): "최소 세 번은 만나봐"·"~할 때마다"가 좋은
//   조언인데 걸렸다. 오탐이 잦으면 qa-regen 이 상시 돌아 비용·지연만 는다.
const HOW_MARKER =
  /(\d|[한두세네]\s*(번|달|주|가지|시간)|다섯|여섯|당일|즉시|곧바로|당장|하루|이틀|사흘|일주일|한\s*달|매달|매주|때마다|먼저|바로|미리|나눠|적어|기록|정해|옮겨|묶어|빼놓|따로|외워|물어|끊)/;

export function findAdviceEchoes(
  advice: Array<{ text?: string; tag?: string }> | undefined
): string[] {
  if (!Array.isArray(advice)) return [];
  const violations: string[] = [];
  for (const a of advice) {
    const text = typeof a?.text === "string" ? a.text : "";
    if (!text) continue;
    // ★실제 출고문은 "겁재 탈재의 영향으로"처럼 띄어 쓴다 — 공백을 지우고 대조해야 잡힌다.
    const term = text.replace(/\s+/g, "").match(MYEONGRI_TERMS)?.[1];
    if (term) violations.push(`advice 근거 재진술: 본문 용어 "${term}" 가 조언 문장에 들어감`);
    if (!HOW_MARKER.test(text)) {
      violations.push(`advice 실행정보 없음: "${text.slice(0, 24)}…" (구체 행동·기한·수량 부재)`);
    }
  }
  return violations;
}
