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
