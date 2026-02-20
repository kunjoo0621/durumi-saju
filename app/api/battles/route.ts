import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

const LIST_COLUMNS = [
  "id",
  "player_a_name",
  "player_b_name",
  "player_a_grade",
  "player_b_grade",
  "overall_winner",
  "overall_intensity",
  "wins_a",
  "wins_b",
  "draws",
  "relationship_type",
  "created_at",
].join(", ");

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { data: battles, error } = await supabaseAdmin
      .from("saju_battles")
      .select(LIST_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ battles: battles ?? [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: "배틀 목록 조회 중 오류가 발생했습니다.", details: error?.message },
      { status: 500 },
    );
  }
}
