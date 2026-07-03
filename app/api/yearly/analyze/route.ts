import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";
import { refundCoins } from "@/lib/server/session-helpers";
import { YEARLY_COST } from "@/lib/constants/coins";
import { runYearlyAnalysis } from "@/lib/yearly-prompt";

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
      .from("yearly_results")
      .select(
        "id, user_id, input_hash, target_year, full_json, name, birth_date, birth_time, region, gender, relationship_status, employment_status, calendar_type, core_fear_axis",
      )
      .eq("id", resultId)
      .eq("user_id", userId)
      .maybeSingle();

    if (queryError || !row) {
      return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
    }

    // 이미 분석 완료
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
      .from("yearly_result_unlocks")
      .select("order_id")
      .eq("result_id", resultId)
      .eq("user_id", userId)
      .maybeSingle();
    const refundRef = unlock?.order_id || resultId;

    try {
      const full = await runYearlyAnalysis(input, row.target_year);

      // teaser는 섹션 메타만 (개인사주 teaser 패턴 동일)
      const teaser = {
        tier: full.tier,
        scores: full.scores,
        sections: full.sections.map((s) => ({ icon: s.icon, title: s.title })),
        yearlyMeta: full.yearlyMeta,
      };

      const { data: updatedRows, error: updateError } = await supabaseAdmin
        .from("yearly_results")
        .update({
          full_json: full,
          teaser_json: teaser,
          yearly_pillar: full.yearlyMeta.pillar,
        })
        .eq("id", resultId)
        .select("id");

      if (updateError) {
        console.error("[YEARLY_ANALYZE] update", updateError.message);
        await supabaseAdmin
          .from("yearly_results")
          .update({ full_json: { _error: true, _message: "결과 저장 실패" } })
          .eq("id", resultId);
        await refundCoins(userId, YEARLY_COST, refundRef);
        return NextResponse.json(
          { error: "결과 저장에 실패했습니다.", refunded: true },
          { status: 500 },
        );
      }

      // 0건 업데이트 = row 가 분석 도중 사라짐 → 조용한 손실 방지: 환불 + loud log.
      if (!updatedRows || updatedRows.length === 0) {
        console.error(
          `[YEARLY_ANALYZE] 결과 row 소실: update 0건 — 분석 도중 삭제됨. resultId=${resultId} userId=${userId} refundRef=${refundRef}`,
        );
        await refundCoins(userId, YEARLY_COST, refundRef);
        return NextResponse.json(
          { error: "분석 결과를 저장할 수 없습니다. 알은 환불되었습니다.", refunded: true },
          { status: 500 },
        );
      }

      return NextResponse.json({ status: "completed" });
    } catch (analysisError: any) {
      console.error("[YEARLY_ANALYZE] analysis failed", analysisError?.message);
      await supabaseAdmin
        .from("yearly_results")
        .update({ full_json: { _error: true, _message: "분석 실패" } })
        .eq("id", resultId);
      await refundCoins(userId, YEARLY_COST, refundRef);
      return NextResponse.json(
        { error: "분석에 실패했습니다. 알은 환불되었습니다.", refunded: true },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("[YEARLY_ANALYZE] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
