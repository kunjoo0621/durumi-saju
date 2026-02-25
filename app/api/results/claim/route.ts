import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseUserId } from "@/lib/server/user";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashToken, getTokensFromCookie, deleteAllTokenCookies } from "@/lib/guest-token";

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

  // 4. RPC 호출 (단일 트랜잭션)
  const { data, error } = await supabaseAdmin.rpc("claim_guest_results", {
    p_user_id: userId,
    p_guest_token_hashes: hashes,
  });

  if (error) {
    console.error("[claim_guest_results] RPC error:", error);
    return NextResponse.json({ error: "claim 실패" }, { status: 500 });
  }

  // 4-b. saju_battles도 이전 (RPC가 미처리할 경우 대비)
  await supabaseAdmin
    .from("saju_battles")
    .update({ user_id: userId, guest_token_hash: null, guest_token_expires_at: null })
    .in("guest_token_hash", hashes)
    .is("user_id", null);

  // 4-c. 대표 사주 자동 설정 (claim 후, 대표 없으면)
  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("primary_result_id")
      .eq("id", userId)
      .single();

    if (!user?.primary_result_id) {
      const { data: firstUnlock } = await supabaseAdmin
        .from("result_unlocks")
        .select("result_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (firstUnlock?.result_id) {
        await supabaseAdmin
          .from("users")
          .update({ primary_result_id: firstUnlock.result_id })
          .eq("id", userId);
      }
    }
  } catch (e) {
    console.error("[claim] autoSetPrimary non-fatal error:", e);
  }

  // 5. 성공 시 쿠키 전체 삭제
  const response = NextResponse.json(data);
  if (data?.success) {
    deleteAllTokenCookies(response);
  }
  return response;
}
