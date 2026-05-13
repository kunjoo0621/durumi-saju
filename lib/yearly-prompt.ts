import {
  callGemini,
  buildFortunePromptBlock,
  DEFAULT_MODELS,
  shouldFallback,
  resolveSajuEnrichedData,
  type InputPayload,
} from "@/lib/analysis";
import {
  calculateServerScoring,
  scoreToGrade,
  type ServerScores,
  type TierResult,
  SCORING_VERSION,
} from "@/lib/utils/saju-scoring";
import { parseJson5Loose } from "@/lib/json5Utils";
import { normalizeScores, type AnalysisScores } from "@/lib/resultSchema";
import { CORE_FEAR_LABELS, type CoreFearAxis } from "@/lib/analysis";
import {
  calculateYearlyInteraction,
  buildYearlyContextBlock,
  type YearlyInteractionResult,
} from "@/lib/utils/yearly-interaction";
import {
  calculateYearlyLuckMeta,
  buildYearlyLuckMetaBlock,
  type YearlyLuckMeta,
} from "@/lib/utils/yearly-luck-meta";
import {
  calculateYearlyMonthlyFlow,
  buildMonthlyFlowBlock,
  type MonthlyEntry,
} from "@/lib/utils/yearly-monthly";
import type { FortuneResult } from "@/lib/utils/saju-fortune";

/* ───────── 결과 타입 ───────── */

export type YearlySection = {
  icon: string;
  title: string;
  content: string;
};

export type YearlyResult = {
  tier: {
    grade: string;
    composite: number;
    percentileRank: number;
    topPercent: number;
    confidence: "high" | "medium" | "low";
    title: string;
    description: string;
  };
  scores: AnalysisScores;
  sections: YearlySection[];
  yearlyMeta: {
    targetYear: number;
    pillar: string;          // 丙午
    pillarKorean: string;    // 병오
    tenStar: string;         // 편관
    twelveStage: string;     // 욕
    napumKorean?: string | null;
    napumHanja?: string | null;
  };
  luckyMeta: YearlyLuckMeta | null;
  monthlyFlow: MonthlyEntry[] | null;
  scoringVersion: number;
};

export const YEARLY_SECTION_SEEDS: Array<{ icon: string; title: string }> = [
  { icon: "🪶", title: "올해의 한 줄" },
  { icon: "💰", title: "올해 재물 흐름" },
  { icon: "💞", title: "올해 관계 흐름" },
  { icon: "💼", title: "올해 일 흐름" },
  { icon: "🩺", title: "올해 컨디션 흐름" },
  { icon: "🎯", title: "올해의 결정 타이밍" },
];

/* ───────── SYSTEM PROMPT (YEARLY v1.0) ───────── */

const YEARLY_SYSTEM_PROMPT = `너는 '사주보는 두루미'의 올해의 운세(세운) 풀이 생성기다.
이 서비스의 정체성: "기분 맞춰주는 점집"이 아니라 "만세력 데이터로 올해 한 해를 냉정하게 채점하는 리포트".
위로 따위 없다. 사주 원국 × 올해 세운이 만든 흐름을 있는 그대로 까발린다.

────────────────────────────────
[목적]
- 사용자는 이미 자기 원국(타고난 사주) 풀이를 봤다. 이 분석은 그것이 아니다.
- 이 분석은 "원국 위에 올해 세운이 얹혀서 만들어진 한 해 한정 흐름"을 푼다.
- 원국 결론 반복 금지. 세운 컨텍스트 없이 풀 수 있는 문장은 쓰지 마라.

[입력으로 받는 것]
- 사용자 원국 enriched (사주팔자·오행분포·십성·신살·용신)
- 서버 확정 등급/점수 (원국 기준)
- 올해 세운 컨텍스트 (세운 천간지지·12운성·세운 십성·납음·세운 × 원국 충/합/형/삼합)
- 현재 대운 (10년 주기) + 세운 흐름 전후 ±5년

────────────────────────────────
[길이 규칙 — 결제 콘텐츠 품질 유지 ★필수★ — 위반 시 분석 실패]
- 각 섹션 content는 반드시 800자 이상, 1100자 이하 (섹션 6 종합은 1,200자 이상, 1,500자 이하).
- 총 본문 합산 5,800~7,500자. 4,500자 미만이면 즉시 분석 실패로 간주.
- 절대 짧게 끝내지 마라. 분량이 모자라면 다음 방식으로 채워라:
  · 세운 × 원국 충/합/형 영향을 천간/지지/십성/12운성 각각 1~2 문장씩 풀어서 근거 분석.
  · 월별 흐름을 4~6개 시기로 쪼개서 각 시기마다 1~2 문장씩 추가.
  · 입력값(직업/연애상태/요즘 고민)을 사주 구조와 어떻게 충돌·조화하는지 1~2 문장씩 연결.
  · 행동 처방을 시기별로 2~3개씩 구체화.
- "짧게 끝내면 깔끔하다"는 인식 금지. 결제 콘텐츠는 충분한 분량이 곧 가치다.

────────────────────────────────
[톤 규칙]
- 너는 사주를 잘 아는 직설적인 친한 형이다. 말투는 친근하지만, 내용은 위로 없이 팩트로 찌른다.
- 반말 사용 ("~야", "~거든", "~거지", "~인 거지").
- 비유/은유 적극 사용. 머니·직장·영화 비유가 메인. 게임/자동차는 결과당 1회 이하.
- 위로/격려 금지: "괜찮아", "잘 될 거야", "충분히 잘하고 있어" 절대 금지.
- 미래 협박 금지: "안 ~면 ~ 거다", "후회할 때는 이미", "평생 ~ 못" 같은 부정 단정 어미 금지.
- 진단형 어미 권장: "~ 구조야", "~ 패턴이 굳어진다", "보완 없이는 같은 흐름이 반복된다".
- "스스로"라는 단어 금지. "자기 자신에게"로 대체.
- 핵심: 따뜻한 말투 + 차가운 진실. 진실을 전하기 위해 공포 어미를 사용할 필요 없다.

────────────────────────────────
[세운 활용 — 핵심 규칙]
- 모든 섹션은 "올해 세운 컨텍스트" 블록을 적극 반영해라.
  · 세운 천간 → 일간 기준 십성 (예: 편관운 = 압박·시험 / 정재운 = 안정 수입 / 상관운 = 표현·이탈)
  · 세운 × 원국 천간충 → 일간/년간/월간/시간 어느 위치냐에 따라 영역 차이
  · 세운 × 원국 지지충/합/형 → 환경 변화·이동·관계 신호
  · 세운 12운성 → 에너지 상태 (장생/제왕은 강세, 사/묘는 침체)
  · 납음(納音) → 보조 색채 (천하수·검봉금 등)
- 충/합/형이 없는 경우에도 "직접 충·합 없음, 흐름은 잔잔" 같은 진단을 명시하고, 십성 운 중심으로 풀어라.

[일지(日支) 자극의 정통 해석 ★중요]
- 일지는 배우자·이성·결혼·동거인 영역. 정통 명리학에서 가장 무거운 자리.
- 일지 × 세운 합(육합·삼합) → "올해 안에 결혼·동거·진지한 결정" 또는 "새 인연 진입" 시그널.
- 일지 × 세운 충 → "이별·이사·환경 격변·배우자/연인 관계 흔들림" 시그널.
- 일지 × 세운 형 → "관계 안에서 자기 소모·소송·구설" 시그널.
- 본문에서 일지가 자극받으면 "관계가 열정적"으로 가볍게 처리하지 말고 정통의 무게로 다뤄라.
- 단, 미혼은 결혼·동거 가능성 / 기혼은 관계 결정·이혼·재결합 가능성으로 분기.

[신살(神煞)·12신살 활용 ★의무]
- 원국 enriched에 신살 매치 리스트가 제공된다 (화개살·홍염살·천덕귀인·공망·역마살·도화살 등).
- 적어도 2개 섹션에서 원국 신살이 세운에 어떻게 자극되는지 풀어라.
  · 길신(천덕귀인·태극귀인 등): 올해 어떻게 작용해 위기 시 도움이 되는지
  · 흉살(겁살·재살·천살 등): 세운에 의해 어떻게 활성화되는지
  · 화개살·홍염살·도화살: 세운 지지와 만나면 어떤 영역에서 발현되는지
- 신살을 단순 나열 X. 본문에 캐릭터처럼 등장시켜라 ("천덕귀인이 받쳐줘서~", "겁살이 깨어나는 시기는~").

[납음(納音) 본문 활용 ★의무 1회 이상]
- 컨텍스트에 제공되는 납음(예: 천하수·검봉금·복등화)을 최소 1개 섹션에서 본문 비유로 활용해라.
- 시그니처 비유 예시:
  · 천하수(天河水) = "하늘에서 내리는 빗물 — 보이지만 잡히지 않는 흐름"
  · 검봉금(劍鋒金) = "칼끝의 금속 — 날카롭지만 차가운 결단력"
  · 노중화(爐中火) = "화로 속 불 — 자기 그릇 안에서만 타오르는 열기"
  · 대해수(大海水) = "바닷물 — 깊고 넓어 흐름을 거스를 수 없음"
- "그 사람의 올해는 [납음 비유] 같다" 식으로 한 문단 안에 자연스럽게.

[시그니처 표현 — 재미를 위한 캐릭터화]
- 십성·신살을 사물·인물·캐릭터처럼 등장시켜라.
  · "정재(正財)가 너에게 손짓하지만, 임병충(壬丙冲)이 옆에서 발목을 잡아"
  · "올해는 편관(偏官)이 채찍을 들고 와서 일을 시켜"
  · "천덕귀인이 너 뒤에 조용히 서 있다가 위기에 손을 내밀어"
- 추상명사보다 동적 동사·신체적 비유 우선.

[시기 명시 ★의무]
- 모든 섹션에서 최소 1회 이상 "n월~m월" 시기 표현을 써라.
- 컨텍스트에 [월별 흐름] 12개월 데이터가 제공된다. 각 월의 천간지지·십성·12운성·mood(강세/보통/주의/위기)를 활용해 정확한 시기 추정을 해라.
  · "강세" 월에는 진행·확장·결정 권장
  · "보통" 월에는 현상 유지·관찰
  · "주의" 월에는 새로운 시작·큰 결제 회피
  · "위기" 월에는 휴식·내실 다지기·새 인연/투자 금지
- 종합(섹션 6)에서는 12개월 중 특히 인상적인 월(강세 2~3개 + 위기 1~2개)을 콕 짚어 행동 지침과 연결해라.
- 좋은 예: "5월 정관운 강세에 계약 결정, 8월 정인운 강세에 자격증 도전. 7월 편관·12운성 절은 진행 멈추고 점검."
- 나쁜 예: "올해 큰 돈은 조심해" (시기 미상)

────────────────────────────────
[섹션 구성 — 정확히 6개]
section[0] icon "🪶" title "올해의 한 줄"
  - 세운 키워드 한 줄 진단 + 원국 등급 대비 올해 분위기.
  - 원국 결론과 어떻게 다른지/같은지 1문단으로 압축.
  - 올해를 한 문장으로 요약하는 비유 1개 포함.

section[1] icon "💰" title "올해 재물 흐름"
  - 12개월 안의 돈 흐름·결제·투자·수입 변동.
  - 세운 십성이 재성과 어떻게 상호작용하는지 (재성 강화/위협).
  - 위험 시기 1~2개 월 명시 + 안전 시기 1~2개 월 명시.

section[2] icon "💞" title "올해 관계 흐름"
  - 연애·결혼·이별·인간관계 마찰·새로운 만남 시기.
  - 세운 십성과 원국 비견/겁재/정관/편관 흐름.
  - 연애 상태(솔로/연애중/기혼) 입력값을 반영해 분기해라.

section[3] icon "💼" title "올해 일 흐름"
  - 이직·승진·시험·평가·직장 압박·기회.
  - 세운 편관/정관 흐름 + 세운 × 원국 천간충 영향.
  - 직업 상태(직장인/사업/학생/취준) 입력값 반영.

section[4] icon "🩺" title "올해 컨디션 흐름"
  - 위험 시기 1~2개 월 명시 + 보완 행동.
  - 세운 × 원국 일지/월지 충/형 → 신체 부담 영역.
  - 의학 진단 금지. "영역" 표현("간담 영역", "심장 영역") 권장.

section[5] icon "🎯" title "올해의 결정 타이밍 (종합)
  - 위 5개 섹션을 통합해 월별 무드 흐름 정리 (분기 단위 가능).
  - "n월에 뭘 해라 / m월에 뭘 하지 마라" 형태 행동 제안 4~6개.
  - 마지막에 올해 한 줄 클로징.

────────────────────────────────
[입력값 100% 반영 — 누락 금지]
- 이름 (입력값 그대로, 한 글자도 변형 금지)
- 생년월일 / 양력음력 / 출생시간 (해석 텍스트에 노출 금지, 만세력 계산용)
- 출생지역 (해석 텍스트에 노출 금지)
- 성별 / 연애·결혼 상태 / 직업 상태 — 각각 최소 1회 문맥 속에 녹여라.
- 요즘 1등 이슈 (선택값) — 결과 전체에서 최소 2회 사주 구조와 어떻게 충돌하는지 구체 연결.
- 만세력 텍스트 없으면 "근거 부족 페널티" 명시.

[절대 출력 규칙]
- 출력은 반드시 유효한 JSON 단일 객체만 반환. JSON 외 텍스트 금지.
- 마크다운 금지(#, *, -, 코드블록, 표, 불릿, 번호 리스트). 문장으로만.
- 과장/단정 금지: "무조건/반드시/확실/100%/절대/영원히/정답/운명" 금지.
- 모욕/조롱/비하 금지. 팩폭은 '행동 패턴과 구조적 취약점'만 공격.
- 사주 용어는 첫 등장 시 한자 병기: 편관(偏官) / 정재(正財) / 겁재(劫財) / 자오충(子午冲).
- 한자 병기 직후 같은 문장에서 일상어로 즉시 번역.
- 이모지: 전체 결과에서 0~2개(섹션 icon 제외).
- 공감 질문: 전체 결과 1~2개.
- 출생시간 모름이면 "시주 미상이라 해석 범위가 넓어진다" 1문장 의무.
- 지역명 언급 금지.
- 마지막 6번 종합 섹션 외에는 "결론적으로", "정리하면" 같은 요약 어미 금지.

[content 포맷팅]
- 각 섹션 content는 2~3 문단. 줄바꿈 2개(\\n\\n)로 구분.
- 1문단 3~5문장. 구조: 1문단(진단) → 2문단(근거 / 시기) → 3문단(처방 / 행동).

────────────────────────────────
[출력 JSON 스키마(고정)]
{
  "tier": {
    "grade": (서버 확정값 그대로),
    "composite": (서버 확정값 그대로),
    "percentileRank": (서버 확정값 그대로),
    "topPercent": (서버 확정값 그대로),
    "title": "올해를 한 줄로 요약한 날카로운 제목 15~25자",
    "description": "올해의 핵심 강점과 리스크 3~5문장"
  },
  "scores": (서버 확정 원국 5분야 그대로 — v1.0),
  "sections": [
    { "icon": "🪶", "title": "올해의 한 줄", "content": "..." },
    { "icon": "💰", "title": "올해 재물 흐름", "content": "..." },
    { "icon": "💞", "title": "올해 관계 흐름", "content": "..." },
    { "icon": "💼", "title": "올해 일 흐름", "content": "..." },
    { "icon": "🩺", "title": "올해 컨디션 흐름", "content": "..." },
    { "icon": "🎯", "title": "올해의 결정 타이밍", "content": "..." }
  ]
}

tier.grade / composite / percentileRank / topPercent / scores는 원국 서버 확정값을 그대로 반환한다.
이 값들을 절대 변경하지 마라. 본문에서는 "원국 등급은 B지만, 올해 세운으로 흐름이 살짝 빠진다"처럼 흐름만 묘사한다.
`;

/* ───────── User Info Builder ───────── */

function buildScoreSummary(tier: TierResult, scores: ServerScores): string {
  return [
    `원국 종합등급: ${tier.grade} (composite: ${tier.composite}, 상위 ${tier.topPercent}%, confidence: ${tier.confidence})`,
    `재물운: ${scores.재물운} (${scoreToGrade(scores.재물운)}) / 연애운: ${scores.연애운} (${scoreToGrade(
      scores.연애운,
    )}) / 직장운: ${scores.직장운} (${scoreToGrade(scores.직장운)}) / 건강운: ${scores.건강운} (${scoreToGrade(
      scores.건강운,
    )}) / 대인운: ${scores.대인운} (${scoreToGrade(scores.대인운)})`,
  ].join("\n");
}

function buildShinsalBlock(enriched: any | null): string {
  if (!enriched?.shinsal?.matches?.length) return "";
  const lines = ["[신살 감지 결과]"];
  for (const m of enriched.shinsal.matches) {
    const typeLabel = m.type === "good" ? "길신" : m.type === "bad" ? "흉살" : "중성";
    lines.push(`- ${m.label} (${typeLabel}): ${m.evidence.join("; ")}`);
  }
  if (enriched.isTimeUnknown) lines.push("※ 시주 미상으로 일부 신살 변동 가능");
  return "\n" + lines.join("\n");
}

export function buildYearlyUserInfo(params: {
  input: InputPayload;
  sajuText: string | null;
  enriched: any | null;
  fortune: FortuneResult | null;
  interaction: YearlyInteractionResult;
  tier: TierResult;
  scores: ServerScores;
  luckyMeta: YearlyLuckMeta | null;
  monthlyFlow: MonthlyEntry[] | null;
}): string {
  const { input, sajuText, enriched, fortune, interaction, tier, scores, luckyMeta, monthlyFlow } = params;
  const sajuInfo = sajuText ? `\n사주팔자: ${sajuText}` : "";
  const shinsalBlock = buildShinsalBlock(enriched);
  const coreFearLabel = input.coreFearAxis && input.coreFearAxis in CORE_FEAR_LABELS
    ? CORE_FEAR_LABELS[input.coreFearAxis as CoreFearAxis]
    : "미선택";
  const currentYear = new Date().getFullYear();
  const koreanAge = currentYear - Number(input.birthYear) + 1;
  const internationalAge = currentYear - Number(input.birthYear);
  const scoreSummary = buildScoreSummary(tier, scores);
  const fortuneBlock = buildFortunePromptBlock(fortune, Number(input.birthYear));
  const yearlyContext = buildYearlyContextBlock(interaction);
  const luckyBlock = buildYearlyLuckMetaBlock(luckyMeta);
  const monthlyBlock = buildMonthlyFlowBlock(monthlyFlow);

  return `
이름: ${input.name}
생년월일: ${input.birthYear}년 ${input.birthMonth}월 ${input.birthDay}일
달력구분: ${input.calendarType === "lunar" ? "음력" : "양력"}
출생시간: ${input.unknownBirthTime ? "모름" : `${input.birthHour}시 ${input.birthMinute}분`}
현재 나이: 만 ${internationalAge}세 (한국 나이 ${koreanAge}세) — ${currentYear}년 기준
성별: ${input.gender}
연애/결혼 상태: ${input.relationshipStatus}
직업/직장 상태: ${input.employmentStatus || "미제공"}${sajuInfo}${shinsalBlock}
요즘 1등 이슈: ${coreFearLabel}${fortuneBlock}

${yearlyContext}
${luckyBlock}
${monthlyBlock}

[서버 계산 결과 — 원국 기준]
${scoreSummary}
위 점수/등급은 원국 확정값이다. 텍스트에서 점수를 변경하지 말고, "원국은 ${tier.grade}지만 세운으로 올해 흐름은 ~" 식으로 시기적 묘사로만 사용해라.

위 정보를 바탕으로 ${interaction.targetYear}년 올해의 운세를 분석해주세요.
연애/직업 정보가 제공된 경우 해당 맥락을 결과에 반영하세요.
모든 섹션은 "올해" 한정으로 풀이하며, 원국 결론 반복은 금지입니다.
  `.trim();
}

/* ───────── Main Entry ───────── */

export async function runYearlyAnalysis(
  input: InputPayload,
  targetYear: number,
): Promise<YearlyResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("API 키가 설정되지 않았습니다.");
  }

  // 1) 사주 원국 enriched (개인사주와 100% 동일 소스)
  const { sajuText, enriched, fortune } = await resolveSajuEnrichedData(input);
  if (!enriched) {
    throw new Error("사주 계산에 실패했습니다.");
  }

  // resolveSajuEnrichedData는 fortune을 any로 반환 — 명시 타입으로 캐스팅
  const typedFortune = fortune as FortuneResult | null;

  // 2) 세운 추출
  const seun = typedFortune?.seun?.find((s) => s.year === targetYear);
  if (!seun) {
    throw new Error(`${targetYear}년 세운 데이터를 가져올 수 없습니다.`);
  }

  // 3) 세운 × 원국 상호작용
  const interaction = calculateYearlyInteraction(enriched, seun);

  // 3-1) 행운 메타 (용신 기반)
  const luckyMeta = calculateYearlyLuckMeta(enriched);

  // 3-2) 월별 12개 흐름 (월운)
  const monthlyFlow = await calculateYearlyMonthlyFlow(targetYear, enriched.dayMaster.stem);

  // 4) 점수/등급 (개인사주와 100% 동일 소스, 원국 기준)
  const { scores: serverScores, tier: serverTier } = calculateServerScoring(enriched);

  // 5) userInfo 어셈블
  const userInfo = buildYearlyUserInfo({
    input,
    sajuText,
    enriched,
    fortune: typedFortune,
    interaction,
    tier: serverTier,
    scores: serverScores,
    luckyMeta,
    monthlyFlow,
  });

  // 6) LLM 호출 (analyze와 동일 모델 fallback 체인)
  const _envModels = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? [];
  const models = _envModels.length > 0 ? _envModels : DEFAULT_MODELS;
  let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

  for (const model of models) {
    const res = await callGemini(model, userInfo, YEARLY_SYSTEM_PROMPT);
    if (res.ok) {
      try {
        const parsed = parseJson5Loose<any>(res.text);
        const sections: YearlySection[] = Array.isArray(parsed?.sections)
          ? parsed.sections
              .filter(Boolean)
              .slice(0, YEARLY_SECTION_SEEDS.length)
              .map((section: any, index: number) => ({
                icon: typeof section?.icon === "string" && section.icon.trim()
                  ? section.icon
                  : YEARLY_SECTION_SEEDS[index]?.icon || "🧩",
                title: typeof section?.title === "string" && section.title.trim()
                  ? section.title
                  : YEARLY_SECTION_SEEDS[index]?.title || `섹션 ${index + 1}`,
                content: typeof section?.content === "string" ? section.content : "",
              }))
          : [];

        const tierTitle = typeof parsed?.tier?.title === "string" && parsed.tier.title.trim()
          ? parsed.tier.title
          : `${interaction.targetYear}년 ${interaction.pillarKorean} 세운 요약`;
        const tierDescription = typeof parsed?.tier?.description === "string" && parsed.tier.description.trim()
          ? parsed.tier.description
          : "올해 흐름을 정리하는 중입니다.";

        const result: YearlyResult = {
          tier: {
            grade: serverTier.grade,
            composite: serverTier.composite,
            percentileRank: serverTier.percentileRank,
            topPercent: serverTier.topPercent,
            confidence: serverTier.confidence,
            title: tierTitle,
            description: tierDescription,
          },
          scores: normalizeScores(serverScores),
          sections,
          yearlyMeta: {
            targetYear: interaction.targetYear,
            pillar: interaction.pillar,
            pillarKorean: interaction.pillarKorean,
            tenStar: interaction.tenStar,
            twelveStage: interaction.twelveStage,
            napumKorean: interaction.napum?.korean ?? null,
            napumHanja: interaction.napum?.hanja ?? null,
          },
          luckyMeta,
          monthlyFlow,
          scoringVersion: SCORING_VERSION,
        };
        return result;
      } catch (error: any) {
        lastError = {
          status: 502,
          apiStatus: "INVALID_JSON",
          message: "분석 결과 형식이 불완전합니다. 잠시 후 다시 시도해주세요.",
        };
        continue;
      }
    }
    lastError = res;
    if (!shouldFallback(res.status, res.apiStatus)) break;
  }

  throw new Error(lastError?.message || "올해의 운세 분석 중 오류가 발생했습니다.");
}
