// 반려동물 궁합 분석 API (배틀 패턴 — 알 차감은 /api/coins/spend에서 이미 처리됨)
// POST /api/pet-compat/analyze
// 흐름: 인증 → 세션 조회 → 사주 계산 → 신호/점수 → LLM → DB 저장
//
// 클라이언트 흐름:
// /pet/input → /checkout?type=pet → /api/coins/spend (알 차감) → /api/pet-compat/analyze → /pet/result/[id]

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";
import { calculateSaju, enrichSajuData, formatEnrichedSajuText } from "@/lib/utils/saju";
import { calculatePetEnrichedSaju, extractPetCompatSignals, buildPetSajuText } from "@/lib/pet-compat-saju";
import { computePetCompatScores } from "@/lib/pet-compat-scoring";
import { runPetCompatAnalysis } from "@/lib/pet-compat";
import type { PetInput, OwnerInput } from "@/lib/pet-compat";

interface AnalyzeBody {
  sessionId: string;
  orderId?: string;          // /api/coins/spend가 발급한 orderId (DB 추적용)
}

interface PetCompatPayload {
  pet: PetInput;
  owner: OwnerInput;
}

export async function POST(request: NextRequest) {
  try {
    // 1. 인증
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요해." }, { status: 401 });
    }

    const body = (await request.json()) as AnalyzeBody;
    if (!body.sessionId) {
      return NextResponse.json({ error: "세션 정보가 필요해." }, { status: 400 });
    }

    // 2. prepayment_sessions에서 페이로드 조회 (알 차감은 이미 끝남 → status='consumed')
    const sessionLookup = await supabaseAdmin
      .from("prepayment_sessions")
      .select("id, payload, status")
      .eq("id", body.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (sessionLookup.error || !sessionLookup.data) {
      return NextResponse.json({ error: "세션을 찾을 수 없어." }, { status: 404 });
    }

    const payload = sessionLookup.data.payload as PetCompatPayload;
    if (!payload?.pet?.name || !payload?.pet?.species || !payload?.pet?.birthTier) {
      return NextResponse.json({ error: "펫 정보가 부족해." }, { status: 400 });
    }
    if (!["dog", "cat"].includes(payload.pet.species)) {
      return NextResponse.json({ error: "지원 안 하는 종이야 (강아지·고양이만)." }, { status: 400 });
    }
    if (!payload?.owner?.birthYear || !payload?.owner?.birthLocation) {
      return NextResponse.json({ error: "보호자 사주 정보가 부족해." }, { status: 400 });
    }

    const { pet, owner } = payload;

    // 3. 보호자 사주 계산
    const ownerSajuData = await calculateSaju(
      Number(owner.birthYear),
      Number(owner.birthMonth),
      Number(owner.birthDay),
      owner.unknownBirthTime ? undefined : Number(owner.birthHour || 12),
      owner.unknownBirthTime ? undefined : Number(owner.birthMinute || 0),
      { birthLocation: owner.birthLocation },
    );

    if (!ownerSajuData) {
      console.error("[PET_COMPAT] owner saju calc failed");
      return NextResponse.json({ error: "보호자 사주 계산 실패했어." }, { status: 500 });
    }

    const ownerEnriched = enrichSajuData(ownerSajuData, { isTimeUnknown: Boolean(owner.unknownBirthTime) });
    const ownerSajuText = formatEnrichedSajuText(ownerEnriched);

    // 4. 펫 사주 계산
    const petCalc = await calculatePetEnrichedSaju(pet);
    const petSajuText = buildPetSajuText(pet, petCalc.enriched, petCalc.reliability, petCalc.note);

    // 5. 신호 추출 + 점수 계산
    const signals = extractPetCompatSignals(ownerEnriched, petCalc.enriched, pet);
    const scores = computePetCompatScores(signals);

    // 6. LLM 호출
    const llmResult = await runPetCompatAnalysis({
      owner,
      pet,
      ownerSajuText,
      petSajuText,
      precomputedScores: scores,
    });

    if (!llmResult.ok) {
      console.error("[PET_COMPAT] LLM failed", llmResult.error);
      return NextResponse.json({ error: "분석 중 오류가 발생했어. 다시 시도해줘." }, { status: 500 });
    }

    // 7. DB 저장 — 펫 프로필
    const petProfileInsert = await supabaseAdmin
      .from("pet_profiles")
      .insert({
        user_id: userId,
        name: pet.name,
        species: pet.species,
        breed: pet.breed || null,
        gender: pet.gender || null,
        birth_tier: pet.birthTier,
        birth_date: pet.birthDate || null,
        birth_time: pet.birthTime || null,
        birth_year_estimated: pet.birthYearEstimated || null,
        birth_month_estimated: pet.birthMonthEstimated || null,
        adoption_date: pet.adoptionDate || null,
        calendar_type: pet.calendarType || null,
        adoption_route: pet.adoptionRoute || null,
        neutered: typeof pet.neutered === "boolean" ? pet.neutered : null,
        coat_color: pet.coatColor || null,
      })
      .select("id")
      .single();

    if (petProfileInsert.error || !petProfileInsert.data?.id) {
      console.error("[PET_COMPAT] pet_profiles insert error", petProfileInsert.error);
      return NextResponse.json({ error: "펫 프로필 저장 실패." }, { status: 500 });
    }

    const petId = petProfileInsert.data.id;

    // 8. DB 저장 — 궁합 결과
    const resultInsert = await supabaseAdmin
      .from("pet_compat_results")
      .insert({
        user_id: userId,
        pet_id: petId,
        label_grade: llmResult.result.label.grade,
        label_text: llmResult.result.label.text,
        composite_score: scores.composite,
        sync_score: scores.sync,
        ruler_score: scores.ruler,
        lover_score: scores.lover,
        conflict_score: scores.conflict,
        full_result: llmResult.result,
        order_id: body.orderId || null,
        scoring_version: scores.scoringVersion,
      })
      .select("id")
      .single();

    if (resultInsert.error || !resultInsert.data?.id) {
      console.error("[PET_COMPAT] result insert error", resultInsert.error);
      return NextResponse.json({ error: "결과 저장 실패." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      resultId: resultInsert.data.id,
      petId,
    });
  } catch (error: any) {
    console.error("[PET_COMPAT] unexpected error", error?.message || error);
    return NextResponse.json({ error: "예상치 못한 오류가 발생했어." }, { status: 500 });
  }
}
