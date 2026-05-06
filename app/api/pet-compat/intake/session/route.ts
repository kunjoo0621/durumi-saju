// 펫 궁합 prepayment_sessions 발급 API
// POST /api/pet-compat/intake/session
// 흐름: /pet/input → /checkout?type=pet 진입 시 호출 → prepayment_sessions에 { pet, owner } 저장 → sessionId 반환
// 사주의 /api/intake/session 패턴과 동일 (단, 회원 전용 + 펫 페이로드)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";
import type { PetInput, OwnerInput } from "@/lib/pet-compat";

interface IntakeBody {
  pet: PetInput;
  owner: OwnerInput;
}

function isValid(body: IntakeBody): { ok: true } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  if (!body?.pet?.name?.trim()) missing.push("pet.name");
  if (!body?.pet?.species) missing.push("pet.species");
  if (!body?.pet?.birthTier) missing.push("pet.birthTier");

  // 4티어별 필수 필드 검증
  const tier = body?.pet?.birthTier;
  if (tier === 1 && (!body?.pet?.birthDate || !body?.pet?.birthTime)) missing.push("pet.birthDate+time(tier1)");
  if (tier === 2 && !body?.pet?.birthDate) missing.push("pet.birthDate(tier2)");
  if (tier === 3 && !body?.pet?.birthYearEstimated) missing.push("pet.birthYearEstimated(tier3)");
  if (tier === 4 && !body?.pet?.adoptionDate) missing.push("pet.adoptionDate(tier4)");

  if (!body?.owner?.name?.trim()) missing.push("owner.name");
  if (!body?.owner?.birthYear) missing.push("owner.birthYear");
  if (!body?.owner?.birthMonth) missing.push("owner.birthMonth");
  if (!body?.owner?.birthDay) missing.push("owner.birthDay");
  if (!body?.owner?.birthLocation) missing.push("owner.birthLocation");
  if (!body?.owner?.gender) missing.push("owner.gender");
  if (!body?.owner?.unknownBirthTime && (!body?.owner?.birthHour || body?.owner?.birthMinute === undefined)) {
    missing.push("owner.birthHour+minute");
  }

  return missing.length > 0 ? { ok: false, missing } : { ok: true };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요해." }, { status: 401 });
    }

    const body = (await request.json()) as IntakeBody;
    const validation = isValid(body);
    if (!validation.ok) {
      console.error("[PET_INTAKE] invalid input, missing:", validation.missing);
      return NextResponse.json({ error: "입력값이 부족해." }, { status: 400 });
    }

    // 입력 해시 (간단한 결정성 키 — 결과 캐싱용)
    const petKey = [
      body.pet.species,
      body.pet.name,
      body.pet.birthTier,
      body.pet.birthDate || body.pet.adoptionDate || `${body.pet.birthYearEstimated}-${body.pet.birthMonthEstimated}`,
      body.pet.gender || "",
      body.pet.coatColor || "",
      body.pet.neutered === undefined ? "" : String(body.pet.neutered),
    ].join("|");

    const ownerKey = `${body.owner.birthYear}-${body.owner.birthMonth}-${body.owner.birthDay}-${body.owner.gender}`;
    const inputHash = `pet:${petKey}::owner:${ownerKey}`;

    // prepayment_sessions INSERT
    const { data, error } = await supabaseAdmin
      .from("prepayment_sessions")
      .insert({
        user_id: userId,
        input_hash: inputHash,
        payload: { pet: body.pet, owner: body.owner } as any,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("[PET_INTAKE] insert error", error?.message);
      return NextResponse.json({ error: "세션 생성 실패." }, { status: 500 });
    }

    return NextResponse.json({ sessionId: data.id });
  } catch (error: any) {
    console.error("[PET_INTAKE] unexpected error", error?.message || error);
    return NextResponse.json({ error: "예상치 못한 오류." }, { status: 500 });
  }
}
