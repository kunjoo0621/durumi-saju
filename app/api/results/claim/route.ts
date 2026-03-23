import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseUserId } from "@/lib/server/user";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashToken, getTokensFromCookie, deleteAllTokenCookies } from "@/lib/guest-token";
import { autoSetPrimaryIfNeeded } from "@/lib/server/session-helpers";

export async function POST() {
  // 1. 로그인 필수
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  const userId = await getSupabaseUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "사용자 확인 실패" }, { status: 401 });
  }

  // 2. 쿠키에서 토큰 배열 읽기
  const tokens = await getTokensFromCookie();
  if (tokens.length === 0) {
    return NextResponse.json({
      success: false,
      reason: "no_guest_tokens",
    });
  }

  // 3. 전체 토큰 해시 배열 생성
  const hashes = tokens.map((t) => hashToken(t));

  // 4. guest saju_results 조회 → user_id 설정 → result_unlocks 삽입
  const { data: guestResults, error: selectError } = await supabaseAdmin
    .from("saju_results")
    .select("id, input_hash, order_id")
    .in("guest_token_hash", hashes)
    .is("user_id", null);

  if (selectError) {
    console.error("[claim] select error:", selectError);
    return NextResponse.json({ error: "claim 실패" }, { status: 500 });
  }

  let claimed = 0;

  if (guestResults && guestResults.length > 0) {
    // saju_results: user_id 설정, guest_token 정보 제거
    const resultIds = guestResults.map((r) => r.id);
    const { error: updateError } = await supabaseAdmin
      .from("saju_results")
      .update({
        user_id: userId,
        guest_token_hash: null,
        guest_token_expires_at: null,
      })
      .in("id", resultIds);

    if (updateError) {
      console.error("[claim] update error:", updateError);
      return NextResponse.json({ error: "claim 실패" }, { status: 500 });
    }

    // result_unlocks 삽입 (ON CONFLICT DO NOTHING)
    const unlockRows = guestResults
      .filter((r) => r.order_id)
      .map((r) => ({
        user_id: userId,
        result_id: r.id,
        input_hash: r.input_hash,
        order_id: r.order_id,
      }));

    if (unlockRows.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("result_unlocks")
        .upsert(unlockRows, { onConflict: "user_id,input_hash", ignoreDuplicates: true });

      if (insertError) {
        console.error("[claim] result_unlocks insert error:", insertError);
        // non-fatal: results are already claimed, just unlock records failed
      }
    }

    claimed = resultIds.length;
  }

  const data = { success: true, claimed };

  // 4-b. saju_battles 이전 + 대표 사주 자동 설정 (병렬 실행)
  const firstInputHash = guestResults?.[0]?.input_hash;
  await Promise.all([
    supabaseAdmin
      .from("saju_battles")
      .update({ user_id: userId, guest_token_hash: null, guest_token_expires_at: null })
      .in("guest_token_hash", hashes)
      .is("user_id", null),
    firstInputHash ? autoSetPrimaryIfNeeded(userId, firstInputHash) : Promise.resolve(),
  ]);

  // 5. 성공 시 쿠키 전체 삭제
  const response = NextResponse.json(data);
  if (data?.success) {
    deleteAllTokenCookies(response);
  }
  return response;
}
