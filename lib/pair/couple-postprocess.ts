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
  /용신|기신|희신/,
  /신약|신강|극왕|태강|태약|중화/,
  /[SABCD]\s?등급|등급이|점수가/,
  /일지|월지|년지|시지|일간|일주|월주|년주|시주/,
  /원진|귀문|육합|삼합|방합|상충|형살|공망/,
  /정관|편관|정재|편재|식신|상관|정인|편인|비견|겁재|관성|재성|식상|인성|비겁/,
  /도화살|홍염살|역마살|화개살|천을귀인/,
];

/** §1-1 — 분기를 만들지 않는 대신 표현을 중립으로 통일한다. */
const MARITAL_TITLES = /남편|아내|시댁|처가|시부모|장인|장모|며느리|사위/;

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
 * 괄호 안이 한글 설명일 때만 잡는다(연도·수치 괄호는 건드리지 않는다).
 */
const TERM_PAREN = /([가-힣]{2,5})\(([^)]*[가-힣][^)]*)\)/g;

export function checkCoupleReport(
  text: string,
  ctx: { allowedYears: number[] },
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
  const allowed = new Set(ctx.allowedYears);
  for (const m of text.matchAll(/\b(19\d{2}|20\d{2}|21\d{2})\s*년/g)) {
    const y = Number(m[1]);
    if (!allowed.has(y)) add("없는연도", m[0]);
  }

  // ★스크럽은 괄호 병기 하나만 한다. 나머지는 문장을 다시 써야 하므로 지우지 않는다
  //   (억지로 지우면 문장이 부서지고, 부서진 문장이 나가는 게 더 나쁘다).
  //   ★문체·수위는 건드리지 않는다 — 재미를 깎지 않기 위해서다.
  let out = text;
  for (const m of text.matchAll(TERM_PAREN)) {
    add("용어병기", m[0]);
    out = out.replace(m[0], m[1]);
  }

  return { text: out, violations };
}
