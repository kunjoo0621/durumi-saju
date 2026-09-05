// couple 리포트 후처리 — 결정론 가드.
//
// 방어는 2겹이다. 1차는 프롬프트 사실 블록에서 아예 안 주는 것(couple-prompt.ts),
// 2차가 여기다. 지시만으로 된 가드는 샌다는 것이 사내 실측이다
// (pet-compat-saju.ts:439 주석, 그리고 아래 닳은 표현 21.5% 실측).
//
// ★금지 목록은 감이 아니라 실측에서 나왔다. 기존 결혼운 177편 전수:
//   · "웬만한 바람에는…"  38편(21.5%)  ← 프롬프트에 예시로 적어 둔 문장 그대로
//   · "뿌리 깊은 나무"     34편(19.2%)  ← 같은 예시
//   · "겉으로는 ~ 속으로는" 108편(61.0%)
//   · "예를 들어 ~ 장면"    29편(16.4%)
//   · 용어 괄호병기 중앙값 7개/리포트(최대 16개)
//   새로 닳는 표현이 생기면 여기에 추가한다 — 이 목록이 품질 기록이다.

import { withJosa } from "./josa";

export type ViolationKind =
  | "닳은표현"
  | "반복골격"
  | "용어병기"
  | "명리용어"
  | "혼인신분어"
  | "단정"
  | "없는연도";

export interface CoupleViolation {
  kind: ViolationKind;
  hit: string;
}

/** 이미 닳아버린 표현. 지울 수 없고 다시 써야 하므로 위반으로만 잡는다. */
const WORN_PHRASES: RegExp[] = [
  /웬만한 바람에?는?/,
  /뿌리 깊은 나무/,
  /햇볕 잘 드는 자리/,
  /레이더망/,
  /마음의 셔터/,
];

/** 리포트 간에 반복되는 문장 골격. 표현이 아니라 틀이 같아서 같은 글로 읽힌다. */
const WORN_SKELETONS: RegExp[] = [
  /겉(으로는|은)[\s\S]{0,40}속(으로는|은)/,
  /예를 들어[\s\S]{0,120}장면/,
  /결론은\?/,
];

/**
 * 명리 용어. 운영자 확정(§1-0)으로 등급·용신·강약은 노출 금지이고,
 * 자리 이름(일지·월지)과 관계 원어(원진·육합)도 사람 말로 풀어야 한다.
 */
const MYEONGRI_TERMS: RegExp[] = [
  /(?<![가-힣])(용신|기신|희신)/,
  /(?<![가-힣])(극왕|태강|신강|중화신강|중화신약|신약|태약|극약)/, // 강약 8단계 전수
  /[SABCD]\s?등급|등급이|점수가/,
  // ★앞 글자 한글 차단 + 뒤가 서술어면 일반어다(실측 오탐: "반대일지는"→일지,
  //   "상관없어"→상관, "비견할"→비견). 오탐은 재생성을 태운다.
  /(?<![가-힣])(일지|월지|년지|시지|일간|일주|월주|년주|시주)(?![은는이가])/,
  /(?<![가-힣])(원진|귀문|육합|삼합|방합|상충|형살|공망)/,
  /(?<![가-힣])(정관|편관|정재|편재|식신|정인|편인|겁재|관성|재성|식상|인성|비겁)/,
  /(?<![가-힣])상관(?![없있한하도의])/,
  /(?<![가-힣])비견(?![할하되됨])/,
  /(?<![가-힣])(도화살|홍염살|역마살|화개살|천을귀인)/,
];

/**
 * §1-1 — 분기를 만들지 않는 대신 표현을 중립으로 통일한다.
 * ★앞 글자가 한글이면 어중이다(실측 오탐: "쏟아내게"→아내, "휴식처가"→처가).
 *   오탐은 매 리포트마다 재생성을 태운다 — 못 잡는 것만큼 나쁘다.
 */
const MARITAL_TITLES = /(?<![가-힣])(남편|아내|시댁|처가|시부모|장인|장모|며느리|사위)/;

/**
 * "결혼해라/하지 마라"는 명리적으로도 CS적으로도 단정할 수 없다.
 *
 * ★범위를 좁힌 근거(실측): 초안은 `/해라|하지 ?마라/` 와 `/반드시|무조건/` 을 그냥
 * 잡았는데, 기존 결혼운 177편에 돌려 보니 "단정" 히트 87회가 전부 평범한 조언 어미
 * ("먼저 말을 걸어라")였고 "반드시 필요한 건 아니야" 같은 부정문까지 걸렸다.
 * 가드가 과하면 생성할 때마다 재작성 루프에 빠져 호출만 태운다 — 못 잡는 것만큼 나쁘다.
 * 그래서 **결혼·이별을 대상으로 한 지시·예언에만** 건다.
 */
const ASSERTIONS: RegExp[] = [
  /결혼(은 )?(하지 ?마|하면 안|하지 않는 게)/,
  /결혼해도 (좋|된다|괜찮)/,
  /결혼해라|결혼하지 ?마라/,
  /곧 헤어|헤어질 (거|것)|이혼|파혼|사별/,
  // 절대 표현은 "미래를 확정하는 서술어"와 붙어 있을 때만 단정으로 본다.
  /(반드시|무조건|틀림없이)[^.。\n]{0,20}(결혼|헤어|만나게|이어지게|끝나)/,
];

/**
 * 용어 괄호 병기 — "정재(바른 인연과 결실)" 꼴.
 *
 * ★괄호 앞 단어가 **명리 용어일 때만** 잡는다. 초안은 한글+괄호를 전부 잡아
 * "카페(단골집)" 같은 평범한 문장까지 위반으로 만들었고, 위반은 곧 재생성 트리거라
 * 멀쩡한 문장마다 Gemini 호출을 태웠다(전체 리뷰에서 재현). 게다가 재생성 노트가
 * "용어 위반"으로 전달돼 모델은 뭘 고칠지 알 수도 없었다.
 */
const TERM_PAREN = /([가-힣]{2,5})\(([^)]*[가-힣][^)]*)\)/g;

/** 괄호 앞 단어가 명리 용어인가 */
function isMyeongriTerm(word: string): boolean {
  return MYEONGRI_TERMS.some((re) => re.test(word));
}

/**
 * 치환 사전 — 지우면 문장이 부서지므로 **뜻으로 바꾼다**.
 * (선례: pet-compat-postprocess.ts 가 신살명을 "기질/기운"으로 치환한다)
 *
 * ★왜 필요한가(실측): probe 에서 "아내" 3회·"편인"·"일지" 가 재생성 2회를 견디고
 *   그대로 출고됐다. 프롬프트가 금지해도 모델이 자기 명리 지식으로 되살린다.
 *   가드가 "잡았다"고 기록만 하고 통과시키면 운영자 확정(§1-0·§1-1)이 화면에서 깨진다.
 */
/**
 * 치환 사전 — 지우면 문장이 부서지므로 **뜻으로 바꾼다**.
 * (선례: pet-compat-postprocess.ts 가 신살명을 "기질/기운"으로 치환한다)
 *
 * ★왜 필요한가(실측): probe 에서 "아내" 3회·"편인"·"일지" 가 재생성 2회를 견디고
 *   그대로 출고됐다. 프롬프트가 금지해도 모델이 자기 명리 지식으로 되살린다.
 *
 * ★★단어 경계가 없는 언어라 앞뒤를 막아야 한다(실측 버그): `/아내/g` 는 "녹아내릴"·
 *   "쏟아내기" 안의 "아내"까지 잡아 **"녹짝릴"·"쏟짝기"로 문장을 부순 채 출고**했다.
 *   금지어 검사만 보면 0이라 안 보인다. 그래서
 *     ① 앞 글자가 한글이면 치환하지 않는다(어중 매치 차단)
 *     ② 흔한 일반어와 겹치는 말(상관없다·비견하다·정신)은 뒤 글자로 한 번 더 거른다
 *     ③ 치환하면 조사도 바꾼다 — "아내가" → "짝가" 는 틀린 말이다.
 */
type Replacement = {
  term: string;
  to: string;
  /** 이 글자가 뒤에 오면 일반어이므로 건드리지 않는다 */
  skipIfFollowedBy?: string[];
};

const REPLACEMENTS: Replacement[] = [
  // 혼인 신분어 → 중립 (§1-1)
  { term: "남편", to: "짝" },
  { term: "아내", to: "짝" },
  { term: "시댁", to: "상대 집안" },
  { term: "처가", to: "상대 집안" },
  { term: "시부모", to: "상대 부모" },
  { term: "장인", to: "상대 부모" },
  { term: "장모", to: "상대 부모" },
  // 자리 이름 → 뜻
  { term: "일지", to: "부부 자리" },
  { term: "월지", to: "사회 자리" },
  { term: "년지", to: "뿌리 자리" },
  { term: "연지", to: "뿌리 자리" },
  { term: "시지", to: "말년 자리" },
  { term: "일간", to: "타고난 바탕" },
  // 십성 → 뜻
  { term: "정관", to: "선을 그어주는 결" },
  { term: "편관", to: "밀어붙이는 결" },
  { term: "정재", to: "챙기게 되는 결" },
  { term: "편재", to: "일을 벌이는 결" },
  { term: "식신", to: "마음이 편해지는 결" },
  { term: "상관", to: "말이 많아지는 결", skipIfFollowedBy: ["없", "있", "한", "하", "도", "의"] },
  { term: "정인", to: "기대게 되는 결" },
  { term: "편인", to: "속으로 파고드는 결" },
  { term: "비견", to: "나와 닮은 결", skipIfFollowedBy: ["할", "하", "되", "됨"] },
  { term: "겁재", to: "겨루게 되는 결" },
  // 관계 원어 → 뜻
  { term: "원진", to: "까닭 없이 거슬리는 자리" },
  { term: "귀문", to: "서로 예민해지는 자리" },
  { term: "육합", to: "붙는 자리" },
  { term: "삼합", to: "같은 방향을 보는 자리" },
  { term: "방합", to: "같은 계절을 사는 자리" },
];

/** 치환어 뒤에 붙은 조사를 새 단어의 받침에 맞춰 고친다. */
const JOSA_FIX: Record<string, "을" | "이" | "은" | "와"> = {
  을: "을", 를: "을",
  이: "이", 가: "이",
  은: "은", 는: "은",
  와: "와", 과: "와",
};

function applyReplacements(text: string): string {
  let out = text;
  for (const { term, to, skipIfFollowedBy } of REPLACEMENTS) {
    // ①앞 글자가 한글이면 어중이다 — 건드리지 않는다.
    const re = new RegExp(`(?<![가-힣])${term}([가-힣]?)`, "g");
    out = out.replace(re, (whole, next: string) => {
      // ②일반어와 겹치는 경우 제외
      if (skipIfFollowedBy?.includes(next)) return whole;
      // ③조사면 새 단어 받침에 맞춰 교체
      const kind = JOSA_FIX[next];
      if (kind) return withJosa(to, kind);
      return to + next;
    });
  }
  return out;
}

export function checkCoupleReport(
  text: string,
  ctx: {
    allowedYears: number[];
    /** 사실 블록이 "기준 연도"로 실은 값. 블록에 있는 걸 쓰면 위반이 아니다. */
    currentYear?: number;
  },
): { text: string; violations: CoupleViolation[] } {
  const violations: CoupleViolation[] = [];
  const add = (kind: ViolationKind, hit: string) => {
    if (!violations.some((v) => v.kind === kind && v.hit === hit)) violations.push({ kind, hit });
  };

  for (const re of WORN_PHRASES) {
    const m = text.match(re);
    if (m) add("닳은표현", m[0]);
  }
  for (const re of WORN_SKELETONS) {
    const m = text.match(re);
    if (m) add("반복골격", m[0].slice(0, 30));
  }
  for (const re of MYEONGRI_TERMS) {
    const m = text.match(re);
    if (m) add("명리용어", m[0]);
  }
  {
    const m = text.match(MARITAL_TITLES);
    if (m) add("혼인신분어", m[0]);
  }
  for (const re of ASSERTIONS) {
    const m = text.match(re);
    if (m) add("단정", m[0]);
  }

  // 블록에 없는 연도 = 지어낸 것. 1900~2199 만 연도로 본다.
  // ★기준 연도를 허용 목록에 넣는다. 블록이 그 값을 싣는데 가드가 막으면,
  //   LLM 이 규칙을 성실히 지켜도 위반이 떠 무의미한 재생성이 돈다(전체 리뷰에서 재현).
  const allowed = new Set(ctx.allowedYears);
  if (ctx.currentYear) allowed.add(ctx.currentYear);
  for (const m of text.matchAll(/\b(19\d{2}|20\d{2}|21\d{2})\s*년/g)) {
    const y = Number(m[1]);
    if (!allowed.has(y)) add("없는연도", m[0]);
  }

  // ★스크럽은 괄호 병기 하나만 한다. 나머지는 문장을 다시 써야 하므로 지우지 않는다
  //   (억지로 지우면 문장이 부서지고, 부서진 문장이 나가는 게 더 나쁘다).
  //   ★문체·수위는 건드리지 않는다 — 재미를 깎지 않기 위해서다.
  let out = text;

  // ① 괄호 병기를 먼저 정리한다. 치환을 먼저 돌리면 괄호 앞 단어가 이미 바뀌어
  //    명리 용어 판정이 안 된다(테스트가 이 순서 의존을 잡았다).
  for (const m of text.matchAll(TERM_PAREN)) {
    if (!isMyeongriTerm(m[1])) continue; // 평범한 괄호는 건드리지 않는다
    add("용어병기", m[0]);
    out = out.replace(m[0], m[1]);
  }

  // ② 남은 용어를 뜻으로 치환한다. 위반 기록은 위에서 이미 끝났으므로
  //    "몇 번 샜는지"는 그대로 남고, 프롬프트 개선의 근거가 된다.
  out = applyReplacements(out);

  return { text: out, violations };
}

/* ── 블록 검증 · 가드 적용 (qa-regen 규약) ── */

/**
 * 블록별 최소 길이.
 * ★headline 을 따로 뺀 이유(실측): 프롬프트는 headline 을 "한 줄"로 지시하는데
 *   초안은 전 블록에 40자 하한을 걸어, 35자짜리 정상 헤드라인이 반려되고 재생성이
 *   돌다 **첫 probe 실행이 통째로 실패**했다. 내가 만든 규칙끼리 부딪힌 것이다.
 * ★본문 하한은 350자다. marriage(10알)가 블록당 400~550자를 요구하는데 couple(20알)의
 *   초안 하한은 40자였고, 실측 총량이 731~801자로 marriage 총량 하한(1900자)의 40%였다.
 */
const MIN_LEN: Record<string, number> = {
  headline: 20,
  mindScene: 350,
  lifeScene: 350,
  complement: 350,
  timing: 250,
};
const REQUIRED_BLOCKS = ["headline", "mindScene", "lifeScene", "complement", "timing", "advice"];

/** 총량 soft 하한 — marriage 의 validateMarriageRichness 와 같은 취지. */
export const COUPLE_MIN_TOTAL = 1600;

/**
 * 필수 블록이 있고 최소 분량을 채웠는지.
 *
 * ★중화된 축의 블록은 하한을 면제한다. 볼 수 없는 축에 400자를 요구하면 모델은
 *   필러를 쓰거나 단정하게 된다 — 이 작업이 지켜온 "못 본 것 ≠ 없는 것"과 정면 충돌이다.
 */
export function validateCoupleBlocks(
  blocks: unknown,
  opts: { deadBlocks?: string[] } = {},
): string[] {
  const issues: string[] = [];
  if (!blocks || typeof blocks !== "object" || Array.isArray(blocks)) return ["루트가 객체가 아님"];
  const b = blocks as Record<string, unknown>;
  const dead = new Set(opts.deadBlocks ?? []);

  for (const key of REQUIRED_BLOCKS) {
    const v = b[key];
    if (key === "advice") {
      if (!Array.isArray(v) || v.length < 3) issues.push(`${key} 3개 미만`);
      else if (v.some((x) => typeof x !== "string" || x.trim().length < 20)) issues.push(`${key} 너무 짧음`);
      continue;
    }
    if (typeof v !== "string" || v.trim().length === 0) {
      issues.push(`${key} 없음`);
      continue;
    }
    // 볼 수 없는 축은 정직한 한 문장이면 된다(실측: "시간을 몰라 이 자리는 못 봤어." = 17자).
    // 빈 값·쓰레기만 막고, 길이를 요구하면 필러가 들어온다.
    const min = dead.has(key) ? 12 : (MIN_LEN[key] ?? 200);
    if (v.trim().length < min) issues.push(`${key} 짧음(${v.trim().length}/${min})`);
  }
  return issues;
}

/**
 * 총량 검사(soft). 블록별 하한을 아슬아슬하게 넘기면서 전체가 얇아지는 걸 막는다.
 * 재생성 노트로만 쓰고 실패시키지 않는다 — 중화가 많은 커플은 구조적으로 짧다.
 */
export function validateCoupleRichness(blocks: unknown): string[] {
  if (!blocks || typeof blocks !== "object") return [];
  const b = blocks as Record<string, unknown>;
  let total = 0;
  for (const v of Object.values(b)) {
    if (typeof v === "string") total += v.replace(/\s/g, "").length;
    else if (Array.isArray(v)) total += v.reduce((s: number, x) => s + (typeof x === "string" ? x.replace(/\s/g, "").length : 0), 0);
  }
  return total < COUPLE_MIN_TOTAL
    ? [`전체가 얇다(${total}/${COUPLE_MIN_TOTAL}자). 위 사실에서 아직 안 쓴 것을 찾아 새 장면으로 채워라 — 같은 말을 늘이지 마라.`]
    : [];
}

/**
 * 가드 적용. ★문체·수위는 건드리지 않는다 — 재미를 깎지 않기 위해서다.
 * 스크럽은 용어 괄호 병기 하나뿐이고, 나머지는 위반 목록으로만 돌려 재생성에 맡긴다.
 */
export function applyCoupleGuards(
  blocks: unknown,
  ctx: { allowedYears: number[]; currentYear?: number },
): { blocks: unknown; violations: string[] } {
  if (!blocks || typeof blocks !== "object") return { blocks, violations: ["루트가 객체가 아님"] };
  const b = { ...(blocks as Record<string, unknown>) };
  const violations: string[] = [];

  const run = (text: string): string => {
    const r = checkCoupleReport(text, ctx);
    for (const v of r.violations) violations.push(`${v.kind}: ${v.hit}`);
    return r.text;
  };

  for (const [key, value] of Object.entries(b)) {
    if (typeof value === "string") b[key] = run(value);
    else if (Array.isArray(value)) b[key] = value.map((x) => (typeof x === "string" ? run(x) : x));
  }
  return { blocks: b, violations };
}
