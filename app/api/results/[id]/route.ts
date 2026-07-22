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

    // 감사 로그용: 삭제 직전 결과 정보 확보(하드 삭제되면 사라지므로 미리 읽는다).
    // 이 조회 실패는 삭제를 막지 않는다 — 감사는 부가 기능.
    const { data: victim } = await supabaseAdmin
      .from("saju_results")
      .select("input_hash, name, birth_date, full_json")
      .eq("id", id)
      .maybeSingle();

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

    // 감사 로그: "본인 삭제"임을 기록해, 이후 결제-무결과 케이스에서 삭제/손실을 구분한다.
    // 실패해도 삭제는 이미 성공했으므로 막지 않는다(로그만).
    try {
      const fj = victim?.full_json as { _error?: boolean } | null | undefined;
      const { error: auditErr } = await supabaseAdmin.from("result_deletions").insert({
        user_id: userId,
        result_id: id,
        input_hash: victim?.input_hash ?? null,
        name: victim?.name ?? null,
        birth_date: victim?.birth_date ?? null,
        was_delivered: fj != null && !fj._error,
      });
      if (auditErr) {
        console.error("[DELETE /api/results] 감사 로그 적재 실패(삭제는 완료)", auditErr.message);
      }
    } catch (auditErr: any) {
      console.error("[DELETE /api/results] 감사 로그 예외(삭제는 완료)", auditErr?.message);
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
