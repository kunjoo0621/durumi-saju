// /api/wealth/list — 내 재물운 결과 목록 (관심사·등급·생성일).
// app/api/marriage/list/route.ts 패턴 미러. marriage와 동일하게 등급(wealth_grade)이
// full_json 안이 아니라 wealth_results 테이블 컬럼에 이미 있으므로 full_json 파싱 없이 컬럼만 select한다.

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
      .from("wealth_results")
      .select(
        "id, interest, wealth_grade, jaeseong_type, jaeda_shinyak, jae_grip, full_json, source_result_id, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[WEALTH_LIST] error", error.message);
      return NextResponse.json({ error: "재물운 목록 조회 중 오류가 발생했습니다." }, { status: 500 });
    }

    const enriched = (rows ?? []).map((r: any) => ({
      id: r.id,
      interest: r.interest,
      grade: r.wealth_grade,
      jaeseongType: r.jaeseong_type,
      jaedaShinyak: r.jaeda_shinyak,
      jaeGrip: r.jae_grip,
      sourceResultId: r.source_result_id,
      createdAt: r.created_at,
      // full_json이 null이면 wealth/start만 완료되고 결제 전(teaser) 단계
      unlocked: r.full_json !== null,
    }));

    return NextResponse.json({ results: enriched });
  } catch (error: any) {
    // error.message 노출 금지 (CLAUDE.md 규약) — yearly/list.ts는 details로 노출하는 기존 결함이
    // 있으나 이 라우트는 그대로 미러하지 않고 console.error로만 남긴다.
    console.error("[WEALTH_LIST] error", error?.message || error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
