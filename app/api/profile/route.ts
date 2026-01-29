import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { supabaseId?: string; id?: string; name?: string } | undefined;
    let userId = sessionUser?.supabaseId;
    const kakaoId = sessionUser?.id;

    let profile: any = null;

    if (!userId && kakaoId) {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, name, birth_date, birth_time, region, gender, relationship_status, employment_status, calendar_type")
        .eq("kakao_id", kakaoId)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data) {
        const inserted = await supabaseAdmin
          .from("users")
          .insert({ kakao_id: kakaoId, nickname: sessionUser?.name || null })
          .select("id, name, birth_date, birth_time, region, gender, relationship_status, employment_status, calendar_type")
          .single();

        if (inserted.error) {
          return NextResponse.json({ error: inserted.error.message }, { status: 500 });
        }

        profile = inserted.data;
        userId = inserted.data?.id;
      } else {
        profile = data;
        userId = data.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    if (!profile) {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("name, birth_date, birth_time, region, gender, relationship_status, employment_status, calendar_type")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      profile = data || null;
    }

    return NextResponse.json({ profile: profile || null });
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
    const sessionUser = session?.user as { supabaseId?: string; id?: string; name?: string } | undefined;
    let userId = sessionUser?.supabaseId;
    const kakaoId = sessionUser?.id;

    if (!userId && kakaoId) {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("kakao_id", kakaoId)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data) {
        const inserted = await supabaseAdmin
          .from("users")
          .insert({ kakao_id: kakaoId, nickname: sessionUser?.name || null })
          .select("id")
          .single();

        if (inserted.error) {
          return NextResponse.json({ error: inserted.error.message }, { status: 500 });
        }
        userId = inserted.data?.id;
      } else {
        userId = data.id;
      }
    }

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
      calendarType,
    } = body;

    if (!name || !birthDate || !gender || !employmentStatus || !calendarType) {
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
        calendar_type: calendarType,
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
