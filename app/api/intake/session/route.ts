import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

function isValidInput(input: InputPayload) {
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const input = (await request.json()) as InputPayload;
    if (!isValidInput(input)) {
      return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
    }

    const inputHash = buildInputHash(input);
    const payload = {
      ...input,
      name: input.name.trim(),
      birthYear: input.birthYear.trim(),
      birthMonth: input.birthMonth.trim(),
      birthDay: input.birthDay.trim(),
      birthHour: input.birthHour?.trim() || "",
      birthMinute: input.birthMinute?.trim() || "",
      birthLocation: input.birthLocation.trim(),
      gender: input.gender.trim(),
      relationshipStatus: input.relationshipStatus.trim(),
      employmentStatus: input.employmentStatus.trim(),
      coreFearAxis: input.coreFearAxis,
      unknownBirthTime: Boolean(input.unknownBirthTime),
      calendarType: input.calendarType || "solar",
    };

    const { data, error } = await supabaseAdmin
      .from("prepayment_sessions")
      .insert({
        user_id: userId,
        input_hash: inputHash,
        payload,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      return NextResponse.json({ error: error?.message || "임시 저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ sessionId: data.id });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "임시 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
