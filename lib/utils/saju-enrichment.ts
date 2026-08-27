export type KoreanElement = "목" | "화" | "토" | "금" | "수";
export type KoreanYinYang = "양" | "음";

export const STEM_ELEMENT: Record<
  string,
  { element: KoreanElement; yin_yang: KoreanYinYang; korean: string }
> = {
  甲: { element: "목", yin_yang: "양", korean: "갑" },
  乙: { element: "목", yin_yang: "음", korean: "을" },
  丙: { element: "화", yin_yang: "양", korean: "병" },
  丁: { element: "화", yin_yang: "음", korean: "정" },
  戊: { element: "토", yin_yang: "양", korean: "무" },
  己: { element: "토", yin_yang: "음", korean: "기" },
  庚: { element: "금", yin_yang: "양", korean: "경" },
  辛: { element: "금", yin_yang: "음", korean: "신" },
  壬: { element: "수", yin_yang: "양", korean: "임" },
  癸: { element: "수", yin_yang: "음", korean: "계" },
} as const;

export interface BranchInfo {
  element: KoreanElement;
  yin_yang: KoreanYinYang;
  korean: string;
  jijanggan: { stem: string; weight: number }[];
}

export const BRANCH_INFO: Record<string, BranchInfo> = {
  子: { element: "수", yin_yang: "양", korean: "자", jijanggan: [{ stem: "癸", weight: 10 }] },
  丑: {
    element: "토",
    yin_yang: "음",
    korean: "축",
    jijanggan: [
      { stem: "己", weight: 5 },
      { stem: "癸", weight: 3 },
      { stem: "辛", weight: 2 },
    ],
  },
  寅: {
    element: "목",
    yin_yang: "양",
    korean: "인",
    jijanggan: [
      // ★2026-08-26: 7/3/3(합 13)이었다. 12지지 중 寅만 합이 10이 아니었고,
      //   같은 생지인 巳(丙5·庚3·戊2)·申(庚5·壬3·戊2)의 3층 패턴과도 어긋났다.
      //   2층 지지(亥 壬7·甲3 / 午 丁7·己3)의 앞자리 7을 3층에 그대로 쓴 것으로 보인다.
      //   사령일수(정기 甲 > 중기 丙 > 여기 戊)와 정렬 순서는 그대로 유지된다.
      { stem: "甲", weight: 5 },
      { stem: "丙", weight: 3 },
      { stem: "戊", weight: 2 },
    ],
  },
  卯: { element: "목", yin_yang: "음", korean: "묘", jijanggan: [{ stem: "乙", weight: 10 }] },
  辰: {
    element: "토",
    yin_yang: "양",
    korean: "진",
    jijanggan: [
      { stem: "戊", weight: 5 },
      { stem: "乙", weight: 3 },
      { stem: "癸", weight: 2 },
    ],
  },
  巳: {
    element: "화",
    yin_yang: "음",
    korean: "사",
    jijanggan: [
      { stem: "丙", weight: 5 },
      { stem: "庚", weight: 3 },
      { stem: "戊", weight: 2 },
    ],
  },
  午: {
    element: "화",
    yin_yang: "양",
    korean: "오",
    jijanggan: [
      { stem: "丁", weight: 7 },
      { stem: "己", weight: 3 },
    ],
  },
  未: {
    element: "토",
    yin_yang: "음",
    korean: "미",
    jijanggan: [
      { stem: "己", weight: 5 },
      { stem: "丁", weight: 3 },
      { stem: "乙", weight: 2 },
    ],
  },
  申: {
    element: "금",
    yin_yang: "양",
    korean: "신",
    jijanggan: [
      { stem: "庚", weight: 5 },
      { stem: "壬", weight: 3 },
      { stem: "戊", weight: 2 },
    ],
  },
  酉: { element: "금", yin_yang: "음", korean: "유", jijanggan: [{ stem: "辛", weight: 10 }] },
  戌: {
    element: "토",
    yin_yang: "양",
    korean: "술",
    jijanggan: [
      { stem: "戊", weight: 5 },
      { stem: "辛", weight: 3 },
      { stem: "丁", weight: 2 },
    ],
  },
  亥: {
    element: "수",
    yin_yang: "음",
    korean: "해",
    jijanggan: [
      { stem: "壬", weight: 7 },
      { stem: "甲", weight: 3 },
    ],
  },
} as const;

export const GENERATES: Record<KoreanElement, KoreanElement> = {
  목: "화",
  화: "토",
  토: "금",
  금: "수",
  수: "목",
} as const;

export const CONTROLS: Record<KoreanElement, KoreanElement> = {
  목: "토",
  토: "수",
  수: "화",
  화: "금",
  금: "목",
} as const;

export const ELEMENT_TO_HANJA: Record<KoreanElement, string> = {
  목: "木",
  화: "火",
  토: "土",
  금: "金",
  수: "水",
} as const;

export function calculateElementDistribution(
  stems: string[],
  branches: string[]
): Record<KoreanElement, number> {
  const count: Record<KoreanElement, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };

  for (const stem of stems) {
    const meta = STEM_ELEMENT[stem];
    if (meta) count[meta.element] += 1;
  }

  for (const branch of branches) {
    const meta = BRANCH_INFO[branch];
    if (meta) count[meta.element] += 1;
  }

  return count;
}

export function analyzeElementBalance(dist: Record<KoreanElement, number>): {
  deficient: KoreanElement[];
  dominant: KoreanElement[];
} {
  const entries = Object.entries(dist) as [KoreanElement, number][];
  const deficient = entries.filter(([_, v]) => v === 0).map(([k]) => k);
  const maxVal = Math.max(...entries.map(([, v]) => v));
  const dominant =
    maxVal >= 3 ? entries.filter(([_, v]) => v === maxVal).map(([k]) => k) : [];
  return { deficient, dominant };
}

export function getTenStar(
  dayMasterElement: KoreanElement,
  dayMasterYinYang: KoreanYinYang,
  targetElement: KoreanElement,
  targetYinYang: KoreanYinYang
): string {
  const sameYY = dayMasterYinYang === targetYinYang;

  if (dayMasterElement === targetElement) {
    return sameYY ? "비견(比肩)" : "겁재(劫財)";
  }
  if (GENERATES[dayMasterElement] === targetElement) {
    return sameYY ? "식신(食神)" : "상관(傷官)";
  }
  if (CONTROLS[dayMasterElement] === targetElement) {
    return sameYY ? "편재(偏財)" : "정재(正財)";
  }
  if (CONTROLS[targetElement] === dayMasterElement) {
    return sameYY ? "편관(偏官)" : "정관(正官)";
  }
  if (GENERATES[targetElement] === dayMasterElement) {
    return sameYY ? "편인(偏印)" : "정인(正印)";
  }
  return "알수없음";
}

export function calculateTenStars(stems: string[], branches: string[]): string[] {
  const dayStem = stems[2];
  const dayMaster = STEM_ELEMENT[dayStem];
  if (!dayMaster) return [];

  const stars: Set<string> = new Set();

  // 년간, 월간, 시간 (시간은 없을 수 있음)
  [0, 1, 3].forEach((i) => {
    const targetStem = stems[i];
    if (!targetStem) return;
    const target = STEM_ELEMENT[targetStem];
    if (!target) return;
    stars.add(getTenStar(dayMaster.element, dayMaster.yin_yang, target.element, target.yin_yang));
  });

  // 지지 주기(지장간 중 weight 최대 = 첫 번째)
  branches.forEach((branch) => {
    const info = BRANCH_INFO[branch];
    const mainHidden = info?.jijanggan?.[0];
    const target = mainHidden ? STEM_ELEMENT[mainHidden.stem] : null;
    if (!target) return;
    stars.add(getTenStar(dayMaster.element, dayMaster.yin_yang, target.element, target.yin_yang));
  });

  return Array.from(stars);
}

/** calculateTenStars의 중복포함(개수보존) 버전 — 비겁 과다 등 십성 "개수" 판정용(스코어링 전용).
 *  Set 미사용. stems/branches는 호출부에서 시간미상 처리 완료된 배열을 받는다(=calculateTenStars와 동일 입력·동일 일간제외). */
export function calculateTenStarsFull(stems: string[], branches: string[]): string[] {
  const dayStem = stems[2];
  const dayMaster = STEM_ELEMENT[dayStem];
  if (!dayMaster) return [];
  const out: string[] = [];
  [0, 1, 3].forEach((i) => {
    const targetStem = stems[i];
    if (!targetStem) return;
    const target = STEM_ELEMENT[targetStem];
    if (!target) return;
    out.push(getTenStar(dayMaster.element, dayMaster.yin_yang, target.element, target.yin_yang));
  });
  branches.forEach((branch) => {
    const info = BRANCH_INFO[branch];
    const mainHidden = info?.jijanggan?.[0];
    const target = mainHidden ? STEM_ELEMENT[mainHidden.stem] : null;
    if (!target) return;
    out.push(getTenStar(dayMaster.element, dayMaster.yin_yang, target.element, target.yin_yang));
  });
  return out;
}

function findElementThatGenerates(dayMasterElement: KoreanElement): KoreanElement | null {
  const found = (Object.entries(GENERATES) as [KoreanElement, KoreanElement][]).find(
    ([_, v]) => v === dayMasterElement
  );
  return found?.[0] ?? null;
}

/** target을 극하는 오행을 찾는다 (CONTROLS[X] === target인 X) */
function findElementThatControls(target: KoreanElement): KoreanElement | null {
  const found = (Object.entries(CONTROLS) as [KoreanElement, KoreanElement][]).find(
    ([_, v]) => v === target
  );
  return found?.[0] ?? null;
}

// ── 용신(用神) 판정 ──

export interface YongshinResult {
  eokbu: KoreanElement;        // 억부용신 (주 용신)
  eokbuReason: string;         // "중화신강 → 관성(금) 보강"
  johu: KoreanElement | null;  // 조후용신 (계절 기반, null=해당 없음)
  johuReason: string | null;   // "하절(여름) → 수(水)로 열기 조절"
  gisin: KoreanElement;        // 기신 (병 진영에서 용신을 해치는 오행 — 억부 매핑)
  heesin: KoreanElement;       // 희신 (용신을 생하는 오행)
}

const STRONG_LEVELS: Set<StrengthLevel> = new Set(["극왕", "태강", "신강", "중화신강"]);

const SEASON_BY_BRANCH: Record<string, "spring" | "summer" | "autumn" | "winter"> = {
  寅: "spring", 卯: "spring", 辰: "spring",
  巳: "summer", 午: "summer", 未: "summer",
  申: "autumn", 酉: "autumn", 戌: "autumn",
  亥: "winter", 子: "winter", 丑: "winter",
};

export function determineYongshin(
  dayMasterElement: KoreanElement,
  strength: StrengthResult,
  elementDist: Record<KoreanElement, number>,
  monthBranch: string,
): YongshinResult {
  const isStrong = STRONG_LEVELS.has(strength.result);

  // 일간 기준 십성 오행 (전 분기 공유)
  const gwansung = findElementThatControls(dayMasterElement)!;
  const siksang = GENERATES[dayMasterElement];
  const jaesung = CONTROLS[dayMasterElement];
  const insung = findElementThatGenerates(dayMasterElement)!;
  const bigeop = dayMasterElement;

  // ── 억부용신 ──
  let eokbu: KoreanElement;
  let eokbuReason: string;

  // ★2026-08-27: 극왕에 관살이 없을 때의 두 갈래 처리.
  //
  //   기존 신강 분기는 후보를 분포 오름차순으로 정렬하므로, 원국에 관살이 0개면
  //   관성이 항상 최저값이 되어 **반드시** 용신으로 뽑혔다. 실사용자 실측에서
  //   극왕 146명 중 관살 0인 54명 전원이 관성 용신을 받고 있었다.
  //
  //   그런데 적천수천미 從象은 바로 그 명식을 종왕(從旺)으로 보고, 관살운을
  //   "犯旺, 凶禍立至"라 한다. 없는 관살을 약으로 처방하는 게 아니라 가장 꺼려야 할
  //   글자였다. 자사 사전 dict/data/gangyak/geukwang.ts 도 이미
  //   "종격이면 용신은 일반 극왕 논리와 정반대로 비겁·인성"이라 적고 있어,
  //   엔진만 사전과 고전을 못 따라가던 상태다.
  //
  //   ★단 "관살 0"만으로 종왕을 선언하지 않는다. 적천수 요건은
  //     "四柱皆比劫, 無官殺之制, 有印綬之生, 旺之極者, 從其旺神也"
  //   이고 ★"四柱皆比劫"은 문자 그대로다 — 비겁·인수 외에는 아무것도 없어야 한다.
  //   같은 장이 든 종왕 실례가 그것을 증명한다: **癸卯 乙卯 甲寅 乙亥** (목 6·수 2,
  //   식상·재성·관성 전부 0). 자사 사전 gangyak/geukwang.ts 도 "식상·재성·관성이
  //   한 글자도 없거나 매우 약한 자리에만 있을 때"라 적어 같은 기준이다.
  //
  //   ※주의 — 임철초 "局中印輕, 行傷食亦佳"는 **운(運)에서 식상이 올 때** 좋다는 말이지
  //     원국에 식상이 있어도 된다는 뜻이 아니다. 초안이 이 대목을 원국 조건으로 잘못 읽어
  //     식상 검사를 뺐다가 리뷰에서 잡혔다(실측 28명 중 22명이 식상 보유였다).
  //
  //   재성은 특히 무겁다. 임철초가 종왕에 재성을 두고 "遇財星, 群劫相爭, 九死一生"이라 하여
  //   관살(犯旺)보다 심하게 적는다.
  //
  //   그래서 갈래를 둘로 나눈다.
  //     (1) 종왕 = 극왕 + 관살0 + 재성0 + 식상0 + 인수>=1 … 왕신에 순응(비겁 용신)
  //     (2) 그 외 극왕 + 관살0 … 종왕은 아니지만 관성도 아니다. 관성을 후보에서 빼고
  //         남은 {식상, 재성} 중 최저를 쓴다. 왕한 비겁을 식상으로 설기하는 방향이라
  //         군겁쟁재(재성 보유 시)에도 맞는다.
  //
  //   ★스코프 한계: 태강(4득 3개)은 다루지 않는다. 적천수 요건이 "旺之極"이라 4득 4개인
  //     극왕이 최선의 근사이고, 태강까지 넓히면 같은 조건 29명이 추가로 뒤집힌다(실측).
  //     종격 오탐은 용신이 정반대로 나가므로 좁게 잡는 편이 안전하다.
  const jongwangEligible =
    strength.result === "극왕" &&
    (elementDist[gwansung] || 0) === 0 &&
    (elementDist[jaesung] || 0) === 0 &&
    (elementDist[siksang] || 0) === 0 &&   // ★四柱皆比劫 — 식상도 없어야 한다
    (elementDist[insung] || 0) >= 1;
  // 극왕은 STRONG_LEVELS 에 속하므로 isStrong 검사는 불필요하다(항상 참).
  const strongNoGwan = strength.result === "극왕" && (elementDist[gwansung] || 0) === 0;

  if (jongwangEligible) {
    eokbu = bigeop;
    eokbuReason = `극왕·관살 없음 → 종왕(從旺): 왕한 기세를 거스르지 않고 비겁(${bigeop}) 순응`;
  } else if (strongNoGwan) {
    // 관살이 원국에 없으므로 후보에서 제외. 남은 둘 중 분포 최저(동률 시 식상>재성).
    const candidates: { element: KoreanElement; label: string }[] = [
      { element: siksang, label: "식상" },
      { element: jaesung, label: "재성" },
    ];
    candidates.sort((a, b) => (elementDist[a.element] || 0) - (elementDist[b.element] || 0));
    const lowest = elementDist[candidates[0].element] || 0;
    const tied = candidates.filter(c => (elementDist[c.element] || 0) === lowest);
    tied.sort((a, b) => ["식상", "재성"].indexOf(a.label) - ["식상", "재성"].indexOf(b.label));
    eokbu = tied[0].element;
    eokbuReason = `${strength.result} → ${tied[0].label}(${eokbu}) 보강 (관살 부재로 관성 제외 — 犯旺 회피)`;
  } else if (isStrong) {
    // 신강: 관성/식상/재성 중 분포 최저. 동률 시 관성>식상>재성
    const candidates: { element: KoreanElement; label: string }[] = [
      { element: gwansung, label: "관성" },
      { element: siksang, label: "식상" },
      { element: jaesung, label: "재성" },
    ];
    candidates.sort((a, b) => (elementDist[a.element] || 0) - (elementDist[b.element] || 0));
    const lowest = elementDist[candidates[0].element] || 0;
    const priority = ["관성", "식상", "재성"];
    const tied = candidates.filter(c => (elementDist[c.element] || 0) === lowest);
    tied.sort((a, b) => priority.indexOf(a.label) - priority.indexOf(b.label));

    eokbu = tied[0].element;
    eokbuReason = `${strength.result} → ${tied[0].label}(${eokbu}) 보강`;
  } else {
    // 신약: 인성/비겁 중 분포 최저. 동률 시 인성>비겁
    const candidates: { element: KoreanElement; label: string }[] = [
      { element: insung, label: "인성" },
      { element: bigeop, label: "비겁" },
    ];
    candidates.sort((a, b) => (elementDist[a.element] || 0) - (elementDist[b.element] || 0));
    const lowest = elementDist[candidates[0].element] || 0;
    const priority = ["인성", "비겁"];
    const tied = candidates.filter(c => (elementDist[c.element] || 0) === lowest);
    tied.sort((a, b) => priority.indexOf(a.label) - priority.indexOf(b.label));

    eokbu = tied[0].element;
    eokbuReason = `${strength.result} → ${tied[0].label}(${eokbu}) 보강`;
  }

  // ── 조후용신 ──
  const season = SEASON_BY_BRANCH[monthBranch] ?? null;
  let johu: KoreanElement | null = null;
  let johuReason: string | null = null;

  if (season === "summer") {
    johu = "수";
    johuReason = "하절(여름) → 수(水)로 열기 조절";
  } else if (season === "winter") {
    johu = "화";
    johuReason = "동절(겨울) → 화(火)로 한기 보충";
  }

  // ── 기신 / 희신 ──
  // 희신: 자평 정통 매핑. 단순 "용신을 생하는 오행"으로 잡으면
  // 신강+식상/재성 용신 케이스에서 비겁이 희신으로 잡혀 자기모순.
  // 격국 사전(lib/dict/data/gyeokguk/*)의 정통 매핑과 일치시킨다.
  //   신강 + 관성 → 재성 (재생관)
  //   신강 + 식상 → 재성 (식상생재)
  //   신강 + 재성 → 식상 (식상생재)
  //   신약 + 인성 → 관성 (관인상생)
  //   신약 + 비겁 → 인성 (인성생비겁)
  let heesin: KoreanElement;
  if (jongwangEligible) {
    // 종왕은 왕신에 순응하므로 그 왕신을 생하는 인수가 희신이다.
    //   임철초 "運行比劫印綬則吉" — 비겁·인수 운이 길.
    // ★식상을 희신으로 두는 대안도 있다. 같은 주석이 "局中印輕, 行傷食亦佳"라 하여
    //   인수가 가벼우면 식상운도 좋다고 하기 때문이다. 다만 (a) 이 게이트는 인수>=1 을
    //   요구하므로 印輕 케이스가 드물고(실측 29명 중 2명), (b) 원문이 인수를 먼저 들며,
    //   (c) 신약 매핑(인성생비겁)과 대칭이라 인수를 택했다. 식상 보유자는 아래 주석 참조.
    heesin = insung;
  } else if (isStrong) {
    if (eokbu === gwansung) heesin = jaesung;
    else if (eokbu === siksang) heesin = jaesung;
    else heesin = siksang;
  } else {
    if (eokbu === insung) heesin = gwansung;
    else heesin = insung;
  }

  // 기신: 희신과 같은 형식의 억부 매핑.
  //
  // ★2026-08-26: 기존은 `findElementThatControls(eokbu)` — "용신을 극하는 오행"이었다.
  //   그 공식은 자평 명리가 아니라 **육효(六爻)**의 정의다("忌神: 克用神之爻就叫做忌神").
  //   육효는 용신이 점치는 대상 그 자체라 성립하지만, 자평 억부에서 용신은 균형 수단이라
  //   그대로 옮기면 모순이 난다. 실제로 신강 분기의 용신 후보는 {관성·식상·재성}인데,
  //   관성이 뽑히는 순간 방금까지 동급 후보였던 식상이 기신이 됐다 — 약을 병이라 부른 셈.
  //
  //   자평의 기신은 "용신을 극하는 것"이 아니라 **체와 용을 손상하는 것**이다.
  //     적천수 하지장 "忌神者, 損害體用之神也 … 以忌神為病, 以喜神為藥"
  //     신봉통고 병약설 "何以為之病？原八字中原所害之神也"
  //   즉 원국의 병(病)이 먼저고 용신(藥)이 거기서 도출된다. 기존 구현은 인과가 거꾸로였다.
  //
  //   매핑 원리(도출): 기신 = 억부상 병 진영(신강이면 비겁·인성 / 신약이면 식상·재성·관성)에
  //   속하면서 용신과 직접 극 관계인 오행.
  //     신강 + 관성 → 비겁   (병=왕한 비겁을 관살로 제압하는 명식. 실측 62.5%가 비겁주도)
  //     신강 + 식상 → 인성   (효신탈식 — 자평진전 "食神逢梟")
  //     신강 + 재성 → 비겁   (군겁쟁재 — 자평진전 "財輕比重")
  //     신약 + 인성 → 재성   (탐재괴인 — 연해자평 "貪財壞印")
  //     신약 + 비겁 → 관성   (관살이 약한 일간을 직접 극)
  //
  //   ★한계(공시): 신강의 원인이 인성 과다인 명식은 이상적 기신이 인성이다(적천수 반국
  //     "母慈滅子"). 지금 매핑은 원인을 보지 않는다. 용신 규칙 v2 과제.
  //     종격 중 ★종왕만 2026-08-27 에 처리했다(아래 분기). 종강·종아·종재·종살과 화격은
  //     여전히 미산출이며, 태강 이하의 종왕 후보도 스코프에서 뺐다.
  const bigyeop = dayMasterElement; // 비겁 = 일간과 같은 오행

  // ★종왕(2026-08-27): 억부 진영 매핑이 그대로 적용되지 않는다. 왕신에 순응하는 격이라
  //   "병"은 원국 안이 아니라 그 순응을 깨는 운에 있다. 임철초가 둘을 명시한다 —
  //     관살 "官殺運, 謂之犯旺, 凶禍立至"
  //     재성 "遇財星, 群劫相爭, 九死一生"
  //   재성이 더 무겁게 적히지만 이 게이트는 재성 0을 요구하므로 원국에 재성이 없다.
  //   그래서 기신은 관성으로 둔다(원국에 없더라도 운에서 가장 꺼리는 글자).
  //   ※우리 엔진에는 구신(仇神) 필드가 없어 재성 경고는 여기 주석으로만 남긴다.
  const gisin: KoreanElement = jongwangEligible
    ? gwansung
    : isStrong
      ? (eokbu === siksang ? insung : bigyeop)
      : (eokbu === insung ? jaesung : gwansung);

  // 불변식 — 이 버그는 assert 하나만 있었어도 잡혔다.
  if (process.env.NODE_ENV !== "production") {
    if (jongwangEligible) {
      // 종왕은 신강 진영 규칙(badCamp=[비겁,인성])에 안 맞는다. 전용 불변식으로 검사한다.
      console.assert(eokbu === bigyeop, `[종왕] 용신이 비겁이 아님: ${eokbu}`);
      console.assert(heesin === insung, `[종왕] 희신이 인성이 아님: ${heesin}`);
      console.assert(gisin === gwansung, `[종왕] 기신이 관성이 아님: ${gisin}`);
      console.assert(gisin !== eokbu && gisin !== heesin, `[종왕] 기신 중복: ${gisin}`);
    } else {
      const badCamp = isStrong ? [bigyeop, insung] : [siksang, jaesung, gwansung];
      console.assert(badCamp.includes(gisin), `[기신] 진영 위반: ${isStrong ? "신강" : "신약"} → ${gisin}`);
      console.assert(gisin !== eokbu, `[기신] 용신과 동일: ${gisin}`);
      console.assert(gisin !== heesin, `[기신] 희신과 동일: ${gisin}`);
    }
  }

  return { eokbu, eokbuReason, johu, johuReason, gisin, heesin };
}

// ── 12운성 기반 생왕지 판정 유틸 ──

const TWELVE_STAGE_NAMES = ["장생","목욕","관대","건록","제왕","쇠","병","사","묘","절","태","양"] as const;
const BRANCHES_SEQ = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"] as const;
const YANG_STEMS_SET = new Set(["甲","丙","戊","庚","壬"]);

const YANG_BIRTH_BRANCH: Record<string, string> = { "甲": "亥", "丙": "寅", "戊": "寅", "庚": "巳", "壬": "申" };
const YIN_BIRTH_BRANCH: Record<string, string> = { "乙": "午", "丁": "酉", "己": "酉", "辛": "子", "癸": "卯" };


/** 일간 기준 특정 지지의 12운성 한글명을 반환 */
function getTwelveStageForBranch(dayStem: string, branch: string): string {
  const isYang = YANG_STEMS_SET.has(dayStem);
  const birthBranch = isYang ? YANG_BIRTH_BRANCH[dayStem] : YIN_BIRTH_BRANCH[dayStem];
  if (!birthBranch) return "알수없음";
  const birthIdx = BRANCHES_SEQ.indexOf(birthBranch as typeof BRANCHES_SEQ[number]);
  const targetIdx = BRANCHES_SEQ.indexOf(branch as typeof BRANCHES_SEQ[number]);
  if (birthIdx < 0 || targetIdx < 0) return "알수없음";
  const stageIdx = isYang
    ? (targetIdx - birthIdx + 12) % 12
    : (birthIdx - targetIdx + 12) % 12;
  return TWELVE_STAGE_NAMES[stageIdx];
}

/**
 * 월령을 얻었는가 — 왕상휴수(旺相休囚) 기준.
 * 지지의 본기(정기) 오행이 일간과 비화(旺)이거나 일간을 생하면(相) 득.
 *
 * ★2026-08-25: 여기서 12운성 생왕지 경로를 제거했다.
 *   기존 하이브리드는 "12운성이 장생·관대·건록·제왕이면 오행과 무관하게 득"으로 쳤는데,
 *   그렇게 추가되는 조합이 정확히 13개이고 **전부 일간을 돕지 않는 십성**이었다
 *   (칠살 4: 戊寅·庚巳·壬戌·癸丑 / 식상 6 / 재성 3). 칠살월 — 일간이 가장 극을 받는 달 —
 *   을 득령으로 세는 셈이라 왕상휴수와 방향이 정반대다.
 *   고전이 이 방식을 직접 반박한다:
 *     적천수 주석 "甲木死於午…而乙木死於亥, 亥中有壬水, 乃其嫡母, 何為死哉?"
 *     임철초 "不專以順逆為憑, 須觀日主之衰旺 … 至於長生沐浴等名, 乃假借形容之辭也"
 *     서락오 "陰長生…皆因誤於陰陽各有長生, 而不能自圓其說也"
 *   양간은 12운성 생왕지와 통근처가 대체로 겹쳐 문제가 안 보이지만, 음간은 역행이라
 *   그 일치가 깨지고 깨지는 지점이 전부 '가짜 득'이 된다.
 */
export function isWangSangBranch(dayStem: string, branch: string): boolean {
  const branchInfo = BRANCH_INFO[branch];
  const stemInfo = STEM_ELEMENT[dayStem];
  if (!branchInfo || !stemInfo) return false;
  const mainHidden = branchInfo.jijanggan[0]; // 본기 (첫 번째 = 최고 weight)
  if (!mainHidden) return false;
  const hiddenElement = STEM_ELEMENT[mainHidden.stem]?.element;
  if (!hiddenElement) return false;
  const dayElement = stemInfo.element;
  if (hiddenElement === dayElement) return true;             // 비화(旺)
  if (GENERATES[hiddenElement] === dayElement) return true;  // 인성(相)
  return false;
}

/**
 * 일지·시지가 일간을 받쳐 주는가 — 통근(通根) 기준.
 *
 * ★통근은 본기만이 아니라 지장간 **전층**(여기·중기·정기)에서 인정한다.
 *   자평진전 「논음양생사」 "就使逢庫, 亦為有根"
 *   서락오 평주 "天干通根, 不僅祿旺為美, 長生·餘氣·墓庫皆其根也.
 *              如甲乙木見寅卯, 固為身旺, 而見亥辰未, 亦為有根也"
 *   → 甲木이 辰을 봐도 유근이다(辰 중기 乙木). 본기만 보면 이걸 놓친다.
 *
 * ★음양은 가리지 않는다 — 서락오 "墓本從五行論, 不分陰陽也".
 * ★개고(형충해야 창고를 쓴다)는 넣지 않는다 — 자평진전 "投庫而必沖者, 俗書之謬也",
 *   임철초 "刑沖傷吾本根之氣. 此種謬論, 必宜一切掃除也", 서락오 "逢庫必沖之說, 謬誤可嗤".
 *
 * 통근(비겁)이 없으면 본기 인성만 생조로 인정한다. 미약한 여기·중기 인성까지
 * '득'으로 치는 학설은 없어서, 통근과 생조를 구분한다.
 */
export function hasRootOrInseong(dayStem: string, branch: string): boolean {
  const branchInfo = BRANCH_INFO[branch];
  const stemInfo = STEM_ELEMENT[dayStem];
  if (!branchInfo || !stemInfo) return false;
  const dayElement = stemInfo.element;
  // 1) 통근 — 지장간 전층에 일간과 같은 오행이 있으면 뿌리
  for (const hidden of branchInfo.jijanggan) {
    if (STEM_ELEMENT[hidden.stem]?.element === dayElement) return true;
  }
  // 2) 생조 — 본기 오행이 일간을 생하는 경우만
  const mainHidden = branchInfo.jijanggan[0];
  const hiddenElement = mainHidden ? STEM_ELEMENT[mainHidden.stem]?.element : undefined;
  return !!hiddenElement && GENERATES[hiddenElement] === dayElement;
}

export type StrengthLevel = "극왕" | "태강" | "신강" | "중화신강" | "중화신약" | "신약" | "태약" | "극약";

export interface StrengthDetails {
  deukryeong: boolean;  // 득령 — 월지 12운성이 생왕지
  deukji: boolean;      // 득지 — 일지 12운성이 생왕지
  deuksi: boolean;      // 득시 — 시지 12운성이 생왕지
  deukse: boolean;      // 득세 — 천간(일간 제외) 비겁/인성 2개 이상
}

export interface StrengthResult {
  result: StrengthLevel;
  helpCount: number;
  resistCount: number;
  details: StrengthDetails;
  legacy: "신강" | "신약" | "추정 신강" | "추정 신약";
}

export interface StrengthContext {
  monthBranch: string;
  dayBranch: string;
  hourBranch?: string;    // 시주 미상 시 undefined
  allBranches: string[];
  allStems: string[];
  dayStem: string;
}

export function judgeStrength(
  dayMasterElement: KoreanElement,
  elementDist: Record<KoreanElement, number>,
  totalCount: number,
  isTimeUnknown: boolean,
  context?: StrengthContext,
): StrengthResult {
  const generatesMe = findElementThatGenerates(dayMasterElement);

  const helpCount =
    (elementDist[dayMasterElement] || 0) + (generatesMe ? elementDist[generatesMe] || 0 : 0);
  const resistCount = Math.max(0, totalCount - helpCount);

  const baseLegacy: "신강" | "신약" = helpCount >= resistCount ? "신강" : "신약";

  // context 없으면 레거시 결과만 반환 (하위 호환)
  if (!context) {
    const legacy: StrengthResult["legacy"] = isTimeUnknown
      ? baseLegacy === "신강" ? "추정 신강" : "추정 신약"
      : baseLegacy;
    return {
      result: baseLegacy === "신강" ? "신강" : "신약",
      helpCount,
      resistCount,
      details: { deukryeong: false, deukji: false, deuksi: false, deukse: false },
      legacy,
    };
  }

  // ── 4가지 세부 판정 ──
  // ★득령과 통근은 다른 축이다. 득령은 월령(왕상휴수)을 얻었는가이고,
  //   득지·득시는 그 자리에 뿌리가 있는가다. 임철초가 둘을 분리해 말한다 —
  //   "日干不論月令休囚, 只要四柱有根, 便能受財官食神而當傷官七殺".
  //   甲木 辰월의 정답은 '득령'이 아니라 '부득령이지만 유근'이다.

  // 득령: 월지 본기가 비겁(旺)·인성(相)인가
  const deukryeong = isWangSangBranch(context.dayStem, context.monthBranch);

  // 득지: 일지에 뿌리(지장간 전층) 또는 본기 생조가 있는가
  const deukji = hasRootOrInseong(context.dayStem, context.dayBranch);

  // 득시: 시지 동일 기준 (시주 미상 시 false)
  const deuksi = context.hourBranch
    ? hasRootOrInseong(context.dayStem, context.hourBranch)
    : false;

  // 득세: 천간(일간 제외) 중 비겁(같은 오행) 또는 인성(일간을 생하는 오행)이 2개 이상
  let helpStemCount = 0;
  for (let i = 0; i < context.allStems.length; i++) {
    if (i === 2) continue; // 일간 자신 제외
    const stemInfo = STEM_ELEMENT[context.allStems[i]];
    if (!stemInfo) continue;
    if (stemInfo.element === dayMasterElement) helpStemCount++;
    else if (generatesMe && stemInfo.element === generatesMe) helpStemCount++;
  }
  const deukse = helpStemCount >= 2;

  const details: StrengthDetails = { deukryeong, deukji, deuksi, deukse };

  // ── 8단계 종합 판정 ──
  const trueCount = [deukryeong, deukji, deuksi, deukse].filter(Boolean).length;
  const helpRatio = totalCount > 0 ? helpCount / totalCount : 0;
  const dayMasterCount = elementDist[dayMasterElement] || 0;

  let result: StrengthLevel;
  if (trueCount === 4) {
    result = "극왕";
  } else if (trueCount === 3 && helpRatio > 0.6) {
    result = "태강";
  } else if (trueCount === 3) {
    result = "신강";
  } else if (trueCount === 2 && helpCount >= resistCount) {
    result = "중화신강";
  } else if (trueCount === 2) {
    result = "중화신약";
  } else if (trueCount === 1) {
    result = "신약";
  } else if (trueCount <= 1 && dayMasterCount === 0) {
    // 일간 오행이 사주에 전혀 없음 → 극약
    result = "극약";
  } else if (trueCount <= 1) {
    // deficiency check: 결핍 오행 2개 이상이면 태약
    const deficientCount = (Object.values(elementDist) as number[]).filter(v => v === 0).length;
    result = deficientCount >= 2 ? "태약" : "신약";
  } else {
    result = "신약";
  }

  // legacy: 8단계 → 이진 매핑
  const isStrong = ["극왕", "태강", "신강", "중화신강"].includes(result);
  const legacy: StrengthResult["legacy"] = isTimeUnknown
    ? isStrong ? "추정 신강" : "추정 신약"
    : isStrong ? "신강" : "신약";

  return { result, helpCount, resistCount, details, legacy };
}

export const YUKAP: [string, string, KoreanElement][] = [
  ["子", "丑", "토"], // 자축합토
  ["寅", "亥", "목"], // 인해합목
  ["卯", "戌", "화"], // 묘술합화
  ["辰", "酉", "금"], // 진유합금
  ["巳", "申", "수"], // 사신합수
  ["午", "未", "화"], // 오미합화(토)
];

export const SAMHAP: [string, string, string, KoreanElement][] = [
  ["申", "子", "辰", "수"], // 신자진 수국
  ["寅", "午", "戌", "화"], // 인오술 화국
  ["巳", "酉", "丑", "금"], // 사유축 금국
  ["亥", "卯", "未", "목"], // 해묘미 목국
];

export const YUKCHUNG: [string, string][] = [
  ["子", "午"],
  ["丑", "未"],
  ["寅", "申"],
  ["卯", "酉"],
  ["辰", "戌"],
  ["巳", "亥"],
];

export const HYUNG: [string[], string][] = [
  [["寅", "巳", "申"], "무은지형(無恩之刑)"],
  [["丑", "戌", "未"], "지세지형(持勢之刑)"],
  [["子", "卯"], "무례지형(無禮之刑)"],
  [["辰", "辰"], "자형(自刑)"],
  [["午", "午"], "자형(自刑)"],
  [["酉", "酉"], "자형(自刑)"],
  [["亥", "亥"], "자형(自刑)"],
];

export function findRelationships(branches: string[]): {
  hap: string[];
  chung: string[];
  hyung: string[];
} {
  const result = { hap: [] as string[], chung: [] as string[], hyung: [] as string[] };
  const branchSet = new Set(branches);

  for (const [a, b, elem] of YUKAP) {
    if (branchSet.has(a) && branchSet.has(b)) {
      const label = `${BRANCH_INFO[a].korean}${BRANCH_INFO[b].korean}합${elem}`;
      const hanja = ELEMENT_TO_HANJA[elem];
      result.hap.push(`${label}(${a}${b}合${hanja})`);
    }
  }

  for (const [a, b, c, elem] of SAMHAP) {
    const count = [a, b, c].filter((x) => branchSet.has(x)).length;
    if (count === 3) {
      result.hap.push(
        `${BRANCH_INFO[a].korean}${BRANCH_INFO[b].korean}${BRANCH_INFO[c].korean} 삼합${elem}국(三合)`
      );
    }
  }

  for (const [a, b] of YUKCHUNG) {
    if (branchSet.has(a) && branchSet.has(b)) {
      result.chung.push(`${BRANCH_INFO[a].korean}${BRANCH_INFO[b].korean}충(${a}${b}沖)`);
    }
  }

  // 자형 판정용: 같은 글자가 두 개 이상 있어야 성립하므로 Set이 아닌 count 기준
  const branchCount = branches.reduce<Record<string, number>>((acc, b) => {
    acc[b] = (acc[b] ?? 0) + 1;
    return acc;
  }, {});

  for (const [group, name] of HYUNG) {
    // 자형: group이 [X, X] 형태 — 같은 글자가 사주에 두 개 이상 있을 때만 성립
    if (group.length === 2 && group[0] === group[1]) {
      if ((branchCount[group[0]] ?? 0) >= 2) {
        const label = group.map((x) => BRANCH_INFO[x].korean).join("");
        result.hyung.push(`${label}형(${group.join("")}刑) ${name}`);
      }
      continue;
    }
    if (group.length <= 2) {
      if (group.every((x) => branchSet.has(x))) {
        const label = group.map((x) => BRANCH_INFO[x].korean).join("");
        result.hyung.push(`${label}형(${group.join("")}刑) ${name}`);
      }
    } else {
      const matches = group.filter((x) => branchSet.has(x));
      if (matches.length >= 2) {
        const label = matches.map((x) => BRANCH_INFO[x].korean).join("");
        result.hyung.push(`${label}형(${matches.join("")}刑) ${name}`);
      }
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────
// 원진(怨嗔) · 방합(方合) 매트릭스 (한자 기반)
// — findRelationships()는 4기둥 내부 관계만 다루지만,
//   두 사주 비교(today·pet·battle 등)에서 원진/방합 검출 필요.
// — 모든 모듈은 이 마스터 상수를 import해야 함 (인라인 복사 금지).
// ────────────────────────────────────────────────────────

export const WONJIN: [string, string][] = [
  ["子", "未"],  // 자미 원진
  ["丑", "午"],  // 축오 원진
  ["寅", "酉"],  // 인유 원진
  ["卯", "申"],  // 묘신 원진
  ["辰", "亥"],  // 진해 원진
  ["巳", "戌"],  // 사술 원진
];

export const BANGHAP: [string, string, string, KoreanElement][] = [
  ["寅", "卯", "辰", "목"],  // 동방 목국
  ["巳", "午", "未", "화"],  // 남방 화국
  ["申", "酉", "戌", "금"],  // 서방 금국
  ["亥", "子", "丑", "수"],  // 북방 수국
];

// ────────────────────────────────────────────────────────
// 두 사주 비교용 헬퍼 — 두 지지 한자 받아 관계 반환
// today/pet/battle 등 모듈이 사용. 인라인 매트릭스 복사 금지.
// ────────────────────────────────────────────────────────

export type PairRelation =
  | "hap"          // 6합
  | "samhap"       // 삼합 반합
  | "banghap"      // 방합 반방합
  | "chung"        // 6충
  | "hyung"        // 형
  | "wonjin"       // 원진
  | "same"         // 동일 지지
  | "none";

export function getPairRelation(branchA: string, branchB: string): {
  type: PairRelation;
  label: string;       // 한글 라벨 (UI/프롬프트용)
  hanjaLabel: string;  // 한자 라벨
} {
  if (!branchA || !branchB) {
    return { type: "none", label: "특별한 관계 없음", hanjaLabel: "" };
  }

  // 6합
  for (const [a, b, elem] of YUKAP) {
    if ((a === branchA && b === branchB) || (b === branchA && a === branchB)) {
      const kor = `${BRANCH_INFO[a].korean}${BRANCH_INFO[b].korean}합${elem} (끌림·결합)`;
      return { type: "hap", label: kor, hanjaLabel: `${a}${b}合${ELEMENT_TO_HANJA[elem]}` };
    }
  }

  // 6충 (마스터 YUKCHUNG 사용)
  for (const [a, b] of YUKCHUNG) {
    if ((a === branchA && b === branchB) || (b === branchA && a === branchB)) {
      const kor = `${BRANCH_INFO[a].korean}${BRANCH_INFO[b].korean}충 (정면 충돌)`;
      return { type: "chung", label: kor, hanjaLabel: `${a}${b}沖` };
    }
  }

  // 형
  for (const [group, name] of HYUNG) {
    // 자형 (XX 같은 글자 2개): 두 글자가 같고 group[0]과도 같으면 성립
    if (group.length === 2 && group[0] === group[1]) {
      if (branchA === branchB && branchA === group[0]) {
        const kor = `${BRANCH_INFO[group[0]].korean}${BRANCH_INFO[group[1]].korean}형 (${name})`;
        return { type: "hyung", label: kor, hanjaLabel: `${group[0]}${group[1]}刑` };
      }
      continue;
    }
    // 다중 글자 형 (인사신·축술미·자묘): 둘 다 group에 속하고 다른 글자면 성립
    if (group.length > 1 && group.includes(branchA) && group.includes(branchB) && branchA !== branchB) {
      const kor = `${BRANCH_INFO[branchA].korean}${BRANCH_INFO[branchB].korean}형 (${name})`;
      return { type: "hyung", label: kor, hanjaLabel: `${branchA}${branchB}刑` };
    }
  }

  // 원진
  for (const [a, b] of WONJIN) {
    if ((a === branchA && b === branchB) || (b === branchA && a === branchB)) {
      const kor = `${BRANCH_INFO[a].korean}${BRANCH_INFO[b].korean}원진 (미운 정·보이지 않는 충돌)`;
      return { type: "wonjin", label: kor, hanjaLabel: `${a}${b}怨嗔` };
    }
  }

  // 삼합 반합 (두 글자가 같은 삼합 그룹)
  for (const [a, b, c, elem] of SAMHAP) {
    const group = [a, b, c];
    if (group.includes(branchA) && group.includes(branchB) && branchA !== branchB) {
      const kor = `${BRANCH_INFO[branchA].korean}${BRANCH_INFO[branchB].korean} 삼합 반합${elem} (같은 의지)`;
      return { type: "samhap", label: kor, hanjaLabel: `${branchA}${branchB}半合${ELEMENT_TO_HANJA[elem]}` };
    }
  }

  // 방합 반방합 (두 글자가 같은 방합 그룹)
  for (const [a, b, c, elem] of BANGHAP) {
    const group = [a, b, c];
    if (group.includes(branchA) && group.includes(branchB) && branchA !== branchB) {
      const kor = `${BRANCH_INFO[branchA].korean}${BRANCH_INFO[branchB].korean} 방합 반방합${elem} (같은 계절)`;
      return { type: "banghap", label: kor, hanjaLabel: `${branchA}${branchB}半方合${ELEMENT_TO_HANJA[elem]}` };
    }
  }

  // 동일 지지
  if (branchA === branchB) {
    return {
      type: "same",
      label: `${BRANCH_INFO[branchA].korean}${BRANCH_INFO[branchA].korean} 동일 지지 (안정·반복)`,
      hanjaLabel: `${branchA}${branchA}`,
    };
  }

  return {
    type: "none",
    label: `${BRANCH_INFO[branchA].korean}-${BRANCH_INFO[branchB].korean} 특별한 합·충 없음`,
    hanjaLabel: `${branchA}-${branchB}`,
  };
}

/** @deprecated 내부 로직은 SHINSAL_DEFS 사용. 외부 참조용으로만 유지. */
export const DOHWA: Record<string, string> = {
  子: "酉", 丑: "午", 寅: "卯", 卯: "子", 辰: "酉", 巳: "午",
  午: "卯", 未: "子", 申: "酉", 酉: "午", 戌: "卯", 亥: "子",
} as const;

/** @deprecated 내부 로직은 SHINSAL_DEFS 사용. 외부 참조용으로만 유지. */
export const YEOKMA: Record<string, string> = {
  子: "寅", 丑: "亥", 寅: "申", 卯: "巳", 辰: "寅", 巳: "亥",
  午: "申", 未: "巳", 申: "寅", 酉: "亥", 戌: "申", 亥: "巳",
} as const;

/** @deprecated 내부 로직은 SHINSAL_DEFS 사용. 외부 참조용으로만 유지. */
export const HWAGAE: Record<string, string> = {
  子: "辰", 丑: "丑", 寅: "戌", 卯: "未", 辰: "辰", 巳: "丑",
  午: "戌", 未: "未", 申: "辰", 酉: "丑", 戌: "戌", 亥: "未",
} as const;

/** @deprecated 내부 로직은 SHINSAL_DEFS 사용. 외부 참조용으로만 유지. */
export const HYUNCHIM_STEMS = ["甲", "辛"] as const;

// ── 신살 시스템 KR_COMMON_V1 ──

export const SHINSAL_RULESET = "KR_COMMON_V1" as const;

export type SamhapGroup = "인오술" | "사유축" | "신자진" | "해묘미";
export type ShinsalType = "good" | "bad" | "neutral";

export type PillarPosition = "year" | "month" | "day" | "hour";

export interface ShinsalMatch {
  key: string;
  label: string;
  type: ShinsalType;
  evidence: string[];
  detectedAt: PillarPosition[];
}

export interface ShinsalResult {
  ruleset: typeof SHINSAL_RULESET;
  matches: ShinsalMatch[];
  labels: string[];
  meta: { note?: string };
}

interface ShinsalContext {
  dayStem: string;
  dayBranch: string;
  yearBranch: string;
  monthBranch: string;
  allBranches: string[];
  otherBranches: string[];       // 일지(index 2) 제외 — 일간/백호 등
  otherBranchSet: Set<string>;
  samhapOtherBranches: string[]; // 년지(index 0) 제외 — 삼합 기반 신살
  samhapOtherBranchSet: Set<string>;
  allStems: string[];
  otherStems: string[];          // stems에서 index 2(일간) 제외
  otherStemSet: Set<string>;
  isTimeUnknown: boolean;
  samhapGroup: SamhapGroup;      // 년지 기반 삼합그룹
  sexagenaryIndex: number;       // 일주 60갑자 인덱스
}

interface ShinsalDef {
  key: string;
  label: string;
  type: ShinsalType;
  requiredPillars: 3 | 4;
  detect: (ctx: ShinsalContext) => ShinsalMatch | null;
}

const BRANCH_TO_SAMHAP_GROUP: Record<string, SamhapGroup> = {
  寅: "인오술", 午: "인오술", 戌: "인오술",
  巳: "사유축", 酉: "사유축", 丑: "사유축",
  申: "신자진", 子: "신자진", 辰: "신자진",
  亥: "해묘미", 卯: "해묘미", 未: "해묘미",
};

// 삼합 기반 룩업 (4-entry)
const SAMHAP_DOHWA: Record<SamhapGroup, string> = {
  "인오술": "卯", "사유축": "午", "신자진": "酉", "해묘미": "子",
};
const SAMHAP_YEOKMA: Record<SamhapGroup, string> = {
  "인오술": "申", "사유축": "亥", "신자진": "寅", "해묘미": "巳",
};
const SAMHAP_HWAGAE: Record<SamhapGroup, string> = {
  "인오술": "戌", "사유축": "丑", "신자진": "辰", "해묘미": "未",
};
// KR_COMMON_V1 겁살 — 삼합 그룹의 역마 대충(對沖) 지지.
// 근거: 연해자평·명리정의 계열 표 기준, 학파 간 일치도 높음.
const SAMHAP_GYEOPSAL: Record<SamhapGroup, string> = {
  "인오술": "亥", "사유축": "寅", "신자진": "巳", "해묘미": "申",
};

// 일간 기반 룩업
const YANGIN_STEMS: Record<string, string> = {
  "甲": "卯", "丙": "午", "戊": "午", "庚": "酉", "壬": "子",
};
// 천을귀인: 자평 정통 — "갑무경 우양(甲戊庚 牛羊)·을기 서후(乙己 鼠猴)·병정 저계(丙丁 猪雞)·임계 토사(壬癸 兔蛇)·신 마호(辛 馬虎)"
const CHUNEUL_STEMS: Record<string, string[]> = {
  "甲": ["丑", "未"], "戊": ["丑", "未"], "庚": ["丑", "未"],
  "乙": ["子", "申"], "己": ["子", "申"],
  "丙": ["亥", "酉"], "丁": ["亥", "酉"],
  "辛": ["寅", "午"],
  "壬": ["卯", "巳"], "癸": ["卯", "巳"],
};
const MUNCHANG_STEMS: Record<string, string> = {
  "甲": "巳", "乙": "午", "丙": "申", "丁": "酉", "戊": "申",
  "己": "酉", "庚": "亥", "辛": "子", "壬": "寅", "癸": "卯",
};
const HONGRYEOM_STEMS: Record<string, string> = {
  "甲": "午", "乙": "申", "丙": "寅", "丁": "未", "戊": "辰",
  "己": "辰", "庚": "戌", "辛": "酉", "壬": "子", "癸": "申",
};

// ── 신규 삼합 기반 룩업 ──
const SAMHAP_JANGSEONG: Record<SamhapGroup, string> = {
  "인오술": "午", "사유축": "酉", "신자진": "子", "해묘미": "卯",
};
const SAMHAP_JAESAL: Record<SamhapGroup, string> = {
  "인오술": "子", "사유축": "卯", "신자진": "午", "해묘미": "酉",
};
const SAMHAP_CHEONSAL: Record<SamhapGroup, string> = {
  "인오술": "丑", "사유축": "辰", "신자진": "未", "해묘미": "戌",
};
// 12신살에서 지살은 각 삼합 그룹의 생지(장생 자리). 인오술 화국의 생지=寅, 신자진 수국의 생지=申 등.
const SAMHAP_JISAL: Record<SamhapGroup, string> = {
  "인오술": "寅", "사유축": "巳", "신자진": "申", "해묘미": "亥",
};
// 12신살에서 망신은 각 삼합 그룹의 록(건록) 자리. 인오술 록=巳(병화), 사유축 록=申(경금), 신자진 록=亥(임수), 해묘미 록=寅(갑목).
const SAMHAP_MANGSIN: Record<SamhapGroup, string> = {
  "인오술": "巳", "사유축": "申", "신자진": "亥", "해묘미": "寅",
};

// ── 백호살 — 60갑자 7종 일주 (4성 28수 백호 자리) ──
// 표준 명리학: 일주(또는 시주·월주·년주)가 이 7개 중 하나일 때 백호 발동.
// 모두 일지가 4고지(辰·戌·丑·未)이고 일간이 천을귀인 그룹과 짝을 이룸.
const BAEKHO_PILLARS = new Set(["戊辰", "丁丑", "丙戌", "乙未", "甲辰", "癸丑", "壬戌"]);

// ── 괴강살 — 일주 조합 ──
const GOEGANG_PILLARS = new Set(["庚辰", "庚戌", "壬辰", "壬戌"]);

// ── 천덕귀인 — 월지 기준 ──
const CHEONDEOK_TABLE: Record<string, string> = {
  "寅": "丁", "卯": "申", "辰": "壬", "巳": "辛", "午": "亥", "未": "甲",
  "申": "癸", "酉": "寅", "戌": "丙", "亥": "乙", "子": "巳", "丑": "庚",
};

// ── 월덕귀인 — 월지 그룹 기준 (천간 타겟) ──
const WOLDEOK_TABLE: Record<string, string> = {
  "寅": "丙", "午": "丙", "戌": "丙",
  "申": "壬", "子": "壬", "辰": "壬",
  "巳": "庚", "酉": "庚", "丑": "庚",
  "亥": "甲", "卯": "甲", "未": "甲",
};

// ── 학당귀인 — 일간 기준 ──
const HAKDANG_STEMS: Record<string, string> = {
  "甲": "亥", "乙": "午", "丙": "寅", "戊": "寅",
  "丁": "酉", "己": "酉", "庚": "巳", "辛": "子",
  "壬": "申", "癸": "卯",
};

// ── 60갑자 인덱스 계산 ──
const STEMS_SEQ = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const BRANCHES_SEQ_SHINSAL = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

function getSexagenaryIndex(stem: string, branch: string): number {
  const s = STEMS_SEQ.indexOf(stem);
  const b = BRANCHES_SEQ_SHINSAL.indexOf(branch);
  if (s < 0 || b < 0) return -1;
  return (6 * s - 5 * b + 60) % 60;
}

// ── 공망 지지 계산 ──
function getGongmangBranches(sexagenaryIndex: number): [string, string] {
  const group = Math.floor(sexagenaryIndex / 10);
  const idx1 = 10 - 2 * group;
  const idx2 = 11 - 2 * group;
  return [BRANCHES_SEQ_SHINSAL[idx1], BRANCHES_SEQ_SHINSAL[idx2]];
}

const PILLAR_NAMES = ["년지", "월지", "일지", "시지"];
const PILLAR_POSITIONS: PillarPosition[] = ["year", "month", "day", "hour"];

function branchKorean(branch: string): string {
  return BRANCH_INFO[branch]?.korean ?? branch;
}

function stemKorean(stem: string): string {
  return STEM_ELEMENT[stem]?.korean ?? stem;
}

/** allBranches에서 target과 일치하는 모든 pillar position 반환 (skipIndex 위치 제외) */
function findBranchPositions(allBranches: string[], target: string, skipIndex?: number): PillarPosition[] {
  const positions: PillarPosition[] = [];
  for (let i = 0; i < allBranches.length; i++) {
    if (skipIndex !== undefined && i === skipIndex) continue;
    if (allBranches[i] === target) positions.push(PILLAR_POSITIONS[i]);
  }
  return positions;
}

function makeSamhapMatch(
  key: string, label: string, type: ShinsalType,
  ctx: ShinsalContext, table: Record<SamhapGroup, string>, shinsalName: string
): ShinsalMatch | null {
  const target = table[ctx.samhapGroup];
  if (!target || !ctx.samhapOtherBranchSet.has(target)) return null;
  // 삼합 기반: 년지(index 0) 제외한 위치에서 감지
  const detectedAt = findBranchPositions(ctx.allBranches, target, 0);
  return {
    key, label, type,
    evidence: [
      `년지 ${ctx.yearBranch}(${branchKorean(ctx.yearBranch)}) → 삼합 ${ctx.samhapGroup} → ${shinsalName} ${target}(${branchKorean(target)})`,
    ],
    detectedAt,
  };
}

const SHINSAL_DEFS: ShinsalDef[] = [
  // ── 삼합 기반 (yearBranch-samhap) ──
  {
    key: "dohwa", label: "도화살(桃花殺)", type: "neutral", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_DOHWA, "도화"); },
  },
  {
    key: "yeokma", label: "역마살(驛馬殺)", type: "neutral", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_YEOKMA, "역마"); },
  },
  {
    key: "hwagae", label: "화개살(華蓋殺)", type: "neutral", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_HWAGAE, "화개"); },
  },
  {
    key: "gyeopsal", label: "겁살(劫殺)", type: "bad", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_GYEOPSAL, "겁살"); },
  },
  // ── 일간 기반 (dayStem) ──
  {
    key: "yangin", label: "양인살(羊刃殺)", type: "bad", requiredPillars: 3,
    detect(ctx) {
      const target = YANGIN_STEMS[ctx.dayStem];
      if (!target || !ctx.allBranches.includes(target)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일간 ${ctx.dayStem}(양간) → 양인 ${target}(${branchKorean(target)})`],
        detectedAt: findBranchPositions(ctx.allBranches, target),
      };
    },
  },
  {
    key: "chuneul", label: "천을귀인(天乙貴人)", type: "good", requiredPillars: 3,
    detect(ctx) {
      const targets = CHUNEUL_STEMS[ctx.dayStem];
      if (!targets) return null;
      const found = targets.filter((t) => ctx.allBranches.includes(t));
      if (found.length === 0) return null;
      const detectedAt: PillarPosition[] = [];
      for (const t of found) {
        for (const p of findBranchPositions(ctx.allBranches, t)) {
          if (!detectedAt.includes(p)) detectedAt.push(p);
        }
      }
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [
          `일간 ${ctx.dayStem} → 천을귀인 ${targets.map((t) => `${t}(${branchKorean(t)})`).join("·")}`,
          ...found.map((t) => `${branchKorean(t)}지에 ${t} 존재`),
        ],
        detectedAt,
      };
    },
  },
  {
    key: "munchang", label: "문창귀인(文昌貴人)", type: "good", requiredPillars: 3,
    detect(ctx) {
      const target = MUNCHANG_STEMS[ctx.dayStem];
      if (!target || !ctx.allBranches.includes(target)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일간 ${ctx.dayStem} → 문창 ${target}(${branchKorean(target)})`],
        detectedAt: findBranchPositions(ctx.allBranches, target),
      };
    },
  },
  {
    key: "hongryeom", label: "홍염살(紅艶殺)", type: "neutral", requiredPillars: 3,
    detect(ctx) {
      // ★일지 포함(2026-07-28 수정). 홍염살은 통설에서 **일주로 정의**되는 신살이라
      //   (甲午·丙寅·丁未·戊辰·庚戌·壬子·辛酉 가 교과서적 홍염 일주) 일지를 빼면
      //   대표 사례를 통째로 놓친다. 실측: 400명 격자에서 9.3%가 일지 홍염인데 미검출이었고,
      //   누락 일주 목록이 정확히 위 고전 목록과 일치했다.
      //   otherBranchSet(일지 제외)은 다른 일간기반 신살(양인·천을)과 공유하므로 건드리지 않고
      //   여기서만 allBranches 를 쓴다.
      const target = HONGRYEOM_STEMS[ctx.dayStem];
      if (!target || !ctx.allBranches.includes(target)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일간 ${ctx.dayStem} → 홍염 ${target}(${branchKorean(target)})`],
        detectedAt: findBranchPositions(ctx.allBranches, target),
      };
    },
  },
  // ── 일간 형태 (dayStem-shape) ──
  {
    key: "hyunchim", label: "현침살(懸針殺)", type: "bad", requiredPillars: 3,
    detect(ctx) {
      if (!(HYUNCHIM_STEMS as readonly string[]).includes(ctx.dayStem)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일간 ${ctx.dayStem} 자형(字形)이 현침에 해당`],
        detectedAt: ["day"],
      };
    },
  },
  // ── 신규 삼합 기반 ──
  {
    key: "jangseong", label: "장성살(將星殺)", type: "good", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_JANGSEONG, "장성"); },
  },
  {
    key: "jaesal", label: "재살(災殺)", type: "bad", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_JAESAL, "재살"); },
  },
  {
    key: "cheonsal", label: "천살(天殺)", type: "bad", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_CHEONSAL, "천살"); },
  },
  {
    key: "jisal", label: "지살(地殺)", type: "bad", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_JISAL, "지살"); },
  },
  {
    // 한자 표기 통일(2026-08-03): 둘째 글자 身→神 표준화 (사전 sipisinsal/mangsinsal.ts와 동일 표기).
    // 라벨 문자열 소비처는 한글 keyword includes 매칭(pet hasShinsalKey "도화"/"역마" 등,
    // marriage-facts "도화"/"홍염")뿐이라 검출·점수 로직 무영향.
    key: "mangsin", label: "망신살(亡神殺)", type: "bad", requiredPillars: 3,
    detect(ctx) { return makeSamhapMatch(this.key, this.label, this.type, ctx, SAMHAP_MANGSIN, "망신"); },
  },
  // ── 백호살 — 60갑자 7종 일주(또는 다른 기둥)에 들 때 발동 ──
  {
    key: "baekho", label: "백호살(白虎殺)", type: "bad", requiredPillars: 3,
    detect(ctx) {
      if (!ctx.allStems || ctx.allStems.length !== ctx.allBranches.length) return null;
      const matchedPositions: PillarPosition[] = [];
      const matchedPillars: string[] = [];
      for (let i = 0; i < ctx.allBranches.length; i++) {
        const pillar = ctx.allStems[i] + ctx.allBranches[i];
        if (BAEKHO_PILLARS.has(pillar)) {
          matchedPositions.push(PILLAR_POSITIONS[i]);
          matchedPillars.push(pillar);
        }
      }
      if (matchedPositions.length === 0) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`백호 일주 ${matchedPillars.join("·")} 발견`],
        detectedAt: matchedPositions,
      };
    },
  },
  // ── 괴강살 (일주 조합) ──
  {
    key: "goegang", label: "괴강살(魁罡殺)", type: "neutral", requiredPillars: 3,
    detect(ctx) {
      const dayPillar = ctx.dayStem + ctx.dayBranch;
      if (!GOEGANG_PILLARS.has(dayPillar)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일주 ${dayPillar}(${stemKorean(ctx.dayStem)}${branchKorean(ctx.dayBranch)})이 괴강에 해당`],
        detectedAt: ["day"],
      };
    },
  },
  // ── 공망 (일주 60갑자 기반) ──
  {
    key: "gongmang", label: "공망(空亡)", type: "neutral", requiredPillars: 3,
    detect(ctx) {
      if (ctx.sexagenaryIndex < 0) return null;
      const [gm1, gm2] = getGongmangBranches(ctx.sexagenaryIndex);
      const matchNames: string[] = [];
      const detectedAt: PillarPosition[] = [];
      for (let i = 0; i < ctx.allBranches.length; i++) {
        if (i === 2) continue;
        if (ctx.allBranches[i] === gm1 || ctx.allBranches[i] === gm2) {
          matchNames.push(PILLAR_NAMES[i]);
          detectedAt.push(PILLAR_POSITIONS[i]);
        }
      }
      if (matchNames.length === 0) return null;
      return {
        key: this.key,
        label: matchNames.map(pos => `공망(空亡)-${pos}`).join(", "),
        type: this.type,
        evidence: [
          `일주 60갑자 → 공망 ${gm1}(${branchKorean(gm1)})·${gm2}(${branchKorean(gm2)})`,
          ...matchNames.map(pos => `${pos}에 공망 해당`),
        ],
        detectedAt,
      };
    },
  },
  // ── 천덕귀인 (월지 기준) ──
  {
    key: "cheondeok", label: "천덕귀인(天德貴人)", type: "good", requiredPillars: 3,
    detect(ctx) {
      const target = CHEONDEOK_TABLE[ctx.monthBranch];
      if (!target) return null;
      // ★2026-08-25: 일주(일간·일지) 제외를 걷어냈다. 천덕·월덕은 기준점이 월지라
      //   일주를 뺄 이유가 없고, 삼명통회 「論天月德」은 오히려 그 자리를 으뜸으로 친다 —
      //   "凡命中帶凶煞, 得此二德扶化, 凶不為甚; 須要日上見, 時上不犯克沖刑破, 方吉".
      //   기존 코드는 otherBranchSet/otherStemSet(일간 기반 신살용 제외 집합)을 빌려 써서
      //   고전이 가장 좋다고 하는 자리만 골라 못 보고 있었다. 근거 주석·커밋도 없었다.
      const isBranch = BRANCHES_SEQ_SHINSAL.includes(target);
      const allStemsArr = ctx.allStems ?? [];
      const found = isBranch
        ? ctx.allBranches.includes(target)
        : allStemsArr.includes(target);
      if (!found) {
        const foundOther = isBranch
          ? allStemsArr.includes(target)
          : ctx.allBranches.includes(target);
        if (!foundOther) return null;
      }
      // 천덕은 천간/지지 모두 가능하므로 지지에서 감지된 위치만 기록
      const detectedAt = isBranch ? findBranchPositions(ctx.allBranches, target) : [];
      // 천간에서 발견된 경우 해당 천간의 주 위치
      if (!isBranch && ctx.allStems) {
        for (let i = 0; i < ctx.allStems.length; i++) {
          if (ctx.allStems[i] === target && !detectedAt.includes(PILLAR_POSITIONS[i])) {
            detectedAt.push(PILLAR_POSITIONS[i]);
          }
        }
      }
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`월지 ${ctx.monthBranch}(${branchKorean(ctx.monthBranch)}) → 천덕 ${target}`],
        detectedAt: detectedAt.length > 0 ? detectedAt : ["month"],
      };
    },
  },
  // ── 월덕귀인 (월지 그룹 → 천간) ──
  {
    key: "woldeok", label: "월덕귀인(月德貴人)", type: "good", requiredPillars: 3,
    detect(ctx) {
      // ★2026-08-25: 일간 제외 해제(위 천덕과 같은 사유).
      //   사전 woldeok-gwiin.ts 도 "일간이 직접 월덕에 해당하면 본인 자체가 덕망을 갖춘
      //   사람으로 봅니다"라고 적어, 기존 엔진만 사전·고전과 어긋나 있었다.
      const target = WOLDEOK_TABLE[ctx.monthBranch];
      if (!target || !(ctx.allStems ?? []).includes(target)) return null;
      const detectedAt: PillarPosition[] = [];
      if (ctx.allStems) {
        for (let i = 0; i < ctx.allStems.length; i++) {
          if (ctx.allStems[i] === target) detectedAt.push(PILLAR_POSITIONS[i]);
        }
      }
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`월지 ${ctx.monthBranch}(${branchKorean(ctx.monthBranch)}) → 월덕 ${target}(${stemKorean(target)})`],
        detectedAt: detectedAt.length > 0 ? detectedAt : ["month"],
      };
    },
  },
  // ── 학당귀인 (일간 → 지지) ──
  {
    key: "hakdang", label: "학당귀인(學堂貴人)", type: "good", requiredPillars: 3,
    detect(ctx) {
      const target = HAKDANG_STEMS[ctx.dayStem];
      if (!target || !ctx.allBranches.includes(target)) return null;
      return {
        key: this.key, label: this.label, type: this.type,
        evidence: [`일간 ${ctx.dayStem}(${stemKorean(ctx.dayStem)}) → 학당 ${target}(${branchKorean(target)})`],
        detectedAt: findBranchPositions(ctx.allBranches, target),
      };
    },
  },
];

export function findShinsal(
  dayBranch: string,
  dayStem: string,
  monthBranch: string,
  allBranches: string[],
  isTimeUnknown: boolean,
  allStems?: string[],
): ShinsalResult {
  const yearBranch = allBranches[0] ?? "";
  const otherBranches = allBranches.filter((_, i) => i !== 2);       // 일지 제외 (일간 기반 신살용)
  const samhapOtherBranches = allBranches.filter((_, i) => i !== 0); // 년지 제외 (삼합 기반 신살용)
  const stems = allStems ?? [];
  const otherStems = stems.filter((_, i) => i !== 2);
  const ctx: ShinsalContext = {
    dayStem, dayBranch, yearBranch, monthBranch, allBranches, otherBranches,
    otherBranchSet: new Set(otherBranches),
    samhapOtherBranches,
    samhapOtherBranchSet: new Set(samhapOtherBranches),
    allStems: stems,
    otherStems,
    otherStemSet: new Set(otherStems),
    isTimeUnknown,
    samhapGroup: BRANCH_TO_SAMHAP_GROUP[yearBranch],
    sexagenaryIndex: getSexagenaryIndex(dayStem, dayBranch),
  };

  const matches: ShinsalMatch[] = [];
  for (const def of SHINSAL_DEFS) {
    if (def.requiredPillars === 4 && isTimeUnknown) continue;
    const match = def.detect(ctx);
    if (match) matches.push(match);
  }

  const meta: ShinsalResult["meta"] = {};
  if (isTimeUnknown) {
    meta.note = "시주 미상으로 일부 변동 가능";
  }

  return { ruleset: SHINSAL_RULESET, matches, labels: matches.map((m) => m.label), meta };
}

export interface TwelveStageEntry {
  korean: string;    // "장생", "목욕", ...
  hanja: string;     // "長生", "沐浴", ...
  meaning: string;   // "새로운 시작, 성장의 기운"
  strength: "strong" | "neutral" | "weak";
}

export interface EnrichedSajuData {
  pillars: { year: string; month: string; day: string; hour: string | null };
  dayMaster: { stem: string; element: KoreanElement; yinYang: KoreanYinYang; korean: string };
  elementDist: Record<KoreanElement, number>;
  elementAnalysis: { deficient: KoreanElement[]; dominant: KoreanElement[] };
  strength: StrengthResult;
  tenStars: string[];
  tenStarsFull: string[];
  relationships: { hap: string[]; chung: string[]; hyung: string[] };
  shinsal: ShinsalResult;
  twelveStages: {
    year: TwelveStageEntry;
    month: TwelveStageEntry;
    day: TwelveStageEntry;
    hour: TwelveStageEntry | null;
  };
  yongshin: YongshinResult;
  pillar12Shinsal: Pillar12ShinsalResult;
  isTimeUnknown: boolean;
}

// ── 12신살 위치별 매핑 (년지 기준) ──

const TWELVE_SHINSAL_NAMES = [
  "겁살", "재살", "천살", "지살", "년살", "월살",
  "망신살", "장성살", "반안살", "역마살", "육해살", "화개살",
] as const;

export type TwelveShinsalName = (typeof TWELVE_SHINSAL_NAMES)[number];

const GEOBSAL_START: Record<SamhapGroup, number> = {
  "인오술": 11, // 亥
  "사유축": 2,  // 寅
  "신자진": 5,  // 巳
  "해묘미": 8,  // 申
};

const TWELVE_SHINSAL_TYPE: Record<TwelveShinsalName, ShinsalType> = {
  "겁살": "bad", "재살": "bad", "천살": "bad", "지살": "bad",
  "년살": "neutral", "월살": "neutral", "망신살": "bad",
  "장성살": "good", "반안살": "neutral", "역마살": "neutral",
  "육해살": "bad", "화개살": "neutral",
};

export interface Pillar12ShinsalEntry {
  name: TwelveShinsalName;
  type: ShinsalType;
  branch: string;        // 해당 주의 지지 한자
  branchKorean: string;  // 해당 주의 지지 한글
}

export interface Pillar12ShinsalResult {
  year: Pillar12ShinsalEntry;
  month: Pillar12ShinsalEntry;
  day: Pillar12ShinsalEntry;
  hour: Pillar12ShinsalEntry | null;
}

/**
 * 12신살 위치별 매핑 — 년지(年支) 기준, 4기둥 동일 적용.
 *
 * 기준 근거:
 * - 고전·주류 산출법 = 년지 삼합 기준. 사이트 사전(lib/dict/data/sipisinsal/intro.ts
 *   "산출 기준: 년지(年支)를 기준으로…")과 조견표가 이 기준으로 작성돼 있다.
 * - 일지 기준 유파도 실재하지만, 그 경우에도 4기둥 전체에 같은 기준을 적용한다.
 * - 과거 구현("방법B", 82184d3)은 년주만 일지 삼합·나머지는 년지 삼합을 쓰는 혼합
 *   방식이었는데, 이런 per-기둥 혼합을 쓰는 유파 근거를 찾지 못했고 사전 조견표와
 *   년주 값이 어긋나는 실측 불일치(윤경호·태연·서인국 글)가 확인되어 년지 기준으로
 *   통일했다 (2026-08-03).
 * - 년지 기준의 필연적 결과: 년지는 자기 삼합 그룹에 속하므로 년주 12신살은 항상
 *   지살(생지)·장성살(왕지)·화개살(고지) 중 하나다. 이는 조견표와 동일한 표준 결과.
 */
export function getPillar12Shinsal(
  allBranches: string[],
  isTimeUnknown: boolean,
): Pillar12ShinsalResult {
  const yearBranch = allBranches[0];
  const dayBranch = allBranches[2];

  const yearGroup = BRANCH_TO_SAMHAP_GROUP[yearBranch]; // 년지 삼합 → 4기둥 전체에 사용

  function getShinsalForBranch(branch: string, group: SamhapGroup): Pillar12ShinsalEntry {
    const branchIdx = BRANCHES_SEQ_SHINSAL.indexOf(branch);
    const startIdx = GEOBSAL_START[group];
    const stageIdx = (branchIdx - startIdx + 12) % 12;
    const name = TWELVE_SHINSAL_NAMES[stageIdx];
    return {
      name,
      type: TWELVE_SHINSAL_TYPE[name],
      branch,
      branchKorean: BRANCH_INFO[branch]?.korean ?? branch,
    };
  }

  return {
    year: getShinsalForBranch(yearBranch, yearGroup),
    month: getShinsalForBranch(allBranches[1], yearGroup),
    day: getShinsalForBranch(dayBranch, yearGroup),
    hour: isTimeUnknown ? null : getShinsalForBranch(allBranches[3], yearGroup),
  };
}

// ── 신살 설명 ──

export const SHINSAL_DESCRIPTIONS: Record<string, string> = {
  // 삼합 기반
  dohwa: "이성을 끄는 매력",
  yeokma: "변화와 이동의 기운",
  hwagae: "학문·예술 재능",
  gyeopsal: "재물 손실 주의",
  jangseong: "리더십과 통솔력",
  jaesal: "재난·사고 주의",
  cheonsal: "정신적 시련 주의",
  jisal: "주거 변동 주의",
  mangsin: "명예 실추 주의",
  // 일간 기반
  yangin: "강한 기운, 다툼 주의",
  chuneul: "귀인의 도움",
  munchang: "학업·시험 유리",
  hongryeom: "이성 매력, 감정 기복",
  hyunchim: "손재주, 기술 재능",
  // 기타
  baekho: "수술·사고 주의",
  goegang: "성격 강함, 리더십",
  gongmang: "기운이 비어있음",
  cheondeok: "재앙을 면함",
  woldeok: "매달 복이 들어옴",
  hakdang: "배움의 재능",
  // 12신살 (위치별)
  "겁살": "재물 손실 주의",
  "재살": "재난·사고 주의",
  "천살": "정신적 시련 주의",
  "지살": "주거 변동 주의",
  "년살": "이성 구설 주의",
  "월살": "건강·가정 변동",
  "망신살": "명예 실추 주의",
  "장성살": "리더십과 통솔력",
  "반안살": "안정과 편안함",
  "역마살": "변화와 이동의 기운",
  "육해살": "가까운 이와 갈등 주의",
  "화개살": "학문·예술 재능",
};

// ── 신강/신약 8단계 설명 ──

export const STRENGTH_DESCRIPTIONS: Record<string, string> = {
  "극왕": "에너지 과잉 상태",
  "태강": "기운이 매우 강함",
  "신강": "기운이 강한 편",
  "중화신강": "기운이 적당히 강함",
  "중화신약": "기운이 적당히 약함",
  "신약": "기운이 약한 편",
  "태약": "기운이 매우 약함",
  "극약": "에너지 결핍 상태",
};

export function formatEnrichedSajuText(data: EnrichedSajuData): string {
  const lines: string[] = [];

  const hourPart = data.isTimeUnknown ? "미상" : `${data.pillars.hour}`;
  lines.push(
    `년주: ${data.pillars.year} / 월주: ${data.pillars.month} / 일주: ${data.pillars.day} / 시주: ${hourPart}`
  );

  lines.push(
    `일간: ${data.dayMaster.stem}(${data.dayMaster.korean}${data.dayMaster.element}, ${data.dayMaster.yinYang}${data.dayMaster.element})`
  );

  const distStr = (["목", "화", "토", "금", "수"] as KoreanElement[])
    .map((e) => `${e}(${data.elementDist[e]})`)
    .join(" ");

  const defStr =
    data.elementAnalysis.deficient.length > 0
      ? ` → ${data.elementAnalysis.deficient.join(",")} 결핍`
      : "";
  const domStr =
    data.elementAnalysis.dominant.length > 0
      ? ` / ${data.elementAnalysis.dominant.join(",")} 과다`
      : "";
  const timeNote = data.isTimeUnknown ? " (시주 미상으로 불완전)" : "";
  lines.push(`오행분포: ${distStr}${defStr}${domStr}${timeNote}`);

  const strengthNote = data.isTimeUnknown ? " (시주 미상)" : "";
  const d = data.strength.details;
  const detailStr = d
    ? ` [득령${d.deukryeong ? "✅" : "❌"} 득지${d.deukji ? "✅" : "❌"} 득시${d.deuksi ? "✅" : "❌"} 득세${d.deukse ? "✅" : "❌"}]`
    : "";
  lines.push(
    `신강/신약: ${data.strength.result}${detailStr} (일간 도움 세력 ${data.strength.helpCount} vs 억제 세력 ${data.strength.resistCount})${strengthNote}`
  );

  const starNote = data.isTimeUnknown ? " (시주 제외)" : "";
  lines.push(`십성: ${data.tenStars.join(" ")}${starNote}`);

  const rels: string[] = [];
  if (data.relationships.hap.length > 0) rels.push(data.relationships.hap.join(", "));
  if (data.relationships.chung.length > 0) rels.push(data.relationships.chung.join(", "));
  if (data.relationships.hyung.length > 0) rels.push(data.relationships.hyung.join(", "));
  const relNote = data.isTimeUnknown ? " (시주 제외)" : "";
  lines.push(`합충형: ${rels.length > 0 ? rels.join(" / ") : "없음"}${relNote}`);

  if (data.twelveStages) {
    const ts = data.twelveStages;
    const parts = [
      `년-${ts.year.korean}(${ts.year.hanja})`,
      `월-${ts.month.korean}(${ts.month.hanja})`,
      `일-${ts.day.korean}(${ts.day.hanja})`,
      ts.hour ? `시-${ts.hour.korean}(${ts.hour.hanja})` : "시-미상",
    ];
    lines.push(`12운성: ${parts.join(" / ")}`);
  }

  const ssNote = data.isTimeUnknown ? " (시주 제외)" : "";
  const shinsalLabels = data.shinsal?.labels ?? [];
  if (shinsalLabels.length > 0) {
    const parts = data.shinsal.matches.map((m) =>
      `${m.label} [${m.evidence.join(", ")}]`
    );
    lines.push(`신살: ${parts.join(", ")}${ssNote}`);
  } else {
    lines.push(`신살: 없음${ssNote}`);
  }

  // 용신
  if (data.yongshin) {
    const y = data.yongshin;
    const eokbuHanja = ELEMENT_TO_HANJA[y.eokbu];
    let yongLine = `용신: 억부용신-${y.eokbu}(${eokbuHanja}) [${y.eokbuReason}]`;
    if (y.johu) {
      const johuHanja = ELEMENT_TO_HANJA[y.johu];
      yongLine += ` / 조후용신-${y.johu}(${johuHanja}) [${y.johuReason}]`;
    }
    lines.push(yongLine);
    const gisinHanja = ELEMENT_TO_HANJA[y.gisin];
    const heesinHanja = ELEMENT_TO_HANJA[y.heesin];
    let gisinLine = `기신: ${y.gisin}(${gisinHanja}) / 희신: ${y.heesin}(${heesinHanja})`;

    // ★2026-08-27: 조후용신과 기신이 같은 오행일 때 우선순위를 결정론적으로 명시한다.
    //
    //   조후는 계절(월지)만 보고 선언되고 기신은 억부에서 도출되므로, 둘이 같은 오행을
    //   가리키는 경우가 생긴다(전 사용자 3,285명 중 282명 실측). 그동안은 한 프롬프트에
    //   "조후용신-수(水) … / 기신: 수(水)"가 나란히 나가 LLM에게 모순 지시가 됐다.
    //
    //   ★조후를 숨기는 방식(johu=null)은 쓰지 않는다. 세 가지 이유다.
    //     ① 자사 사전 dict/data/yongshin/johu.ts "억부와 갈릴 때"가 이미
    //        "갈리는 경우엔 어느 쪽 결핍이 더 시급한지를 따집니다"라고 가르친다.
    //        엔진이 갈리는 순간 숨기면 사전과 어긋나는 4층 드리프트를 새로 만든다.
    //     ② 원전과 방향이 반대다. 궁통보감·서락오 평주의 원칙은 "調候為急" —
    //        한열이 치우친 사주일수록 조후가 억부보다 급하다. 그런데 충돌이 나는 집단이
    //        바로 하절·동절생, 즉 조후가 가장 필요한 사람들이다. 거기서만 조후를 지우면
    //        우선순위를 거꾸로 적용하는 셈이다.
    //     ③ 출력이 빈약해진다. battle-prompt 는 건강운을 "조후용신 중심"으로 풀라 하고,
    //        analysis 의 조후 지침도 개인화 레버다. 계절 축이 통째로 사라진다.
    //
    //   대신 시급성을 원국 보유량으로 판정한다 — 사전이 말한 "어느 쪽 결핍이 더 시급한가"를
    //   그대로 수치화한 것이다. 임계는 0 / 1 / 2+ 세 갈래로 고정한다.
    if (y.johu && y.johu === y.gisin) {
      const n = data.elementDist?.[y.johu] ?? 0;
      const johuHanja2 = ELEMENT_TO_HANJA[y.johu];
      // ★종왕은 위 3분기를 타면 안 된다. 종왕의 기신은 관성이고 게이트가 관살 0을 요구하므로
      //   조후 오행 개수가 **항상 0** — 즉 전원이 n=0("조후위급, 채워라") 분기에 떨어진다.
      //   그런데 임철초는 종왕에 관살을 두고 "官殺運, 謂之犯旺, 凶禍立至"라 한다.
      //   가장 꺼려야 할 오행을 "채우라"고 지시하게 되므로 종왕은 별도 문구로 가른다.
      //   ★우선순위 판단: 조후위급(調候為急)보다 종격 판정이 앞선다. 종격은 억부·조후를
      //   적용할 국면 자체를 바꾸는 판정이라, 그 안에서 조후를 이유로 금기 오행을 권할 수 없다.
      //   실측 2026-08-27: 종왕 28명 중 6명이 이 교집합.
      if (y.eokbuReason.includes("종왕")) {
        gisinLine += ` [★종왕 우선 — 계절상 ${y.johu}(${johuHanja2})가 아쉬운 배치이긴 하나, 이 사주는 왕한 기세에 순응하는 종왕격이라 그 오행이 최대 금기다(犯旺). 조후를 이유로 채우라고 하지 마라. 계절 얘기는 "있었으면 좋았을 조건" 정도로만 짧게 언급하고, 처방은 비겁·인성 쪽으로 하라]`;
      } else if (n === 0) {
        gisinLine += ` [★조후 충돌 — 억부상 기신이지만 ${y.johu}(${johuHanja2})가 원국에 하나도 없어 한열 보정이 급하다(조후위급). 조후를 우선해 "부족해서 조심스럽게 채워야 할 오행"으로 다루고, 대량 보강 처방은 하지 마라]`;
      } else if (n === 1) {
        gisinLine += ` [★조후 충돌 — ${y.johu}(${johuHanja2})가 원국에 하나뿐이라 한열 보정은 최소한만 갖췄다. 억부를 우선하되 이 오행을 제거·회피 대상으로 단정하지 말고 "더 늘리지는 않는" 수준으로 다뤄라]`;
      } else {
        gisinLine += ` [★조후 충돌 — 계절상 필요한 ${y.johu}(${johuHanja2})가 원국에 이미 ${n}개 있어 한열은 해소됐다. 억부를 우선해 기신으로 다루고, 조후는 "이미 갖춰져 있다"는 확인으로만 언급하라]`;
      }
    }
    lines.push(gisinLine);
  }

  return lines.join("\n");
}

/* ===== 한줄평 생성 함수들 ===== */

export function getStrengthFeedback(
  strengthLevel: string,
  hasDeukse: boolean,
): string {
  const feedbacks: Record<string, string> = {
    "극왕_O": "체력도 주변 지원도 넘쳐. 에너지 조절이 핵심이야",
    "극왕_X": "혼자서 이 에너지를 감당 중. 터지기 전에 방향을 잡아",
    "태강_O": "주변까지 밀어주니까 과해. 브레이크가 필요한 사주",
    "태강_X": "기운은 센데 도와주는 사람이 없어. 혼자 버티는 타입",
    "신강_O": "체력 좋고 주변 도움도 받아. 꽤 괜찮은 구조야",
    "신강_X": "기운은 있는데 다 혼자 해야 해. 동료를 만들어",
    "중화신강_O": "균형 잡힌 편이야. 살짝 강한 게 오히려 추진력이 돼",
    "중화신강_X": "균형은 잡혀있는데 혼자 힘으로 유지 중이야",
    "중화신약_O": "살짝 부족하지만 주변에서 채워주고 있어",
    "중화신약_X": "겉보기엔 괜찮은데, 무리하면 금방 흔들리는 구조야",
    "신약_O": "체력은 약한데 주변이 버텨주고 있어. 고마운 사주",
    "신약_X": "쉽게 지치는 체질. 무리하면 바로 몸이 반응해",
    "태약_O": "에너지가 많이 부족해. 주변 도움이 그나마 다행이야",
    "태약_X": "에너지가 많이 부족해. 충전 시간을 꼭 확보해",
    "극약_O": "기운이 거의 바닥인데 주변이 겨우 잡아주고 있어",
    "극약_X": "기운이 거의 바닥이야. 쉬는 게 제일 중요한 사주",
  };
  const key = `${strengthLevel}_${hasDeukse ? "O" : "X"}`;
  return feedbacks[key] || "독특한 에너지 구조를 가지고 있어";
}

export function getYongshinFeedback(yongshinElement: KoreanElement): string {
  const feedbacks: Record<string, string> = {
    "목": "이것저것 고민만 하지 말고 일단 시작해. 새 출발이 약이야",
    "화": "속으로만 삭이지 말고 밖으로 표현해. 그게 너한테 필요한 거야",
    "토": "마음 잡아줄 안정적인 환경이 제일 중요해",
    "금": "이것저것 벌리지 말고 하나를 끝까지 밀어붙여",
    "수": "너무 빡빡하게 굴지 마. 유연하게 흐름을 타는 법을 배워",
  };
  return feedbacks[yongshinElement] || "";
}

export function getOhaengFeedback(
  distribution: Record<KoreanElement, number>,
): string {
  const entries = (Object.entries(distribution) as [KoreanElement, number][]);
  const max = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
  const min = entries.reduce((a, b) => (a[1] < b[1] ? a : b));
  const zeros = entries.filter(([, v]) => v === 0);
  const highs = entries.filter(([, v]) => v >= 3);
  const allSimilar = max[1] - min[1] <= 1;

  if (zeros.length > 0 && highs.length > 0) {
    return `${max[0]}은 넘치는데 ${zeros[0][0]}은 텅 비었어. 극단적인 구조야`;
  }
  if (highs.length >= 2) {
    return `${highs[0][0]}하고 ${highs[1][0]}에 몰려있어. 나머지가 설 자리가 없어`;
  }
  if (highs.length === 1) {
    return `${max[0]} 기운에 올인한 사주. 장점이자 약점이야`;
  }
  if (zeros.length > 0) {
    return `${zeros[0][0]} 기운이 완전 제로. 그쪽 관련된 일에서 약할 수 있어`;
  }
  if (allSimilar) {
    return "오행이 고르게 퍼져있어. 드문 균형형이야";
  }
  return `약간 ${max[0]} 쪽으로 쏠렸지만 크게 나쁘진 않아`;
}

export function getShinsalFeedback(
  shinsals: ShinsalMatch[],
): string {
  const gil = shinsals.filter((s) => s.type === "good").length;
  const hyung = shinsals.filter((s) => s.type === "bad").length;
  const total = shinsals.length;

  if (total === 0) return "";
  if (hyung === 0 && gil > 0) return "좋은 신살이 많아. 타고난 복이 있는 편이야";
  if (gil === 0 && hyung > 0) return "주의할 게 좀 있어. 아래 내용 꼼꼼히 읽어봐";
  if (hyung >= 3) return "주의 신호가 꽤 많아. 미리 알면 대비할 수 있어";
  if (gil >= 3) return "길한 기운이 강해. 타고난 운이 좋은 편이야";
  if (hyung > gil) return "주의할 게 좀 더 많아. 아래 신살들 체크해봐";
  if (gil > hyung) return "좋은 기운이 더 많아. 흉살만 조심하면 돼";
  return "길한 기운과 주의할 기운이 반반이야. 균형이 중요해";
}
