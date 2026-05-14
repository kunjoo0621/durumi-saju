import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";
import { hasRequiredInput, markSessionConsumed, autoSetPrimaryIfNeeded, formatBirthDate, formatBirthTime, refundCoins } from "@/lib/server/session-helpers";
import { SAJU_COST, BATTLE_COST } from "@/lib/constants/coins";

type SpendBody = {
  sessionId: string;
  type: "analysis" | "battle";
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json()) as SpendBody;
    if (!body.sessionId) {
      return NextResponse.json({ error: "세션 정보가 필요합니다." }, { status: 400 });
    }

    const isBattle = body.type === "battle";
    const cost = isBattle ? BATTLE_COST : SAJU_COST;

    // prepayment_sessions 조회
    const pendingSession = await supabaseAdmin
      .from("prepayment_sessions")
      .select("id, input_hash, payload, status, expires_at")
      .eq("id", body.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (pendingSession.error) {
      console.error("[SPEND] session lookup error", pendingSession.error.message);
      return NextResponse.json({ error: "세션 조회 중 오류가 발생했습니다." }, { status: 500 });
    }

    const sessionRow = pendingSession.data;
    if (!sessionRow) {
      return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    }

    if (
      sessionRow.status === "pending" &&
      sessionRow.expires_at &&
      new Date(sessionRow.expires_at).getTime() < Date.now()
    ) {
      return NextResponse.json({ error: "세션이 만료되었습니다." }, { status: 410 });
    }

    const input = sessionRow.payload as InputPayload;

    if (isBattle) {
      if (!input?.name || !input.birthYear || !input.birthMonth || !input.birthDay || !input.birthLocation || !input.gender) {
        return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
      }
    } else if (!hasRequiredInput(input)) {
      return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
    }

    // spend_coins RPC 호출
    const spendRpc = await supabaseAdmin.rpc("spend_coins", {
      p_user_id: userId,
      p_amount: cost,
      p_reference_id: body.sessionId,
    });

    if (spendRpc.error) {
      console.error("[SPEND] rpc error", spendRpc.error.message);
      return NextResponse.json({ error: "알 차감 중 오류가 발생했습니다." }, { status: 500 });
    }

    const spendResult = Array.isArray(spendRpc.data) ? spendRpc.data[0] : spendRpc.data;
    if (!spendResult?.success) {
      return NextResponse.json({
        insufficient: true,
        balance: spendResult?.new_balance ?? 0,
        required: cost,
      });
    }

    // ============ 배틀: 알 차감만, 분석 안 함 ============
    if (isBattle) {
      const orderId = `egg_battle_${Date.now()}_${userId.slice(0, 8)}`;
      await supabaseAdmin
        .from("payment_transactions")
        .upsert(
          {
            user_id: userId,
            order_id: orderId,
            method: "egg",
            amount: 0,
            status: "success",
          },
          { onConflict: "order_id", ignoreDuplicates: true }
        );

      await markSessionConsumed(body.sessionId, userId);
      return NextResponse.json({
        ok: true,
        type: "battle",
        balance: spendResult.new_balance,
      });
    }

    // ============ 사주 분석: 기존 payment/complete 로직 이동 ============
    const inputHash =
      typeof sessionRow.input_hash === "string" && sessionRow.input_hash
        ? sessionRow.input_hash
        : buildInputHash(input);

    try {
      // 기존 결과 재사용 확인
      const existingUnlock = await supabaseAdmin
        .from("result_unlocks")
        .select("result_id")
        .eq("user_id", userId)
        .eq("input_hash", inputHash)
        .maybeSingle();

      if (existingUnlock.data?.result_id) {
        const existingResultId = existingUnlock.data.result_id;

        // 기존 row가 실패 상태(_error)면 재사용 시 "알만 빠지고 결과 없음" 발생.
        // full_json을 null로 리셋해 pending 상태로 되돌리고, 클라이언트가
        // /api/results/analyze 호출해 재분석하도록 흐름을 다시 태운다.
        const { data: existingResult } = await supabaseAdmin
          .from("saju_results")
          .select("full_json")
          .eq("id", existingResultId)
          .maybeSingle();

        if ((existingResult?.full_json as any)?._error) {
          await supabaseAdmin
            .from("saju_results")
            .update({ full_json: null, teaser_json: null, saju_text: null })
            .eq("id", existingResultId);
          await markSessionConsumed(body.sessionId, userId);
          return NextResponse.json({
            ok: true,
            resultId: existingResultId,
            balance: spendResult.new_balance,
            pending: true,
          });
        }

        // 정상 결과 — 재사용 (scoring은 results/full에서 on-the-fly 업그레이드)
        await markSessionConsumed(body.sessionId, userId);
        return NextResponse.json({
          ok: true,
          reused: true,
          resultId: existingResultId,
          balance: spendResult.new_balance,
        });
      }

      const birthDate = formatBirthDate(input);
      const birthTime = formatBirthTime(input);

      // 빈 result row 생성 (pending 상태 — full_json: null)
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
            saju_text: null,
            teaser_json: null,
            full_json: null,
            unlocked_at: new Date().toISOString(),
          },
          { onConflict: "user_id,input_hash" }
        )
        .select("id")
        .maybeSingle();

      if (upserted.error || !upserted.data?.id) {
        console.error("[SPEND] result upsert error", upserted.error?.message);
        await refundCoins(userId, cost, body.sessionId);
        return NextResponse.json({
          error: "결과 저장 중 오류가 발생했습니다.",
          refunded: true,
        }, { status: 500 });
      }

      const resultId = upserted.data.id;

      // result_unlocks + 세션 처리
      const orderId = `egg_analysis_${Date.now()}_${userId.slice(0, 8)}`;
      await Promise.all([
        supabaseAdmin
          .from("result_unlocks")
          .upsert(
            {
              user_id: userId,
              result_id: resultId,
              input_hash: inputHash,
              order_id: orderId,
            },
            { onConflict: "order_id", ignoreDuplicates: true }
          ),
        markSessionConsumed(body.sessionId, userId),
        autoSetPrimaryIfNeeded(userId, inputHash),
      ]);

      // 즉시 반환 (~300ms) — 분석은 클라이언트가 /api/results/analyze 호출로 트리거
      return NextResponse.json({
        ok: true,
        resultId,
        balance: spendResult.new_balance,
        pending: true,
      });
    } catch (err: any) {
      console.error("[SPEND] pre-analysis setup failed, refunding", err?.message);
      await refundCoins(userId, cost, body.sessionId);
      return NextResponse.json({
        error: "분석 준비 중 오류가 발생했습니다. 알은 환불되었습니다.",
        refunded: true,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[SPEND] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
