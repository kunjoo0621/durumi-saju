// /api/couple/analyze — 20알 차감 + Gemini + 가드 + 저장 (+ 실패 시 환불)
//
// app/api/marriage/analyze 의 검증된 순서를 그대로 이식한다. 돈 로직을 재발명하지 않는다.
// 다만 환불 불변식은 4번째 복사본을 만들지 않고 lib/server/report-unlock.ts 를 쓴다
// (marriage/wealth/career 에 세 벌 복사돼 있고 테스트가 한 줄도 없던 자리다).
//
// 고정 순서:
//   1) 결과 row 조회
//   2) 멱등: unlock 있고 full_json 있음 → 재분석·재차감 없이 반환
//   2-1) orphan unlock: 유예 안이면 409(진행 중), 넘겼으면 멱등 환불 후 재결제로 진행
//   2-2) ★결제 전 판정 게이트 — 저장된 연도로 재계산해 판정이 바뀌었으면 409(차감 없음)
//   3) 차감 + unlock insert (unique 위반 = 동시 요청 loser = 멱등)
//   4) 프롬프트 → Gemini → 가드(재생성 루프)
//   5) 저장
//   6) 어느 단계든 실패 → 환불 + 방금 넣은 unlock 삭제
//      (unlock 을 남기면 재시도가 "이미 결제됨"으로 오인해 무료 통과하거나,
//       실패마다 환불이 재호출돼 코인이 증식한다)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { callGemini, DEFAULT_MODELS, shouldFallback } from "@/lib/analysis";
import { authOptions } from "@/lib/auth";
import { COUPLE_COST } from "@/lib/constants/coins";
import { parseJson5Loose } from "@/lib/json5Utils";
import { computePartnerChart } from "@/lib/pair/couple-charts";
import { decideCouple, type AxisKey } from "@/lib/pair/couple-decision";
import { isVerdictStale } from "@/lib/pair/couple-input-hash";
import { applyCoupleGuards, validateCoupleBlocks } from "@/lib/pair/couple-postprocess";
import { buildCouplePrompt } from "@/lib/pair/couple-prompt";
import { derivePairFacts, type PairFacts, type Sex } from "@/lib/pair/pair-facts";
import { generateWithQaRegen } from "@/lib/qa-regen";
import {
  isOrphanUnlock,
  refundReportUnlock,
  type UnlockStore,
} from "@/lib/server/report-unlock";
import { refundCoins } from "@/lib/server/session-helpers";
import { getSupabaseUserId } from "@/lib/server/user";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SYSTEM_PROMPT =
  "너는 지시받은 지침을 정확히 따르는 JSON 생성기다. 사용자 메시지에 포함된 규칙과 출력 스키마를 그대로 지켜라.";

/** report-unlock 의 store 를 Supabase 로 구현. 로직은 그쪽에 있고 여기는 배관만. */
const store: UnlockStore = {
  async hasRefund(userId, orderId) {
    const { data, error } = await supabaseAdmin
      .from("coin_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "refund")
      .eq("reference_id", orderId)
      .limit(1);
    // ★fail-closed. 조회 실패를 "환불 기록 없음"으로 오판하면 이중 환불이 된다.
    if (error) {
      console.error("[COUPLE_ANALYZE] refund lookup", error.message);
      return { ok: false, found: false };
    }
    return { ok: true, found: (data?.length ?? 0) > 0 };
  },
  async deleteUnlock(orderId) {
    const { data, error } = await supabaseAdmin
      .from("couple_result_unlocks")
      .delete()
      .eq("order_id", orderId)
      .select("id");
    if (error) {
      console.error("[COUPLE_ANALYZE] unlock delete", error.message);
      return { ok: false, deletedCount: 0 };
    }
    return { ok: true, deletedCount: data?.length ?? 0 };
  },
  async refund(userId, amount, orderId) {
    await refundCoins(userId, amount, orderId);
  },
};

function normSex(g?: string | null): Sex {
  return /여|female|f/i.test(g ?? "") ? "female" : "male";
}

const AXIS_ORDER: AxisKey[] = ["마음", "생활", "보완", "시기"];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json()) as { resultId?: string };
    if (!body.resultId) {
      return NextResponse.json({ error: "결과 정보가 필요합니다." }, { status: 400 });
    }

    /* ── 1) 결과 row ── */
    const { data: resultRow, error: resultError } = await supabaseAdmin
      .from("couple_results")
      .select("*")
      .eq("id", body.resultId)
      .eq("user_id", userId) // ★소유 스코프 — 상대 정보가 들어 있어 남의 row 를 읽으면 안 된다
      .maybeSingle();

    if (resultError) {
      console.error("[COUPLE_ANALYZE] result 조회", resultError.message);
      return NextResponse.json({ error: "정보를 불러오지 못했어요." }, { status: 500 });
    }
    if (!resultRow) {
      return NextResponse.json({ error: "결과를 찾을 수 없어요." }, { status: 404 });
    }

    const inputHash = resultRow.input_hash as string;

    /* ── 2) 멱등 ── */
    const { data: existingUnlock, error: unlockError } = await supabaseAdmin
      .from("couple_result_unlocks")
      .select("order_id, created_at")
      .eq("user_id", userId)
      .eq("input_hash", inputHash)
      .maybeSingle();

    if (unlockError) {
      console.error("[COUPLE_ANALYZE] unlock 조회", unlockError.message);
      return NextResponse.json({ error: "결제 정보를 확인하지 못했어요." }, { status: 500 });
    }

    if (existingUnlock && resultRow.full_json) {
      // 결제 + 생성 완료 — 차감도 Gemini 도 건너뛴다(참 멱등).
      return NextResponse.json({ ok: true, resultId: body.resultId, fullJson: resultRow.full_json, reused: true });
    }

    if (existingUnlock) {
      // 결제는 됐는데 결과가 없다. 둘이 섞여 있다:
      //  (a) 방금 다른 요청이 결제하고 아직 생성 중 → 재차감하면 이중결제
      //  (b) 이전 시도가 끊겨 영영 안 채워질 row → 환불하고 새로 결제
      const createdAt = existingUnlock.created_at ? new Date(existingUnlock.created_at as string).getTime() : null;
      const ageOk = createdAt !== null && Number.isFinite(createdAt);
      if (!isOrphanUnlock(ageOk ? createdAt : null, Date.now())) {
        return NextResponse.json(
          { error: "이미 분석이 진행 중이에요. 잠시 후 다시 시도해 주세요.", analyzing: true },
          { status: 409 },
        );
      }
      const cleaned = await refundReportUnlock(store, userId, existingUnlock.order_id as string, COUPLE_COST);
      if (!cleaned) {
        return NextResponse.json({ error: "결제 정보 정리 중 오류가 발생했습니다." }, { status: 500 });
      }
      // fall-through → 아래에서 새로 결제
    }

    /* ── 2-2) ★결제 전 판정 게이트 (차감 전에 확정) ── */
    // ★저장된 연도로 재계산한다. '오늘'로 하면 12/31 teaser → 1/1 analyze 에서
    //   대운 구간이 넘어가 판정이 밀리고, 정당한 결제가 여기서 튕긴다.
    const storedYear = Number(resultRow.current_year);
    if (!Number.isFinite(storedYear)) {
      console.error("[COUPLE_ANALYZE] current_year 결측 — 결제 차단", body.resultId);
      return NextResponse.json({ error: "미리보기를 다시 만든 뒤 시도해 주세요." }, { status: 409 });
    }

    const recomputed = await recomputeDecision(resultRow, storedYear);
    if (!recomputed) {
      return NextResponse.json({ error: "사주 계산에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }

    const stored = {
      verdict: (resultRow.verdict as string) ?? "",
      axes: [resultRow.axis_mind, resultRow.axis_life, resultRow.axis_complement, resultRow.axis_timing].map(
        (v) => (v as string) ?? "",
      ),
    };
    const fresh = {
      verdict: recomputed.decision.verdict,
      axes: AXIS_ORDER.map((k) => recomputed.decision.axes[k].verdict as string),
    };

    if (isVerdictStale(stored, fresh)) {
      console.error("[COUPLE_ANALYZE] 판정 불일치 — 결제 차단", stored.verdict, "vs", fresh.verdict);
      return NextResponse.json(
        { error: "미리보기 이후 사주 정보가 바뀌었어요. 미리보기를 다시 만든 뒤 시도해 주세요.", mismatch: true },
        { status: 409 },
      );
    }

    /* ── 3) 차감 ── */
    const orderId = `couple_${inputHash.slice(0, 16)}_${Date.now()}_${userId.slice(0, 8)}`;

    const spendRpc = await supabaseAdmin.rpc("spend_coins", {
      p_user_id: userId,
      p_amount: COUPLE_COST,
      p_reference_id: orderId,
    });
    if (spendRpc.error) {
      console.error("[COUPLE_ANALYZE] spend rpc", spendRpc.error.message);
      return NextResponse.json({ error: "알 차감 중 오류가 발생했습니다." }, { status: 500 });
    }
    const spendResult = Array.isArray(spendRpc.data) ? spendRpc.data[0] : spendRpc.data;
    if (!spendResult?.success) {
      return NextResponse.json(
        {
          insufficient: true,
          balance: spendResult?.new_balance ?? 0,
          required: COUPLE_COST,
          error: "알이 부족해요. 알을 충전한 뒤 다시 시도해 주세요.",
        },
        { status: 402 },
      );
    }

    // unique(user_id, input_hash) 위반 = 동시 요청이 먼저 결제 완료 = 멱등 처리(이번 차감 환불).
    const unlockInsert = await supabaseAdmin.from("couple_result_unlocks").insert({
      user_id: userId,
      result_id: body.resultId,
      input_hash: inputHash,
      order_id: orderId,
    });

    if (unlockInsert.error) {
      if (unlockInsert.error.code === "23505") {
        await refundCoins(userId, COUPLE_COST, orderId);
        return NextResponse.json(
          { error: "이미 분석이 진행 중이에요. 잠시 후 다시 시도해 주세요.", analyzing: true },
          { status: 409 },
        );
      }
      console.error("[COUPLE_ANALYZE] unlock insert", unlockInsert.error.message);
      await refundCoins(userId, COUPLE_COST, orderId);
      return NextResponse.json({ error: "결제 처리 중 오류가 발생했습니다." }, { status: 500 });
    }

    // 이 지점 이후의 모든 실패는 반드시 이걸 거쳐야 한다 — 차감 1회당 환불 1회.
    const refundAndCleanup = async () => {
      const ok = await refundReportUnlock(store, userId, orderId, COUPLE_COST);
      if (!ok) console.error("[COUPLE_ANALYZE] 환불·정리 실패", orderId);
    };

    /* ── 4) 생성 ── */
    const names = {
      nameA: (resultRow.name as string) || "너",
      nameB: (resultRow.partner_name as string) || "상대",
    };
    const prompt = buildCouplePrompt(recomputed.facts, recomputed.decision, names);
    const allowedYears = recomputed.facts.fortuneCross.timingOverlapYears;

    const envModels = (process.env.GEMINI_MODELS || "").split(",").map((m) => m.trim()).filter(Boolean);
    const models = envModels.length > 0 ? envModels : DEFAULT_MODELS;

    const gen = await generateWithQaRegen<unknown>({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      models,
      temperature: 0.75,
      callModel: (model, p, sys, cfg) => callGemini(model, p, sys, cfg),
      shouldFallback,
      parse: (text) => parseJson5Loose<unknown>(text),
      validateBlocks: (candidate) => validateCoupleBlocks(candidate),
      applyGuards: (candidate) => applyCoupleGuards(candidate, { allowedYears }),
    });

    if (!gen.ok) {
      console.error("[COUPLE_ANALYZE] gemini 실패", gen.error);
      await refundAndCleanup();
      return NextResponse.json({ error: "분석에 실패했어. 알은 환불됐어.", refunded: true }, { status: 500 });
    }
    if (gen.violations.length > 0) {
      console.warn(`[COUPLE_ANALYZE] 가드 위반 잔존 (재생성 ${gen.attempts}회 후)`, gen.violations);
    }

    // 가드가 문장을 스크럽한 뒤 필수 블록이 비었는지 재검증 — 빈 리포트가 나가면 안 된다.
    const postIssues = validateCoupleBlocks(gen.blocks);
    if (postIssues.length > 0) {
      console.error("[COUPLE_ANALYZE] 가드 후 블록 결손", postIssues);
      await refundAndCleanup();
      return NextResponse.json({ error: "분석에 실패했어. 알은 환불됐어.", refunded: true }, { status: 500 });
    }

    /* ── 5) 저장 ── */
    const saved = await supabaseAdmin
      .from("couple_results")
      .update({ full_json: gen.blocks, unlocked_at: new Date().toISOString() })
      .eq("id", body.resultId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (saved.error || !saved.data?.id) {
      console.error("[COUPLE_ANALYZE] 저장 실패", saved.error?.message);
      await refundAndCleanup();
      return NextResponse.json({ error: "결과 저장에 실패했어. 알은 환불됐어.", refunded: true }, { status: 500 });
    }

    return NextResponse.json({ ok: true, resultId: body.resultId, fullJson: gen.blocks });
  } catch (error: unknown) {
    console.error("[COUPLE_ANALYZE] error", (error as Error)?.message || error);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * 저장된 입력 스냅샷으로 두 원국을 다시 세우고 판정을 재계산한다.
 * ★반드시 저장된 연도(storedYear)를 쓴다.
 */
async function recomputeDecision(
  row: Record<string, unknown>,
  storedYear: number,
): Promise<{ facts: PairFacts; decision: ReturnType<typeof decideCouple> } | null> {
  const toParts = (d: unknown) => {
    const [y, m, dd] = String(d ?? "").split("-");
    return { y, m, dd };
  };

  const a = toParts(row.birth_date);
  const aTime = String(row.birth_time ?? "");
  const selfChart = await computePartnerChart({
    name: (row.name as string) ?? "",
    birthYear: a.y, birthMonth: a.m, birthDay: a.dd,
    birthHour: aTime ? aTime.split(":")[0] : undefined,
    birthMinute: aTime ? aTime.split(":")[1] : undefined,
    birthLocation: (row.region as string) ?? undefined,
    gender: (row.gender as string) ?? "",
    calendarType: (row.calendar_type as string) ?? "solar",
    unknownBirthTime: !aTime,
  });
  if (!selfChart.ok) return null;

  const b = toParts(row.partner_birth_date);
  const bTime = String(row.partner_birth_time ?? "");
  const partnerChart = await computePartnerChart({
    name: (row.partner_name as string) ?? "",
    birthYear: b.y, birthMonth: b.m, birthDay: b.dd,
    birthHour: bTime ? bTime.split(":")[0] : undefined,
    birthMinute: bTime ? bTime.split(":")[1] : undefined,
    birthLocation: (row.partner_region as string) ?? undefined,
    gender: (row.partner_gender as string) ?? "",
    calendarType: (row.partner_calendar_type as string) ?? "solar",
    unknownBirthTime: Boolean(row.partner_unknown_birth_time) || !bTime,
  });
  if (!partnerChart.ok) return null;

  // 타이밍 교차는 start 에서 저장한 pair_facts_json 의 값을 그대로 쓴다.
  // 여기서 다시 구하면 대운 계산이 또 두 번 돌아 비싸고, 저장 시점 값과 갈라질 수 있다.
  const storedFacts = row.pair_facts_json as PairFacts | null;
  const timingOverlap = storedFacts?.fortuneCross?.timingOverlapYears ?? [];

  const facts = derivePairFacts(selfChart.enriched, partnerChart.enriched, {
    currentYear: storedYear,
    sexA: normSex(row.gender as string),
    sexB: partnerChart.sex,
  });
  // 저장된 타이밍을 되살린다(위 주석 참조).
  facts.fortuneCross.timingOverlapYears = timingOverlap;

  return { facts, decision: decideCouple(facts) };
}
