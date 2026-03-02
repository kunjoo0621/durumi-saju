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
  "full_result",
].join(", ");

type BattleRow = {
  id: string;
  player_a_name: string;
  player_b_name: string;
  player_a_grade: string;
  player_b_grade: string;
  overall_winner: string;
  overall_intensity: string;
  wins_a: number;
  wins_b: number;
  draws: number;
  relationship_type: string;
  created_at: string;
  full_result?: { playerA?: { tier?: { composite?: number } }; playerB?: { tier?: { composite?: number } } };
};

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

    const slim = ((battles ?? []) as unknown as BattleRow[]).map(({ full_result, ...rest }) => ({
      ...rest,
      player_a_composite: full_result?.playerA?.tier?.composite ?? null,
      player_b_composite: full_result?.playerB?.tier?.composite ?? null,
    }));

    return NextResponse.json({ battles: slim });
  } catch (error: any) {
    return NextResponse.json(
      { error: "배틀 목록 조회 중 오류가 발생했습니다.", details: error?.message },
      { status: 500 },
    );
  }
}
