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

    await supabaseAdmin
      .from("profiles")
      // Ensure a profile row exists, but never overwrite an existing balance.
      .upsert(
        { user_id: userId, coin_balance: 0 },
        { onConflict: "user_id", ignoreDuplicates: true }
      );

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("coin_balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ balance: data?.coin_balance ?? 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
