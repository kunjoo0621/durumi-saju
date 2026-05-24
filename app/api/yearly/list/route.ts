import { NextResponse } from "next/server";
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

    const { data: rows, error } = await supabaseAdmin
      .from("yearly_results")
      .select(
        "id, target_year, name, birth_date, birth_time, gender, yearly_pillar, full_json, created_at, source_result_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[YEARLY_LIST] error", error.message);
      return NextResponse.json({ error: "올해 운세 목록 조회 중 오류가 발생했습니다." }, { status: 500 });
    }

    const enriched = (rows ?? [])
      .filter((r: any) => !r.full_json?._error)
      .map((r: any) => {
        const fj = r.full_json ?? {};
        return {
          id: r.id,
          target_year: r.target_year,
          name: r.name,
          birth_date: r.birth_date,
          birth_time: r.birth_time,
          gender: r.gender,
          yearly_pillar: r.yearly_pillar,
          source_result_id: r.source_result_id,
          created_at: r.created_at,
          grade: fj?.tier?.grade ?? null,
          score: fj?.tier?.composite != null ? Math.round(fj.tier.composite) : null,
          title: fj?.tier?.title ?? null,
          tenStar: fj?.yearlyMeta?.tenStar ?? null,
          twelveStage: fj?.yearlyMeta?.twelveStage ?? null,
          pillarKorean: fj?.yearlyMeta?.pillarKorean ?? null,
        };
      });

    return NextResponse.json({ results: enriched });
  } catch (error: any) {
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다.", details: error?.message },
      { status: 500 },
    );
  }
}
