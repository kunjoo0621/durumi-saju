import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

// 대표사주(또는 최근 사주) 조회 → 올해의 운세 입력으로 자동 채울 정보 반환.
// battle/my-saju 패턴 1:1 미러.

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("primary_result_id")
      .eq("id", userId)
      .single();

    let targetResultId: string | null = userData?.primary_result_id || null;

    if (!targetResultId) {
      const { data: unlock, error: unlockError } = await supabaseAdmin
        .from("result_unlocks")
        .select("result_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (unlockError) {
        return NextResponse.json({ error: unlockError.message }, { status: 500 });
      }
      targetResultId = unlock?.result_id || null;
    }

    if (!targetResultId) {
      return NextResponse.json({ result: null });
    }

    const { data: result, error: resultError } = await supabaseAdmin
      .from("saju_results")
      .select(
        "id, name, birth_date, birth_time, region, gender, relationship_status, employment_status, calendar_type, core_fear_axis",
      )
      .eq("id", targetResultId)
      .eq("user_id", userId)
      .maybeSingle();

    if (resultError) {
      return NextResponse.json({ error: resultError.message }, { status: 500 });
    }
    if (!result) {
      return NextResponse.json({ result: null });
    }

    const birthParts = result.birth_date?.split("-") || [];
    const timeParts = result.birth_time?.split(":") || [];

    return NextResponse.json({
      result: {
        sourceResultId: result.id,
        name: result.name,
        birthYear: birthParts[0] || "",
        birthMonth: birthParts[1] || "",
        birthDay: birthParts[2] || "",
        calendarType: result.calendar_type || "solar",
        birthHour: timeParts[0] || "",
        birthMinute: timeParts[1] || "",
        birthLocation: result.region || "",
        gender: result.gender || "",
        relationshipStatus: result.relationship_status || "",
        employmentStatus: result.employment_status || "",
        coreFearAxis: result.core_fear_axis || "",
        unknownBirthTime: !result.birth_time,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "내 사주 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
