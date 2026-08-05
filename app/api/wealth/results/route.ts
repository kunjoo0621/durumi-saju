// /api/wealth/results — 결과 조회 (full_json + 메타).
// ?id= 지정 시 해당 결과, 없으면 로그인 사용자의 최신 1건.
// app/api/marriage/results/route.ts 패턴 미러 — 동적 세그먼트 대신 쿼리 파라미터로 id를 받는 점,
// 상태 분기(teaser/completed)가 analysis_started_at/_error 마커 없이 full_json null 여부로만 갈리는 점 동일.
//
// 소유권: id로 조회하더라도 반드시 user_id로 스코프된 쿼리에서 .eq("id", id)를 거는 것으로
// 다른 사람의 결제 결과를 id만 알면 읽어가는 leak을 막는다. 미스(row 없음)는 404로만 응답하고
// "존재하지만 남의 것"과 "존재하지 않음"을 구분하지 않는다 (existence oracle 방지).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";
import { WEALTH_RESULT_COLUMNS } from "@/lib/constants/result-columns";

const SELECT_COLUMNS = WEALTH_RESULT_COLUMNS;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");

    const query = supabaseAdmin.from("wealth_results").select(SELECT_COLUMNS).eq("user_id", userId);

    const { data: row, error } = id
      ? await query.eq("id", id).maybeSingle()
      : await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (error) {
      console.error("[WEALTH_RESULTS] query", error.message);
      return NextResponse.json({ error: "결과 조회 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
    }

    if (row.full_json === null) {
      // wealth/start만 완료되고 결제(wealth/analyze) 전 — teaser만 공개
      return NextResponse.json({
        status: "teaser",
        resultId: row.id,
        interest: row.interest,
        wealthGrade: row.wealth_grade,
        teaser: row.teaser_json,
        createdAt: row.created_at,
      });
    }

    return NextResponse.json({
      status: "completed",
      resultId: row.id,
      interest: row.interest,
      wealthGrade: row.wealth_grade,
      jaeseongType: row.jaeseong_type,
      jaedaShinyak: row.jaeda_shinyak,
      sikssangSaengjae: row.sikssang_saengjae,
      gunggeobJaengjae: row.gunggeob_jaengjae,
      jaeGrip: row.jae_grip,
      result: row.full_json,
      teaser: row.teaser_json,
      createdAt: row.created_at,
    });
  } catch (error: any) {
    console.error("[WEALTH_RESULTS] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
