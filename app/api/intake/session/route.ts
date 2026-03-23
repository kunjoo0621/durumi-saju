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
    !input.employmentStatus ||
    !input.coreFearAxis
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
          if (storedVersion >= SCORING_VERSION) {
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

    const response = NextResponse.json({ sessionId: data.id });

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
