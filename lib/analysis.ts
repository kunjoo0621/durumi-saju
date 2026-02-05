import crypto from "crypto";
import { calculateSaju, formatSajuText } from "@/lib/utils/saju";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import { normalizeScores, type AnalysisScores } from "@/lib/resultSchema";
import { parseJson5Loose } from "@/lib/json5Utils";

export { normalizeScores } from "@/lib/resultSchema";

export type AnalysisResult = {
  tier: {
    grade: string;
    percentile: number;
    title: string;
    description: string;
  };
  scores: AnalysisScores;
  sections: Array<{
    icon: string;
    title: string;
    content: string;
  }>;
  coreFearAxisBlock: string;
};

export type TeaserSection = {
  icon: string;
  title: string;
};

export type TeaserResult = {
  tier: {
    grade: string;
    percentile: number;
    title: string;
    description: string;
  };
  scores: AnalysisScores;
  sections: TeaserSection[];
  coreFearAxisBlock: string;
};

export type CoreFearAxis = "DISMISS" | "ABANDON" | "INCOMPETENT" | "LOSS_OF_CONTROL";

export type InputPayload = {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  calendarType: "solar" | "lunar";
  birthHour: string;
  birthMinute: string;
  birthLocation: string;
  gender: string;
  relationshipStatus: string;
  employmentStatus: string;
  coreFearAxis: CoreFearAxis | "";
  unknownBirthTime: boolean;
  saju?: string | null;
};

const ALLOWED_FEAR_LABELS = ["돈·재정", "이직·커리어", "인간관계", "건강·컨디션"] as const;

export function validatePackpok(text: string): boolean {
  const normalized = text?.trim() ?? "";
  if (!normalized) return false;
  return normalized.includes("이 말이 나오는 이유는") && normalized.includes("그래서 2주만");
}

function resolveCoreFearLabel(input: InputPayload): string {
  const axis = input.coreFearAxis;

  if (axis && axis in CORE_FEAR_LABELS) {
    return CORE_FEAR_LABELS[axis as CoreFearAxis];
  }

  if (typeof axis === "string") {
    const normalized = axis.trim();
    if ((ALLOWED_FEAR_LABELS as readonly string[]).includes(normalized)) {
      return normalized;
    }
  }

  return "미선택";
}

const METAPHOR_HOOK_POOLS: Record<string, string[]> = {
  "돈·재정": [
    "새는 수도꼭지 앞에서 물통만 바꾸는 느낌이라 바닥이 계속 젖어.",
    "통장 잔고보다 지출 습관이 더 시끄럽게 울려서 계획이 자주 밀려.",
    "지갑을 닫아도 결제 알림이 먼저 달리는 흐름이라 리듬이 깨져.",
    "수입은 들어오는데 지출 루트가 지도를 벗어난 느낌으로 흘러가.",
    "예산표를 접어두면 카드 명세서가 하루 우선순위를 대신 정해.",
    "돈을 모으려는데 작은 결제가 틈으로 계속 새어나가는 구조야.",
    "이번 달 목표보다 자동결제가 먼저 도착해서 선택권을 줄여.",
    "현금흐름을 놓치면 마음의 소음이 먼저 커져서 판단을 흔들어.",
  ],
  "이직·커리어": [
    "지도 없이 달리면 속도는 나는데 방향은 잃어서 피로만 먼저 남아.",
    "일은 계속 하고 있는데 커리어는 방치된 서랍처럼 쌓여만 가.",
    "성과는 쌓이는데 다음 스텝은 비어 있는 화면처럼 멈춰 있어.",
    "바쁜 일정 속에서 경력 설계가 뒤로 밀려 방향 감각이 흐려져.",
    "할 일은 많은데 커리어 기준표는 접혀 있어서 선택이 흔들려.",
    "프로젝트는 끝나는데 포지션 방향은 아직 흐릿해서 체감이 약해.",
    "이직 생각은 빠른데 준비 루틴은 느리게 따라와 타이밍이 어긋나.",
    "일의 양은 늘어도 경력의 축은 고정되지 않아 누수가 생겨.",
  ],
  인간관계: [
    "문이 없는 울타리는 결국 다 들어오게 돼서 에너지 누수가 커져.",
    "다정함이 경계 없이 새면 피로가 이자를 붙여 돌아오는 구조야.",
    "관계를 지키려다 내 일정이 먼저 무너지는 흐름이 반복되고 있어.",
    "대화는 많아도 경계선이 흐리면 감정 소모가 크게 남아버려.",
    "부탁을 다 받다 보면 내 리듬이 먼저 깨져서 집중이 흩어져.",
    "분위기를 맞추는 동안 내 에너지는 조용히 줄어드는 패턴이야.",
    "관계의 온도는 높은데 거리 조절이 늦어져 피로가 먼저 쌓여.",
    "좋은 의도만으로 버티면 피로가 빠르게 누적되어 판단이 흐려져.",
  ],
  "건강·컨디션": [
    "배터리 경고등 켜놓고 화면 밝기만 올리는 중이라 소모가 빨라져.",
    "회복 버튼이 없는 하루를 반복하는 느낌이라 속도가 자꾸 꺾여.",
    "잠을 미루는 밤이 쌓이면 낮 집중력이 먼저 빠져서 효율이 낮아져.",
    "컨디션 관리 없이 일정만 늘리면 몸이 먼저 흔들려 신호를 보내.",
    "피로를 넘기다 보면 작은 무기력이 기본값처럼 자리 잡아.",
    "하루는 굴러가도 회복 루틴이 없으면 다음 날 리듬이 깨져.",
    "몸의 신호를 미루면 일정 밀도가 먼저 무너져 체감이 크게 와.",
    "컨디션 적자를 방치하면 집중 시간이 먼저 줄어들어 흐름이 깨져.",
  ],
  미선택: [
    "흐르는 강을 막아두면 결국 다른 데서 넘쳐서 정리가 더 어려워져.",
    "정리 안 된 루틴은 조용히 발목을 잡아 선택 속도를 계속 늦춰.",
    "우선순위를 비워두면 급한 일이 하루 전체를 대신 설계하게 돼.",
    "계획 없는 하루가 쌓이면 선택 비용이 커져서 피로가 먼저 와.",
    "작은 미루기가 반복되면 일정 전체가 뒤로 밀려 체감 부담이 커져.",
    "기록 없는 루틴은 감각에 기대게 만들고 흔들림을 점점 키워.",
    "정리 없이 달리면 속도보다 누수가 먼저 보여 흐름이 무너져.",
    "기준 없는 선택이 이어지면 피로가 먼저 결과를 만들어버려.",
  ],
};

const FUTURE_SENTENCE_POOLS: Record<string, string[]> = {
  "돈·재정": [
    "앞으로 3~6개월은 지출 기록이 끊기는 주간마다 현금흐름 불안이 바로 커질 가능성이 높아.",
    "당분간은 고정비 정리가 늦어질수록 예산보다 카드 명세서가 먼저 결정을 주도할 거야.",
    "이번 분기엔 충동 결제를 늦추는 루틴이 없으면 저축 속도가 체감보다 더 천천히 붙어.",
    "가까운 시기에(1~3개월) 결제 기준표를 못 세우면 작은 누수가 월말 압박으로 번질 수 있어.",
  ],
  "이직·커리어": [
    "앞으로 3~6개월은 지원 기준이 없을수록 이직 속도보다 피로도가 더 빨리 쌓일 가능성이 커.",
    "당분간은 포트폴리오 업데이트 주기가 느리면 기회가 와도 연결 속도가 늦어질 거야.",
    "이번 분기엔 커리어 우선순위를 못 고정하면 성과는 쌓여도 방향성 체감은 약해질 수 있어.",
    "가까운 시기에(1~3개월) 목표 포지션 정의가 흐리면 준비 시간 대비 전환 효율이 떨어질 수 있어.",
  ],
  인간관계: [
    "앞으로 3~6개월은 경계 문장이 없을수록 관계 피로가 일정 전체로 번질 가능성이 높아.",
    "당분간은 부탁 수락 기준이 모호하면 좋은 관계도 부담으로 바뀌는 순간이 늘어날 거야.",
    "이번 분기엔 감정 소모를 기록하지 않으면 대화 횟수와 만족도가 반대로 움직일 수 있어.",
    "가까운 시기에(1~3개월) 거리 조절을 미루면 작은 오해가 반복 패턴으로 굳어질 가능성이 있어.",
  ],
  "건강·컨디션": [
    "앞으로 3~6개월은 수면 리듬이 흔들리는 주간마다 집중력 저하가 더 자주 눈에 띌 가능성이 커.",
    "당분간은 회복 루틴이 비면 일정 밀도보다 피로 누적 속도가 더 빨라질 거야.",
    "이번 분기엔 카페인과 취침 시간을 함께 관리하지 않으면 컨디션 변동폭이 커질 수 있어.",
    "가까운 시기에(1~3개월) 회복 기준을 못 세우면 무기력 구간이 반복 패턴으로 굳어질 수 있어.",
  ],
  미선택: [
    "앞으로 3~6개월은 루틴이 비는 주간마다 우선순위 혼선이 더 크게 체감될 가능성이 높아.",
    "당분간은 기록 없는 일정 운영이 이어지면 급한 일 중심의 반복이 더 잦아질 거야.",
    "이번 분기엔 하루 기준표가 없으면 집중 시간보다 전환 비용이 더 크게 늘어날 수 있어.",
    "가까운 시기에(1~3개월) 기본 루틴을 못 고정하면 작은 누수가 큰 피로로 연결될 가능성이 있어.",
  ],
};

const MYEONGRI_TERMS_BY_LABEL: Record<string, string[]> = {
  "돈·재정": ["정재(正財)", "겁재(劫財)", "비견(比肩)", "식신(食神)"],
  "이직·커리어": ["정관(正官)", "편관(偏官)", "상관(傷官)", "편인(偏印)"],
  인간관계: ["비견(比肩)", "겁재(劫財)", "정인(正印)", "상관(傷官)"],
  "건강·컨디션": ["편관(偏官)", "인성(印星)", "식신(食神)", "상관(傷官)"],
  미선택: ["정관(正官)", "정재(正財)", "비견(比肩)", "인성(印星)"],
};

function pickFromPool(
  input: InputPayload,
  label: string,
  scope: "core" | "risk" | "conclusion",
  channel: "hook" | "future" | "term",
  pool: string[]
) {
  if (!pool.length) return "";
  const seed = `${buildInputHash(input)}:${label}:${scope}:${channel}`;
  const hashHex = crypto.createHash("sha256").update(seed).digest("hex");
  const idx = parseInt(hashHex.slice(0, 8), 16) % pool.length;
  return pool[idx];
}

function pickMetaphorHook(input: InputPayload, label: string, scope: "core" | "risk" | "conclusion") {
  const pool = METAPHOR_HOOK_POOLS[label] || METAPHOR_HOOK_POOLS.미선택;
  return pickFromPool(input, label, scope, "hook", pool);
}

function pickFutureSentence(input: InputPayload, label: string, scope: "core" | "risk" | "conclusion") {
  const pool = FUTURE_SENTENCE_POOLS[label] || FUTURE_SENTENCE_POOLS.미선택;
  return pickFromPool(input, label, scope, "future", pool);
}

function pickMyungriTerms(input: InputPayload, label: string, scope: "core" | "risk" | "conclusion") {
  const pool = MYEONGRI_TERMS_BY_LABEL[label] || MYEONGRI_TERMS_BY_LABEL.미선택;
  const first = pickFromPool(input, label, scope, "term", pool);
  const secondPool = pool.filter((item) => item !== first);
  const second = pickFromPool(input, label, scope, "term", secondPool);
  return second ? [first, second] : [first];
}

function getABPairByLabel(label: string): { a: string; b: string } {
  const abMap: Record<string, { a: string; b: string }> = {
    "돈·재정": { a: "통장 잔고", b: "지출을 관리하는 루틴의 부재" },
    "이직·커리어": { a: "이직 타이밍", b: "커리어 기준 없는 선택 패턴" },
    인간관계: { a: "상대 반응", b: "경계 없는 관계 패턴" },
    "건강·컨디션": { a: "하루 컨디션", b: "회복 루틴의 붕괴" },
    미선택: { a: "운세 점수", b: "일상 관리 루틴의 부재" },
  };
  return abMap[label] || abMap.미선택;
}

function getActionSentenceByLabel(label: string): string {
  const actionSentenceMap: Record<string, string> = {
    "돈·재정":
      "그래서 2주만 이번 주에 고정지출·변동지출을 7일 기록하고, 다음 주에 상위 3개 지출 항목 한도를 10% 줄여 실행한다.",
    "이직·커리어":
      "그래서 2주만 이번 주에 경력기술서와 포트폴리오를 1회 업데이트하고, 다음 주에 목표 포지션 5곳에 지원해 결과를 기록한다.",
    인간관계:
      "그래서 2주만 이번 주에 피로한 관계 2건의 경계 문장을 정리하고, 다음 주에 필요한 1명과 30분 대화를 실행한다.",
    "건강·컨디션":
      "그래서 2주만 이번 주에 수면·카페인·운동 시간을 7일 기록하고, 다음 주에 취침 시간을 30분 앞당겨 5일 유지한다.",
    미선택:
      "그래서 2주만 이번 주에 수면·지출·집중시간을 7일 기록하고, 다음 주에 완료율이 낮은 루틴 2개를 고정해서 실행한다.",
  };
  return (
    actionSentenceMap[label] ||
    "그래서 2주만 이번 주에 하루 계획 3개를 기록하고, 다음 주에 완료율 70% 기준으로 루틴 2개를 고정한다."
  );
}

function getTruthSentenceByLabel(label: string): string {
  const truthMap: Record<string, string> = {
    "돈·재정": "불편한 진실은, 기록 없는 지출은 스트레스가 아니라 반복 비용이 된다는 점이야.",
    "이직·커리어": "불편한 진실은, 기준 없는 지원은 경험이 쌓여도 방향성을 남기지 못한다는 점이야.",
    인간관계: "불편한 진실은, 경계 없이 맞춰주면 관계가 좋아지는 게 아니라 피로만 누적된다는 점이야.",
    "건강·컨디션": "불편한 진실은, 회복 루틴을 미루면 집중력 저하가 기본 상태가 된다는 점이야.",
    미선택: "불편한 진실은, 루틴 없이 버틴 하루가 다음 주의 혼란을 그대로 키운다는 점이야.",
  };
  return truthMap[label] || truthMap.미선택;
}

function buildForcedPackpokContent(
  input: InputPayload,
  scope: "core" | "risk" | "conclusion"
): string {
  const label = resolveCoreFearLabel(input);
  const relationship = input.relationshipStatus || "상태 미상";
  const employment = input.employmentStatus || "상태 미상";

  const hookSentence = pickMetaphorHook(input, label, scope);
  const picked = getABPairByLabel(label);
  const [term1, term2] = pickMyungriTerms(input, label, scope);
  const termText = term2 ? `${term1}, ${term2}` : term1;
  const firstSentence = `지금 문제는 ${picked.a}가 아니라 ${picked.b}야.`;
  const secondSentence = `이 말이 나오는 이유는 ${employment}이고 ${relationship} 상태에서 ${label} 고민이 반복되고, ${termText} 흐름이 동시에 흔들리기 때문이야.`;
  const thirdSentence = pickFutureSentence(input, label, scope);
  const fourthSentence = getActionSentenceByLabel(label);
  const fifthSentence = getTruthSentenceByLabel(label);

  const lines = [`${hookSentence}`, `선택한 고민: ${label}`, firstSentence, secondSentence, thirdSentence, fourthSentence, fifthSentence];
  return lines.join("\n");
}

function buildForcedCoreFearAxisBlock(input: InputPayload): string {
  return buildForcedPackpokContent(input, "core");
}

function resolveRiskSectionIndex(sections: AnalysisResult["sections"]): number {
  const riskKeywords = /(리스크)/;
  const riskSimilarKeywords = /(경고|위험|새는|누수|위기)/;
  const riskIcons = new Set(["⚠️", "🚨", "🛑", "🔥", "🕳️", "⛔", "☠️"]);

  const titleHit = sections.findIndex((section) => riskKeywords.test(String(section?.title || "")));
  if (titleHit >= 0) return titleHit;

  const similarHit = sections.findIndex(
    (section) =>
      riskSimilarKeywords.test(String(section?.title || "")) ||
      riskSimilarKeywords.test(String(section?.content || ""))
  );
  if (similarHit >= 0) return similarHit;

  const iconHit = sections.findIndex((section) => riskIcons.has(String(section?.icon || "")));
  if (iconHit >= 0) return iconHit;

  if (sections.length === 0) return -1;
  if (sections.length === 1) return 0;
  return sections.length - 2;
}

function resolveConclusionSectionIndex(sections: AnalysisResult["sections"]): number {
  const conclusionKeywords = /(결론|요약|정리|한 줄)/;

  const titleHit = sections.findIndex((section) => conclusionKeywords.test(String(section?.title || "")));
  if (titleHit >= 0) return titleHit;

  return sections.length > 0 ? sections.length - 1 : -1;
}

function enforceRiskSectionPackpok(input: InputPayload, sections: AnalysisResult["sections"]) {
  if (!Array.isArray(sections) || sections.length === 0) return sections;
  const nextSections = [...sections];
  const targetIndexes = [resolveRiskSectionIndex(sections), resolveConclusionSectionIndex(sections)];
  const uniqueIndexes = [...new Set(targetIndexes)].filter((idx) => idx >= 0);

  uniqueIndexes.forEach((idx) => {
    const target = nextSections[idx];
    if (target?.content && validatePackpok(target.content)) return;
    const scope = idx === targetIndexes[0] ? "risk" : "conclusion";
    nextSections[idx] = {
      ...target,
      content: buildForcedPackpokContent(input, scope),
    };
  });

  return nextSections;
}

function resolveCoreFearAxisBlock(input: InputPayload, existing?: string | null): string {
  return buildForcedCoreFearAxisBlock(input);
}

// 핵심 공포 축 라벨
export const CORE_FEAR_LABELS: Record<CoreFearAxis, string> = {
  DISMISS: "인간관계",
  ABANDON: "이직·커리어",
  INCOMPETENT: "돈·재정",
  LOSS_OF_CONTROL: "건강·컨디션",
};

// 핵심 공포 축 중립 템플릿
export const CORE_FEAR_TEMPLATES: Record<CoreFearAxis, {
  inference: string;
  strongWeak: string;
  relationshipBranch: Record<string, string>;
  employmentBranch: Record<string, string>;
}> = {
  DISMISS: {
    inference:
      "요즘 고민 1순위가 인간관계라면, ‘거리감’과 ‘소속감’ 사이에서 균형을 찾고 있을 가능성이 큽니다. " +
      "말 한마디나 분위기 변화에 민감해질 수 있고, 관계의 온도를 자주 점검하게 될 수 있어요.",
    strongWeak:
      "이 고민이 강하면 작은 오해도 크게 느껴지고, 약하면 관계를 유연하게 바라보는 편입니다.",
    relationshipBranch: {
      솔로: "새 만남의 시작에서 ‘우리 대화 잘 맞나?’가 핵심 포인트가 될 수 있습니다.",
      연애중: "연락 빈도나 말투 변화에 예민해지기 쉬운 타이밍입니다.",
      기혼: "역할 분담이나 소통 방식이 관계 만족도를 좌우할 수 있습니다.",
    },
    employmentBranch: {
      직장인: "팀 내 관계와 커뮤니케이션 방식이 스트레스 요인일 수 있습니다.",
      "사업·프리랜서": "고객과의 신뢰 관리가 성과만큼 중요하게 느껴질 수 있습니다.",
      학생: "친구/동아리 관계에서 거리감이 고민으로 이어질 수 있습니다.",
      "취업 준비 중": "면접/네트워킹에서의 첫인상과 관계 형성이 핵심일 수 있습니다.",
    },
  },
  ABANDON: {
    inference:
      "요즘 커리어가 고민 1순위라면, ‘지금 방향이 맞나?’라는 질문이 자주 떠오를 수 있어요. " +
      "성장 속도, 평가, 방향 전환(이직/전환)에 대한 관심이 커질 수 있습니다.",
    strongWeak:
      "이 고민이 강하면 작은 피드백에도 커리어 전체가 흔들리는 느낌이 들 수 있고, 약하면 장기 플랜으로 차분히 가는 편입니다.",
    relationshipBranch: {
      솔로: "일에 몰입하면서 연애/만남 우선순위가 내려갈 수 있습니다.",
      연애중: "커리어 고민이 커지면 데이트/시간 배분에 민감해질 수 있습니다.",
      기혼: "가정의 안정과 커리어 변화 사이에서 선택의 무게가 커질 수 있습니다.",
    },
    employmentBranch: {
      직장인: "이직 타이밍, 승진 루트, 역할 변화가 핵심 고민이 될 수 있습니다.",
      "사업·프리랜서": "프로젝트 파이프라인과 브랜딩 방향이 중요해질 수 있습니다.",
      학생: "전공/진로 선택과 인턴 경험이 커리어 방향의 힌트가 될 수 있습니다.",
      "취업 준비 중": "지원 전략, 포트폴리오, 합격 신호에 집중하게 될 수 있습니다.",
    },
  },
  INCOMPETENT: {
    inference:
      "요즘 돈/재정이 고민 1순위라면, 수입과 지출의 흐름이 더 예민하게 느껴질 수 있습니다. " +
      "‘지금 잘 굴러가고 있나?’를 계속 체크하는 시기일 수 있어요.",
    strongWeak:
      "이 고민이 강하면 작은 지출에도 불안이 커지고, 약하면 돈을 도구로 차분히 관리하는 편입니다.",
    relationshipBranch: {
      솔로: "자기계발/취미 비용과 저축 사이의 균형이 고민일 수 있습니다.",
      연애중: "데이트 비용, 미래 자금에 대한 합의가 중요해질 수 있습니다.",
      기혼: "가계/대출/자녀 교육비 등 장기 계획이 핵심이 될 수 있습니다.",
    },
    employmentBranch: {
      직장인: "연봉/성과급/복지가 재정 안정감에 큰 영향을 줄 수 있습니다.",
      "사업·프리랜서": "매출 변동과 현금흐름 관리가 가장 큰 이슈가 될 수 있습니다.",
      학생: "알바/용돈 등 단기 재정 계획이 고민이 될 수 있습니다.",
      "취업 준비 중": "준비 비용과 공백 기간의 지출이 부담이 될 수 있습니다.",
    },
  },
  LOSS_OF_CONTROL: {
    inference:
      "요즘 건강/컨디션이 고민 1순위라면, 몸의 신호와 생활 리듬을 더 예민하게 체감하고 있을 수 있습니다. " +
      "컨디션이 곧 하루 성과를 좌우한다고 느껴질 수 있어요.",
    strongWeak:
      "이 고민이 강하면 작은 피로에도 불안해지고, 약하면 루틴을 안정적으로 유지하는 편입니다.",
    relationshipBranch: {
      솔로: "생활 패턴을 지키는 것이 중요해지는 시기일 수 있습니다.",
      연애중: "약속/일정 조율이 컨디션 관리에 영향을 줄 수 있습니다.",
      기혼: "가족 건강과 생활 리듬 관리가 우선순위가 될 수 있습니다.",
    },
    employmentBranch: {
      직장인: "야근/수면 부족이 컨디션에 직접 영향을 줄 수 있습니다.",
      "사업·프리랜서": "불규칙한 일정이 컨디션 관리의 큰 변수일 수 있습니다.",
      학생: "시험/과제 시즌에 컨디션 기복이 심해질 수 있습니다.",
      "취업 준비 중": "루틴 관리가 멘탈/체력 유지의 핵심이 될 수 있습니다.",
    },
  },
};

const MOCK_DATA: AnalysisResult = {
  tier: {
    grade: "A-",
    percentile: 15,
    title: "엔진은 강력한데 핸들이 좀 헐거운 스포츠카",
    description:
      "잠재력은 충분한데 방향성이 애매할 때가 많아요. 한 분야에 집중하면 탑티어까지 올라갈 수 있는 사람인데, 이것저것 손대다가 에너지가 분산되는 경향이 있어요. 일단 한 우물만 파면 진짜 대박 나는 타입입니다.",
  },
  scores: {
    재물운: 78,
    연애운: 65,
    직장운: 82,
    건강운: 70,
    대인운: 88,
  },
  coreFearAxisBlock:
    "선택한 고민: 돈·재정\n\n요즘 돈의 흐름이 더 크게 느껴질 수 있어요. 작은 지출도 신경 쓰이고, ‘지금 이게 맞나?’라는 체크가 잦아지는 시기입니다.\n\n재정은 ‘흐름 관리’에서 승부가 나요. 지출을 줄이기보다, 고정비 구조와 수입 리듬을 먼저 정리해보는 게 빠릅니다.",
  sections: [
    {
      icon: "🎭",
      title: "타고난 DNA",
      content:
        "당신의 일간은 甲木(갑목)인데, 子月(자월)에 태어났어요. 한겨울에 태어난 나무라 뿌리는 깊지만 가지가 잘 안 뻗는 구조예요. 이게 무슨 뜻이냐면, 내면은 단단한데 겉으로 표현하는 게 서툰 타입이라는 거예요. 어릴 때부터 '너 속을 모르겠다'는 소리 들어본 적 있죠? 혼자 끙끙 앓다가 나중에 터뜨리는 스타일이에요. 그래도 일단 마음 열면 의리 하나는 끝내주는 게 갑목의 특징입니다. 천천히 크지만 결국엔 큰 나무가 되는 사람이에요.",
    },
    {
      icon: "💰",
      title: "돈과의 케미",
      content:
        "사주에 편재(偏財)가 있는데 비겁(比劫)이 많아요. 돈 들어올 구멍은 큰데 새는 구멍도 많은 구조라는 거죠. 벌 땐 많이 버는데, 쓸 때도 과감하게 써버려서 통장에 돈이 안 남는 패턴 아니었어요? 특히 친구 생일이나 모임에서 계산할 때 가장 먼저 카드 내미는 스타일일 거예요. 재테크는 혼자 하면 망하니까 자동이체나 적금처럼 강제 저축이 답입니다. 30대 중반 이후부터 재성(財星)이 좋아지니까 그때부터는 쌓이기 시작해요. 지금은 버는 힘 키우는 데 집중하세요.",
    },
    {
      icon: "💕",
      title: "연애 성적표",
      content:
        "당신은 정관(正官)보다 편관(偏官)이 있는 사주예요. 정석적이고 안정적인 사랑보다는 좀 드라마틱한 관계를 겪을 가능성이 높아요. 소개팅보다는 우연히 만난 사람한테 끌리고, 뻔한 데이트보다 색다른 경험 같이 하는 게 재밌잖아요? 그런데 이게 양날의 칼이라서, 초반엔 재밌는데 오래 가려면 루틴이 필요한데 그게 안 맞는 거예요. 잘 맞는 타입은 당신만큼 자유롭지만 책임감은 있는 사람. 너무 평범하거나 보수적인 사람은 답답해서 못 견딥니다. 결혼은 늦어도 30대 중후반에 잘 맞는 사람 만나면 안정되니 조급해하지 마세요.",
    },
    {
      icon: "🏢",
      title: "직장 & 커리어",
      content:
        "직장운은 확장성과 책임감이 동시에 강조되는 흐름이에요. 단기간에 업무를 끌어올리는 힘이 있어서 성과가 빨리 보이는 편입니다. 다만 방향을 바꾸기 전에 한 사이클을 끝내는 게 필요합니다. 이직은 ‘확실한 역할 변화’가 있을 때 더 유리하고, 지금은 핵심 역량을 하나 정해서 깊게 파는 게 더 빠르게 올라가는 길입니다.",
    },
    {
      icon: "🧠",
      title: "멘탈 & 컨디션",
      content:
        "건강운은 기본 체력은 괜찮지만 리듬이 깨질 때 컨디션이 급격히 흔들리는 타입이에요. 수면/식사 루틴이 한 번 틀어지면 회복에 시간이 걸릴 수 있습니다. 지금은 운동보다 ‘수면 고정’이 우선입니다. 하루 일정이 많을수록 루틴을 단단히 잡는 게 장기적으로 효율적이에요.",
    },
    {
      icon: "🧑‍🤝‍🧑",
      title: "대인 관계 흐름",
      content:
        "사람과의 거리를 재는 감각이 예민한 편이라, 가까워지는 속도와 타이밍이 중요합니다. 처음엔 조심스럽지만 한 번 신뢰가 쌓이면 깊어지는 구조예요. 지금은 ‘너무 빨리 맞추려는 습관’을 줄이고, 일정한 간격의 소통을 유지하는 게 관계 안정에 도움이 됩니다.",
    },
    {
      icon: "🚧",
      title: "리스크 관리",
      content:
        "속도가 빠른 대신 실수도 빨리 나오는 구조라서, 체크리스트가 있는지 없는지가 결과를 가릅니다. 특히 돈/일 관련 결정에서 ‘충동’이 섞이면 흔들릴 수 있어요. 지금은 결정 직전에 하루만 보류하는 습관을 붙이면 리스크가 크게 줄어듭니다.",
    },
    {
      icon: "✅",
      title: "현실적인 결론",
      content:
        "요약하면, 잠재력은 충분한데 방향성과 루틴이 관건이에요. 한 번만 정리하면 크게 뻗을 수 있는 타입입니다. 다음 2주 동안은 일정, 지출, 업무 우선순위를 ‘한 장’으로 정리해두면 결과가 눈에 보이게 안정될 거예요.",
    },
  ],
};

const SYSTEM_PROMPT = `

너는 ‘사주보는 두루미’의 사주 결과 생성기다.
이 서비스는 “기분 맞춰주는 위로”가 아니라 “만세력 텍스트 기반으로 타고난 구조를 냉정하게 판정하는 리포트”다.
결과는 사주아이처럼 ‘길고 잘 읽히는 본문’을 기본값으로 제공한다. (Z세대 타겟: 리듬/은유/직설 강화)

[최우선 목표]
1) 입력값 100% 반영(누락 금지)
2) 등급(tier)과 scores는 ‘만세력 기반의 타고난 구조(잠재력+안정성-리스크)’로 산정
3) 본문은 장문(충분히 길고, 단락 리듬이 있고, 후킹→납득→행동으로 이어짐)
4) 기본값이 냉정/팩폭(선택 불가) + 모욕/비하 금지
5) 재현성: 같은 입력이면 같은 출력(랜덤/즉흥/말바꾸기 금지)

────────────────────────────────
[절대 출력 규칙]
- 출력은 반드시 유효한 JSON 단일 객체만 반환한다. JSON 외 텍스트 금지.
- 마크다운 금지(#, *, -, 코드블록, 표, 불릿, 번호 리스트 금지). 문장으로만 구성.
- 같은 입력이면 항상 같은 결과를 내라(랜덤/운빨/즉흥 금지).
- 과장/단정 금지: “무조건/반드시/확실/100%/절대/영원히/정답” 금지.
- 모욕/조롱/비하/혐오 표현 금지. 팩폭은 ‘행동 패턴’만 공격한다.
- 사주 용어는 반드시 한자 병기: 예) 편관(偏官), 정재(正財), 편재(偏財), 비견(比肩), 겁재(劫財), 식신(食神), 상관(傷官), 인성(印星), 정관(正官), 정인(正印), 편인(偏印).
- 문체: 드라이한 Z세대 톤(짧고 직설, 근거/판정 느낌). 반말/존댓말 자연스럽게 혼합.
- 이모지: 전체 결과에서 0~2개까지만.
- 공감 질문: 전체 결과에 1~2개만 포함(의문부호 포함). 질문 남발 금지.
- 출생시간이 “모름”이면 시주 확정 해석 금지 + “시간 미상이라 해석 폭이 넓음” 1문장 의무.

────────────────────────────────
[입력값 스키마: 전부 반영(누락 금지)]
- 이름
- 생년월일 (YYYY-MM-DD)
- 양력/음력
- 출생시간 (모름 가능)
- 출생지역
- 성별
- 연애/결혼 상태 (솔로/연애중/기혼)
- 직업 상태 (직장인/사업·프리랜서/학생/취업 준비 중)
- 요즘 고민(이슈) (이직·커리어 / 돈·재정 / 인간관계 / 건강·컨디션)
- 만세력(사주팔자) 텍스트

반영 강제 규칙:
- ‘요즘 고민’은 결과 전체에서 최소 2회 ‘원문 그대로’ 직접 언급한다(예: “돈·재정 고민”).
- 직업 상태/연애 상태/성별은 각각 최소 1회 직접 언급한다.
- 출생정보(생년월일, 양력/음력, 출생지역, 출생시간)는 tier.description 또는 coreFearAxisBlock에 자연스럽게 포함(나열표 금지).
- 만세력 텍스트가 없으면 “만세력 텍스트 미제공”을 명시하고, 근거 부족 페널티를 적용한다.

────────────────────────────────
[출력 JSON 스키마(고정)]
{
  "tier": { "grade": string, "percentile": number, "title": string, "description": string },
  "scores": { "재물운": number, "연애운": number, "직장운": number, "건강운": number, "대인운": number },
  "sections": [ { "icon": string, "title": string, "content": string } ],
  "coreFearAxisBlock": string
}

────────────────────────────────
[장문 출력 규칙(길이/리듬 고정)]
- sections 개수는 반드시 8개로 고정한다(항상 8).
- 각 section.content는 “장문”이어야 한다.
  - 각 섹션 content 길이 목표: 한국어 기준 700~1200자(대략).
  - 8개 섹션 합산 목표: 6000~9500자(대략).
  - 지나치게 짧으면 실패로 간주한다(단, 실제 재시도는 호출 코드가 수행한다).
- 각 section.content는 반드시 아래 순서를 지킨다(라벨은 금지, 문장 흐름으로 구현):
  (0) 후킹 1문장: 비유/은유 1개 포함, 강한 대비/반전 느낌
  (1) 브릿지 1문장: “이 말이 나오는 이유는 …” 형태로 근거로 연결
  (2) 사주 근거 파트: 만세력 텍스트에서 뽑은 ‘명시된’ 키워드 2~5개만 사용(없으면 “만세력 텍스트 미제공”을 근거로 삼고 과해석 금지)
  (3) 현대적 해석 파트: 사용자의 직업/연애 상태/요즘 고민과 연결해서 5~9문장 정도로 충분히 풀어쓴다
  (4) 현실 예시 파트: “직장인이라면/솔로라면/돈·재정 고민이라면” 같은 구체 상황 예시를 1~2개 반드시 포함한다
  (5) 행동 팁 파트: 오늘~2주 내 실행 가능한 ‘측정 가능한 행동’ 3~5개를 문장으로 제시한다(불릿 금지)

- icon은 이모지 1개만(섹션마다 1개).
- title은 8~18자 내외, 강한 제목형(도발적이되 모욕 금지).

────────────────────────────────
[후킹(은유) 생성 규칙 — Z세대 타겟 강화 + 중복 방지]
후킹은 “문학적 은유 + 현실 직설”의 조합이다. 아래 규칙을 모두 지킨다.

1) 길이
- 후킹 1문장은 22~55자 범위 권장.

2) 형식(선택형 템플릿 중 1개만)
- “A인 줄 알았는데, 실은 B.”
- “겉은 A인데, 속은 B.”
- “A처럼 보이지만, 알고 보면 B.”
- “A가 강점인데, 동시에 B가 리스크.”

3) 은유 사전(섹션별로 서로 다른 군을 사용)
- 자연/기후: 사막, 오아시스, 댐, 장마, 안개, 태풍, 역류, 마른바람
- 물리/기계: 브레이크, 기어, 엔진, 과열, 배터리, 누수, 회로, 노이즈
- 도시/생활: 출근길, 지하철, 교통체증, 야근, 카드값, 마감, 알림 폭주
- 디지털/인터넷: 캐시, 버퍼링, 리셋, 백업, 스크롤, 알고리즘, 푸시 알림
- 스포츠/게임: 쿨타임, 콤보, 랭크, 페널티, 듀얼, 운영, 메타

4) 금지 은유
- 병/정신질환/범죄를 연상시키는 은유 금지
- 외모 평가, 성적 비유, 특정 집단 비하 은유 금지
- “천재/괴물/미친” 같은 극단 찬양/낙인 표현 금지

5) 중복 방지
- 8개 섹션의 후킹은 ‘핵심 은유 명사’가 중복되면 안 된다.
- 동일 템플릿 연속 2회 사용 금지.
- 같은 은유군을 2회 이상 쓰되, 명사는 반드시 바꾼다.

6) 브릿지 강제
- 후킹 직후에는 반드시 “이 말이 나오는 이유는 …” 문장으로 근거로 착지시킨다.

────────────────────────────────
[팩폭(선택 불가) 규칙: 강하게, 하지만 공정하게]
- 금지: 결과 전체에서 "괜찮아/잘하고 있어/충분해/응원해/힘내" 같은 위로·응원 문장을 쓰지 마라.
- 각 섹션의 결론 문장(마지막 문장)은 반드시 현실 판정(불편한 진실 1개)을 포함해야 한다. 완곡하게 돌리지 말고 직설로 쓴다.
- 팩폭 3문장 중 첫 문장은 반드시 "지금 문제는 A가 아니라 B야." 템플릿을 사용한다(A,B는 상황에 맞게 채움).
- 행동 팁은 "하면 좋다" 금지. "이번 주에 A를 하고, 다음 주에 B를 한다"처럼 실행을 단정형으로 쓰되, 운명 단정(무조건/반드시 인생 망함)은 금지한다.
- 팩폭은 총 3회 의무 포함한다.
  1) coreFearAxisBlock에 1회(강도 hard)
  2) sections 중 “경고/새는 구멍/리스크” 성격 섹션에 1회(강도 hard)
  3) sections 중 “결론/요약/현실 판정” 성격 섹션에 1회(강도 mid)
- 팩폭은 인격/가치 판단 금지, 행동 패턴과 선택의 결과만 지적한다.
- 팩폭은 반드시 아래 3단 포맷을 지킨다(문장 3개로 고정):
  (1) 팩폭 1문장(짧고 단호, 35자 내외 권장)
  (2) “이 말이 나오는 이유는 …” 근거 1~2개(입력/만세력에서 ‘명시된’ 신호만)
  (3) “그래서 2주만 …” 행동 2개(측정 가능)

팩폭 템플릿(형태 고정):
- “지금 문제는 A가 아니라 B야.”
- “네가 원하는 건 해결이 아니라 ‘잠깐 안심’이야.”
- “이 패턴은 당장은 편한데, 장기 비용이 커.”

절대 금지:
- 비하/조롱 단어, 관계 단절 유도, 혐오 표현

────────────────────────────────
[만세력 기반 등급/점수 산정: 잠재력+안정성-리스크 종합(타고난 운 베이스)]
중요: tier와 scores는 오직 만세력 텍스트에 명시된 신호로만 계산한다(추측 금지).
요즘 고민/직업/연애는 sections 해석과 행동 팁에 반영한다(등급 베이스로 쓰지 않는다).

(1) 만세력 신호 추출(텍스트에서 “있는 것만”)
- 오행 분포 숫자: “수(3)”, “금(2)” 같은 괄호 숫자 패턴
- 신강/신약: “신강”, “신약”
- 십성/용어: 비견(比肩), 겁재(劫財), 식신(食神), 상관(傷官), 정재(正財), 편재(偏財), 정관(正官), 편관(偏官), 정인(正印), 편인(偏印), 인성(印星)
- 구조: 합/충/형/파/해, 격/용신/희신/조후
- 살: 도화/홍염/역마/화개/현침살(과해석 금지, 영향 작게)

(2) PotentialScore(잠재력/상한): 시작 50, 범위 35~85
+5 정관(正官) 또는 편관(偏官)
+5 정재(正財) 또는 편재(偏財)
+4 식신(食神) 또는 상관(傷官)
+3 인성(印星)/정인(正印)/편인(偏印)
+3 “신강”
+2 오행 숫자 표기가 있고 5개 중 4개 이상이 1 이상
+2 격/용신/희신/조후 등 구조 설명 키워드
-4 오행 숫자 표기 없음

(3) StabilityScore(안정성/지속력): 시작 50, 범위 35~85
+6 오행 숫자 표기 있고 최다-최소 ≤ 2
+4 “합”
+3 정관(正官)
+2 정재(正財)
+2 인성(印星)
-8 오행 4 이상 쏠림(숫자 명시 시)
-6 오행 0 결핍(숫자 명시 시)
-4 “충” 또는 “형”
-3 “파” 또는 “해”
-3 “신약”
-4 오행 숫자 표기 없음

(4) RiskScore(리스크): 시작 45, 범위 35~85(높을수록 위험)
+6 비견(比肩) 또는 겁재(劫財)
+5 편관(偏官)+충/형 동시
+4 상관(傷官)+정관/편관 동시
+4 “충” 또는 “형”
+2 살 키워드 2개 이상(아주 약하게)
+2 오행 쏠림/결핍이 숫자로 명시(존재 시만)

(5) composite(등급 원값)
composite = round(0.45*PotentialScore + 0.45*StabilityScore - 0.35*RiskScore)

(6) 근거 부족 페널티
- 만세력 텍스트가 비었거나,
  (오행 숫자 / 십성 키워드 / 신강·신약 / 합충형파해) 등장 종류가 2종 미만이면:
  composite = composite - 6
  grade 최대 B
- 출생시간 “모름”이면 composite = composite - 1

(7) 상한 규칙(“좋게만” 방지)
- RiskScore ≥ 70이면 grade 최대 B
- RiskScore ≥ 78이면 grade 최대 C
- StabilityScore ≤ 45이면 grade 최대 B

(8) 등급 컷
S: composite ≥ 78
A: 70~77
B: 62~69
C: 54~61
D: ≤ 53

(9) percentile
percentile = clamp(composite, 40, 90)

(10) scores(5개 운 점수)도 만세력 기반
- 각 점수 시작값 58, 범위 35~90 정수.
- 재물운: +6 정재, +4 편재, +3 식신, -4 비견/겁재, -3 오행 결핍/쏠림(숫자 명시)
- 직장운: +6 정관, +3 편관, +2 인성, -3 상관, -2 편관+충/형 동시
- 연애운: +3 도화/홍염(약하게), -2 충/형, -2 비견/겁재
- 건강운: +2 식신/인성, -4 편관+충/형, -3 오행 결핍/쏠림(숫자)
- 대인운: +2 인성/정관, +1 합, -3 비견/겁재, -2 상관, -2 충/형
- 공통: 오행 결핍 또는 4이상 쏠림이 숫자로 명시되면 모든 scores -1
- 근거 부족(위 조건)이면 scores를 50~68로 클램프

`;

const TEASER_PROMPT = `[Role]
당신은 '두루미 사주 결과 디렉터'입니다. 사주를 데이터처럼 분석해서 등급과 수치로만 간단히 요약합니다.

[핵심 컨셉]
- 등급과 퍼센트로 객관화 (S/A/B/C/D 등급, 상위 N%)
- 카테고리별 점수 시각화
- 섹션은 제목/아이콘만 제공 (본문 설명 금지)

[문체 규칙]
- 마크다운 문법(**bold**, ## 등) 절대 사용 금지
- 불필요한 텍스트 금지, JSON만 반환
- 본문(content) 생성 금지 (섹션 제목/아이콘만)

[Output Format - JSON]
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "tier": {
    "grade": "A+",
    "percentile": 8,
    "title": "비유적 한 줄 요약",
    "description": "2-3문장 핵심 설명"
  },
  "scores": {
    "재물운": { "score": 85, "grade": "A" },
    "연애운": { "score": 72, "grade": "B+" },
    "직장운": { "score": 68, "grade": "B" },
    "건강운": { "score": 90, "grade": "A+" },
    "대인운": { "score": 75, "grade": "B+" }
  },
  "sections": [
    { "icon": "🎭", "title": "타고난 DNA" },
    { "icon": "💰", "title": "돈과의 케미" },
    { "icon": "💕", "title": "연애 성적표" }
  ]
}`;

const DEFAULT_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

type GeminiSdkModel = {
  generateContent: (request: {
    contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
    generationConfig?: {
      maxOutputTokens?: number;
      responseMimeType?: string;
    };
  }) => Promise<{
    response?: {
      text?: () => string;
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
  }>;
};

let googleAiClientPromise: Promise<any | null> | null = null;

async function getGeminiSdkModel(model: string, systemText: string): Promise<GeminiSdkModel | null> {
  if (!googleAiClientPromise) {
    googleAiClientPromise = (async () => {
      try {
        const dynamicImport = new Function("moduleName", "return import(moduleName)") as (
          moduleName: string
        ) => Promise<any>;
        const sdk = await dynamicImport("@google/generative-ai");
        const GoogleGenerativeAI = sdk?.GoogleGenerativeAI;
        const apiKey = process.env.GEMINI_API_KEY || "";
        if (!GoogleGenerativeAI || !apiKey) return null;
        return new GoogleGenerativeAI(apiKey);
      } catch {
        return null;
      }
    })();
  }

  const client = await googleAiClientPromise;
  if (!client) return null;

  return client.getGenerativeModel({
    model,
    systemInstruction: systemText,
  }) as GeminiSdkModel;
}

async function callGemini(
  model: string,
  userInfo: string,
  systemPrompt: string = SYSTEM_PROMPT
) {
  const sdkModel = await getGeminiSdkModel(model, systemPrompt);
  if (sdkModel) {
    try {
      const data = await sdkModel.generateContent({
        contents: [{ role: "user", parts: [{ text: userInfo }] }],
        generationConfig: {
          maxOutputTokens: 4000,
          responseMimeType: "application/json",
        },
      });

      const response = data?.response;
      const textFromMethod = response?.text?.()?.trim();
      const textFromParts = response?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();
      const text = textFromMethod || textFromParts;

      if (!text) {
        return { ok: false as const, status: 500, apiStatus: undefined, message: "빈 응답" };
      }

      return { ok: true as const, text };
    } catch (error: any) {
      return {
        ok: false as const,
        status: Number(error?.status) || 500,
        apiStatus: error?.status || error?.code,
        message: error?.message || "Gemini SDK error",
      };
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY || "",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        { role: "user", parts: [{ text: userInfo }] },
      ],
      generationConfig: {
        maxOutputTokens: 4000,
        response_mime_type: "application/json",
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiStatus = data?.error?.status;
    const message = data?.error?.message || "Gemini API error";
    return { ok: false as const, status: response.status, apiStatus, message };
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    return { ok: false as const, status: 500, apiStatus: undefined, message: "빈 응답" };
  }

  return { ok: true as const, text };
}

function shouldFallback(status: number, apiStatus?: string) {
  if (status === 429 || status === 503) return true;
  if (!apiStatus) return false;
  return apiStatus === "RESOURCE_EXHAUSTED" || apiStatus === "UNAVAILABLE";
}

export function buildInputHash(input: InputPayload) {
  const normalizeText = (value?: string) => (value || "").trim().replace(/\s+/g, " ");
  const normalizeNumber = (value?: string, length = 2) => {
    if (!value) return "";
    const numeric = String(parseInt(value, 10));
    if (!numeric || numeric === "NaN") return "";
    return numeric.padStart(length, "0");
  };

  const normalized = JSON.stringify({
    name: normalizeText(input.name),
    birthYear: normalizeNumber(input.birthYear, 4),
    birthMonth: normalizeNumber(input.birthMonth, 2),
    birthDay: normalizeNumber(input.birthDay, 2),
    calendarType: input.calendarType || "solar",
    birthHour: input.unknownBirthTime ? "unknown" : normalizeNumber(input.birthHour, 2),
    birthMinute: input.unknownBirthTime ? "unknown" : normalizeNumber(input.birthMinute, 2),
    birthLocation: normalizeText(input.birthLocation),
    gender: normalizeText(input.gender),
    relationshipStatus: normalizeText(input.relationshipStatus),
    employmentStatus: normalizeText(input.employmentStatus),
    coreFearAxis: normalizeText(input.coreFearAxis),
    unknownBirthTime: Boolean(input.unknownBirthTime),
  });
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export async function resolveSajuText(input: InputPayload) {
  const existing = input.saju?.trim();
  if (existing) return existing;

  const year = Number(input.birthYear);
  const month = Number(input.birthMonth);
  const day = Number(input.birthDay);
  if (!year || !month || !day) return null;

  let calcYear = year;
  let calcMonth = month;
  let calcDay = day;

  if (input.calendarType === "lunar") {
    const converted = convertLunarToSolar(calcYear, calcMonth, calcDay);
    if (!converted) return null;
    calcYear = converted.year;
    calcMonth = converted.month;
    calcDay = converted.day;
  }

  const hour = input.unknownBirthTime ? undefined : Number(input.birthHour || "0");
  const minute = input.unknownBirthTime ? undefined : Number(input.birthMinute || "0");

  try {
    const saju = await calculateSaju(calcYear, calcMonth, calcDay, hour, minute);
    if (!saju) return null;
    return formatSajuText(saju);
  } catch (error) {
    console.warn("[SAJU] failed to resolve saju text", error);
    return null;
  }
}

// 핵심 공포 축 블록 생성 함수
export function buildCoreFearAxisBlock(
  axis: CoreFearAxis,
  relationshipStatus?: string,
  employmentStatus?: string
): string {
  const template = CORE_FEAR_TEMPLATES[axis];
  const label = CORE_FEAR_LABELS[axis];

  let result = `선택한 고민: ${label}\n\n`;
  result += template.inference + "\n\n";
  result += template.strongWeak;

  // 연애 상태 분기 추가
  if (relationshipStatus && template.relationshipBranch[relationshipStatus]) {
    result += "\n\n" + template.relationshipBranch[relationshipStatus];
  }

  // 직업 상태 분기 추가
  if (employmentStatus && template.employmentBranch[employmentStatus]) {
    result += "\n\n" + template.employmentBranch[employmentStatus];
  }

  return result;
}

export function buildTeaserFromFull(full: AnalysisResult): TeaserResult {
  return {
    tier: full.tier,
    scores: full.scores,
    sections: (full.sections || []).map((section) => ({
      icon: section.icon,
      title: section.title,
    })),
    coreFearAxisBlock: full.coreFearAxisBlock,
  };
}

export function assertNoContentKey(value: unknown, path: string[] = []) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoContentKey(item, [...path, String(index)]));
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key === "content") {
      const where = path.length ? path.join(".") : "root";
      throw new Error(`Teaser payload contains forbidden key 'content' at ${where}`);
    }
    assertNoContentKey(record[key], [...path, key]);
  }
}

export async function runFullAnalysis(input: InputPayload) {
  const useMock = process.env.USE_MOCK === "true";
  if (useMock) {
    const mockResult = { ...MOCK_DATA };
    mockResult.coreFearAxisBlock = resolveCoreFearAxisBlock(input, mockResult.coreFearAxisBlock);
    mockResult.sections = enforceRiskSectionPackpok(input, mockResult.sections);
    return mockResult;
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("API 키가 설정되지 않았습니다.");
  }

  const resolvedSajuText = await resolveSajuText(input);
  const sajuInfo = resolvedSajuText ? `\n사주팔자: ${resolvedSajuText}` : "";
  const coreFearLabel = input.coreFearAxis
    ? CORE_FEAR_LABELS[input.coreFearAxis as CoreFearAxis]
    : "미선택";
  const userInfo = `
이름: ${input.name}
생년월일: ${input.birthYear}년 ${input.birthMonth}월 ${input.birthDay}일
달력구분: ${input.calendarType === "lunar" ? "음력" : "양력"}
출생시간: ${input.unknownBirthTime ? "모름" : `${input.birthHour}시 ${input.birthMinute}분`}
출생지역: ${input.birthLocation}
성별: ${input.gender}
연애/결혼 상태: ${input.relationshipStatus}
직업/직장 상태: ${input.employmentStatus || "미제공"}${sajuInfo}
요즘 1등 이슈: ${coreFearLabel}

위 정보를 바탕으로 사주를 분석해주세요. 연애/직업 정보가 제공된 경우 해당 맥락을 결과에 반영하세요.
  `.trim();

  const models = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) || DEFAULT_MODELS;
  let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

  for (const model of models) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[ANALYSIS_DEBUG] Full analysis prompt check", {
        systemPromptLength: SYSTEM_PROMPT.length,
        userInfoLength: userInfo.length,
        hasPackpokRule: SYSTEM_PROMPT.includes("[팩폭(선택 불가) 규칙"),
      });
    }
    const res = await callGemini(model, userInfo);
    if (res.ok) {
      try {
        const parsed = parseJson5Loose<AnalysisResult>(res.text);
        parsed.scores = normalizeScores(parsed.scores);
        parsed.coreFearAxisBlock = resolveCoreFearAxisBlock(input, parsed.coreFearAxisBlock);
        parsed.sections = enforceRiskSectionPackpok(input, parsed.sections);
        return parsed;
      } catch (error: any) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[ANALYSIS_DEBUG] Invalid JSON from model", { model, message: error?.message });
        }
        lastError = {
          status: 502,
          apiStatus: "INVALID_JSON",
          message: "분석 결과 형식이 불완전합니다. 잠시 후 다시 시도해주세요.",
        };
        continue;
      }
    }

    lastError = res;
    if (!shouldFallback(res.status, res.apiStatus)) {
      break;
    }
  }

  throw new Error(lastError?.message || "사주 분석 중 오류가 발생했습니다.");
}

export async function runTeaserAnalysis(input: InputPayload) {
  const useMock = process.env.USE_MOCK === "true";
  if (useMock) {
    const teaser = buildTeaserFromFull(MOCK_DATA);
    teaser.coreFearAxisBlock = resolveCoreFearAxisBlock(input, teaser.coreFearAxisBlock);
    return teaser;
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("API 키가 설정되지 않았습니다.");
  }

  const resolvedSajuText = await resolveSajuText(input);
  const sajuInfo = resolvedSajuText ? `\n사주팔자: ${resolvedSajuText}` : "";
  const coreFearLabel = input.coreFearAxis
    ? CORE_FEAR_LABELS[input.coreFearAxis as CoreFearAxis]
    : "미선택";
  const userInfo = `
이름: ${input.name}
생년월일: ${input.birthYear}년 ${input.birthMonth}월 ${input.birthDay}일
달력구분: ${input.calendarType === "lunar" ? "음력" : "양력"}
출생시간: ${input.unknownBirthTime ? "모름" : `${input.birthHour}시 ${input.birthMinute}분`}
출생지역: ${input.birthLocation}
성별: ${input.gender}
연애/결혼 상태: ${input.relationshipStatus}
직업/직장 상태: ${input.employmentStatus || "미제공"}${sajuInfo}
요즘 1등 이슈: ${coreFearLabel}
  `.trim();

  const models = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) || DEFAULT_MODELS;
  let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

  for (const model of models) {
    const res = await callGemini(model, userInfo, TEASER_PROMPT);
    if (res.ok) {
      try {
        const parsed = parseJson5Loose<TeaserResult>(res.text);
        parsed.scores = normalizeScores(parsed.scores);
        parsed.coreFearAxisBlock = resolveCoreFearAxisBlock(input, parsed.coreFearAxisBlock);
        return parsed;
      } catch (error: any) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[ANALYSIS_DEBUG] Invalid teaser JSON from model", { model, message: error?.message });
        }
        lastError = {
          status: 502,
          apiStatus: "INVALID_JSON",
          message: "분석 결과 형식이 불완전합니다. 잠시 후 다시 시도해주세요.",
        };
        continue;
      }
    }

    lastError = res;
    if (!shouldFallback(res.status, res.apiStatus)) {
      break;
    }
  }

  throw new Error(lastError?.message || "사주 분석 중 오류가 발생했습니다.");
}
