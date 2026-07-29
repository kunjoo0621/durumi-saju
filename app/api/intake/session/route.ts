import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";
import { generateToken, hashToken, addTokenToCookie, getTokensFromCookie } from "@/lib/guest-token";
import { SCORING_VERSION } from "@/lib/utils/saju-scoring";

function isValidInput(input: InputPayload) {
  if (
    !input?.name ||
    !input.birthYear ||
    !input.birthMonth ||
    !input.birthDay ||
    !input.birthLocation ||
    !input.gender ||
    !input.relationshipStatus ||
    !input.employmentStatus
    // coreFearAxis는 옵셔널 (yearly 단독 흐름은 제외)
  ) {
    return false;
  }

  if (!input.unknownBirthTime && (!input.birthHour || !input.birthMinute)) {
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? await getSupabaseUserId(session) : null;

    let rawToken: string | null = null;
    let guestTokenHash: string | null = null;

    if (!userId) {
      rawToken = generateToken();
      guestTokenHash = hashToken(rawToken);
    }

    const input = (await request.json()) as InputPayload;
    if (!isValidInput(input)) {
      const missing = [
        !input?.name && "name", !input?.birthYear && "birthYear", !input?.birthMonth && "birthMonth",
        !input?.birthDay && "birthDay", !input?.birthLocation && "birthLocation", !input?.gender && "gender",
        !input?.relationshipStatus && "relationshipStatus", !input?.employmentStatus && "employmentStatus",
        !input?.coreFearAxis && "coreFearAxis",
        !input?.unknownBirthTime && !input?.birthHour && "birthHour",
        !input?.unknownBirthTime && !input?.birthMinute && "birthMinute",
      ].filter(Boolean);
      console.error("[INTAKE] invalid input, missing:", missing);
      return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
    }

    const inputHash = buildInputHash(input);

    // ── 게스트: 기존 결과 체크 (세션 INSERT 전에 확인) ──
    if (!userId) {
      const existingTokens = await getTokensFromCookie();
      const existingHashes = existingTokens.map(t => hashToken(t));
      if (existingHashes.length > 0) {
        const { data: existing } = await supabaseAdmin
          .from("saju_results")
          .select("id, full_json")
          .eq("input_hash", inputHash)
          .in("guest_token_hash", existingHashes)
          .gt("guest_token_expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          const storedVersion = (existing.full_json as any)?.scoringVersion ?? 0;
          // v18 grandfather: 게스트 언락 결과는 stale이어도 재사용(하향 방지).
          if (existing.full_json && !(existing.full_json as any)._error) {
            if (storedVersion < SCORING_VERSION) console.info("[GRANDFATHER] reuse stale guest result", { id: existing.id, storedVersion, currentVersion: SCORING_VERSION });
            const response = NextResponse.json({
              sessionId: "",
              existingResultId: existing.id,
            });
            if (rawToken) {
              await addTokenToCookie(response, rawToken);
            }
            return response;
          }
        }
      }
    }

    // ── 로그인 유저: 기존 결과 체크 ──
    // 결제는 로그인이 필수라, 위 게스트 전용 분기 때문에 "이미 같은 사주로 본 결과가 있어" 모달이
    // 정작 돈 낼 수 있는 유저에겐 한 번도 뜨지 않았다(실측). 재사용 이중과금 75건/54명의 UX 쪽 원인.
    // 서버(/api/coins/spend)가 이미 차감을 막지만, 유저가 결제 버튼을 누르기 전에 알려주는 게 맞다.
    // 세션은 그대로 만든다 — 모달에서 "태어난 시간 고치기"로 빠지거나 그냥 진행할 수 있어야 한다.
    // ★산식 버전(scoringVersion) 비교는 넣지 않는다: 버전 업그레이드는 대외비이고,
    //   서버 재사용도 버전 무관이라 감지도 무관해야 일관된다.
    let existingResultId: string | null = null;
    if (userId) {
      const { data: unlock } = await supabaseAdmin
        .from("result_unlocks")
        .select("result_id")
        .eq("user_id", userId)
        .eq("input_hash", inputHash)
        .maybeSingle();

      if (unlock?.result_id) {
        const { data: existing } = await supabaseAdmin
          .from("saju_results")
          .select("id, full_json")
          .eq("id", unlock.result_id)
          .maybeSingle();

        // full_json이 null이면 분석 진행 중 — 그것도 "이미 있는 결과"로 안내한다.
        if (existing?.id && !(existing.full_json as any)?._error) {
          existingResultId = existing.id;
        }
      }
    }

    const payload = {
      ...input,
      name: input.name.trim(),
      birthYear: input.birthYear.trim(),
      birthMonth: input.birthMonth.trim(),
      birthDay: input.birthDay.trim(),
      birthHour: input.birthHour?.trim() || "",
      birthMinute: input.birthMinute?.trim() || "",
      birthLocation: input.birthLocation.trim(),
      gender: input.gender.trim(),
      relationshipStatus: input.relationshipStatus.trim(),
      employmentStatus: input.employmentStatus.trim(),
      coreFearAxis: input.coreFearAxis,
      unknownBirthTime: Boolean(input.unknownBirthTime),
      calendarType: input.calendarType || "solar",
    };

    const { data, error } = await supabaseAdmin
      .from("prepayment_sessions")
      .insert({
        user_id: userId,
        guest_token_hash: guestTokenHash,
        input_hash: inputHash,
        payload,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("[INTAKE] session create error", error?.message);
      return NextResponse.json({ error: "세션 생성에 실패했습니다." }, { status: 500 });
    }

    const response = NextResponse.json({
      sessionId: data.id,
      ...(existingResultId ? { existingResultId } : {}),
    });

    if (rawToken) {
      await addTokenToCookie(response, rawToken);
    }

    return response;
  } catch (error: any) {
    console.error("[INTAKE] session error:", error?.message);
    return NextResponse.json(
      { error: "세션 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
