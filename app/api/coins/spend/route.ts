import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";
import { hasRequiredInput, markSessionConsumed, autoSetPrimaryIfNeeded, formatBirthDate, formatBirthTime, refundCoins } from "@/lib/server/session-helpers";
import { SAJU_COST, BATTLE_COST, PET_COMPAT_LAUNCH_COST } from "@/lib/constants/coins";

type SpendBody = {
  sessionId: string;
  type: "analysis" | "battle" | "pet";
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
    const isPet = body.type === "pet";
    const cost = isPet ? PET_COMPAT_LAUNCH_COST : isBattle ? BATTLE_COST : SAJU_COST;

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

    if (isPet) {
      const petPayload = sessionRow.payload as {
        pet?: { name?: string; species?: string; breed?: string; gender?: string; birthTier?: number };
        owner?: { birthYear?: string; gender?: string };
      };
      // breed·gender 필수(폼에서 하드 강제). photoPath 는 서버 하드필수 아님 —
      // 클라가 하드 강제하고, 서버는 사진 없어도 분석은 진행(일러스트만 스킵)하는 안전설계 유지.
      if (
        !petPayload?.pet?.name || !petPayload?.pet?.species || !petPayload?.pet?.birthTier ||
        !petPayload?.pet?.breed || !petPayload?.pet?.gender ||
        !petPayload?.owner?.birthYear || !petPayload?.owner?.gender
      ) {
        return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
      }
    } else if (isBattle) {
      if (!input?.name || !input.birthYear || !input.birthMonth || !input.birthDay || !input.birthLocation || !input.gender) {
        return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
      }
    } else if (!hasRequiredInput(input)) {
      return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
    }

    const isAnalysis = !isPet && !isBattle;
    const inputHash = isAnalysis
      ? typeof sessionRow.input_hash === "string" && sessionRow.input_hash
        ? sessionRow.input_hash
        : buildInputHash(input)
      : null;

    // ★ 확인-후-차감 (analysis): 같은 (user_id, input_hash)에 이미 결과가 있으면 차감하지 않는다.
    //   기존 코드는 spend_coins를 먼저 호출한 뒤에야 재사용을 판정해서, 재사용 경로에서
    //   "알만 빠지고 저장된 옛 결과를 그대로 재노출"했다(실측 75건/54명, 2026-05~07).
    //   yearly/start·today/start·marriage·wealth는 이미 확인-후-차감이라 이 라우트만 순서가 거꾸로였다.
    //   재진입(분석 대기 중 뒤로가기)·충전 후 자동 spend 등 전 경로를 서버에서 한 번에 덮는다.
    //   실패(_error) row 재시도만 예외로 재결제 — yearly/start:105~137 정책과 동일.
    let analysisRetryResultId: string | null = null;
    if (isAnalysis && inputHash) {
      const existingUnlock = await supabaseAdmin
        .from("result_unlocks")
        .select("result_id")
        .eq("user_id", userId)
        .eq("input_hash", inputHash)
        .maybeSingle();

      if (existingUnlock.data?.result_id) {
        const existingResultId = existingUnlock.data.result_id;
        const { data: existingResult } = await supabaseAdmin
          .from("saju_results")
          .select("full_json")
          .eq("id", existingResultId)
          .maybeSingle();

        if (existingResult) {
          const fullJson = existingResult.full_json as any;
          if (fullJson?._error) {
            // 실패 row — 아래에서 정상 차감 후 reset하고 재분석을 태운다.
            analysisRetryResultId = existingResultId;
          } else {
            // 정상 결과(full_json 존재) 또는 분석 진행 중(full_json null) → 차감 없이 그대로 돌려준다.
            // pending 재진입이 "몇 분 안 중복 차감"의 주범이었다.
            await markSessionConsumed(body.sessionId, userId);
            return NextResponse.json({
              ok: true,
              reused: true,
              charged: false,
              resultId: existingResultId,
              ...(fullJson == null ? { pending: true } : {}),
            });
          }
        }
        // existingResult 없음(결과 row가 사라진 경우) → 아래 신규 생성 흐름으로 진행.
      }
    }

    // ★ 재차감 가드 (pet/battle 한정, refund 대조형): consumed 세션에 "미환불 spend"가
    //   남아 있으면 다시 차감하지 않고 흐름만 계속 태운다 (orderId 재발급 → analyze 재시도).
    //   - 환불까지 끝난 세션(spend건수==refund건수)은 현행대로 재차감 (재시도=신규 결제 정책 유지).
    //   - analysis 타입 제외: consumed 재-spend하는 정상 클라 경로가 없고, analyze 계열 환불이
    //     order_id 기준이라 sessionId 대조가 어긋남. today/yearly는 별도 라우트라 무관.
    //   실측(fable): spend_coins가 type='spend'·reference_id=sessionId, refundCoins가 type='refund'·
    //   reference_id=sessionId로 기록 → 대조 정확. 과거 코인 중복충전 사고 방지 취지.
    let skipSpend = false;
    if ((isPet || isBattle) && sessionRow.status !== "pending") {
      const { data: txs, error: txError } = await supabaseAdmin
        .from("coin_transactions")
        .select("type")
        .eq("user_id", userId)
        .eq("reference_id", body.sessionId)
        .in("type", ["spend", "refund"]);
      if (txError) {
        console.error("[SPEND] tx lookup error", txError.message);
        return NextResponse.json({ error: "세션 조회 중 오류가 발생했습니다." }, { status: 500 });
      }
      const spends = (txs ?? []).filter((t) => t.type === "spend").length;
      const refunds = (txs ?? []).filter((t) => t.type === "refund").length;
      skipSpend = spends > refunds;
    }

    // spend_coins RPC 호출 (skipSpend면 차감 없이 현재 잔액만 조회)
    let newBalance: number;
    if (skipSpend) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("coin_balance")
        .eq("user_id", userId)
        .maybeSingle();
      newBalance = prof?.coin_balance ?? 0;
    } else {
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
      newBalance = spendResult.new_balance;
    }

    // ============ 펫 궁합: 알 차감만, 분석은 /api/pet-compat/analyze ============
    if (isPet) {
      const orderId = `egg_pet_${Date.now()}_${userId.slice(0, 8)}`;
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
        type: "pet",
        orderId,
        balance: newBalance,
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
        balance: newBalance,
      });
    }

    // ============ 사주 분석: 기존 payment/complete 로직 이동 ============
    // inputHash·재사용 판정은 차감 전에 끝났다(위 "확인-후-차감" 블록).
    try {
      // 실패(_error) row 재시도 — 위에서 정상 차감했으므로 pending으로 되돌려 재분석을 태운다.
      if (analysisRetryResultId) {
        await supabaseAdmin
          .from("saju_results")
          .update({ full_json: null, teaser_json: null, saju_text: null })
          .eq("id", analysisRetryResultId);
        await markSessionConsumed(body.sessionId, userId);
        return NextResponse.json({
          ok: true,
          resultId: analysisRetryResultId,
          balance: newBalance,
          charged: true,
          pending: true,
        });
      }

      // 여기 도달하면 analysis 경로이므로 inputHash는 항상 존재한다(위에서 계산).
      const analysisInputHash = inputHash as string;
      const birthDate = formatBirthDate(input);
      const birthTime = formatBirthTime(input);

      // 빈 result row 생성 (pending 상태 — full_json: null)
      const upserted = await supabaseAdmin
        .from("saju_results")
        .upsert(
          {
            user_id: userId,
            input_hash: analysisInputHash,
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

      // result_unlocks — plain insert로 전환(기존 upsert는 Promise.all 안에서 에러가 통째로 무시됐다).
      // 동시 요청의 loser는 result_unlocks_user_input_unique(23505)에 걸리는데, 그때 환불하지 않으면
      // "환불 없는 이중 차감"이 된다. yearly/today의 23505 감지+환불 패턴을 미러한다.
      const orderId = `egg_analysis_${Date.now()}_${userId.slice(0, 8)}`;
      const unlockInsert = await supabaseAdmin.from("result_unlocks").insert({
        user_id: userId,
        result_id: resultId,
        input_hash: analysisInputHash,
        order_id: orderId,
      });

      if (unlockInsert.error) {
        if (unlockInsert.error.code === "23505") {
          // 동시 요청이 먼저 잠금을 만들었다 — 이번 차감은 환불하고 그 결과를 그대로 돌려준다.
          console.warn("[SPEND] concurrent unlock, refunding", { userId, resultId });
          await refundCoins(userId, cost, body.sessionId);
          await markSessionConsumed(body.sessionId, userId);
          return NextResponse.json({
            ok: true,
            reused: true,
            charged: false,
            resultId,
            pending: true,
          });
        }
        console.error("[SPEND] unlock insert error", unlockInsert.error.message);
        await refundCoins(userId, cost, body.sessionId);
        return NextResponse.json({
          error: "결과 저장 중 오류가 발생했습니다.",
          refunded: true,
        }, { status: 500 });
      }

      await Promise.all([
        markSessionConsumed(body.sessionId, userId),
        autoSetPrimaryIfNeeded(userId, analysisInputHash),
      ]);

      // 즉시 반환 (~300ms) — 분석은 클라이언트가 /api/results/analyze 호출로 트리거
      return NextResponse.json({
        ok: true,
        resultId,
        balance: newBalance,
        charged: true,
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
