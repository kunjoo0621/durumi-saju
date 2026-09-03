// couple 프롬프트의 사실 블록.
//
// ★가장 중요한 규칙: **중화된 축의 값은 블록에 싣지 않는다.**
//   프롬프트 규칙이 "이 블록 밖의 근거를 만들지 마라"이므로, 블록에 들어간 것은 곧
//   허가된 것이다. 못 믿는 축의 값이 실리면 LLM 이 그걸로 문장을 쓰고, 후처리는
//   이의를 제기할 수 없다 — 블록 안에 있으니 규칙 위반이 아니기 때문이다.
//   그래서 값을 빼고 "이 축은 볼 수 없다"는 사실만 남긴다.
//
// ★용어를 블록에 쓰지 않는다. 등급·용신·강약은 운영자 확정(§1-0)으로 화면에도 글에도
//   안 나온다. 블록에 있으면 LLM 이 그대로 쓴다 — 나중에 지우는 술래잡기 대신 안 넣는다.
//   명리 자리 이름(일지·월지)도 사람 말로 옮겨서 넣는다.

import type { AxisKey, CoupleDecision } from "./couple-decision";
import type { BranchCell, PairFacts } from "./pair-facts";

/** 궁위를 사람 말로. 명리 용어가 블록에 들어가면 본문으로 새어 나간다. */
const PILLAR_LABEL: Record<string, string> = {
  year: "뿌리 자리",
  month: "사회 자리",
  day: "부부 자리",
  hour: "말년 자리",
};

/** 일간 관계를 뜻으로. "합/충" 같은 글자를 그대로 주면 본문에 한자어가 뜬다. */
const STEM_RELATION_LABEL: Record<string, string> = {
  합: "서로 끌어당긴다",
  생: "한쪽이 다른 쪽을 밀어준다",
  비화: "결이 비슷하다",
  극: "한쪽이 다른 쪽을 누른다",
  충: "정면으로 부딪힌다",
};

/** 지지 관계를 뜻으로. 원어(육합·원진…)는 넣지 않는다. */
const RELATION_LABEL: Record<string, string> = {
  육합: "붙는다",
  삼합: "같은 방향을 본다",
  방합: "같은 계절을 산다",
  동일: "똑같다",
  충: "정면으로 부딪힌다",
  형: "부대낀다",
  원진: "까닭 없이 거슬린다",
  귀문: "서로에게 예민해진다",
  해: "될 일이 어긋난다",
};

function cellLine(c: BranchCell, nameA: string, nameB: string): string {
  const rels = c.relations.map((r) => RELATION_LABEL[r] ?? r).join(" + ");
  return `- ${nameA}의 ${PILLAR_LABEL[c.posA] ?? c.posA}(${c.branchA}) ↔ ${nameB}의 ${PILLAR_LABEL[c.posB] ?? c.posB}(${c.branchB}) : ${rels}`;
}

/**
 * 십성을 뜻으로. ★블록에 "정관" 같은 이름을 그대로 실으면, AI 는 그것을 사실로 받고
 * 그대로 받아쓰는데 couple-postprocess 는 그걸 위반으로 잡는다 — 사실로 준 단어를
 * 쓰면 안 된다고 막는 셈이라 무한 재작성 루프가 된다(검토에서 실제로 발견).
 * 블록은 자기가 만든 가드를 스스로 통과해야 한다.
 */
const TEN_STAR_LABEL: Record<string, string> = {
  정관: "선을 그어주는 사람",
  편관: "밀어붙이는 사람",
  정재: "챙기게 되는 사람",
  편재: "일을 벌이게 만드는 사람",
  식신: "마음이 편해지는 사람",
  상관: "말이 많아지게 하는 사람",
  정인: "기대게 되는 사람",
  편인: "생각이 많아지게 하는 사람",
  비견: "나와 닮은 사람",
  겁재: "겨루게 되는 사람",
};

const AXIS_SOURCE: Record<AxisKey, string> = {
  마음: "두 사람의 본바탕이 만났을 때",
  생활: "같이 살면서 부딪히는 자리",
  보완: "서로 부족한 걸 채우는가",
  시기: "때가 맞는가",
};

export function buildCoupleFactsBlock(
  f: PairFacts,
  d: CoupleDecision,
  names: { nameA: string; nameB: string },
): string {
  const { nameA, nameB } = names;
  const dead = new Set(d.neutralized);
  const lines: string[] = [];

  lines.push(`[두 사람 사실 — 이 블록에 없는 것은 지어내지 마라]`);
  lines.push(`기준 연도: ${f.currentYear}`);
  lines.push(`두 사람: ${nameA} / ${nameB}`);
  lines.push("");

  // ── 마음
  if (dead.has("마음")) {
    lines.push(`## ${AXIS_SOURCE.마음} — 볼 수 없다. 단정하지 마라`);
  } else {
    lines.push(`## ${AXIS_SOURCE.마음}`);
    lines.push(`- ${STEM_RELATION_LABEL[f.dayStemRelation.type] ?? f.dayStemRelation.type}`);
    const aSees = f.tenStarExchange.aSeesB ? TEN_STAR_LABEL[f.tenStarExchange.aSeesB] : null;
    const bSees = f.tenStarExchange.bSeesA ? TEN_STAR_LABEL[f.tenStarExchange.bSeesA] : null;
    if (aSees) lines.push(`- ${nameA}에게 ${nameB}는 "${aSees}"으로 온다`);
    if (bSees) lines.push(`- ${nameB}에게 ${nameA}는 "${bSees}"으로 온다`);
    if (f.spouseStarCross.aHitByB === true) lines.push(`- ${nameB}가 ${nameA}의 짝 자리에 실제로 걸린다`);
    if (f.spouseStarCross.bHitByA === true) lines.push(`- ${nameA}가 ${nameB}의 짝 자리에 실제로 걸린다`);
  }
  lines.push("");

  // ── 생활 (지지 매트릭스)
  if (dead.has("생활")) {
    lines.push(`## ${AXIS_SOURCE.생활} — 태어난 시간을 몰라 볼 수 없다. 걸리는 자리가 있다 없다 단정하지 마라`);
  } else {
    lines.push(`## ${AXIS_SOURCE.생활}`);
    if (f.branchMatrix.length === 0) {
      lines.push("- 특별히 걸리는 자리가 없다");
    } else {
      for (const c of f.branchMatrix) lines.push(cellLine(c, nameA, nameB));
    }
  }
  lines.push("");

  // ── 보완
  if (dead.has("보완")) {
    lines.push(`## ${AXIS_SOURCE.보완} — 태어난 시간을 몰라 볼 수 없다. 단정하지 마라`);
  } else {
    lines.push(`## ${AXIS_SOURCE.보완}`);
    const y = f.yongshinCompat;
    if (y.aHelpsB) lines.push(`- ${nameA}가 ${nameB}에게 필요한 기운을 채워준다`);
    if (y.bHelpsA) lines.push(`- ${nameB}가 ${nameA}에게 필요한 기운을 채워준다`);
    if (y.aHurtsB) lines.push(`- ${nameA}가 ${nameB}의 아픈 데를 건드린다`);
    if (y.bHurtsA) lines.push(`- ${nameB}가 ${nameA}의 아픈 데를 건드린다`);
    if (!y.aHelpsB && !y.bHelpsA && !y.aHurtsB && !y.bHurtsA) {
      lines.push("- 서로 채우지도, 건드리지도 않는다");
    }
    lines.push(`- 둘을 합치면 다섯 기운 중 ${f.elementCoverage.percent}%가 채워진다`);
  }
  lines.push("");

  // ── 시기
  if (dead.has("시기")) {
    lines.push(`## ${AXIS_SOURCE.시기} — 볼 수 없다. 단정하지 마라`);
  } else {
    lines.push(`## ${AXIS_SOURCE.시기}`);
    const years = f.fortuneCross.timingOverlapYears;
    lines.push(
      years.length > 0
        ? `- 둘 다 열리는 해: ${years.join(", ")}`
        : "- 둘 다 열리는 해는 보이지 않는다. ★없다고 나쁜 게 아니다 — 나쁘게 쓰지 마라",
    );
  }
  lines.push("");

  // ── 신살 교차 (양쪽에 겹칠 때만 의미)
  const shin: string[] = [];
  if (f.shinsalCross.dohwaBoth) shin.push("둘 다 사람 눈길을 끄는 결을 타고났다");
  if (f.shinsalCross.hongryeomBoth) shin.push("둘 다 끌림이 강한 결을 타고났다");
  if (f.shinsalCross.chuneul.a) shin.push(`${nameA}에게는 위기에 도와주는 사람이 붙는 결이 있다`);
  if (f.shinsalCross.chuneul.b) shin.push(`${nameB}에게는 위기에 도와주는 사람이 붙는 결이 있다`);
  if (shin.length) {
    lines.push("## 타고난 결");
    for (const s of shin) lines.push(`- ${s}`);
    lines.push("");
  }

  // ── 서버 확정 판정 (변경 금지)
  lines.push("## 서버가 확정한 판정 — 바꾸지 마라");
  lines.push(`- 종합: ${d.verdict}`);
  for (const key of ["마음", "생활", "보완", "시기"] as AxisKey[]) {
    const a = d.axes[key];
    lines.push(`- ${key}: ${a.verdict === "모름" ? "볼 수 없음" : a.verdict}`);
  }
  lines.push("");

  // ── ★couple 만의 무기
  lines.push("## 이 리포트가 1인 리포트와 달라야 하는 지점");
  lines.push(
    "- 상대가 실제로 여기 있다. 상상해서 그리지 마라. **같은 상황에서 둘이 어떻게 다르게 반응하는지**를 장면으로 보여줘라.",
  );
  lines.push(
    `- 예: 위 사실에서 나오는 ${nameA}의 반응과 ${nameB}의 반응을 한 장면 안에 나란히 놓아라. 한 사람 서술을 두 번 하지 마라.`,
  );

  return lines.join("\n");
}

/* ── 프롬프트 본체 ── */

/** 출력 블록. 상수와 프롬프트가 갈라지지 않게 한 곳에서 관리한다. */
export const COUPLE_BLOCK_KEYS = [
  "headline",      // 한 줄. 두 사람이 같은 상황에서 어떻게 갈리는지
  "mindScene",     // 마음의 결 — 장면으로
  "lifeScene",     // 생활의 결 — 장면으로
  "complement",    // 서로 채우는가
  "timing",        // 때가 맞는가
  "advice",        // 배열. 실제로 해볼 것
] as const;

const COUPLE_RULES = `
[역할]
너는 두 사람의 사주를 함께 읽어주는 두루미다. 한 사람이 아니라 **둘 사이**를 본다.

[말투]
- 반말로만 쓴다(~야/~거든/~어/~지/~잖아). 존댓말 어미 금지.
- 다정하되 무르지 않게. 위로로 뭉개지 마라.

[★이 리포트가 1인 리포트와 다른 지점 — 여기가 전부다]
- 상대가 실제로 여기 있다. "너에게 올 사람은 아마…" 같은 상상 서술을 쓰지 마라.
- **같은 상황에서 둘이 어떻게 다르게 반응하는지**를 장면으로 보여줘라.
  한 사람 이야기를 두 번 하지 말고, 한 장면 안에 둘을 나란히 놓아라.
- 장면은 위 사실에서 나와야 한다. 사실에 없는 사건을 지어내지 마라.

[★쓰지 말 것 — 닳은 표현과 반복되는 틀]
- 사주 글에서 이미 흔해진 비유는 쓰지 마라. 자연물에 빗대 "튼튼하다/흔들리지 않는다"고
  말하는 종류가 특히 그렇다.
- **문장 골격을 반복하지 마라.** 겉과 속을 대비시키는 틀, 상황을 가정해 장면으로 끌고 가는 틀 같은 것. 표현만 바꾸고 같은 틀을 쓰면 다른 사람 리포트가 같은 글로 읽힌다.
- 유행어·인터넷 밈·이모지.
- ★따라 쓸 예시 문장을 여기 적지 않는다. 적어두면 그대로 복제되기 때문이다
  (실측: 앞선 상품에서 프롬프트에 적은 예시가 리포트 5편 중 1편에 그대로 나왔다).
  위 사실에서 네가 새로 만들어라. 닳은 표현을 쓰면 검사에서 걸려 다시 쓰게 된다.

[★쓰면 안 되는 말]
- 명리 용어 전부(용신·기신·신약·신강·일지·월지·원진·육합·정관·도화살 등)와 한자.
  뜻으로 풀어 써라. 용어 뒤에 괄호로 설명을 다는 것도 금지다.
- 등급·점수·숫자 판정.
- 혼인 신분어(남편·아내·시댁·처가). "짝", "곁에 올 사람"처럼 중립으로.
- "결혼해라 / 하지 마라" 같은 지시, 이혼·이별 예언, "반드시 ~하게 된다" 같은 확정.
- 위 사실 블록에 없는 연도.

[출력]
JSON 하나만. 키는 정확히 이것들:
${COUPLE_BLOCK_KEYS.map((k) => `- ${k}`).join("\n")}
advice 는 문자열 배열, 나머지는 문자열.
`.trim();

export function buildCouplePrompt(
  f: PairFacts,
  d: CoupleDecision,
  names: { nameA: string; nameB: string },
): string {
  return `${buildCoupleFactsBlock(f, d, names)}\n\n${COUPLE_RULES}`;
}
