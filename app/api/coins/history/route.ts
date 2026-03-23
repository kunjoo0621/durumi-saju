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

    const { data, error } = await supabaseAdmin
      .from("coin_transactions")
      .select("id, type, amount, balance_after, created_at, package_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[COINS] history query error", error.message);
      return NextResponse.json({ error: "내역 조회 중 오류가 발생했습니다." }, { status: 500 });
    }

    return NextResponse.json({ transactions: data ?? [] });
  } catch (error: any) {
    console.error("[COINS] history error", error?.message);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
