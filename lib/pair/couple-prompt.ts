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
    lines.push(`## ${AXIS_SOURCE.마음} — 볼 수 없다(단정하지 마라)`);
  } else {
    lines.push(`## ${AXIS_SOURCE.마음}`);
    lines.push(`- ${STEM_RELATION_LABEL[f.dayStemRelation.type] ?? f.dayStemRelation.type}`);
    if (f.tenStarExchange.aSeesB) {
      lines.push(`- ${nameA}에게 ${nameB}는 '${f.tenStarExchange.aSeesB}'로 온다`);
    }
    if (f.tenStarExchange.bSeesA) {
      lines.push(`- ${nameB}에게 ${nameA}는 '${f.tenStarExchange.bSeesA}'로 온다`);
    }
    if (f.spouseStarCross.aHitByB === true) lines.push(`- ${nameB}가 ${nameA}의 짝 자리에 실제로 걸린다`);
    if (f.spouseStarCross.bHitByA === true) lines.push(`- ${nameA}가 ${nameB}의 짝 자리에 실제로 걸린다`);
  }
  lines.push("");

  // ── 생활 (지지 매트릭스)
  if (dead.has("생활")) {
    lines.push(`## ${AXIS_SOURCE.생활} — 태어난 시간을 몰라 볼 수 없다(있다/없다 단정 금지)`);
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
    lines.push(`## ${AXIS_SOURCE.보완} — 태어난 시간을 몰라 볼 수 없다(단정 금지)`);
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
    lines.push(`## ${AXIS_SOURCE.시기} — 볼 수 없다(단정 금지)`);
  } else {
    lines.push(`## ${AXIS_SOURCE.시기}`);
    const years = f.fortuneCross.timingOverlapYears;
    lines.push(
      years.length > 0
        ? `- 둘 다 열리는 해: ${years.join(", ")}`
        : "- 둘 다 열리는 해는 보이지 않는다 (★없다고 나쁜 게 아니다. 나쁘게 쓰지 마라)",
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
