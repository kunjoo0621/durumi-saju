import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ unlocked: false }, { status: 401 });
    }

    const input = (await request.json()) as InputPayload;
    if (!input?.name || !input.birthYear || !input.birthMonth || !input.birthDay) {
      return NextResponse.json({ unlocked: false }, { status: 400 });
    }

    const inputHash = buildInputHash(input);
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
  } catch (error: any) {
    return NextResponse.json({ unlocked: false, error: error?.message }, { status: 500 });
  }
}
