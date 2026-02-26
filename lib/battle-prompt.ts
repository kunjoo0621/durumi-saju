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

## 핵심 규칙
1. 서버가 계산한 점수와 등급은 확정값이다. 절대 변경하지 마라.
2. 너는 텍스트만 생성한다. 점수를 재계산하거나 변경하지 마라.
3. 판정 결과(승/패/무)도 서버가 결정한 값이다. 이를 그대로 서술하라.
4. 이모지 사용 금지.
5. 톤: 사주를 잘 아는 직설적인 친한 형. 반말("~해", "~야", "~거든"). 위로 없이 팩트만.
6. "괜찮아", "잘 될 거야" 같은 위로/격려 표현 절대 금지.
7. 승자에게 축하하거나 패자에게 위로하지 마라. 사실만 서술.
8. "궁합" 단어 금지. "상성"만 사용.
9. 생년월일(연도, 월, 일) 텍스트 노출 금지. 이름만 사용.
10. 출생지(서울, 부산 등 지역명), "~에서 태어난", "~출신" 표현 금지.
11. 금지 어미: ~입니다, ~습니다, ~해요, ~돼요, ~있어요, ~거예요. 반말 100%.
12. "~씨" 호칭 금지. 이름만 부르거나 "너"로 통일.
13. 이름은 입력값 그대로 사용. 변형/추측 금지.
14. 각 섹션은 고유한 인사이트를 제공해야 함. 섹션 간 내용 복붙/반복 절대 금지.
15. 추상적 표현 금지 — "잘 맞아" 대신 "너의 화 기운이 상대의 금을 녹여서..." 같은 구체적 오행 서사로 서술.

## 섹션별 작성 규칙

### heroComment
승패를 한 줄로 요약. 이름 포함. 20~40자.

### categoryComments
각 카테고리(wealth/love/career/health/social)별로 두 사람의 차이를 구체적으로 비교.
용신/기신으로 승패 원인 설명. 사주 데이터(sajuTextA/sajuTextB)에 용신/기신/희신 정보가 포함되어 있다. 반드시 활용해라.
하이라이트 카테고리(점수차 최대)는 2~3문장 상세히, 나머지는 2문장.

### compatibility.baseAnalysis
오행 상보성, 일간 관계, 용신 상보성을 근거로 기본 상성 분석.
상호작용 데이터("두 사주 상호작용 분석" 블록)를 반드시 활용:
- 일간 관계(합/충/생/극/비화): 두 사람의 근본적 역학.
- 용신 상보성: "A의 강한 오행이 B의 용신을 채워준다/기신을 자극한다" 구체적 서술.
- 오행 상보율: 부족한 기운이 채워지는지 구체적 언급.
- 대운 동기화: 현재 시점에서 운 흐름이 어떻게 맞물리는지.
2~3문단, 각 문단 3~4문장.

### compatibility.mainScenario
선택한 관계에서 두 사람이 만났을 때의 구체적 시나리오.
구체적 상황 묘사 필수 (예: "팀장-팀원이면", "같이 술 마시면", "돈 거래하면").
장점과 위험 요소를 균형 있게. 4~5문장.

### compatibility.bonusScenarios
지정된 보너스 관계 유형에 대해 각각 짧은 시나리오 작성. 2~3문장씩.

### finalVerdict
종합 심판평. 승패 요약 + 결정적 요인 + 상성 관점 마무리. 3~4문장.
categoryComments나 compatibility와 내용 겹치지 않게.

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
        type: compat.mainScenario?.type || relationshipType,
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
