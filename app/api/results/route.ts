import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({ error: "Deprecated" }, { status: 410 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "저장 중 오류가 발생했습니다.", details: error?.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { data: unlocks, error: unlockError } = await supabaseAdmin
      .from("result_unlocks")
      .select("result_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (unlockError) {
      return NextResponse.json({ error: unlockError.message }, { status: 500 });
    }

    if (!unlocks || unlocks.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const resultIds = unlocks.map((item) => item.result_id);
    const { data: results, error } = await supabaseAdmin
      .from("saju_results")
      .select(
        "id, name, birth_date, birth_time, region, gender, calendar_type, unlocked_at, created_at"
      )
      .eq("user_id", userId)
      .in("id", resultIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const resultMap = new Map(results?.map((item) => [item.id, item]));
    const ordered = unlocks
      .map((item) => resultMap.get(item.result_id))
      .filter(Boolean);

    return NextResponse.json({ results: ordered });
  } catch (error: any) {
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다.", details: error?.message },
      { status: 500 }
    );
  }
}
