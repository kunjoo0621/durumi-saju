import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";
import { checkRateLimit, getClientIp } from "@/lib/server/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const ip = getClientIp(request.headers);
    const minuteLimit = checkRateLimit(`result:${userId}:m`, 30, 60_000);
    const hourLimit = checkRateLimit(`result:${userId}:h`, 300, 60 * 60_000);
    if (!minuteLimit.allowed || !hourLimit.allowed) {
      console.warn("[RATE_LIMIT] /api/results/full", { userId, ip });
      const retryAfter = Math.max(minuteLimit.retryAfter, hourLimit.retryAfter);
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    let input: InputPayload | null = null;
    let resultId: string | null = null;
    const bodyText = await request.text();
    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText) as InputPayload & { resultId?: string | null };
        input = parsed;
        resultId = parsed.resultId ?? null;
      } catch {
        input = null;
      }
    }

    let resolvedResultId = resultId;
    let inputHash: string | null = null;

    if (!resolvedResultId && input) {
      inputHash = buildInputHash(input);
    }

    if (!resolvedResultId && !inputHash) {
      return NextResponse.json({ error: "조회 조건이 필요합니다." }, { status: 400 });
    }

    if (resolvedResultId) {
      const { data: unlock, error: unlockError } = await supabaseAdmin
        .from("result_unlocks")
        .select("result_id")
        .eq("user_id", userId)
        .eq("result_id", resolvedResultId)
        .maybeSingle();

      if (unlockError) {
        return NextResponse.json({ error: unlockError.message }, { status: 500 });
      }
      if (!unlock?.result_id) {
        return NextResponse.json({ error: "결제가 필요합니다." }, { status: 403 });
      }
    } else if (inputHash) {
      const { data: unlock, error: unlockError } = await supabaseAdmin
        .from("result_unlocks")
        .select("result_id")
        .eq("user_id", userId)
        .eq("input_hash", inputHash)
        .maybeSingle();

      if (unlockError) {
        return NextResponse.json({ error: unlockError.message }, { status: 500 });
      }
      if (!unlock?.result_id) {
        return NextResponse.json({ error: "결제가 필요합니다." }, { status: 403 });
      }
      resolvedResultId = unlock.result_id;
    }

    let query = supabaseAdmin
      .from("saju_results")
      .select(
        "full_json, unlocked_at, name, birth_date, birth_time, region, gender, relationship_status, employment_status, calendar_type"
      )
      .eq("user_id", userId)
      .order("unlocked_at", { ascending: false, nullsFirst: false })
      .limit(1);

    if (resolvedResultId) {
      query = query.eq("id", resolvedResultId);
    } else if (inputHash) {
      query = query.eq("input_hash", inputHash);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data?.full_json) {
      return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      result: data.full_json,
      unlockedAt: data.unlocked_at,
      access: "user",
      input: {
        name: data.name,
        birthDate: data.birth_date,
        birthTime: data.birth_time,
        region: data.region,
        gender: data.gender,
        relationshipStatus: data.relationship_status,
        employmentStatus: data.employment_status,
        calendarType: data.calendar_type,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
