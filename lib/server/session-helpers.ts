import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { InputPayload } from "@/lib/analysis";

export function hasRequiredInput(input: InputPayload) {
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

/**
 * today 전용 입력 검증. today 분석은 사주 계산 + 직업 매핑만 쓰므로
 * relationshipStatus / coreFearAxis 등 사주 v1.3 전용 필드는 안 봄.
 *
 * yearly hotfix 0389a00 (coreFearAxis 폼/API mismatch) 패턴 회피 —
 * today는 자체 검증으로 분리해 신규 진입자 차단을 원천 방지.
 * employmentStatus도 미제공 폴백 매핑이 system prompt에 있어 옵셔널.
 */
export function hasTodayRequiredInput(input: InputPayload) {
  if (
    !input?.name ||
    !input.birthYear ||
    !input.birthMonth ||
    !input.birthDay ||
    !input.birthLocation ||
    !input.gender
  ) {
    return false;
  }

  if (!input.unknownBirthTime && (!input.birthHour || !input.birthMinute)) {
    return false;
  }

  return true;
}

export async function markSessionConsumed(
  sessionId: string,
  userId: string | null,
  guestTokenHash: string | null = null,
) {
  let query = supabaseAdmin
    .from("prepayment_sessions")
    .update({
      status: "consumed",
      consumed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("status", "pending");

  if (userId) {
    query = query.eq("user_id", userId);
  } else if (guestTokenHash) {
    query = query.eq("guest_token_hash", guestTokenHash);
  }

  const { error } = await query;

  if (error) {
    console.error("[markSessionConsumed] failed:", { sessionId, error: error.message });
  }
}

export async function autoSetPrimaryIfNeeded(userId: string, inputHash: string) {
  try {
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("primary_result_id")
      .eq("id", userId)
      .single();

    if (!u?.primary_result_id) {
      const { data: unlock } = await supabaseAdmin
        .from("result_unlocks")
        .select("result_id")
        .eq("user_id", userId)
        .eq("input_hash", inputHash)
        .maybeSingle();

      if (unlock?.result_id) {
        await supabaseAdmin
          .from("users")
          .update({ primary_result_id: unlock.result_id })
          .eq("id", userId);
      }
    }
  } catch (e) {
    console.error("[autoSetPrimary] non-fatal error:", e);
  }
}

// TODO: refund_coins RPC로 원자적 처리 필요 (현재 read-then-write race 가능성 있음)
// 환불은 분석 실패 시에만 발생하므로 동시성 이슈 확률은 매우 낮음
export async function refundCoins(userId: string, amount: number, referenceId: string) {
  // 멱등성: 동일 reference_id 로 이미 환불된 이력이 있으면 재환불 금지.
  // analyze 재시도(클라이언트 폴링)나 중복 호출 시 이중 환불되는 사고를 막는다.
  // reference_id 는 모든 호출처에서 spend 1건당 유일(sessionId / order_id)하므로
  // 이 체크가 정상 환불을 억제하지 않는다.
  const { count: alreadyRefunded } = await supabaseAdmin
    .from("coin_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "refund")
    .eq("reference_id", referenceId);

  if ((alreadyRefunded ?? 0) > 0) {
    console.warn(`[REFUND] 중복 환불 차단 user=${userId} ref=${referenceId} amount=${amount}`);
    return;
  }

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("coin_balance")
    .eq("user_id", userId)
    .single();

  const newBalance = (data?.coin_balance ?? 0) + amount;

  await Promise.all([
    supabaseAdmin
      .from("profiles")
      .update({ coin_balance: newBalance })
      .eq("user_id", userId),
    supabaseAdmin.from("coin_transactions").insert({
      user_id: userId,
      type: "refund",
      amount: amount,
      balance_after: newBalance,
      reference_id: referenceId,
    }),
  ]);
}

export function formatBirthDate(input: InputPayload): string | null {
  return input.birthYear && input.birthMonth && input.birthDay
    ? `${input.birthYear}-${input.birthMonth.padStart(2, "0")}-${input.birthDay.padStart(2, "0")}`
    : null;
}

export function formatBirthTime(input: InputPayload): string | null {
  return !input.unknownBirthTime && input.birthHour && input.birthMinute
    ? `${input.birthHour.padStart(2, "0")}:${input.birthMinute.padStart(2, "0")}`
    : null;
}
