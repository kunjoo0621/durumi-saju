// 펫 궁합 결과 조회 API (배틀 패턴 — 회원 전용)
// GET /api/pet-compat/results/[id]

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
      return NextResponse.json({ error: "로그인이 필요해." }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "결과 ID가 필요해." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("pet_compat_results")
      .select(`
        id, label_grade, label_text, composite_score,
        sync_score, ruler_score, lover_score, conflict_score,
        illustration_key, illustration_url,
        full_result, scoring_version, created_at,
        pet:pet_profiles (id, name, species, breed, gender, birth_tier, birth_date, adoption_date)
      `)
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[PET_COMPAT_GET] db error", error.message);
      return NextResponse.json({ error: "결과 조회 중 오류가 발생했어." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "결과를 찾을 수 없어." }, { status: 404 });
    }

    return NextResponse.json({ result: data });
  } catch (error: any) {
    console.error("[PET_COMPAT_GET] unexpected error", error?.message || error);
    return NextResponse.json({ error: "예상치 못한 오류가 발생했어." }, { status: 500 });
  }
}
