// /api/today/results/[id] — 결과 조회 (full_json + 메타)
// yearly /full 패턴 미러

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "resultId가 필요합니다." }, { status: 400 });
    }

    const { data: row, error } = await supabaseAdmin
      .from("today_results")
      .select(
        "id, user_id, target_date, today_pillar, today_mood, today_weather_icon, branch_relation_type, stem_relation_label, ten_star, full_json, teaser_json, created_at",
      )
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[TODAY_RESULTS] query", error.message);
      return NextResponse.json({ error: "결과 조회 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
    }

    if (row.full_json === null) {
      return NextResponse.json({ status: "pending", resultId: row.id });
    }
    if ((row.full_json as any)?._error) {
      return NextResponse.json({
        status: "failed",
        resultId: row.id,
        message: (row.full_json as any)?._message || "분석 실패",
      }, { status: 409 });
    }

    return NextResponse.json({
      status: "completed",
      resultId: row.id,
      targetDate: row.target_date,
      todayPillar: row.today_pillar,
      todayMood: row.today_mood,
      todayWeatherIcon: row.today_weather_icon,
      branchRelationType: row.branch_relation_type,
      stemRelationLabel: row.stem_relation_label,
      tenStar: row.ten_star,
      result: row.full_json,
      teaser: row.teaser_json,
      createdAt: row.created_at,
    });
  } catch (error: any) {
    console.error("[TODAY_RESULTS] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
