import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";
import { checkRateLimit, getClientIp } from "@/lib/server/rateLimit";
import { parseJson5Loose } from "@/lib/json5Utils";

const FIELDS =
  "id, target_year, full_json, teaser_json, unlocked_at, name, birth_date, birth_time, region, gender, relationship_status, employment_status, calendar_type, core_fear_axis, saju_text, yearly_pillar";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const ip = getClientIp(request.headers);
    const minuteLimit = checkRateLimit(`yearly_full:${userId}:m`, 30, 60_000);
    const hourLimit = checkRateLimit(`yearly_full:${userId}:h`, 300, 60 * 60_000);
    if (!minuteLimit.allowed || !hourLimit.allowed) {
      console.warn("[RATE_LIMIT] /api/yearly/full", { userId, ip });
      const retryAfter = Math.max(minuteLimit.retryAfter, hourLimit.retryAfter);
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { resultId?: string };
    if (!body.resultId) {
      return NextResponse.json({ error: "resultId가 필요합니다." }, { status: 400 });
    }

    const { data: row, error } = await supabaseAdmin
      .from("yearly_results")
      .select(FIELDS)
      .eq("id", body.resultId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[YEARLY_FULL] query", error.message);
      return NextResponse.json({ error: "결과 조회 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
    }

    let parsedResult: unknown = row.full_json;
    if (typeof parsedResult === "string") {
      try {
        parsedResult = parseJson5Loose(parsedResult);
      } catch (parseError: any) {
        console.warn("[YEARLY_FULL] parse fail", parseError?.message);
        return NextResponse.json(
          { error: "저장된 결과 데이터가 손상되었습니다." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      result: parsedResult,
      teaser: row.teaser_json,
      resultId: row.id,
      targetYear: row.target_year,
      yearlyPillar: row.yearly_pillar,
      unlockedAt: row.unlocked_at,
      input: {
        name: row.name,
        birthDate: row.birth_date,
        birthTime: row.birth_time,
        region: row.region,
        gender: row.gender,
        relationshipStatus: row.relationship_status,
        employmentStatus: row.employment_status,
        calendarType: row.calendar_type,
        coreFearAxis: row.core_fear_axis,
        sajuText: row.saju_text,
      },
    });
  } catch (error: any) {
    console.error("[YEARLY_FULL] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
