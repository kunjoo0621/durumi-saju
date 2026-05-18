import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";
import { COIN_PACKAGES } from "@/lib/constants/coins";

type ChargeBody = {
  packageId: string;
  orderId: string;
  paymentId?: string;
  amount: number;
  paymentStatus?: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json()) as ChargeBody;
    if (!body.packageId || !body.orderId || !body.amount) {
      return NextResponse.json({ error: "필수 정보가 부족합니다." }, { status: 400 });
    }

    // 패키지 검증
    const pkg = COIN_PACKAGES.find((p) => p.id === body.packageId);
    if (!pkg) {
      return NextResponse.json({ error: "존재하지 않는 패키지입니다." }, { status: 400 });
    }
    if (pkg.price !== Number(body.amount)) {
      return NextResponse.json({ error: "금액이 일치하지 않습니다." }, { status: 400 });
    }

    const mockPayment = process.env.USE_MOCK_PAYMENT === "true";
    let paymentMethod = "mock";

    if (mockPayment) {
      // Mock 모드: orderId + paymentStatus 확인만
      if (body.paymentStatus !== "success") {
        return NextResponse.json({ error: "결제가 완료되지 않았습니다." }, { status: 402 });
      }
    } else {
      // 실결제: PortOne API 검증
      if (!body.paymentId) {
        return NextResponse.json({ error: "결제 정보가 부족합니다." }, { status: 400 });
      }

      const portoneSecret = process.env.PORTONE_API_SECRET;
      if (!portoneSecret) {
        return NextResponse.json({ error: "결제 설정이 누락되었습니다." }, { status: 500 });
      }

      const verifyResponse = await fetch(
        `https://api.portone.io/payments/${encodeURIComponent(body.paymentId)}`,
        { headers: { Authorization: `PortOne ${portoneSecret}` } }
      );

      const paymentData = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok) {
        return NextResponse.json(
          { error: paymentData?.message || "결제 검증에 실패했습니다." },
          { status: 400 }
        );
      }

      if (paymentData.status !== "PAID") {
        return NextResponse.json(
          { error: `결제가 완료되지 않았습니다. (상태: ${paymentData.status})` },
          { status: 400 }
        );
      }

      const paidAmount = paymentData.amount?.total ?? paymentData.amount?.paid;
      if (paidAmount !== Number(body.amount)) {
        return NextResponse.json({ error: "결제 금액이 일치하지 않습니다." }, { status: 400 });
      }

      const verifiedPaymentId = paymentData.id ?? body.paymentId;
      if (verifiedPaymentId !== body.orderId) {
        console.error("[CHARGE] paymentId-orderId mismatch", {
          verified: verifiedPaymentId,
          orderId: body.orderId,
        });
        return NextResponse.json({ error: "결제 정보가 일치하지 않습니다." }, { status: 400 });
      }

      paymentMethod = paymentData.method?.provider || paymentData.method?.type || "portone";
    }

    // payment_transactions upsert (충전 결제 기록)
    await supabaseAdmin
      .from("payment_transactions")
      .upsert(
        {
          user_id: userId,
          order_id: body.orderId,
          method: paymentMethod,
          amount: pkg.price,
          status: "success",
        },
        { onConflict: "order_id", ignoreDuplicates: true }
      );

    // charge_coins RPC 호출
    const rpc = await supabaseAdmin.rpc("charge_coins", {
      p_user_id: userId,
      p_package_id: body.packageId,
      p_order_id: body.orderId,
    });

    if (rpc.error) {
      console.error("[CHARGE] rpc error", rpc.error.message);
      if (rpc.error.message.includes("first_charge_already_used")) {
        return NextResponse.json({ error: "첫 충전 혜택은 이미 사용했습니다." }, { status: 400 });
      }
      return NextResponse.json({ error: "충전 처리 중 오류가 발생했습니다." }, { status: 500 });
    }

    const result = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    // RPC 멱등 가드가 발동하면 charged=0, bonus=0을 반환 (잔액은 현재값).
    // 정상 첫 호출은 charged>0. 이 둘로 멱등 여부를 판정.
    const alreadyCharged = result?.charged === 0 && result?.bonus === 0;
    return NextResponse.json({
      ok: true,
      balance: result?.new_balance ?? 0,
      charged: result?.charged ?? pkg.coinAmount,
      bonus: result?.bonus ?? pkg.bonusAmount,
      alreadyCharged,
    });
  } catch (error: any) {
    console.error("[CHARGE] error", error?.message);
    return NextResponse.json({ error: "충전 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
