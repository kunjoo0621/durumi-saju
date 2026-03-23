import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

export async function DELETE(
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

    // result_unlocks로 소유권 확인 (GET /api/results와 동일 기준)
    const { data: unlock } = await supabaseAdmin
      .from("result_unlocks")
      .select("id")
      .eq("result_id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!unlock) {
      console.log("[DELETE /api/results] 소유권 없음", { id, userId });
      return NextResponse.json({ error: "삭제할 결과를 찾을 수 없습니다." }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("saju_results")
      .delete()
      .eq("id", id)
      .select("id");

    console.log("[DELETE /api/results]", { id, userId, deletedRows: data?.length ?? 0 });

    if (error) {
      console.error("[RESULTS] delete error", error.message);
      return NextResponse.json({ error: "결과 삭제 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "삭제할 결과를 찾을 수 없습니다." }, { status: 404 });
    }

    // 대표 사주 승계: ON DELETE SET NULL 후 primary_result_id가 NULL이면 다음 결과로 설정
    const { data: currentUser } = await supabaseAdmin
      .from("users")
      .select("primary_result_id")
      .eq("id", userId)
      .single();

    if (!currentUser?.primary_result_id) {
      const { data: nextUnlock } = await supabaseAdmin
        .from("result_unlocks")
        .select("result_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (nextUnlock?.result_id) {
        await supabaseAdmin
          .from("users")
          .update({ primary_result_id: nextUnlock.result_id })
          .eq("id", userId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[DELETE /api/results] 예외", error?.message);
    return NextResponse.json(
      { error: "삭제 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
