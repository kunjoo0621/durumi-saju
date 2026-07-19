// /api/today/list — 내 오늘의 운세 결과 목록 (날짜·기분/날씨·오늘의 별·생성일).
// app/api/yearly/list/route.ts 패턴 미러 — 조회 전용 GET, user_id 스코프.
// 최신 날짜순(target_date desc). full_json이 null(pending)이거나 _error인 미완 행은 제외.
// error.message 비노출(CLAUDE.md).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from("today_results")
      .select("id, target_date, today_mood, today_weather_icon, ten_star, full_json, created_at")
      .eq("user_id", userId)
      .order("target_date", { ascending: false });

    if (error) {
      console.error("[TODAY_LIST] error", error.message);
      return NextResponse.json({ error: "오늘의 운세 목록 조회 중 오류가 발생했습니다." }, { status: 500 });
    }

    const enriched = (rows ?? [])
      // pending(full_json null) / 분석 실패(_error) 행 제외 (yearly/list 선례)
      .filter((r: any) => r.full_json && !r.full_json?._error)
      .map((r: any) => ({
        id: r.id,
        target_date: r.target_date,
        today_mood: r.today_mood,
        today_weather_icon: r.today_weather_icon,
        ten_star: r.ten_star,
        created_at: r.created_at,
      }));

    return NextResponse.json({ results: enriched });
  } catch (error: any) {
    console.error("[TODAY_LIST] error", error?.message || error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
