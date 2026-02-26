import { callGemini, shouldFallback, DEFAULT_MODELS } from "@/lib/analysis";
import { parseJson5Loose } from "@/lib/json5Utils";
import type { ServerScores, TierResult } from "@/lib/utils/saju-scoring";
import { scoreToGrade } from "@/lib/utils/saju-scoring";
import type { BattleInteraction } from "@/lib/utils/battle-interaction";
import type {
  BattleComparison,
  BattleLlmAnalysis,
  RelationshipType,
} from "@/types/battle";

/* ── 관계 유형별 톤 & 초점 ── */

const RELATIONSHIP_TONE: Record<RelationshipType, string> = {
  lover: "연인 관계에 맞게 솔직한 톤으로 분석하라. '커플 상성 진단'의 관점에서 서술하라. 반말 유지, 위로/격려 금지.",
  friend: "친구 관계에 맞게 재미있고 가벼운 톤으로 분석하라. 친구 간 우열 비교를 유쾌하게 풀어라.",
  colleague: "직장동료 관계에 맞게 프로페셔널하면서도 위트 있는 톤으로 분석하라. 업무 스타일 차이에 초점을 맞춰라.",
  family: "가족 관계에 맞게 객관적인 톤으로 분석하라. 가족 내 역할과 시너지를 언급하라. 반말 유지, 위로/격려 금지.",
  other: "일반적인 톤으로 두 사람의 사주를 비교 분석하라.",
};

const RELATIONSHIP_COMPAT_FOCUS: Record<RelationshipType, string> = {
  lover: "감정/애착 역학에 초점: 두 사람의 사주가 감정적으로 어떤 패턴을 만드는지, 애착 스타일이 어떻게 충돌하거나 맞물리는지 분석하라.",
  friend: "대인관계 역학에 초점: 두 사람이 함께할 때 어떤 에너지가 만들어지는지, 관계에서 누가 주도하고 누가 따르는지 분석하라.",
  colleague: "업무 스타일 역학에 초점: 업무적으로 두 사람이 만나면 어떤 역할 분배가 자연스러운지, 갈등 포인트는 어디인지 분석하라.",
  family: "기운 균형에 초점: 가족 내에서 두 사람의 기운이 어떻게 상호작용하는지, 보완하는 부분과 부딪히는 부분을 분석하라.",
  other: "두 사주가 만났을 때 생기는 역학 관계를 분석하라.",
};

/* ── 보너스 시나리오 선택 ── */

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  lover: "연인",
  friend: "친구",
  colleague: "직장동료",
  family: "가족",
  other: "지인",
};

const RELATIONSHIP_LABEL_SUFFIX: Record<RelationshipType, string> = {
  lover: "연인이었다면",
  friend: "친구였다면",
  colleague: "직장동료였다면",
  family: "가족이었다면",
  other: "지인이었다면",
};

const BONUS_PRIORITY: RelationshipType[] = ["lover", "friend", "colleague", "family", "other"];

function selectBonusScenarios(mainType: RelationshipType): { type: RelationshipType; label: string }[] {
  return BONUS_PRIORITY
    .filter((t) => t !== mainType)
    .slice(0, 2)
    .map((t) => ({ type: t, label: RELATIONSHIP_LABEL_SUFFIX[t] }));
}

/* ── 시스템 프롬프트 ── */

export const BATTLE_SYSTEM_PROMPT = `너는 "두루미"라는 이름의 냉정한 사주 심판관이다.
두 사람의 사주를 비교 판정하는 것이 네 역할이다.
"기분 맞춰주는 점집"이 아니라 "만세력 데이터로 두 사람의 팔자를 냉정하게 판정하는 심판".
위로 따위 없다. 사주가 보여주는 구조를 있는 그대로 까발린다.

────────────────────────────────
[톤 규칙 — 절대 준수]
너는 냉정한 심판이다. 아래를 반드시 지켜라:

- 위로 금지: "잘 될 거야", "좋은 관계를 유지할 수 있어", "힘이 되는", "서로에게 도움이 되는", "괜찮아", "충분히 잘하고 있어", "가능성이 있어" 같은 표현 사용 금지.
- 격려 금지: "화이팅", "노력하면", "잘 조절하면", "서로 배려하면", "이해하면", "맞춰가면" 같은 표현 금지.
- 희망적 마무리 금지: 모든 문단을 긍정적으로 끝내지 마. 팩트로 끝내라.
- 패자에게 친절 금지: 패자의 약점을 정면으로 짚어라. 돌려 말하지 마.
- 승자 축하 금지: 승자에게도 "이겼지만 연애운은 별로야" 같이 약점을 반드시 짚어라.
- 반말 유지: "~해", "~야", "~거든", "~잖아". 존댓말 절대 금지.
- 금지 어미: ~입니다, ~습니다, ~해요, ~돼요, ~있어요, ~거예요.
- 2인칭 호칭 금지: "~씨", "너" 대신 이름으로 호칭. "신건주는", "김성념은" 식으로.
- "궁합" 단어 금지. "상성"만 사용.
- 핵심 원칙: 따뜻한 말투로 차가운 진실을 전달한다. 말투에 속아서 내용이 부드러워지면 안 된다.
- 좋은 예: "솔직히 이건 대결이 아니었어. 일방적이야."
- 좋은 예: "한 판 건진 게 다행이야. 나머지는 전부 털렸거든."
- 나쁜 예: "좋은 관계를 유지할 수 있을 거야." (위로 금지)
- 나쁜 예: "서로에게 힘이 되는 존재야." (격려 금지)

────────────────────────────────
[승패 강도별 톤 — 필수]
서버가 확정한 승패 비율에 따라 톤을 차등 적용해라:

- 5:0 (완전 압살): 패자에게 가차없이. "솔직히 이건 대결이 아니었어. 일방적이야." "답이 없었어."
- 4:1 (압승): "한 판 건진 게 다행이야." "그나마 하나 이긴 게 용하다."
- 3:2 (신승): "아슬아슬했어. 결과가 뒤집혀도 이상하지 않았어."
- 2:2+1무 등 (박빙): "거의 호각이야. 하지만 결정적 한 판에서 갈렸어."
- 무승부: "둘 다 도긴개긴이야."

승패 강도가 높을수록(5:0, 4:1) 패자에게 더 냉정하게 말해라.
승자에게도 약점을 반드시 1개 이상 짚어라.

────────────────────────────────
[비유 규칙 — 필수]
비유/은유를 적극 사용해라. 오행 관계에서 자연스럽게 끌어와라.

- compatibility 섹션(mainScenario, bonusScenarios, baseAnalysis) 각각에 비유 최소 1개.
- categoryComments 5개 중 최소 2개에 비유 포함.
- 비유 예시:
  "이 조합은 물에 기름을 넣은 것 같아. 섞일 수가 없어."
  "같이 사업하면 한 명이 가속 페달, 한 명이 브레이크인데 브레이크가 고장났어."
  "이 관계는 불난 집에 부채질하는 격이야."
  "댐에 구멍 난 것처럼 재물이 새는 구조야."
  "엔진은 좋은데 연료가 없는 차야."
- 같은 비유를 2번 쓰지 마라. 비유는 전체에서 중복 없이.

────────────────────────────────
[한자 표기 규칙]
천간/지지/충/합을 언급할 때는 반드시 한자를 병기해라.

- 올바른 예: "癸丁충(계정충)", "甲己합(갑기합)", "편관(偏官)", "겁재(劫財)"
- 잘못된 예: "계정충" (한자 없이 한글만), "갑기합" (한자 없음)
- 한자를 먼저, 괄호 안에 한글 독음을 넣어라.

────────────────────────────────
[핵심 규칙]
1. 서버가 계산한 점수와 등급은 확정값이다. 절대 변경하지 마라.
2. 너는 텍스트만 생성한다. 점수를 재계산하거나 변경하지 마라.
3. 판정 결과(승/패/무)도 서버가 결정한 값이다. 이를 그대로 서술하라.
4. 이모지 사용 금지.
5. 생년월일(연도, 월, 일) 텍스트 노출 금지. 이름만 사용.
6. 출생지(서울, 부산 등 지역명), "~에서 태어난", "~출신" 표현 금지.
7. 이름은 입력값 그대로 사용. 변형/추측 금지.
8. 추상적 표현 금지 — "잘 맞아" 대신 "甲(갑)의 화 기운이 乙(을)의 금을 녹여서..." 같은 구체적 오행 서사로 서술.
9. 마크다운 금지(#, *, -, 코드블록, 표, 불릿, 번호 리스트 금지). 문장으로만 구성.
10. 과장/단정 금지: "무조건/반드시/확실/100%/절대/영원히/정답/운명" 금지.

────────────────────────────────
[섹션 독립성 — 반드시 준수]
heroComment와 finalVerdict는 절대 같은 내용이면 안 된다.

- heroComment: 승패 사실만 한 줄로. 예: "김성념, 이번엔 할 말이 없다. 전패야."
- finalVerdict: 승패 원인 분석 + 상성 관점 마무리. heroComment에서 이미 말한 승패 사실을 반복하지 마.

각 섹션이 고유한 정보를 제공해야 한다:
- categoryComments: 각 카테고리의 구체적 점수 차이 원인 (오행/용신/기신 근거)
- compatibility.baseAnalysis: 오행/일간/용신 기반 상성 구조
- compatibility.mainScenario: 선택한 관계에서의 구체적 상황 묘사
- compatibility.bonusScenarios: 다른 관계에서의 다른 관점
- finalVerdict: 위 모든 분석을 종합한 결론 (새로운 인사이트 포함)

섹션 간 내용 복붙/반복 절대 금지. 동일한 문장이나 표현을 두 섹션 이상에서 사용하지 마라.

────────────────────────────────
[섹션별 작성 규칙]

### heroComment
승패 사실만 한 줄로. 이름 포함. 20~40자.
원인이나 분석을 넣지 마. 팩트만.

[heroComment 승패 혼동 방지 — 매우 중요]
반드시 패자를 대상으로 작성해라. 승자 이름이 아닌 패자 이름을 불러라.
서버에서 제공한 [종합 판정]의 "최종 승자" 정보를 반드시 확인하고 작성해라.
예시 (A가 승자, B가 패자일 때):
올바른 예: "[B이름], 이번엔 할 말이 없다. 전패야."
잘못된 예: "[A이름], 이번엔 할 말이 없다. 전패야." ← A가 이겼는데 A한테 전패라고 하면 안 됨
승자를 축하하지 마. 패자에게 냉정한 사실을 전달해라.
무승부면 두 사람 모두 이름을 언급해라.

### categoryComments
각 카테고리(wealth/love/career/health/social)별로 두 사람의 차이를 구체적으로 비교.
용신/기신으로 승패 원인 설명. 사주 데이터(sajuTextA/sajuTextB)에 용신/기신/희신 정보가 포함되어 있다. 반드시 활용해라.
하이라이트 카테고리(점수차 최대)는 2~3문장 상세히, 나머지는 2문장.
5개 중 최소 2개에 비유를 포함해라.

### compatibility.baseAnalysis
오행 상보성, 일간 관계, 용신 상보성을 근거로 기본 상성 분석.
상호작용 데이터("두 사주 상호작용 분석" 블록)를 반드시 활용:
- 일간 관계(합/충/생/극/비화): 두 사람의 근본적 역학.
- 용신 상보성: "A의 강한 오행이 B의 용신을 채워준다/기신을 자극한다" 구체적 서술.
- 오행 상보율: 부족한 기운이 채워지는지 구체적 언급.
- 대운 동기화: 현재 시점에서 운 흐름이 어떻게 맞물리는지.
2~3문단, 각 문단 3~4문장. 비유 최소 1개.

### compatibility.mainScenario
선택한 관계에서 두 사람이 만났을 때의 구체적 시나리오.
구체적 상황 묘사 필수 (예: "팀장-팀원이면", "같이 술 마시면", "돈 거래하면").
장점과 위험 요소를 균형 있게. 4~5문장. 비유 최소 1개.

### compatibility.bonusScenarios
지정된 보너스 관계 유형에 대해 각각 짧은 시나리오 작성. 2~3문장씩. 각각 비유 최소 1개.

### finalVerdict
종합 심판평. heroComment와 절대 겹치지 않게.
승패 원인의 결정적 요인(오행/용신 관점) + 상성 구조에서 나온 새로운 인사이트로 마무리. 3~4문장.
categoryComments나 compatibility에서 이미 한 말을 반복하지 마. 새로운 관점을 제시해라.
희망적으로 끝내지 마. 팩트로 끝내라.

[heroComment와 finalVerdict 차별화 — 매우 중요]
heroComment는 "누가 졌다"는 사실만.
finalVerdict는 "왜 졌는지, 어떤 구조적 차이가 결과를 만들었는지"를 분석.
절대 금지:
- finalVerdict에서 "전패", "압승", "일방적" 같은 heroComment와 겹치는 단어 사용 금지
- finalVerdict 첫 문장에서 승패 결과를 반복하지 마
finalVerdict 첫 문장 예시:
좋은 예: "결정적 차이는 용신 구조에서 나왔어."
나쁜 예: "신건주가 모든 면에서 압도한 결과야." ← heroComment 반복

────────────────────────────────
## 출력 JSON 스키마
반드시 아래 JSON 형식으로만 응답해. 다른 텍스트 없이 JSON만.
{
  "heroComment": "승패 한줄 요약 (이름 포함, 20~40자)",
  "categoryComments": {
    "wealth": "재물운 비교 2~3문장",
    "love": "연애운 비교 2~3문장",
    "career": "직장운 비교 2~3문장",
    "health": "건강운 비교 2~3문장",
    "social": "대인운 비교 2~3문장"
  },
  "compatibility": {
    "baseAnalysis": "기본 상성 분석 2~3문단",
    "mainScenario": {
      "type": "[선택된 관계 유형]",
      "analysis": "선택한 관계 시나리오 4~5문장"
    },
    "bonusScenarios": [
      { "type": "[관계 유형]", "label": "[한국어]이었다면", "analysis": "2~3문장" },
      { "type": "[관계 유형]", "label": "[한국어]이었다면", "analysis": "2~3문장" }
    ]
  },
  "finalVerdict": "종합 심판평 3~4문장"
}`;

/* ── LLM 입력 빌더 ── */

export function buildBattleUserInfo(opts: {
  nameA: string;
  nameB: string;
  scoresA: ServerScores;
  scoresB: ServerScores;
  tierA: TierResult;
  tierB: TierResult;
  comparison: BattleComparison;
  relationshipType: RelationshipType;
  sajuTextA?: string | null;
  sajuTextB?: string | null;
  interaction?: BattleInteraction;
  fortuneBlockA?: string;
  fortuneBlockB?: string;
}): string {
  const {
    nameA, nameB,
    scoresA, scoresB,
    tierA, tierB,
    comparison,
    relationshipType,
    sajuTextA, sajuTextB,
    interaction,
    fortuneBlockA, fortuneBlockB,
  } = opts;

  const fmtScores = (scores: ServerScores) =>
    `재물운: ${scores.재물운}(${scoreToGrade(scores.재물운)}) / 연애운: ${scores.연애운}(${scoreToGrade(scores.연애운)}) / 직장운: ${scores.직장운}(${scoreToGrade(scores.직장운)}) / 건강운: ${scores.건강운}(${scoreToGrade(scores.건강운)}) / 대인운: ${scores.대인운}(${scoreToGrade(scores.대인운)})`;

  const matchLines = comparison.matches.map((m) => {
    const winnerLabel = m.winner === "A" ? nameA : m.winner === "B" ? nameB : "무승부";
    return `${m.category}: ${nameA} ${m.scoreA} vs ${nameB} ${m.scoreB} → ${winnerLabel} (${m.intensity}, 차이 ${m.diff})`;
  });

  const overallLabel = comparison.overallWinner === "A" ? nameA
    : comparison.overallWinner === "B" ? nameB
    : "무승부";

  const tone = RELATIONSHIP_TONE[relationshipType];
  const compatFocus = RELATIONSHIP_COMPAT_FOCUS[relationshipType];
  const bonusScenarios = selectBonusScenarios(relationshipType);

  // Identify highlight category (max score diff)
  const highlight = [...comparison.matches].sort((a, b) => b.diff - a.diff)[0];
  const highlightInstruction = highlight
    ? `\n[하이라이트 카테고리]\n"${highlight.category}"가 점수차(${highlight.diff}점)가 가장 큰 결정적 항목이다. categoryComments에서 이 카테고리는 반드시 2~3문장으로 상세히 분석하라.`
    : "";

  // Build interaction block
  let interactionBlock = "";
  if (interaction) {
    const lines: string[] = ["\n[두 사주 상호작용 분석]"];
    lines.push(`일간 관계: ${interaction.dayStemRelation.type} — ${interaction.dayStemRelation.detail}`);
    lines.push(`용신 상보성: ${interaction.yongshinCompat.summary}`);
    if (interaction.yongshinCompat.aHelpsB) lines.push(`  - ${nameA}의 강한 오행이 ${nameB}의 용신을 보강`);
    if (interaction.yongshinCompat.bHelpsA) lines.push(`  - ${nameB}의 강한 오행이 ${nameA}의 용신을 보강`);
    if (interaction.yongshinCompat.aHurtsB) lines.push(`  - ${nameA}의 강한 오행이 ${nameB}의 기신을 자극`);
    if (interaction.yongshinCompat.bHurtsA) lines.push(`  - ${nameB}의 강한 오행이 ${nameA}의 기신을 자극`);
    lines.push(`오행 상보율: ${interaction.elementCoverage.percent}% (5행 중 ${Math.round(interaction.elementCoverage.percent / 20)}개 충족)`);
    if (interaction.elementCoverage.coveredByOther.a.length > 0) {
      lines.push(`  - ${nameA}에게 부족한 [${interaction.elementCoverage.coveredByOther.a.join(",")}]을 ${nameB}가 채워줌`);
    }
    if (interaction.elementCoverage.coveredByOther.b.length > 0) {
      lines.push(`  - ${nameB}에게 부족한 [${interaction.elementCoverage.coveredByOther.b.join(",")}]을 ${nameA}가 채워줌`);
    }
    if (interaction.fortuneSync) {
      lines.push(`대운 동기화: ${interaction.fortuneSync.synced ? "동기화됨" : "비동기"}`);
      lines.push(`  - ${nameA} 현재 대운: ${interaction.fortuneSync.currentDaeunA}`);
      lines.push(`  - ${nameB} 현재 대운: ${interaction.fortuneSync.currentDaeunB}`);
      lines.push(`  - ${interaction.fortuneSync.summary}`);
    }
    interactionBlock = lines.join("\n");
  }

  // Build bonus scenario instruction
  const bonusInstruction = bonusScenarios.map((b, i) =>
    `${i + 1}. type: "${b.type}", label: "${b.label}" — 2~3문장`
  ).join("\n");

  return `
[甲] ${nameA}
종합: ${tierA.grade}등급 (composite: ${tierA.composite}, 상위 ${tierA.topPercent}%)
${fmtScores(scoresA)}
${sajuTextA ? `사주: ${sajuTextA}` : ""}
${fortuneBlockA || ""}

[乙] ${nameB}
종합: ${tierB.grade}등급 (composite: ${tierB.composite}, 상위 ${tierB.topPercent}%)
${fmtScores(scoresB)}
${sajuTextB ? `사주: ${sajuTextB}` : ""}
${fortuneBlockB || ""}
${interactionBlock}

[카테고리별 대결 결과 (서버 확정)]
${matchLines.join("\n")}

[종합 판정 (서버 확정)]
${nameA} ${comparison.winsA}승 / ${nameB} ${comparison.winsB}승 / 무승부 ${comparison.draws}
최종 승자: ${overallLabel} (${comparison.overallIntensity})
${highlightInstruction}

[메인 관계 유형: ${RELATIONSHIP_LABELS[relationshipType]}]
${tone}

[상성 진단 초점]
${compatFocus}

[보너스 시나리오]
다음 관계에 대해서도 짧은 시나리오를 작성해:
${bonusInstruction}

위 서버 확정 결과를 바탕으로 배틀 판정 텍스트를 JSON으로 생성하라.
`.trim();
}

/* ── LLM 분석 실행 ── */

export async function runBattleAnalysis(opts: {
  nameA: string;
  nameB: string;
  scoresA: ServerScores;
  scoresB: ServerScores;
  tierA: TierResult;
  tierB: TierResult;
  comparison: BattleComparison;
  relationshipType: RelationshipType;
  sajuTextA?: string | null;
  sajuTextB?: string | null;
  interaction?: BattleInteraction;
  fortuneBlockA?: string;
  fortuneBlockB?: string;
}): Promise<BattleLlmAnalysis> {
  const userInfo = buildBattleUserInfo(opts);
  const models = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) || DEFAULT_MODELS;

  let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

  for (const model of models) {
    const res = await callGemini(model, userInfo, BATTLE_SYSTEM_PROMPT);
    if (res.ok) {
      try {
        const raw = parseJson5Loose<any>(res.text);
        return validateAndNormalize(raw, opts.relationshipType);
      } catch (parseErr) {
        console.warn("[BATTLE_LLM] 응답 파싱 실패:", model, parseErr);
        lastError = { message: "LLM 응답 파싱 실패" };
        continue;
      }
    }
    lastError = res;
    if (!shouldFallback(res.status, res.apiStatus)) break;
  }

  // Fallback
  return buildFallback(opts);
}

/* ── 파싱 검증 & 정규화 ── */

function validateAndNormalize(raw: any, relationshipType: RelationshipType): BattleLlmAnalysis {
  // categoryComments: 객체 형태 기대, 배열이면 변환 시도
  const cc = raw.categoryComments;
  let categoryComments: BattleLlmAnalysis["categoryComments"];

  if (cc && typeof cc === "object" && !Array.isArray(cc)) {
    categoryComments = {
      wealth: cc.wealth || "",
      love: cc.love || "",
      career: cc.career || "",
      health: cc.health || "",
      social: cc.social || "",
    };
  } else if (Array.isArray(cc)) {
    // Legacy array format → convert
    const CATEGORY_MAP: Record<string, keyof BattleLlmAnalysis["categoryComments"]> = {
      "재물운": "wealth", "연애운": "love", "직장운": "career", "건강운": "health", "대인운": "social",
    };
    categoryComments = { wealth: "", love: "", career: "", health: "", social: "" };
    for (const item of cc) {
      const key = CATEGORY_MAP[item?.category];
      if (key) categoryComments[key] = item.comment || "";
    }
  } else {
    categoryComments = { wealth: "", love: "", career: "", health: "", social: "" };
  }

  // compatibility: 객체 형태 기대
  const compat = raw.compatibility;
  let compatibility: BattleLlmAnalysis["compatibility"];

  if (compat && typeof compat === "object") {
    compatibility = {
      baseAnalysis: compat.baseAnalysis || "",
      mainScenario: {
        type: relationshipType, // Always use server-side value — LLM may return Korean ("가족") instead of English ("family")
        analysis: compat.mainScenario?.analysis || "",
      },
      bonusScenarios: Array.isArray(compat.bonusScenarios)
        ? compat.bonusScenarios.map((s: any) => ({
            type: s?.type || "",
            label: s?.label || "",
            analysis: s?.analysis || "",
          }))
        : [],
    };
  } else {
    compatibility = {
      baseAnalysis: "",
      mainScenario: { type: relationshipType, analysis: "" },
      bonusScenarios: [],
    };
  }

  return {
    heroComment: raw.heroComment || "",
    categoryComments,
    compatibility,
    finalVerdict: raw.finalVerdict || "",
  };
}

/* ── Fallback (LLM 실패 시) ── */

function buildFallback(opts: {
  nameA: string;
  nameB: string;
  comparison: BattleComparison;
  relationshipType: RelationshipType;
}): BattleLlmAnalysis {
  const winner = opts.comparison.overallWinner === "A" ? opts.nameA
    : opts.comparison.overallWinner === "B" ? opts.nameB
    : null;

  return {
    heroComment: winner
      ? `${winner}의 ${opts.comparison.overallIntensity}!`
      : "무승부! 팽팽한 대결!",
    categoryComments: {
      wealth: "", love: "", career: "", health: "", social: "",
    },
    compatibility: {
      baseAnalysis: "",
      mainScenario: { type: opts.relationshipType, analysis: "" },
      bonusScenarios: [],
    },
    finalVerdict: winner
      ? `종합적으로 ${winner}의 사주가 더 강한 기운을 갖고 있어.`
      : "두 사람 다 비슷한 수준의 사주 기운이야.",
  };
}
