import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, buildTeaserFromFull, resolveSajuText, runFullAnalysis, type InputPayload } from "@/lib/analysis";
import { SCORING_VERSION } from "@/lib/utils/saju-scoring";
import { getSupabaseUserId } from "@/lib/server/user";
import { hashToken, getTokensFromCookie, getDbExpiresAt } from "@/lib/guest-token";

type PaymentCompleteBody = {
  sessionId?: string;
  orderId?: string;
  paymentKey?: string;
  amount?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  type?: string;
};

function hasRequiredInput(input: InputPayload) {
  if (
    !input?.name ||
    !input.birthYear ||
    !input.birthMonth ||
    !input.birthDay ||
    !input.birthLocation ||
    !input.gender ||
    !input.relationshipStatus ||
    !input.employmentStatus ||
    !input.coreFearAxis
  ) {
    return false;
  }

  if (!input.unknownBirthTime && (!input.birthHour || !input.birthMinute)) {
    return false;
  }

  return true;
}

async function markSessionConsumed(
  sessionId: string,
  userId: string | null,
  guestTokenHash: string | null,
) {
  const query = supabaseAdmin
    .from("prepayment_sessions")
    .update({
      status: "consumed",
      consumed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("status", "pending");

  if (userId) {
    query.eq("user_id", userId);
  } else if (guestTokenHash) {
    query.eq("guest_token_hash", guestTokenHash);
  }

  const { error } = await query;

  if (error) {
    console.error("[markSessionConsumed] failed:", { sessionId, error: error.message });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PaymentCompleteBody;
    if (!body.sessionId) {
      return NextResponse.json({ error: "결제 세션이 필요합니다." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user ? await getSupabaseUserId(session) : null;
    const guestTokens = await getTokensFromCookie();
    const latestGuestToken = guestTokens[0] || null;

    if (!userId && !latestGuestToken) {
      return NextResponse.json({ error: "인증 정보 없음" }, { status: 401 });
    }

    const guestTokenHash = latestGuestToken ? hashToken(latestGuestToken) : null;
    const isGuest = !userId;

    // prepayment_sessions 조회: userId 또는 guestTokenHash로 매칭
    let sessionQuery = supabaseAdmin
      .from("prepayment_sessions")
      .select("id, input_hash, payload, status, expires_at")
      .eq("id", body.sessionId);

    if (userId) {
      sessionQuery = sessionQuery.eq("user_id", userId);
    } else {
      sessionQuery = sessionQuery.eq("guest_token_hash", guestTokenHash!);
    }

    const pendingSession = await sessionQuery.maybeSingle();

    if (pendingSession.error) {
      return NextResponse.json({ error: pendingSession.error.message }, { status: 500 });
    }

    const sessionRow = pendingSession.data;
    if (!sessionRow) {
      return NextResponse.json({ error: "결제 세션을 찾을 수 없습니다." }, { status: 404 });
    }

    if (
      sessionRow.status === "pending" &&
      sessionRow.expires_at &&
      new Date(sessionRow.expires_at).getTime() < Date.now()
    ) {
      return NextResponse.json({ error: "결제 세션이 만료되었습니다." }, { status: 410 });
    }

    const isBattle = body.type === "battle";
    const input = sessionRow.payload as InputPayload;

    if (isBattle) {
      if (!input?.name || !input.birthYear || !input.birthMonth || !input.birthDay || !input.birthLocation || !input.gender) {
        return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
      }
    } else if (!hasRequiredInput(input)) {
      return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
    }

    const mockPayment = process.env.USE_MOCK_PAYMENT === "true";
    let paymentMethod = body.paymentMethod || "mock";
    let amount = Number(body.amount ?? 1000);

    if (mockPayment) {
      if (!body.orderId || body.paymentStatus !== "success") {
        return NextResponse.json({ error: "결제가 완료되지 않았습니다." }, { status: 402 });
      }
    } else {
      if (!body.orderId || !body.paymentKey || !body.amount) {
        return NextResponse.json({ error: "결제 정보가 부족합니다." }, { status: 400 });
      }

      if (![1000, 2000].includes(Number(body.amount))) {
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

      paymentMethod = confirmData?.method || "toss";
      amount = Number(body.amount);
    }

    // 배틀 결제: 결제 확인만 하고 분석은 클라이언트에서 /api/battle/analyze 호출
    if (isBattle) {
      const inputHash =
        typeof sessionRow.input_hash === "string" && sessionRow.input_hash
          ? sessionRow.input_hash
          : buildInputHash(input);

      await supabaseAdmin
        .from("payment_transactions")
        .upsert(
          {
            user_id: userId,
            order_id: body.orderId,
            method: paymentMethod,
            amount,
            status: "success",
          },
          { onConflict: "order_id", ignoreDuplicates: true }
        );

      await markSessionConsumed(body.sessionId!, userId, guestTokenHash);
      return NextResponse.json({ ok: true, type: "battle" });
    }

    const inputHash =
      typeof sessionRow.input_hash === "string" && sessionRow.input_hash
        ? sessionRow.input_hash
        : buildInputHash(input);

    // ============ 로그인 사용자: 기존 로직 100% 유지 ============
    if (!isGuest) {
      const existingUnlock = await supabaseAdmin
        .from("result_unlocks")
        .select("result_id")
        .eq("user_id", userId)
        .eq("input_hash", inputHash)
        .maybeSingle();

      if (existingUnlock.data?.result_id) {
        // 스코어링 버전 확인 — 구버전이면 재계산
        const { data: existingForVersion } = await supabaseAdmin
          .from("saju_results")
          .select("full_json")
          .eq("id", existingUnlock.data.result_id)
          .maybeSingle();
        const storedVersion = (existingForVersion?.full_json as any)?.scoringVersion ?? 0;
        if (storedVersion >= SCORING_VERSION) {
          await markSessionConsumed(body.sessionId, userId, null);
          return NextResponse.json({ ok: true, reused: true });
        }
        console.info("[SCORING_UPGRADE] recomputing stale result", {
          resultId: existingUnlock.data.result_id,
          storedVersion,
          currentVersion: SCORING_VERSION,
        });
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
          const storedVer = (existingResult.data.full_json as any)?.scoringVersion ?? 0;
          if (storedVer >= SCORING_VERSION) {
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

            await markSessionConsumed(body.sessionId, userId, null);
            return NextResponse.json({ ok: true, reused: true });
          }
          console.info("[SCORING_UPGRADE] payment re-run: stale result", {
            resultId: existingResult.data.id,
            storedVersion: storedVer,
            currentVersion: SCORING_VERSION,
          });
        }
        forceUnlock = true;
      }

      const sajuText = await resolveSajuText(input);
      const full = await runFullAnalysis({ ...input, saju: sajuText || input.saju });
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
              core_fear_axis: input.coreFearAxis || null,
              saju_text: sajuText,
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

        await markSessionConsumed(body.sessionId, userId, null);
        return NextResponse.json({ ok: true, reused: true });
      }

      const rpc = await supabaseAdmin.rpc("process_payment_unlock", {
        p_user_id: userId,
        p_order_id: body.orderId,
        p_method: paymentMethod,
        p_amount: amount,
        p_input_hash: inputHash,
        p_name: input.name,
        p_birth_date: birthDate,
        p_birth_time: birthTime,
        p_region: input.birthLocation,
        p_gender: input.gender,
        p_relationship_status: input.relationshipStatus,
        p_employment_status: input.employmentStatus,
        p_calendar_type: input.calendarType,
        p_core_fear_axis: input.coreFearAxis || null,
        p_saju_text: sajuText,
        p_teaser: teaser,
        p_full: full,
      });

      if (rpc.error) {
        return NextResponse.json({ error: rpc.error.message }, { status: 500 });
      }

      await markSessionConsumed(body.sessionId, userId, null);

      const payload = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      return NextResponse.json({ ok: true, reused: Boolean(payload?.reused) });
    }

    // ============ guest: RPC 우회, 직접 INSERT ============

    const sajuText = await resolveSajuText(input);
    const full = await runFullAnalysis({ ...input, saju: sajuText || input.saju });
    const teaser = buildTeaserFromFull(full);

    const birthDate =
      input.birthYear && input.birthMonth && input.birthDay
        ? `${input.birthYear}-${input.birthMonth.padStart(2, "0")}-${input.birthDay.padStart(2, "0")}`
        : null;
    const birthTime =
      !input.unknownBirthTime && input.birthHour && input.birthMinute
        ? `${input.birthHour.padStart(2, "0")}:${input.birthMinute.padStart(2, "0")}`
        : null;

    // saju_results INSERT (UPSERT 아님 — NULL user_id는 unique constraint 미동작)
    const { data: resultData, error: resultError } = await supabaseAdmin
      .from("saju_results")
      .insert({
        user_id: null,
        guest_token_hash: guestTokenHash,
        guest_token_expires_at: getDbExpiresAt(),
        order_id: body.orderId,
        input_hash: inputHash,
        name: input.name,
        birth_date: birthDate,
        birth_time: birthTime,
        region: input.birthLocation,
        gender: input.gender,
        relationship_status: input.relationshipStatus,
        employment_status: input.employmentStatus,
        calendar_type: input.calendarType,
        core_fear_axis: input.coreFearAxis || null,
        saju_text: sajuText,
        teaser_json: teaser,
        full_json: full,
        unlocked_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (resultError || !resultData?.id) {
      return NextResponse.json({ error: resultError?.message || "결과 저장 실패" }, { status: 500 });
    }

    // payment_transactions INSERT (user_id null)
    await supabaseAdmin
      .from("payment_transactions")
      .upsert(
        {
          user_id: null,
          order_id: body.orderId,
          method: paymentMethod,
          amount,
          status: "success",
        },
        { onConflict: "order_id", ignoreDuplicates: true }
      );

    // result_unlocks 스킵 — claim 시 RPC가 자동 생성

    await markSessionConsumed(body.sessionId, null, guestTokenHash);

    return NextResponse.json({ ok: true, resultId: resultData.id });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "결제 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
