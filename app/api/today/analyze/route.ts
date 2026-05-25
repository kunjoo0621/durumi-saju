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

    // 분석 동시 실행 락 — 새로고침·2탭 동시 호출 시 LLM 중복 호출 + 중복 환불 차단.
    // analysis_started_at atomic UPDATE WHERE 조건으로 획득. 만료 3분 (LLM ~90초 + 여유).
    // schema cache stale 등으로 컬럼 인식 못 하면 실패 응답 (잠깐의 실패가 중복 분석보다 안전).
    const LOCK_TIMEOUT_MS = 3 * 60 * 1000;
    const lockExpireTime = new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString();
    const lockNow = new Date().toISOString();
    const { data: lockResult, error: lockError } = await supabaseAdmin
      .from("today_results")
      .update({ analysis_started_at: lockNow })
      .eq("id", resultId)
      .eq("user_id", userId)
      .is("full_json", null)
      .or(`analysis_started_at.is.null,analysis_started_at.lt.${lockExpireTime}`)
      .select("id");

    if (lockError) {
      console.error("[TODAY_ANALYZE] lock acquire", lockError.message);
      return NextResponse.json({ error: "분석 시작 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!lockResult || lockResult.length === 0) {
      // 락 못 잡음 — 다른 요청이 이미 분석 중. 클라이언트는 곧 결과를 polling 받게 됨.
      return NextResponse.json({ status: "already_processing" });
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
          // 락도 같이 풀어야 함 — 안 풀면 3분간 stuck (start route reset에서만 해제됨)
          .update({ full_json: { _error: true, _message: "결과 저장 실패" }, analysis_started_at: null })
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
        // 락도 같이 풀어야 함 — LLM/JSON parse/sections validation 실패 시에도 락 stuck 방지
        .update({ full_json: { _error: true, _message: "분석 실패" }, analysis_started_at: null })
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
