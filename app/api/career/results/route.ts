// /api/career/results — 결과 조회 (full_json + 메타).
// ?id= 지정 시 해당 결과, 없으면 로그인 사용자의 최신 1건. app/api/wealth/results/route.ts 미러.
// 상태 분기(teaser/completed)는 full_json null 여부로만 갈린다.
//
// 소유권: id 조회여도 반드시 user_id 스코프 쿼리에 .eq("id", id) — id만 알면 남의 결제 결과를
// 읽어가는 leak 방지. 미스는 404로만(존재 여부 구분 안 함 — existence oracle 방지).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

const SELECT_COLUMNS =
  "id, user_id, situation, career_grade, gwanseong_type, gwanda_sinyak, gwanin_sangsaeng, sanggwan_gyeongwan, career_grip, teaser_json, full_json, created_at";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");

    const query = supabaseAdmin.from("career_results").select(SELECT_COLUMNS).eq("user_id", userId);

    const { data: row, error } = id
      ? await query.eq("id", id).maybeSingle()
      : await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (error) {
      console.error("[CAREER_RESULTS] query", error.message);
      return NextResponse.json({ error: "결과 조회 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
    }

    if (row.full_json === null) {
      // career/start만 완료되고 결제(career/analyze) 전 — teaser만 공개
      return NextResponse.json({
        status: "teaser",
        resultId: row.id,
        situation: row.situation,
        careerGrade: row.career_grade,
        teaser: row.teaser_json,
        createdAt: row.created_at,
      });
    }

    return NextResponse.json({
      status: "completed",
      resultId: row.id,
      situation: row.situation,
      careerGrade: row.career_grade,
      gwanseongType: row.gwanseong_type,
      gwandaSinyak: row.gwanda_sinyak,
      gwaninSangsaeng: row.gwanin_sangsaeng,
      sanggwanGyeongwan: row.sanggwan_gyeongwan,
      careerGrip: row.career_grip,
      result: row.full_json,
      teaser: row.teaser_json,
      createdAt: row.created_at,
    });
  } catch (error: any) {
    console.error("[CAREER_RESULTS] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
