// /api/today/start — 입력 검증 + 코인 차감 + row 생성
// yearly start 패턴 미러 + target_date 변형 + hasTodayRequiredInput 사용

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";
import {
  hasTodayRequiredInput,
  markSessionConsumed,
  formatBirthDate,
  formatBirthTime,
  refundCoins,
} from "@/lib/server/session-helpers";
import { TODAY_COST } from "@/lib/constants/coins";

type StartBody = {
  sessionId: string;
  targetDate: string;  // "YYYY-MM-DD"
  sourceResultId?: string | null;  // 대표사주에서 진입
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json()) as StartBody;
    if (!body.sessionId) {
      return NextResponse.json({ error: "세션 정보가 필요합니다." }, { status: 400 });
    }
    if (!body.targetDate || !DATE_REGEX.test(body.targetDate)) {
      return NextResponse.json({ error: "분석 날짜 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const targetDate = body.targetDate;

    // prepayment_sessions 조회
    const pending = await supabaseAdmin
      .from("prepayment_sessions")
      .select("id, input_hash, payload, status, expires_at")
      .eq("id", body.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (pending.error) {
      console.error("[TODAY_START] session lookup", pending.error.message);
      return NextResponse.json({ error: "세션 조회 중 오류가 발생했습니다." }, { status: 500 });
    }
    const sessionRow = pending.data;
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
    // ★ today 전용 검증 (relationshipStatus / coreFearAxis 안 봄 — yearly 0389a00 mismatch 회피)
    if (!hasTodayRequiredInput(input)) {
      return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
    }

    const inputHash =
      typeof sessionRow.input_hash === "string" && sessionRow.input_hash
        ? sessionRow.input_hash
        : buildInputHash(input);

    // ── 기존 결과 재사용: (user_id, input_hash, target_date) ──
    const existingUnlock = await supabaseAdmin
      .from("today_result_unlocks")
      .select("result_id")
      .eq("user_id", userId)
      .eq("input_hash", inputHash)
      .eq("target_date", targetDate)
      .maybeSingle();

    if (existingUnlock.data?.result_id) {
      const existingResultId = existingUnlock.data.result_id;

      // 실패 row 재사용 시 "알만 빠지고 결과 없음" 사고 방지 (29ad160 패턴)
      const { data: existingResult } = await supabaseAdmin
        .from("today_results")
        .select("full_json")
        .eq("id", existingResultId)
        .maybeSingle();

      if ((existingResult?.full_json as any)?._error) {
        // 실패 row 재시도는 신규 결제 — yearly·saju spend route와 동일 정책.
        // 1차 분석 실패 후 환불(+5)을 이미 받았으므로 재시도는 다시 spend.
        // (이게 빠지면 무료 재시도 → 또 실패 → 또 환불 루프로 알 늘어남)
        const retrySpend = await supabaseAdmin.rpc("spend_coins", {
          p_user_id: userId,
          p_amount: TODAY_COST,
          p_reference_id: body.sessionId,
        });
        if (retrySpend.error) {
          console.error("[TODAY_START] retry spend rpc", retrySpend.error.message);
          return NextResponse.json({ error: "알 차감 중 오류가 발생했습니다." }, { status: 500 });
        }
        const retryResult = Array.isArray(retrySpend.data) ? retrySpend.data[0] : retrySpend.data;
        if (!retryResult?.success) {
          return NextResponse.json({
            insufficient: true,
            balance: retryResult?.new_balance ?? 0,
            required: TODAY_COST,
          });
        }

        await supabaseAdmin
          .from("today_results")
          .update({ full_json: null, teaser_json: null })
          .eq("id", existingResultId);
        await markSessionConsumed(body.sessionId, userId);
        return NextResponse.json({
          ok: true,
          resultId: existingResultId,
          pending: true,
          balance: retryResult.new_balance,
        });
      }

      await markSessionConsumed(body.sessionId, userId);
      return NextResponse.json({
        ok: true,
        reused: true,
        resultId: existingResultId,
      });
    }

    // 코인 차감 (spend_coins RPC, TODAY_COST = 5)
    const spendRpc = await supabaseAdmin.rpc("spend_coins", {
      p_user_id: userId,
      p_amount: TODAY_COST,
      p_reference_id: body.sessionId,
    });

    if (spendRpc.error) {
      console.error("[TODAY_START] spend rpc", spendRpc.error.message);
      return NextResponse.json({ error: "알 차감 중 오류가 발생했습니다." }, { status: 500 });
    }

    const spendResult = Array.isArray(spendRpc.data) ? spendRpc.data[0] : spendRpc.data;
    if (!spendResult?.success) {
      return NextResponse.json({
        insufficient: true,
        balance: spendResult?.new_balance ?? 0,
        required: TODAY_COST,
      });
    }

    try {
      const birthDate = formatBirthDate(input);
      const birthTime = formatBirthTime(input);

      // pending today_results row 생성
      const upserted = await supabaseAdmin
        .from("today_results")
        .upsert(
          {
            user_id: userId,
            source_result_id: body.sourceResultId ?? null,
            input_hash: inputHash,
            target_date: targetDate,
            name: input.name,
            birth_date: birthDate,
            birth_time: birthTime,
            region: input.birthLocation,
            gender: input.gender,
            relationship_status: input.relationshipStatus || null,
            employment_status: input.employmentStatus || null,
            calendar_type: input.calendarType,
            core_fear_axis: input.coreFearAxis || null,
            saju_text: null,
            today_pillar: null,
            today_mood: null,
            today_weather_icon: null,
            branch_relation_type: null,
            stem_relation_label: null,
            ten_star: null,
            teaser_json: null,
            full_json: null,
            unlocked_at: new Date().toISOString(),
          },
          { onConflict: "user_id,input_hash,target_date" },
        )
        .select("id")
        .maybeSingle();

      if (upserted.error || !upserted.data?.id) {
        console.error("[TODAY_START] result upsert", upserted.error?.message);
        await refundCoins(userId, TODAY_COST, body.sessionId);
        return NextResponse.json(
          { error: "결과 저장 중 오류가 발생했습니다.", refunded: true },
          { status: 500 },
        );
      }

      const resultId = upserted.data.id;
      const orderId = `egg_today_${targetDate}_${Date.now()}_${userId.slice(0, 8)}`;

      // ★ 중복 요청 race 가드: unlock insert를 plain insert로 명시.
      // (user_id, input_hash, target_date) unique 충돌 시 = 다른 요청이 먼저 차감·등록함.
      // 우리 차감은 손실 — 환불 후 기존 unlock의 result_id 반환.
      const unlockInsert = await supabaseAdmin
        .from("today_result_unlocks")
        .insert({
          user_id: userId,
          result_id: resultId,
          input_hash: inputHash,
          target_date: targetDate,
          order_id: orderId,
        });

      if (unlockInsert.error) {
        // PostgreSQL unique_violation = 23505. user_input_date 또는 order_id 충돌.
        if (unlockInsert.error.code === "23505") {
          // 다른 요청이 먼저 처리 — 우리 차감 환불 + 기존 unlock 재사용
          await refundCoins(userId, TODAY_COST, body.sessionId);
          const { data: priorUnlock } = await supabaseAdmin
            .from("today_result_unlocks")
            .select("result_id")
            .eq("user_id", userId)
            .eq("input_hash", inputHash)
            .eq("target_date", targetDate)
            .maybeSingle();
          await markSessionConsumed(body.sessionId, userId);
          return NextResponse.json({
            ok: true,
            reused: true,
            resultId: priorUnlock?.result_id || resultId,
            refunded: true,
          });
        }
        // 그 외 에러 — 환불 후 실패
        console.error("[TODAY_START] unlock insert", unlockInsert.error.message);
        await refundCoins(userId, TODAY_COST, body.sessionId);
        return NextResponse.json(
          { error: "결제 기록 저장 중 오류가 발생했습니다.", refunded: true },
          { status: 500 },
        );
      }

      await markSessionConsumed(body.sessionId, userId);

      return NextResponse.json({
        ok: true,
        resultId,
        balance: spendResult.new_balance,
        pending: true,
      });
    } catch (err: any) {
      console.error("[TODAY_START] pre-analysis", err?.message);
      await refundCoins(userId, TODAY_COST, body.sessionId);
      return NextResponse.json(
        { error: "분석 준비 중 오류가 발생했습니다. 알은 환불되었습니다.", refunded: true },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("[TODAY_START] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
