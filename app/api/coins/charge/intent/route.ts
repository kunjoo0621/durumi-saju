import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";
import { COIN_PACKAGES } from "@/lib/constants/coins";

// charge_orders 기반 결제 시작 endpoint (Stripe payment_intents 패턴).
// 5/N: 전체 사용자 신구조 전환 — 운영자 production 실결제(2/N, 4/N) 검증 후 gate 제거.
// 모든 로그인 사용자가 server-issued orderId 사용.
//
// intent 실패 시 클라이언트는 결제를 시작하지 않음 (useCharge에서 throw).
// fallback 절대 X — 우슬기 사고는 클라이언트 randomUUID 흐름의 redirect 끊김 때문이라
// fallback 열면 같은 사고 재발 위험.

type IntentBody = {
  packageId: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json()) as IntentBody;
    if (!body.packageId) {
      return NextResponse.json({ error: "패키지 정보가 필요합니다." }, { status: 400 });
    }

    const pkg = COIN_PACKAGES.find((p) => p.id === body.packageId);
    if (!pkg) {
      return NextResponse.json({ error: "존재하지 않는 패키지입니다." }, { status: 400 });
    }

    const orderId = randomUUID();
    const { error } = await supabaseAdmin.from("charge_orders").insert({
      order_id: orderId,
      user_id: userId,
      package_id: body.packageId,
      amount: pkg.price,
      status: "pending",
    });

    if (error) {
      console.error("[INTENT] charge_orders insert error", error.message);
      return NextResponse.json(
        { error: "결제 준비 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ orderId, amount: pkg.price });
  } catch (error: any) {
    console.error("[INTENT] error", error?.message);
    return NextResponse.json(
      { error: "결제 준비 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
