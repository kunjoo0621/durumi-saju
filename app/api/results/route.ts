import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { supabaseId?: string } | undefined)?.supabaseId;

    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      birthDate,
      birthTime,
      region,
      gender,
      relationshipStatus,
      result,
    } = body;

    const { error } = await supabaseAdmin.from("saju_results").insert({
      user_id: userId,
      name,
      birth_date: birthDate,
      birth_time: birthTime,
      region,
      gender,
      relationship_status: relationshipStatus,
      result,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "저장 중 오류가 발생했습니다.", details: error?.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { supabaseId?: string } | undefined)?.supabaseId;

    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("saju_results")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다.", details: error?.message },
      { status: 500 }
    );
  }
}
