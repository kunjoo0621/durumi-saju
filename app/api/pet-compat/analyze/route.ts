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
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { buildFortunePromptBlock } from "@/lib/analysis";
import { calculatePetEnrichedSaju, extractPetCompatSignals, buildPetSajuText, buildPetSpec } from "@/lib/pet-compat-saju";
import { computePetCompatScores } from "@/lib/pet-compat-scoring";
import { runPetCompatAnalysis } from "@/lib/pet-compat";
import { generatePetIllustration } from "@/lib/pet-compat-illustration";
import { refundCoins } from "@/lib/server/session-helpers";
import { PET_COMPAT_LAUNCH_COST } from "@/lib/constants/coins";
import type { PetInput, OwnerInput } from "@/lib/pet-compat";

const PHOTO_BUCKET = "pet-uploads";

interface AnalyzeBody {
  sessionId: string;
  orderId?: string;          // /api/coins/spend가 발급한 orderId (DB 추적용)
}

interface PetCompatPayload {
  pet: PetInput;
  owner: OwnerInput;
}

export async function POST(request: NextRequest) {
  // 결제 견고성용 외부 스코프 변수 (실패 경로 환불 + 재호출 가드에서 참조)
  let userId: string | null = null;
  let sessionId: string | undefined;
  // 알은 /api/coins/spend(type=pet)에서 이미 차감됨 (p_reference_id=sessionId).
  // 이 라우트는 알을 새로 차감하지 않는다 → 재호출해도 재청구는 원천적으로 없음.
  // chargedContext: 검증을 모두 통과해 "차감된 세션의 실제 분석"에 진입했는지 표시.
  //   실패 시 이 시점 이후에만 환불한다(검증 거부 단계는 환불하지 않음 — 미검증 세션 보호).
  let chargedContext = false;
  let refunded = false;

  // 환불은 사주 spend 흐름의 refundCoins 패턴을 그대로 재사용한다.
  // reference_id = sessionId 로 spend 의 p_reference_id 와 일관되게 맞춘다.
  // 한 번만 실행되도록 refunded 플래그로 이중 환불을 막는다.
  async function doRefund() {
    if (refunded || !chargedContext || !userId || !sessionId) return;
    refunded = true;
    try {
      await refundCoins(userId, PET_COMPAT_LAUNCH_COST, sessionId);
    } catch (e: any) {
      console.error("[PET_COMPAT] refund failed", e?.message || e);
    }
  }

  try {
    // 1. 인증
    const session = await getServerSession(authOptions);
    userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요해." }, { status: 401 });
    }

    const body = (await request.json()) as AnalyzeBody;
    if (!body.sessionId) {
      return NextResponse.json({ error: "세션 정보가 필요해." }, { status: 400 });
    }
    sessionId = body.sessionId;

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
    if (
      !payload?.pet?.name || !payload?.pet?.species || !payload?.pet?.birthTier ||
      !payload?.pet?.breed || !payload?.pet?.gender
    ) {
      return NextResponse.json({ error: "펫 정보가 부족해." }, { status: 400 });
    }
    if (!["dog", "cat"].includes(payload.pet.species)) {
      return NextResponse.json({ error: "지원 안 하는 종이야 (강아지·고양이만)." }, { status: 400 });
    }
    if (!payload?.owner?.birthYear || !payload?.owner?.birthLocation) {
      return NextResponse.json({ error: "보호자 사주 정보가 부족해." }, { status: 400 });
    }

    // 2-b. ★재호출 가드 — 세션당 결과 1개.
    //   이 결제(orderId)로 이미 pet_compat_results row 가 있으면 기존 resultId 를 반환하고
    //   신규 생성·재분석을 하지 않는다 → "1결제 무한생성" 차단.
    //   (알 재청구는 이 라우트가 spend_coins 를 호출하지 않아 애초에 없음.)
    //   무거운 사주 계산·LLM·일러스트 호출 전에 배치해 비용을 절약한다.
    //   주의: order_id 에 UNIQUE 제약이 없어 "동시 중복 호출"까지는 못 막는다(순차 재호출만
    //   차단). 완전한 원자성은 order_id UNIQUE 인덱스가 필요 — 운영자 결정 사항으로 보고.
    if (body.orderId) {
      const existing = await supabaseAdmin
        .from("pet_compat_results")
        .select("id, pet_id")
        .eq("user_id", userId)
        .eq("order_id", body.orderId)
        .maybeSingle();
      if (existing.data?.id) {
        return NextResponse.json({
          ok: true,
          reused: true,
          resultId: existing.data.id,
          petId: existing.data.pet_id,
        });
      }
    }

    const { pet, owner } = payload;

    // 여기서부터 "차감된 세션의 실제 분석" — 이후 실패는 알만 빠지고 결과 없음 → 환불.
    chargedContext = true;

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
      await doRefund();
      return NextResponse.json({ error: "보호자 사주 계산 실패했어.", refunded: true }, { status: 500 });
    }

    const ownerEnriched = enrichSajuData(ownerSajuData, { isTimeUnknown: Boolean(owner.unknownBirthTime) });
    let ownerSajuText = formatEnrichedSajuText(ownerEnriched);

    // 보호자 대운/세운 추가 (관계 시간성 카피 생성용)
    try {
      const fortune = await calculateFortune({
        birthYear: Number(owner.birthYear),
        birthMonth: Number(owner.birthMonth),
        birthDay: Number(owner.birthDay),
        birthHour: owner.unknownBirthTime ? undefined : Number(owner.birthHour || 12),
        birthMinute: owner.unknownBirthTime ? undefined : Number(owner.birthMinute || 0),
        gender: owner.gender,
        birthLocation: owner.birthLocation,
        yearPillar: ownerSajuData.year.heavenlyStem + ownerSajuData.year.earthlyBranch,
        monthPillar: ownerSajuData.month.heavenlyStem + ownerSajuData.month.earthlyBranch,
        dayPillar: ownerSajuData.day.heavenlyStem + ownerSajuData.day.earthlyBranch,
        dayMasterStem: ownerSajuData.day.heavenlyStem,
      } as any);
      const fortuneBlock = buildFortunePromptBlock(fortune, Number(owner.birthYear));
      if (fortuneBlock) ownerSajuText += fortuneBlock;
    } catch (e) {
      console.warn("[PET_COMPAT] owner fortune calc failed (시간성 카피 약화):", (e as any)?.message);
    }

    // 4. 펫 사주 계산
    const petCalc = await calculatePetEnrichedSaju(pet);
    const petSajuText = buildPetSajuText(pet, petCalc.enriched, petCalc.reliability, petCalc.note);

    // 5. 신호 추출 + 점수 계산
    const signals = extractPetCompatSignals(ownerEnriched, petCalc.enriched, pet);
    const scores = computePetCompatScores(signals);

    // 6. LLM 호출 + 일러스트 생성 병렬 실행 (사진 있을 때만)
    //    LLM ~30s, 일러스트 ~5-10s — Promise.all로 동시 진행 → 추가 대기 0
    //    일러스트 실패해도 분석은 계속 (illustration_url=null)

    // 6-a. 사진 URL 준비 (Storage 경로 → service_role public URL)
    let photoSignedUrl: string | null = null;
    if (pet.photoPath) {
      const { data: signed } = await supabaseAdmin.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(pet.photoPath, 60 * 10);  // 10분 (Gemini fetch 충분)
      photoSignedUrl = signed?.signedUrl || null;
    }

    // 6-b. 분석 결과 ID 미리 생성 (일러스트 저장 경로용)
    const provisionalResultId = crypto.randomUUID();

    const [llmResult, illustrationResult] = await Promise.all([
      runPetCompatAnalysis({
        owner,
        pet,
        ownerSajuText,
        petSajuText,
        precomputedScores: scores,
        signals,
        petSpec: buildPetSpec(pet, petCalc.enriched),
      }),
      photoSignedUrl
        ? generatePetIllustration({
            photoUrl: photoSignedUrl,
            petName: pet.name,
            petSpecies: pet.species,
            // "잘 몰라요"(폼의 미상 옵션)는 일러스트 프롬프트에서 품종으로 쓰지 않음.
            petBreed: pet.breed && pet.breed !== "잘 몰라요" ? pet.breed : undefined,
            resultId: provisionalResultId,
            archetype: scores.archetype,
          })
        : Promise.resolve({ ok: false as const, reason: "no photo" }),
    ]);

    if (!llmResult.ok) {
      console.error("[PET_COMPAT] LLM failed", llmResult.error);
      await doRefund();
      return NextResponse.json({ error: "분석 중 오류가 발생했어. 다시 시도해줘.", refunded: true }, { status: 500 });
    }

    if (!illustrationResult.ok) {
      console.warn("[PET_COMPAT] illustration skipped:", illustrationResult.reason);
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
        adoption_route: null,
      })
      .select("id")
      .single();

    if (petProfileInsert.error || !petProfileInsert.data?.id) {
      console.error("[PET_COMPAT] pet_profiles insert error", petProfileInsert.error);
      await doRefund();
      return NextResponse.json({ error: "펫 프로필 저장 실패.", refunded: true }, { status: 500 });
    }

    const petId = petProfileInsert.data.id;

    // 8. DB 저장 — 궁합 결과 (일러스트 URL 포함)
    const resultInsert = await supabaseAdmin
      .from("pet_compat_results")
      .insert({
        id: provisionalResultId,         // 일러스트 저장 경로와 일치시킴
        user_id: userId,
        pet_id: petId,
        label_grade: llmResult.result.label.grade,
        label_text: llmResult.result.label.text,
        composite_score: scores.composite,
        sync_score: scores.sync,
        ruler_score: scores.ruler,
        lover_score: scores.lover,
        loyalty_score: scores.loyalty,
        conflict_score: scores.conflict,
        full_result: llmResult.result,
        order_id: body.orderId || null,
        scoring_version: scores.scoringVersion,
        illustration_key: illustrationResult.ok ? illustrationResult.illustrationPath : null,
        illustration_url: illustrationResult.ok ? illustrationResult.illustrationUrl : null,
      })
      .select("id")
      .single();

    if (resultInsert.error || !resultInsert.data?.id) {
      console.error("[PET_COMPAT] result insert error", resultInsert.error);
      await doRefund();
      return NextResponse.json({ error: "결과 저장 실패.", refunded: true }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      resultId: resultInsert.data.id,
      petId,
    });
  } catch (error: any) {
    console.error("[PET_COMPAT] unexpected error", error?.message || error);
    // 검증 통과 후(chargedContext) 예외면 알만 빠지고 결과 없음 → 환불.
    await doRefund();
    return NextResponse.json(
      { error: "예상치 못한 오류가 발생했어.", refunded },
      { status: 500 },
    );
  }
}
