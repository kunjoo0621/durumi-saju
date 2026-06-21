import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

// 결과 공유 보상: 인증 사용자 최초 1회만 5알 지급 (멱등은 RPC가 보장).
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin.rpc("grant_share_reward", {
      p_user_id: userId,
    });

    if (error) {
      console.error("[SHARE_REWARD] rpc error", error.message);
      return NextResponse.json({ error: "지급 중 오류가 발생했습니다." }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      granted: !!row?.success,
      amount: row?.reward_amount ?? 0,
      balance: row?.new_balance ?? 0,
    });
  } catch (error: any) {
    console.error("[SHARE_REWARD] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
