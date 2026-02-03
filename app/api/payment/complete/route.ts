import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, buildTeaserFromFull, runFullAnalysis, type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InputPayload & {
      orderId?: string;
      paymentKey?: string;
      amount?: number;
    };
    const input = body as InputPayload;
    if (
      !input?.name ||
      !input.birthYear ||
      !input.birthMonth ||
      !input.birthDay ||
      !input.birthLocation ||
      !input.gender ||
      !input.relationshipStatus ||
      !input.employmentStatus
    ) {
      return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    if (!body.orderId || !body.paymentKey || !body.amount) {
      return NextResponse.json({ error: "결제 정보가 부족합니다." }, { status: 400 });
    }

    if (Number(body.amount) !== 1000) {
      return NextResponse.json({ error: "결제 금액이 올바르지 않습니다." }, { status: 400 });
    }

    const tossSecretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;
    if (!tossSecretKey) {
      return NextResponse.json({ error: "결제 설정이 누락되었습니다." }, { status: 500 });
    }

    const authHeader = Buffer.from(`${tossSecretKey}:`).toString("base64");
    const confirmResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentKey: body.paymentKey,
        orderId: body.orderId,
        amount: Number(body.amount),
      }),
    });

    const confirmData = await confirmResponse.json().catch(() => ({}));
    if (!confirmResponse.ok) {
      return NextResponse.json(
        { error: confirmData?.message || "결제 승인에 실패했습니다." },
        { status: 400 }
      );
    }

    const paymentMethod = confirmData?.method || "toss";

    const inputHash = buildInputHash(input);

    const existingUnlock = await supabaseAdmin
      .from("result_unlocks")
      .select("result_id")
      .eq("user_id", userId)
      .eq("input_hash", inputHash)
      .maybeSingle();

    if (existingUnlock.data?.result_id) {
      return NextResponse.json({ ok: true, reused: true });
    }

    const existingPayment = await supabaseAdmin
      .from("payment_transactions")
      .select("status")
      .eq("order_id", body.orderId)
      .maybeSingle();

    if (existingPayment.data?.status === "failed") {
      return NextResponse.json({ error: "이미 실패한 결제입니다." }, { status: 400 });
    }

    let forceUnlock = false;
    if (existingPayment.data?.status === "success") {
      const existingResult = await supabaseAdmin
        .from("saju_results")
        .select("id, full_json")
        .eq("user_id", userId)
        .eq("input_hash", inputHash)
        .maybeSingle();

      if (existingResult.data?.full_json) {
        const unlockUpsert = await supabaseAdmin
          .from("result_unlocks")
          .upsert(
            {
              user_id: userId,
              result_id: existingResult.data.id,
              input_hash: inputHash,
              order_id: body.orderId,
            },
            { onConflict: "order_id", ignoreDuplicates: true }
          )
          .select("id")
          .maybeSingle();
        if (unlockUpsert.error) {
          return NextResponse.json({ error: unlockUpsert.error.message }, { status: 500 });
        }
        return NextResponse.json({ ok: true, reused: true });
      }
      forceUnlock = true;
    }

    const full = await runFullAnalysis(input);
    const teaser = buildTeaserFromFull(full);

    const birthDate =
      input.birthYear && input.birthMonth && input.birthDay
        ? `${input.birthYear}-${input.birthMonth.padStart(2, "0")}-${input.birthDay.padStart(2, "0")}`
        : null;
    const birthTime =
      !input.unknownBirthTime && input.birthHour && input.birthMinute
        ? `${input.birthHour.padStart(2, "0")}:${input.birthMinute.padStart(2, "0")}`
        : null;

    if (forceUnlock) {
      const upserted = await supabaseAdmin
        .from("saju_results")
        .upsert(
          {
            user_id: userId,
            input_hash: inputHash,
            name: input.name,
            birth_date: birthDate,
            birth_time: birthTime,
            region: input.birthLocation,
            gender: input.gender,
            relationship_status: input.relationshipStatus,
            employment_status: input.employmentStatus,
            calendar_type: input.calendarType,
            teaser_json: teaser,
            full_json: full,
            unlocked_at: new Date().toISOString(),
          },
          { onConflict: "user_id,input_hash" }
        )
        .select("id")
        .maybeSingle();

      if (upserted.error || !upserted.data?.id) {
        return NextResponse.json({ error: upserted.error?.message || "결과 저장 실패" }, { status: 500 });
      }

      const unlockUpsert = await supabaseAdmin
        .from("result_unlocks")
        .upsert(
          {
            user_id: userId,
            result_id: upserted.data.id,
            input_hash: inputHash,
            order_id: body.orderId,
          },
          { onConflict: "order_id", ignoreDuplicates: true }
        )
        .select("id")
        .maybeSingle();

      if (unlockUpsert.error) {
        return NextResponse.json({ error: unlockUpsert.error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, reused: true });
    }

    const rpc = await supabaseAdmin.rpc("process_payment_unlock", {
      p_user_id: userId,
      p_order_id: body.orderId,
      p_method: paymentMethod,
      p_amount: 1000,
      p_input_hash: inputHash,
      p_name: input.name,
      p_birth_date: birthDate,
      p_birth_time: birthTime,
      p_region: input.birthLocation,
      p_gender: input.gender,
      p_relationship_status: input.relationshipStatus,
      p_employment_status: input.employmentStatus,
      p_calendar_type: input.calendarType,
      p_teaser: teaser,
      p_full: full,
    });

    if (rpc.error) {
      return NextResponse.json({ error: rpc.error.message }, { status: 500 });
    }

    const payload = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    return NextResponse.json({ ok: true, reused: Boolean(payload?.reused) });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "결제 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
