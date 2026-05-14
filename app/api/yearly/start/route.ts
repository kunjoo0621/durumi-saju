import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";
import {
  hasRequiredInput,
  markSessionConsumed,
  formatBirthDate,
  formatBirthTime,
  refundCoins,
} from "@/lib/server/session-helpers";
import { YEARLY_COST } from "@/lib/constants/coins";

type StartBody = {
  sessionId: string;
  targetYear: number;
  sourceResultId?: string | null;  // 대표사주에서 진입했을 때
};

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

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
    const targetYear = Number(body.targetYear);
    if (!Number.isFinite(targetYear) || targetYear < YEAR_MIN || targetYear > YEAR_MAX) {
      return NextResponse.json({ error: "분석 연도가 올바르지 않습니다." }, { status: 400 });
    }

    // prepayment_sessions 조회
    const pending = await supabaseAdmin
      .from("prepayment_sessions")
      .select("id, input_hash, payload, status, expires_at")
      .eq("id", body.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (pending.error) {
      console.error("[YEARLY_START] session lookup", pending.error.message);
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
    if (!hasRequiredInput(input)) {
      return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
    }

    const inputHash =
      typeof sessionRow.input_hash === "string" && sessionRow.input_hash
        ? sessionRow.input_hash
        : buildInputHash(input);

    // ── 기존 결과 재사용: (user_id, input_hash, target_year) ──
    const existingUnlock = await supabaseAdmin
      .from("yearly_result_unlocks")
      .select("result_id")
      .eq("user_id", userId)
      .eq("input_hash", inputHash)
      .eq("target_year", targetYear)
      .maybeSingle();

    if (existingUnlock.data?.result_id) {
      const existingResultId = existingUnlock.data.result_id;

      // 기존 row가 실패 상태(_error)면 재사용 시 "알만 빠지고 결과 없음" 발생.
      // full_json/teaser_json을 null로 리셋해 pending 상태로 되돌리고, 클라이언트가
      // /api/yearly/analyze 호출해 재분석하도록 흐름을 다시 태운다.
      // (saju 핫픽스 6d4a822와 동일 패턴)
      const { data: existingResult } = await supabaseAdmin
        .from("yearly_results")
        .select("full_json")
        .eq("id", existingResultId)
        .maybeSingle();

      if ((existingResult?.full_json as any)?._error) {
        // 실패 row 재시도는 무료가 아니라 재결제 — saju spend route와 동일 정책.
        // 1차 분석 실패 후 환불(+10)을 이미 받았으므로 재시도는 신규 결제로 처리.
        const retrySpend = await supabaseAdmin.rpc("spend_coins", {
          p_user_id: userId,
          p_amount: YEARLY_COST,
          p_reference_id: body.sessionId,
        });
        if (retrySpend.error) {
          console.error("[YEARLY_START] retry spend rpc", retrySpend.error.message);
          return NextResponse.json({ error: "알 차감 중 오류가 발생했습니다." }, { status: 500 });
        }
        const retryResult = Array.isArray(retrySpend.data) ? retrySpend.data[0] : retrySpend.data;
        if (!retryResult?.success) {
          return NextResponse.json({
            insufficient: true,
            balance: retryResult?.new_balance ?? 0,
            required: YEARLY_COST,
          });
        }

        await supabaseAdmin
          .from("yearly_results")
          .update({ full_json: null, teaser_json: null })
          .eq("id", existingResultId);
        await markSessionConsumed(body.sessionId, userId);
        return NextResponse.json({
          ok: true,
          resultId: existingResultId,
          balance: retryResult.new_balance,
          pending: true,
        });
      }

      await markSessionConsumed(body.sessionId, userId);
      return NextResponse.json({
        ok: true,
        reused: true,
        resultId: existingResultId,
      });
    }

    // 코인 차감
    const spendRpc = await supabaseAdmin.rpc("spend_coins", {
      p_user_id: userId,
      p_amount: YEARLY_COST,
      p_reference_id: body.sessionId,
    });

    if (spendRpc.error) {
      console.error("[YEARLY_START] spend rpc", spendRpc.error.message);
      return NextResponse.json({ error: "알 차감 중 오류가 발생했습니다." }, { status: 500 });
    }

    const spendResult = Array.isArray(spendRpc.data) ? spendRpc.data[0] : spendRpc.data;
    if (!spendResult?.success) {
      return NextResponse.json({
        insufficient: true,
        balance: spendResult?.new_balance ?? 0,
        required: YEARLY_COST,
      });
    }

    try {
      const birthDate = formatBirthDate(input);
      const birthTime = formatBirthTime(input);

      // pending yearly_results row 생성 (full_json: null)
      const upserted = await supabaseAdmin
        .from("yearly_results")
        .upsert(
          {
            user_id: userId,
            source_result_id: body.sourceResultId ?? null,
            input_hash: inputHash,
            target_year: targetYear,
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
            yearly_pillar: null,
            teaser_json: null,
            full_json: null,
            unlocked_at: new Date().toISOString(),
          },
          { onConflict: "user_id,input_hash,target_year" },
        )
        .select("id")
        .maybeSingle();

      if (upserted.error || !upserted.data?.id) {
        console.error("[YEARLY_START] result upsert", upserted.error?.message);
        await refundCoins(userId, YEARLY_COST, body.sessionId);
        return NextResponse.json(
          { error: "결과 저장 중 오류가 발생했습니다.", refunded: true },
          { status: 500 },
        );
      }

      const resultId = upserted.data.id;
      const orderId = `egg_yearly_${targetYear}_${Date.now()}_${userId.slice(0, 8)}`;

      await Promise.all([
        supabaseAdmin
          .from("yearly_result_unlocks")
          .upsert(
            {
              user_id: userId,
              result_id: resultId,
              input_hash: inputHash,
              target_year: targetYear,
              order_id: orderId,
            },
            { onConflict: "order_id", ignoreDuplicates: true },
          ),
        markSessionConsumed(body.sessionId, userId),
      ]);

      return NextResponse.json({
        ok: true,
        resultId,
        balance: spendResult.new_balance,
        pending: true,
      });
    } catch (err: any) {
      console.error("[YEARLY_START] pre-analysis", err?.message);
      await refundCoins(userId, YEARLY_COST, body.sessionId);
      return NextResponse.json(
        { error: "분석 준비 중 오류가 발생했습니다. 알은 환불되었습니다.", refunded: true },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("[YEARLY_START] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
