import { callGemini, shouldFallback, DEFAULT_MODELS } from "@/lib/analysis";
import { parseJson5Loose } from "@/lib/json5Utils";
import type { ServerScores, TierResult } from "@/lib/utils/saju-scoring";
import { scoreToGrade } from "@/lib/utils/saju-scoring";
import type {
  BattleComparison,
  BattleLlmAnalysis,
  RelationshipType,
} from "@/types/battle";

const RELATIONSHIP_TONE: Record<RelationshipType, string> = {
  lover: "연인 관계에 맞게 애정 있지만 솔직한 톤으로 분석하라. '커플 사주궁합'의 관점에서 서술하라.",
  friend: "친구 관계에 맞게 재미있고 가벼운 톤으로 분석하라. 친구 간 우열 비교를 유쾌하게 풀어라.",
  colleague: "직장동료 관계에 맞게 프로페셔널하면서도 위트 있는 톤으로 분석하라. 업무 스타일 차이에 초점을 맞춰라.",
  family: "가족 관계에 맞게 따뜻하지만 객관적인 톤으로 분석하라. 가족 내 역할과 시너지를 언급하라.",
  other: "일반적인 톤으로 두 사람의 사주를 비교 분석하라.",
};

export const BATTLE_SYSTEM_PROMPT = `너는 "두루미"라는 이름의 냉정한 사주 심판관이다.
두 사람의 사주를 비교 판정하는 것이 네 역할이다.

## 핵심 규칙
1. 서버가 계산한 점수와 등급은 확정값이다. 절대 변경하지 마라.
2. 너는 텍스트만 생성한다. 점수를 재계산하거나 변경하지 마라.
3. 판정 결과(승/패/무)도 서버가 결정한 값이다. 이를 그대로 서술하라.
4. 각 카테고리별로 왜 차이가 나는지 사주학적 근거를 1~2문장으로 설명하라.
5. 전체 판정은 냉정하되 재미있게, 한국어로 서술하라.
6. 이모지는 사용하지 마라.
7. 총 300~500자 이내로 간결하게 작성하라.
8. 톤: 사주를 잘 아는 직설적인 친한 형이다. 말투는 친근한 반말, 내용은 위로 없이 팩트로 찌른다. "괜찮아", "잘 될 거야" 같은 위로/격려 표현 절대 금지.
9. 출생지는 사주 해석과 무관하다. 출생지를 언급하지 마라.

## 출력 JSON 스키마
{
  "headVerdict": "한 줄 요약 판정문 (예: 'A의 압도적 승리!' 또는 '팽팽한 접전, 결국 B의 신승')",
  "categoryComments": [
    { "category": "재물운", "comment": "1~2문장 사주학적 비교 코멘트" },
    { "category": "연애운", "comment": "..." },
    { "category": "직장운", "comment": "..." },
    { "category": "건강운", "comment": "..." },
    { "category": "대인운", "comment": "..." }
  ],
  "overallComment": "종합 판정 2~3문장",
  "playerASummary": "A의 사주 특징 요약 1문장",
  "playerBSummary": "B의 사주 특징 요약 1문장"
}`;

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
}): string {
  const {
    nameA, nameB,
    scoresA, scoresB,
    tierA, tierB,
    comparison,
    relationshipType,
    sajuTextA, sajuTextB,
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

  return `
[甲] ${nameA}
종합: ${tierA.grade}등급 (composite: ${tierA.composite}, 상위 ${tierA.topPercent}%)
${fmtScores(scoresA)}
${sajuTextA ? `사주: ${sajuTextA}` : ""}

[乙] ${nameB}
종합: ${tierB.grade}등급 (composite: ${tierB.composite}, 상위 ${tierB.topPercent}%)
${fmtScores(scoresB)}
${sajuTextB ? `사주: ${sajuTextB}` : ""}

[카테고리별 대결 결과 (서버 확정)]
${matchLines.join("\n")}

[종합 판정 (서버 확정)]
${nameA} ${comparison.winsA}승 / ${nameB} ${comparison.winsB}승 / 무승부 ${comparison.draws}
최종 승자: ${overallLabel} (${comparison.overallIntensity})

[관계 유형]
${tone}

위 서버 확정 결과를 바탕으로 배틀 판정 텍스트를 JSON으로 생성하라.
`.trim();
}

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
}): Promise<BattleLlmAnalysis> {
  const userInfo = buildBattleUserInfo(opts);
  const models = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) || DEFAULT_MODELS;

  let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

  for (const model of models) {
    const res = await callGemini(model, userInfo, BATTLE_SYSTEM_PROMPT);
    if (res.ok) {
      try {
        const parsed = parseJson5Loose<BattleLlmAnalysis>(res.text);
        return {
          headVerdict: parsed.headVerdict || "판정 결과",
          categoryComments: Array.isArray(parsed.categoryComments) ? parsed.categoryComments : [],
          overallComment: parsed.overallComment || "",
          playerASummary: parsed.playerASummary || "",
          playerBSummary: parsed.playerBSummary || "",
        };
      } catch {
        lastError = { message: "LLM 응답 파싱 실패" };
        continue;
      }
    }
    lastError = res;
    if (!shouldFallback(res.status, res.apiStatus)) break;
  }

  // Fallback: generate basic analysis without LLM
  const winner = opts.comparison.overallWinner === "A" ? opts.nameA
    : opts.comparison.overallWinner === "B" ? opts.nameB
    : null;

  return {
    headVerdict: winner
      ? `${winner}의 ${opts.comparison.overallIntensity}!`
      : "무승부! 팽팽한 대결!",
    categoryComments: opts.comparison.matches.map((m) => ({
      category: m.category,
      comment: m.winner === "draw"
        ? "두 사람의 역량이 비슷합니다."
        : `${m.winner === "A" ? opts.nameA : opts.nameB}가 ${m.diff}점 차로 앞섭니다.`,
    })),
    overallComment: winner
      ? `종합적으로 ${winner}의 사주가 더 강한 기운을 가지고 있습니다.`
      : "두 사람 모두 비슷한 수준의 사주 기운을 가지고 있습니다.",
    playerASummary: `${opts.nameA}: ${opts.tierA.grade}등급`,
    playerBSummary: `${opts.nameB}: ${opts.tierB.grade}등급`,
  };
}
