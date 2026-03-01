import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseUserId } from "@/lib/server/user";
import { resolveSajuEnrichedData, type InputPayload, buildFortunePromptBlock } from "@/lib/analysis";
import { calculateServerScoring } from "@/lib/utils/saju-scoring";
import { compareBattle } from "@/lib/utils/battle-compare";
import { runBattleAnalysis } from "@/lib/battle-prompt";
import { selectChemistryLabel } from "@/lib/battle-chemistry";
import { selectSimulations } from "@/lib/battle-simulations";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { calculateBattleInteraction } from "@/lib/utils/battle-interaction";
import { normalizeGender } from "@/lib/utils/gender";
import { hashToken, getTokensFromCookie, getDbExpiresAt } from "@/lib/guest-token";
import type { BattlePlayerInput, RelationshipType } from "@/types/battle";

type BattleAnalyzeBody = {
  playerA: BattlePlayerInput;
  playerB: BattlePlayerInput;
  relationshipType: RelationshipType;
  sessionId?: string;
};

function playerToInputPayload(p: BattlePlayerInput): InputPayload {
  return {
    name: p.name,
    birthYear: p.birthYear,
    birthMonth: p.birthMonth,
    birthDay: p.birthDay,
    calendarType: p.calendarType,
    birthHour: p.birthHour,
    birthMinute: p.birthMinute,
    birthLocation: p.birthLocation,
    gender: p.gender,
    relationshipStatus: p.relationshipStatus,
    employmentStatus: p.employmentStatus,
    coreFearAxis: p.coreFearAxis as InputPayload["coreFearAxis"],
    unknownBirthTime: p.unknownBirthTime,
  };
}

function hasRequiredBattleInput(p: BattlePlayerInput): boolean {
  if (
    !p.name?.trim() ||
    !p.birthYear ||
    !p.birthMonth ||
    !p.birthDay ||
    !p.birthLocation ||
    !p.gender
  ) {
    return false;
  }
  if (!p.unknownBirthTime && (!p.birthHour || !p.birthMinute)) {
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? await getSupabaseUserId(session) : null;
    const guestTokens = await getTokensFromCookie();
    const latestGuestToken = guestTokens[0] || null;

    if (!userId && !latestGuestToken) {
      return NextResponse.json({ error: "인증 정보 없음" }, { status: 401 });
    }

    const guestTokenHash = latestGuestToken ? hashToken(latestGuestToken) : null;

    const body = (await request.json()) as BattleAnalyzeBody;

    if (!body.playerA || !body.playerB || !body.relationshipType) {
      return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
    }

    if (!hasRequiredBattleInput(body.playerA) || !hasRequiredBattleInput(body.playerB)) {
      return NextResponse.json({ error: "양쪽 플레이어 정보가 부족합니다." }, { status: 400 });
    }

    // Enrich + score Player A
    const inputA = playerToInputPayload(body.playerA);
    const { sajuText: sajuTextA, enriched: enrichedA } = await resolveSajuEnrichedData(inputA);
    console.info("[BATTLE_ENRICHED_A]", JSON.stringify(enrichedA).slice(0, 2000));

    const scoringA = calculateServerScoring(enrichedA);

    console.info("[BATTLE_SCORING] playerA", {
      name: body.playerA.name,
      isTimeUnknown: scoringA.scoringInput.isTimeUnknown,
      calendarType: inputA.calendarType,
      birthHour: inputA.birthHour,
      birthMinute: inputA.birthMinute,
      confidence: scoringA.tier.confidence,
      grade: scoringA.tier.grade,
      composite: scoringA.tier.composite,
      scores: scoringA.scores,
      tenStars: scoringA.scoringInput.tenStars,
      elementDist: scoringA.scoringInput.elementDist,
    });

    // Enrich + score Player B
    const inputB = playerToInputPayload(body.playerB);
    const { sajuText: sajuTextB, enriched: enrichedB } = await resolveSajuEnrichedData(inputB);
    const scoringB = calculateServerScoring(enrichedB);

    console.info("[BATTLE_SCORING] playerB", {
      name: body.playerB.name,
      isTimeUnknown: scoringB.scoringInput.isTimeUnknown,
      calendarType: inputB.calendarType,
      birthHour: inputB.birthHour,
      birthMinute: inputB.birthMinute,
      confidence: scoringB.tier.confidence,
      grade: scoringB.tier.grade,
      composite: scoringB.tier.composite,
      scores: scoringB.scores,
      tenStars: scoringB.scoringInput.tenStars,
      elementDist: scoringB.scoringInput.elementDist,
    });

    // Fortune for both players
    const birthYearA = Number(body.playerA.birthYear);
    const birthYearB = Number(body.playerB.birthYear);

    const [fortuneA, fortuneB] = await Promise.all([
      calculateFortune({
        birthYear: birthYearA,
        birthMonth: Number(body.playerA.birthMonth),
        birthDay: Number(body.playerA.birthDay),
        birthHour: body.playerA.unknownBirthTime ? undefined : Number(body.playerA.birthHour),
        birthMinute: body.playerA.unknownBirthTime ? undefined : Number(body.playerA.birthMinute),
        gender: normalizeGender(body.playerA.gender),
        birthLocation: body.playerA.birthLocation,
        yearPillar: enrichedA.pillars.year,
        monthPillar: enrichedA.pillars.month,
        dayPillar: enrichedA.pillars.day,
        hourPillar: enrichedA.pillars.hour ?? "",
        isTimeUnknown: body.playerA.unknownBirthTime,
      }),
      calculateFortune({
        birthYear: birthYearB,
        birthMonth: Number(body.playerB.birthMonth),
        birthDay: Number(body.playerB.birthDay),
        birthHour: body.playerB.unknownBirthTime ? undefined : Number(body.playerB.birthHour),
        birthMinute: body.playerB.unknownBirthTime ? undefined : Number(body.playerB.birthMinute),
        gender: normalizeGender(body.playerB.gender),
        birthLocation: body.playerB.birthLocation,
        yearPillar: enrichedB.pillars.year,
        monthPillar: enrichedB.pillars.month,
        dayPillar: enrichedB.pillars.day,
        hourPillar: enrichedB.pillars.hour ?? "",
        isTimeUnknown: body.playerB.unknownBirthTime,
      }),
    ]);

    const fortuneBlockA = buildFortunePromptBlock(fortuneA, birthYearA);
    const fortuneBlockB = buildFortunePromptBlock(fortuneB, birthYearB);

    // Interaction analysis
    const interaction = calculateBattleInteraction(
      enrichedA, enrichedB,
      fortuneA, fortuneB,
      birthYearA, birthYearB,
    );

    // Compare
    const comparison = compareBattle(
      scoringA.scores,
      scoringB.scores,
      scoringA.tier,
      scoringB.tier,
      body.playerA.name,
      body.playerB.name,
    );

    // Chemistry label (deterministic, server-side)
    const chemistryLabel = selectChemistryLabel(
      interaction.dayStemRelation.type,
      comparison.winsA,
      comparison.winsB,
      body.relationshipType,
    );

    console.info("[BATTLE_CHEMISTRY]", {
      dayStemRelation: interaction.dayStemRelation.type,
      winsA: comparison.winsA,
      winsB: comparison.winsB,
      relationshipType: body.relationshipType,
      label: chemistryLabel,
    });

    // Simulation questions (trigger-based, server-side)
    const simulationQuestions = selectSimulations(
      enrichedA,
      enrichedB,
      body.relationshipType,
      5,
    );

    console.info("[BATTLE_SIMULATIONS]", {
      count: simulationQuestions.length,
      questions: simulationQuestions.map((sq) => `${sq.icon} ${sq.question}`),
    });

    // LLM analysis
    const llmAnalysis = await runBattleAnalysis({
      nameA: body.playerA.name,
      nameB: body.playerB.name,
      scoresA: scoringA.scores,
      scoresB: scoringB.scores,
      tierA: scoringA.tier,
      tierB: scoringB.tier,
      comparison,
      relationshipType: body.relationshipType,
      sajuTextA,
      sajuTextB,
      interaction,
      fortuneBlockA,
      fortuneBlockB,
      chemistryLabel,
      simulationQuestions,
    });

    const result = {
      playerA: {
        name: body.playerA.name,
        tier: scoringA.tier,
        scores: scoringA.scores,
      },
      playerB: {
        name: body.playerB.name,
        tier: scoringB.tier,
        scores: scoringB.scores,
      },
      comparison,
      llmAnalysis,
      relationshipType: body.relationshipType,
      chemistryLabel,
      simulationQuestions,
    };

    // DB 저장 (동기 + 1회 재시도)
    const battleRow: Record<string, any> = {
      user_id: userId,
      player_a_name: body.playerA.name,
      player_b_name: body.playerB.name,
      player_a_grade: scoringA.tier.grade,
      player_b_grade: scoringB.tier.grade,
      overall_winner: comparison.overallWinner,
      overall_intensity: comparison.overallIntensity,
      wins_a: comparison.winsA,
      wins_b: comparison.winsB,
      draws: comparison.draws,
      relationship_type: body.relationshipType,
      full_result: result,
    };

    if (!userId && guestTokenHash) {
      battleRow.guest_token_hash = guestTokenHash;
      battleRow.guest_token_expires_at = getDbExpiresAt();
    }

    let battleId: string | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("saju_battles")
        .insert(battleRow)
        .select("id")
        .single();

      if (!insertError && inserted?.id) {
        battleId = inserted.id;
        break;
      }

      if (attempt === 0) {
        console.warn("[BATTLE_ANALYZE] DB save attempt 1 failed, retrying:", insertError?.message);
        await new Promise((r) => setTimeout(r, 500));
      } else {
        console.error("[BATTLE_ANALYZE] DB save failed after retry:", insertError?.message);
        return NextResponse.json(
          { error: "배틀 결과 저장에 실패했습니다. 다시 시도해주세요." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, result, battleId });
  } catch (error: any) {
    console.error("[BATTLE_ANALYZE]", error);
    return NextResponse.json(
      { error: error?.message || "배틀 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
