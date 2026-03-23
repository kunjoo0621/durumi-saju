import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

export async function GET(request: NextRequest) {
  try {
    const resultId = request.nextUrl.searchParams.get("resultId");
    if (!resultId) {
      return NextResponse.json({ error: "resultId가 필요합니다." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("saju_results")
      .select("id, full_json")
      .eq("id", resultId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[PROGRESS] query error", error.message);
      return NextResponse.json({ status: "error" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    // full_json이 null → 아직 분석 중
    if (data.full_json === null) {
      return NextResponse.json({ status: "pending" });
    }

    // 실패 마커 확인
    if ((data.full_json as any)?._error) {
      return NextResponse.json({ status: "failed", refunded: true });
    }

    return NextResponse.json({ status: "completed" });
  } catch (err: any) {
    console.error("[PROGRESS] error", err?.message);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
