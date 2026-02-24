import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";
import { hashToken, getTokensFromCookie } from "@/lib/guest-token";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? await getSupabaseUserId(session) : null;

    const input = (await request.json()) as InputPayload;
    if (!input?.name || !input.birthYear || !input.birthMonth || !input.birthDay) {
      return NextResponse.json({ unlocked: false }, { status: 400 });
    }

    const inputHash = buildInputHash(input);

    // 로그인 사용자: 기존 로직 (result_unlocks)
    if (userId) {
      const { data, error } = await supabaseAdmin
        .from("result_unlocks")
        .select("result_id")
        .eq("user_id", userId)
        .eq("input_hash", inputHash)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ unlocked: false }, { status: 500 });
      }

      return NextResponse.json({
        unlocked: Boolean(data?.result_id),
        resultId: data?.result_id || null,
      });
    }

    // guest: saju_results에서 직접 확인
    const tokens = await getTokensFromCookie();
    if (tokens.length > 0) {
      const hashes = tokens.map((t) => hashToken(t));
      const { data } = await supabaseAdmin
        .from("saju_results")
        .select("id")
        .eq("input_hash", inputHash)
        .in("guest_token_hash", hashes)
        .gt("guest_token_expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (data) {
        return NextResponse.json({
          unlocked: true,
          resultId: data.id,
          is_guest: true,
        });
      }
    }

    return NextResponse.json({ unlocked: false });
  } catch (error: any) {
    return NextResponse.json({ unlocked: false, error: error?.message }, { status: 500 });
  }
}
