// /api/career/list — 내 커리어운 결과 목록 (상황·등급·생성일).
// app/api/wealth/list/route.ts 미러. 등급(career_grade)이 테이블 컬럼에 있어 full_json 파싱 없이 컬럼만 select.

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
      .from("career_results")
      .select(
        "id, situation, career_grade, gwanseong_type, gwanda_sinyak, career_grip, full_json, source_result_id, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[CAREER_LIST] error", error.message);
      return NextResponse.json({ error: "커리어운 목록 조회 중 오류가 발생했습니다." }, { status: 500 });
    }

    const enriched = (rows ?? []).map((r: any) => ({
      id: r.id,
      situation: r.situation,
      // 결제 전(teaser) row는 등급을 내려보내지 않는다 — /my/results 잠금 카드의
      // GradeMedal이 null이면 물음표 폴백으로 그려진다.
      grade: r.full_json !== null ? r.career_grade : null,
      gwanseongType: r.gwanseong_type,
      gwandaSinyak: r.gwanda_sinyak,
      careerGrip: r.career_grip,
      sourceResultId: r.source_result_id,
      createdAt: r.created_at,
      // full_json이 null이면 career/start만 완료되고 결제 전(teaser) 단계
      unlocked: r.full_json !== null,
    }));

    return NextResponse.json({ results: enriched });
  } catch (error: any) {
    // error.message 노출 금지 (CLAUDE.md 규약) — console.error로만 남긴다.
    console.error("[CAREER_LIST] error", error?.message || error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
