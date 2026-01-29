import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { supabaseId?: string } | undefined)?.supabaseId;

    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("name, birth_date, birth_time, region, gender, relationship_status, employment_status")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data || null });
  } catch (error: any) {
    return NextResponse.json(
      { error: "정보 조회 중 오류가 발생했습니다.", details: error?.message },
      { status: 500 }
    );
  }
}

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
      employmentStatus,
    } = body;

    if (!name || !birthDate || !gender || !employmentStatus) {
      return NextResponse.json({ error: "필수 입력값이 누락되었습니다." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({
        name,
        birth_date: birthDate,
        birth_time: birthTime || null,
        region: region || null,
        gender,
        relationship_status: relationshipStatus || null,
        employment_status: employmentStatus,
      })
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "정보 저장 중 오류가 발생했습니다.", details: error?.message },
      { status: 500 }
    );
  }
}
