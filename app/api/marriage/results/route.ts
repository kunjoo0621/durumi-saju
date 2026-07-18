// /api/marriage/results — 결과 조회 (full_json + 메타).
// ?id= 지정 시 해당 결과, 없으면 로그인 사용자의 최신 1건.
// app/api/today/results/[id] 패턴 미러 — 동적 세그먼트 대신 쿼리 파라미터로 id를 받는 점만 다르다
// (docs/superpowers/sdd/task-10-brief.md Step 1: "?id= 또는 최신 1건").
//
// 상태 분기: marriage_results는 today_results와 달리 analysis_started_at/_error 마커가 없다
// (marriage/analyze가 동기 호출 — 폴링 대상이 아님). full_json이 null이면 아직 결제 전(=
// marriage/start만 끝난 teaser 단계)이라는 뜻이라 teaser_json만 내려준다.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

const SELECT_COLUMNS =
  "id, user_id, marital_status, marriage_grade, spouse_star_type, gwansal_honjap, spouse_star_absent, spouse_palace_stability, teaser_json, full_json, created_at";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");

    const query = supabaseAdmin.from("marriage_results").select(SELECT_COLUMNS).eq("user_id", userId);

    const { data: row, error } = id
      ? await query.eq("id", id).maybeSingle()
      : await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (error) {
      console.error("[MARRIAGE_RESULTS] query", error.message);
      return NextResponse.json({ error: "결과 조회 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
    }

    if (row.full_json === null) {
      // marriage/start만 완료되고 결제(marriage/analyze) 전 — teaser만 공개
      return NextResponse.json({
        status: "teaser",
        resultId: row.id,
        maritalStatus: row.marital_status,
        marriageGrade: row.marriage_grade,
        teaser: row.teaser_json,
        createdAt: row.created_at,
      });
    }

    return NextResponse.json({
      status: "completed",
      resultId: row.id,
      maritalStatus: row.marital_status,
      marriageGrade: row.marriage_grade,
      spouseStarType: row.spouse_star_type,
      gwansalHonjap: row.gwansal_honjap,
      spouseStarAbsent: row.spouse_star_absent,
      spousePalaceStability: row.spouse_palace_stability,
      result: row.full_json,
      teaser: row.teaser_json,
      createdAt: row.created_at,
    });
  } catch (error: any) {
    console.error("[MARRIAGE_RESULTS] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
