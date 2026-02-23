import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;

    const { data: battle, error } = await supabaseAdmin
      .from("saju_battles")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !battle) {
      return NextResponse.json({ error: "배틀을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ battle });
  } catch (error: any) {
    return NextResponse.json(
      { error: "배틀 조회 중 오류가 발생했습니다.", details: error?.message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("saju_battles")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id");

    console.log("[DELETE /api/battles]", { id, userId, deletedRows: data?.length ?? 0 });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "삭제할 배틀을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[DELETE /api/battles] 예외", error?.message);
    return NextResponse.json(
      { error: "삭제 중 오류가 발생했습니다.", details: error?.message },
      { status: 500 },
    );
  }
}
