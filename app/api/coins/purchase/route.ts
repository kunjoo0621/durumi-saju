import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

export async function POST(request: NextRequest) {
  try {
    const mockPayment = process.env.USE_MOCK_PAYMENT === "true";
    if (!mockPayment) {
      return NextResponse.json({ error: "Deprecated" }, { status: 410 });
    }

    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const amount = Number(body?.amount ?? 1);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10) {
      return NextResponse.json({ error: "유효하지 않은 수량입니다." }, { status: 400 });
    }

    const purchase = await supabaseAdmin.rpc("purchase_coins", {
      p_user_id: userId,
      p_amount: amount,
    });

    if (purchase.error) {
      return NextResponse.json({ error: purchase.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, balance: purchase.data?.balance ?? null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "구매 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
