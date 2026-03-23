import { NextRequest, NextResponse } from "next/server";
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

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("primary_result_id")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("[RESULTS] primary query error", error.message);
      return NextResponse.json({ error: "대표 사주 조회 중 오류가 발생했습니다." }, { status: 500 });
    }

    return NextResponse.json({ primaryResultId: data?.primary_result_id ?? null });
  } catch (error: any) {
    console.error("[RESULTS] primary error", error?.message);
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { resultId } = body as { resultId: string };

    if (!resultId) {
      return NextResponse.json({ error: "resultId는 필수입니다." }, { status: 400 });
    }

    // 소유권 확인 (result_unlocks — saju_results만 존재, 배틀 결과는 자동 거부)
    const { data: unlock } = await supabaseAdmin
      .from("result_unlocks")
      .select("id")
      .eq("result_id", resultId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!unlock) {
      return NextResponse.json({ error: "해당 결과에 대한 권한이 없습니다." }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({ primary_result_id: resultId })
      .eq("id", userId);

    if (error) {
      console.error("[RESULTS] primary update error", error.message);
      return NextResponse.json({ error: "대표 사주 설정 중 오류가 발생했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[RESULTS] primary error", error?.message);
    return NextResponse.json(
      { error: "설정 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
