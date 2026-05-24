// /api/today/analyze — LLM 호출 + DB 저장
// yearly analyze 패턴 미러 + runTodayAnalysis 사용

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";
import { refundCoins } from "@/lib/server/session-helpers";
import { TODAY_COST } from "@/lib/constants/coins";
import { runTodayAnalysis } from "@/lib/today-prompt";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { resultId } = (await request.json()) as { resultId: string };
    if (!resultId) {
      return NextResponse.json({ error: "resultId가 필요합니다." }, { status: 400 });
    }

    const { data: row, error: queryError } = await supabaseAdmin
      .from("today_results")
      .select(
        "id, user_id, input_hash, target_date, full_json, name, birth_date, birth_time, region, gender, relationship_status, employment_status, calendar_type, core_fear_axis",
      )
      .eq("id", resultId)
      .eq("user_id", userId)
      .maybeSingle();

    if (queryError || !row) {
      return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
    }

    if (row.full_json !== null && !(row.full_json as any)?._error) {
      return NextResponse.json({ status: "already_completed" });
    }
    if ((row.full_json as any)?._error) {
      return NextResponse.json(
        { error: "이미 실패 처리된 결과입니다.", failed: true },
        { status: 409 },
      );
    }

    const [bY, bM, bD] = (row.birth_date || "").split("-");
    const [bH, bMin] = (row.birth_time || "").split(":");
    const input: InputPayload = {
      name: row.name || "",
      birthYear: bY || "",
      birthMonth: bM || "",
      birthDay: bD || "",
      calendarType: (row.calendar_type as "solar" | "lunar") || "solar",
      birthHour: bH || "",
      birthMinute: bMin || "",
      birthLocation: row.region || "",
      gender: row.gender || "",
      relationshipStatus: row.relationship_status || "",
      employmentStatus: row.employment_status || "",
      coreFearAxis: (row.core_fear_axis || "") as InputPayload["coreFearAxis"],
      unknownBirthTime: !row.birth_time,
    };

    // 환불용 참조
    const { data: unlock } = await supabaseAdmin
      .from("today_result_unlocks")
      .select("order_id")
      .eq("result_id", resultId)
      .eq("user_id", userId)
      .maybeSingle();
    const refundRef = unlock?.order_id || resultId;

    try {
      const { result, serverAnalysis } = await runTodayAnalysis(input, row.target_date);

      // teaser는 섹션 메타만 (yearly·사주 teaser 패턴 동일)
      const teaser = {
        tier: result.tier,
        scores: result.scores,
        sections: result.sections.map((s) => ({ icon: s.icon, title: s.title })),
        todayMeta: result.todayMeta,
      };

      const { error: updateError } = await supabaseAdmin
        .from("today_results")
        .update({
          full_json: result,
          teaser_json: teaser,
          today_pillar: result.todayMeta.dayPillar,
          today_mood: result.todayMeta.mood,
          today_weather_icon: result.todayMeta.weatherIcon,
          branch_relation_type: serverAnalysis.branchRelationType,
          stem_relation_label: serverAnalysis.stemRelation.label,
          ten_star: serverAnalysis.tenStar,
        })
        .eq("id", resultId);

      if (updateError) {
        console.error("[TODAY_ANALYZE] update", updateError.message);
        await supabaseAdmin
          .from("today_results")
          .update({ full_json: { _error: true, _message: "결과 저장 실패" } })
          .eq("id", resultId);
        await refundCoins(userId, TODAY_COST, refundRef);
        return NextResponse.json(
          { error: "결과 저장에 실패했습니다.", refunded: true },
          { status: 500 },
        );
      }

      return NextResponse.json({ status: "completed" });
    } catch (analysisError: any) {
      console.error("[TODAY_ANALYZE] analysis failed", analysisError?.message);
      await supabaseAdmin
        .from("today_results")
        .update({ full_json: { _error: true, _message: "분석 실패" } })
        .eq("id", resultId);
      await refundCoins(userId, TODAY_COST, refundRef);
      return NextResponse.json(
        { error: "분석에 실패했습니다. 알은 환불되었습니다.", refunded: true },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("[TODAY_ANALYZE] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
