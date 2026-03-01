import { callGemini, shouldFallback, DEFAULT_MODELS } from "@/lib/analysis";
import { parseJson5Loose } from "@/lib/json5Utils";
import type { ServerScores, TierResult } from "@/lib/utils/saju-scoring";
import { scoreToGrade } from "@/lib/utils/saju-scoring";
import type { BattleInteraction } from "@/lib/utils/battle-interaction";
import type {
  BattleComparison,
  BattleLlmAnalysis,
  ChemistryLabel,
  RelationshipType,
} from "@/types/battle";
import { postprocessBattleResult } from "@/lib/battle-postprocess";

/* ── 관계 유형별 톤 ── */

const RELATIONSHIP_TONE: Record<RelationshipType, string> = {
  lover: "연인 관계에 맞게 솔직한 톤으로 분석하라. 반말 유지, 위로/격려 금지.",
  friend: "친구 관계에 맞게 재미있고 가벼운 톤으로 분석하라. 친구 간 우열 비교를 유쾌하게 풀어라.",
  colleague: "직장동료 관계에 맞게 프로페셔널하면서도 위트 있는 톤으로 분석하라. 업무 스타일 차이에 초점.",
  family: "가족 관계에 맞게 객관적인 톤으로 분석하라. 가족 내 역할과 시너지를 언급하라. 반말 유지, 위로/격려 금지.",
  other: "일반적인 톤으로 두 사람의 사주를 비교 분석하라.",
};

const RELATIONSHIP_COMPAT_FOCUS: Record<RelationshipType, string> = {
  lover: "감정/애착 역학에 초점: 감정적으로 어떤 패턴을 만드는지, 애착 스타일이 어떻게 충돌하거나 맞물리는지.",
  friend: "대인관계 역학에 초점: 함께할 때 어떤 에너지가 만들어지는지, 누가 주도하고 누가 따르는지.",
  colleague: "업무 스타일 역학에 초점: 역할 분배, 갈등 포인트, 시너지.",
  family: "기운 균형에 초점: 가족 내 두 사람의 기운 상호작용, 보완과 충돌.",
  other: "두 사주가 만났을 때 생기는 역학 관계.",
};

/* ── 보너스 시나리오 선택 ── */

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  lover: "연인", friend: "친구", colleague: "직장동료", family: "가족", other: "지인",
};

const RELATIONSHIP_LABEL_SUFFIX: Record<RelationshipType, string> = {
  lover: "연인이었다면", friend: "친구였다면", colleague: "직장동료였다면",
  family: "가족이었다면", other: "지인이었다면",
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
위로 따위 없다. 사주가 보여주는 구조를 있는 그대로 까발린다.

────────────────────────────────
[톤 규칙 — 절대 준수]
- 반말 사용. 존댓말 절대 금지. 금지 어미: ~입니다, ~습니다, ~해요, ~돼요, ~있어요, ~거예요.
- 위로 금지: "잘 될 거야", "좋은 관계를 유지할 수 있어", "괜찮아", "가능성이 있어" 금지.
- 격려 금지: "화이팅", "노력하면", "잘 조절하면", "서로 배려하면" 금지.
- 희망적 마무리 금지. 모든 문단을 팩트로 끝내라.
- 패자 위로 금지. 승자 축하 금지. 승자에게도 약점을 반드시 짚어라.
- 2인칭 호칭 금지: "~씨", "너" 대신 이름으로 호칭.
- 이름 규칙: 두 사람의 이름은 반드시 프롬프트에 제공된 nameA, nameB만 사용. 다른 이름을 만들어내거나 추측하지 마.
- "궁합" 단어 금지 → "상성"만 사용.
- "~해봐" 금지 → "~안 하면 ~된다".
- "스스로" 단어 자체를 절대 사용하지 마. 대체 표현: "본인이", "자기가", "자기 힘으로", "혼자서". 문맥에 맞는 표현을 골라라.
- 이모지 사용 금지.
- 마크다운 금지(#, *, -, 코드블록, 표, 불릿, 번호 리스트 금지). 문장으로만 구성.
- 과장/단정 금지: "무조건/반드시/확실/100%/절대/영원히/정답/운명" 금지.
- 명리 용어 사용 시 즉시 번역: 겁재(남의 돈 뺏는 기운), 편관(위에서 누르는 힘).

────────────────────────────────
[비유 규칙]
- "마치 ~처럼" 패턴 2회 이상 금지.
- 같은 비유 2회 이상 사용 금지.
- 비유는 오행 관계에서 자연스럽게 나와야 해.
- 진부한 비유("댐에 구멍", "불난 집에 부채질") 피해.

────────────────────────────────
[섹션 독립성 — 반드시 준수]
- 각 섹션은 고유한 인사이트를 가져야 해.
- killingLine이 다른 카테고리와 겹치면 안 돼.
- 같은 사주 요소(예: 겁재)를 2개 이상 killingLine의 메인 근거로 사용 금지.
- detail과 killingLine이 같은 내용 반복 금지.
- heroQuip과 finalVerdict는 절대 같은 내용이면 안 돼.
- 섹션 간 내용 복붙/반복 절대 금지.

────────────────────────────────
[카테고리별 결과 규칙]

killingLine:
- 캡처용 한줄. 12~30자. 두 사람의 이름을 사용 (A/B 아님).
- 승자가 명확히 드러나야 함. 1점 차이라도 승자는 승자.
- 좋은 예: "민수가 번 돈, 서연이가 관리해야 살아남아"
- 나쁜 예: "재물운에서는 B가 좀 더 유리한 편이야" (밋밋, A/B 사용)

detail:
- 왜 이 승패가 나왔는지 사주 데이터로 설명. 2~3문장, 80~150자.
- 십성/오행/대운 중 가장 관련 있는 근거 1~2개만.
- "마치 ~처럼" 비유 금지 (killingLine이 이미 비유 역할).
- 카테고리별 분석 도구:
  재물운: 재성(편재/정재), 식상생재, 용신과 재물의 관계
  연애운: 관성, 합충 관계, 홍염살, 도화살
  직장운: 관성(편관/정관), 인성, 대운과 관성의 관계
  건강운: 오행 과다/부족, 12운성, 조후용신
  대인운: 인성, 비겁, 식상의 균형, 신살(역마, 화개 등)

────────────────────────────────
[상성 진단 규칙]

chemistry.label:
- 서버가 확정한 라벨을 그대로 복사해. 변경 금지.

chemistry.analysis:
- 2~3문단. 일간 관계/오행 상보/용신 상보/대운 동기화 기반.
  1문단: 일간 관계 + 오행 상보 분석
  2문단: 대운 흐름 비교
  3문단: 관계 종합 판정

mainScenario:
- 선택된 관계 유형에 대한 구체적 분석, 1~2문단.
- 구체적 상황 묘사 필수.

bonusScenarios:
- 반드시 2개 생성 (비워두지 마). 다른 관계 유형이었다면의 분석. 각 4~5문장.

────────────────────────────────
[시뮬레이션 규칙]
- 서버가 준 질문을 question에 그대로 복사.
- answer: 사주 근거 기반, 구체적 상황 묘사, 1~2문장, 두 사람 이름 사용.
  좋은 예: "민수가 3잔 넘으면 감정 폭발해. 서연이는 끝까지 안 취한 척하다가 집에 가서 혼자 울어."
  나쁜 예: "둘 다 조심해야 해."
- basis: 사주 키워드만, 15자 이내. 예: "수 과다 + 식신", "겁재 + 정재"

────────────────────────────────
[미래 예측 규칙]
- nextYear: 내년 각자의 변화. 구체적 사건 수준. 1~2문장.
- threeYears: 3년 뒤 역전/변화 포인트. 1~2문장.
- 희망적 표현 금지. "기회가 찾아올 거야" → "이직 압박이 세져"

────────────────────────────────
[최종 심판 규칙]
- 2~3문장.
- 승패 요약 + 핵심 원인 + 역설 (이기고도 편하지 않은 등)
- 새로운 인사이트 1개 필수 (다른 섹션에서 안 나온 것)
- heroQuip과 절대 겹치지 않게.
- 조언/격려 금지. "~노력이 필요해", "~하면 좋겠어", "~해야 해" 금지. 판정만. 냉정하게 끝내.

────────────────────────────────
[heroQuip 규칙]
- 10~20자. 이름을 절대 넣지 마 — 서버가 앞에 "XXX의 승리!" 를 붙여줌.
- "왜 이겼는지" 또는 "어디서 갈렸는지"만 짧게.
- 좋은 예: "건강에서 갈렸어", "재물 빼면 전부 졌어", "건강이 판을 뒤집었어"
- 나쁜 예: "운명의 주사위는 던져졌다" (정보 없음), "민수의 건강이 갈랐어" (이름 포함)

────────────────────────────────
[한자 표기 규칙]
- 천간/지지/충/합 언급 시 반드시 한자 병기: "甲己합(갑기합)", "편관(偏官)"

────────────────────────────────
[★ 최종 확인 — 출력 전 반드시 점검]
1. "스스로" 사용 금지 (본인이/자기가/혼자서 등 대체)
2. "~해봐" 금지 → "~안 하면 ~된다"
3. 같은 비유·키워드 2회 이상 금지
4. chemistry.label은 서버가 준 값 그대로 복사했는가
5. simulations[].question은 서버가 준 질문 그대로 복사했는가
6. killingLine에 같은 사주 요소 2개 이상 메인 근거로 사용 안 했는가
7. "궁합" 단어 사용 안 했는가
8. 위로/격려/긍정 마무리 없는가
9. 존댓말 없는가
10. heroQuip에 이름 안 넣었는가

────────────────────────────────
## 출력 JSON 스키마
반드시 아래 JSON 형식으로만 응답해. 다른 텍스트 없이 JSON만.
{
  "heroQuip": "10~20자, 이름 절대 금지",
  "categoryResults": {
    "wealth": { "killingLine": "12~30자, 이름 사용", "detail": "80~150자, 사주 근거" },
    "love": { "killingLine": "...", "detail": "..." },
    "career": { "killingLine": "...", "detail": "..." },
    "health": { "killingLine": "...", "detail": "..." },
    "social": { "killingLine": "...", "detail": "..." }
  },
  "chemistry": {
    "label": { "emoji": "서버값 복사", "title": "서버값 복사", "description": "서버값 복사" },
    "analysis": "2~3문단",
    "mainScenario": { "type": "서버가 지정한 관계", "analysis": "1~2문단" },
    "bonusScenarios": [
      { "type": "관계유형", "label": "한국어이었다면", "analysis": "4~5문장" },
      { "type": "관계유형", "label": "한국어이었다면", "analysis": "4~5문장" }
    ]
  },
  "simulations": [
    { "question": "서버가 준 질문 그대로", "answer": "1~2문장", "basis": "15자 이내 키워드" }
  ],
  "futureOutlook": {
    "nextYear": "1~2문장",
    "threeYears": "1~2문장"
  },
  "finalVerdict": "2~3문장"
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
  chemistryLabel?: ChemistryLabel;
  simulationQuestions?: { icon: string; question: string }[];
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
    chemistryLabel,
    simulationQuestions,
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

  const highlight = [...comparison.matches].sort((a, b) => b.diff - a.diff)[0];
  const highlightInstruction = highlight
    ? `\n[결정타 카테고리]\n"${highlight.category}"가 점수차(${highlight.diff}점)가 가장 큰 결정적 항목이다. killingLine에서 이 카테고리를 특히 날카롭게 작성하라.`
    : "";

  // Interaction block
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

  // Chemistry label block
  let chemistryBlock = "";
  if (chemistryLabel) {
    chemistryBlock = `
[상성 유형 라벨 — 서버 확정]
emoji: ${chemistryLabel.emoji}
title: ${chemistryLabel.title}
description: ${chemistryLabel.description}
→ 이 라벨을 chemistry.label에 그대로 복사해. 변경 금지.`;
  }

  // Simulation questions block
  let simulationBlock = "";
  if (simulationQuestions && simulationQuestions.length > 0) {
    const simLines = simulationQuestions.map((sq, i) =>
      `${i + 1}. ${sq.icon} ${sq.question}`
    );
    simulationBlock = `
[시뮬레이션 질문 — 서버 선택]
${simLines.join("\n")}
→ 각 질문에 대해 사주 근거 기반으로 1~2문장 답변 생성. question 필드에 질문 그대로 복사.`;
  }

  // Bonus scenario instruction
  const bonusInstruction = bonusScenarios.map((b, i) =>
    `${i + 1}. type: "${b.type}", label: "${b.label}" — 4~5문장`
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
${chemistryBlock}
${simulationBlock}

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
  chemistryLabel?: ChemistryLabel;
  simulationQuestions?: { icon: string; question: string }[];
}): Promise<BattleLlmAnalysis> {
  const userInfo = buildBattleUserInfo(opts);
  const models = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) || DEFAULT_MODELS;

  let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

  for (const model of models) {
    const res = await callGemini(model, userInfo, BATTLE_SYSTEM_PROMPT);
    if (res.ok) {
      try {
        const raw = parseJson5Loose<any>(res.text);
        const validated = validateAndNormalize(raw, opts.relationshipType, opts.chemistryLabel, opts.simulationQuestions);
        const { result: postprocessed } = postprocessBattleResult(validated);
        return postprocessed;
      } catch (parseErr) {
        console.warn("[BATTLE_LLM] 응답 파싱 실패:", model, parseErr);
        lastError = { message: "LLM 응답 파싱 실패" };
        continue;
      }
    }
    lastError = res;
    if (!shouldFallback(res.status, res.apiStatus)) break;
  }

  return buildFallback(opts);
}

/* ── 파싱 검증 & 정규화 ── */

function validateAndNormalize(
  raw: any,
  relationshipType: RelationshipType,
  chemistryLabel?: ChemistryLabel,
  simulationQuestions?: { icon: string; question: string }[],
): BattleLlmAnalysis {
  // categoryResults
  const cr = raw.categoryResults;
  const categoryResults: BattleLlmAnalysis["categoryResults"] = {
    wealth: { killingLine: "", detail: "" },
    love: { killingLine: "", detail: "" },
    career: { killingLine: "", detail: "" },
    health: { killingLine: "", detail: "" },
    social: { killingLine: "", detail: "" },
  };

  if (cr && typeof cr === "object" && !Array.isArray(cr)) {
    for (const key of ["wealth", "love", "career", "health", "social"] as const) {
      if (cr[key]) {
        categoryResults[key] = {
          killingLine: cr[key].killingLine || "",
          detail: cr[key].detail || "",
        };
      }
    }
  }

  // chemistry — force server label
  const chem = raw.chemistry;
  const chemistry: BattleLlmAnalysis["chemistry"] = {
    label: chemistryLabel || { emoji: "", title: "", description: "" },
    analysis: "",
    mainScenario: { type: relationshipType, analysis: "" },
    bonusScenarios: [],
  };

  if (chem && typeof chem === "object") {
    chemistry.analysis = chem.analysis || "";
    if (chem.mainScenario) {
      chemistry.mainScenario = {
        type: relationshipType,
        analysis: chem.mainScenario.analysis || "",
      };
    }
    if (Array.isArray(chem.bonusScenarios)) {
      chemistry.bonusScenarios = chem.bonusScenarios.map((s: any) => ({
        type: s?.type || "",
        label: s?.label || "",
        analysis: s?.analysis || "",
      }));
    }

    console.info("[BATTLE_BONUS_SCENARIOS]", {
      rawType: chem.bonusScenarios === undefined ? "undefined"
        : chem.bonusScenarios === null ? "null"
        : Array.isArray(chem.bonusScenarios) ? `array[${chem.bonusScenarios.length}]`
        : typeof chem.bonusScenarios,
      rawData: JSON.stringify(chem.bonusScenarios)?.slice(0, 500),
      parsedCount: chemistry.bonusScenarios.length,
      parsedAnalysisLengths: chemistry.bonusScenarios.map((s: { analysis: string }) => s.analysis.length),
    });
  }

  // simulations — force server questions
  let simulations: BattleLlmAnalysis["simulations"] = [];
  if (Array.isArray(raw.simulations)) {
    simulations = raw.simulations.map((s: any, i: number) => ({
      question: simulationQuestions?.[i]?.question || s?.question || "",
      answer: s?.answer || "",
      basis: s?.basis || "",
    }));
  }

  // Fill missing simulations with server questions
  if (simulationQuestions) {
    while (simulations.length < simulationQuestions.length) {
      const idx = simulations.length;
      simulations.push({
        question: simulationQuestions[idx].question,
        answer: "",
        basis: "",
      });
    }
  }

  // futureOutlook
  const fo = raw.futureOutlook;
  const futureOutlook: BattleLlmAnalysis["futureOutlook"] = {
    nextYear: "",
    threeYears: "",
  };
  if (fo && typeof fo === "object") {
    futureOutlook.nextYear = fo.nextYear || "";
    futureOutlook.threeYears = fo.threeYears || "";
  }

  return {
    heroQuip: raw.heroQuip || "심판의 말이 필요 없는 결과야.",
    categoryResults,
    chemistry,
    simulations,
    futureOutlook,
    finalVerdict: raw.finalVerdict || "",
  };
}

/* ── Fallback (LLM 실패 시) ── */

function buildFallback(opts: {
  nameA: string;
  nameB: string;
  comparison: BattleComparison;
  relationshipType: RelationshipType;
  chemistryLabel?: ChemistryLabel;
  simulationQuestions?: { icon: string; question: string }[];
}): BattleLlmAnalysis {
  const winner = opts.comparison.overallWinner === "A" ? opts.nameA
    : opts.comparison.overallWinner === "B" ? opts.nameB
    : null;

  const emptyCat = { killingLine: "", detail: "" };

  return {
    heroQuip: "심판의 말이 필요 없는 결과야.",
    categoryResults: {
      wealth: emptyCat, love: emptyCat, career: emptyCat, health: emptyCat, social: emptyCat,
    },
    chemistry: {
      label: opts.chemistryLabel || { emoji: "", title: "", description: "" },
      analysis: "",
      mainScenario: { type: opts.relationshipType, analysis: "" },
      bonusScenarios: [],
    },
    simulations: (opts.simulationQuestions || []).map((sq) => ({
      question: sq.question,
      answer: "",
      basis: "",
    })),
    futureOutlook: { nextYear: "", threeYears: "" },
    finalVerdict: winner
      ? `종합적으로 ${winner}의 사주가 더 강한 기운을 갖고 있어.`
      : "두 사람 다 비슷한 수준의 사주 기운이야.",
  };
}
