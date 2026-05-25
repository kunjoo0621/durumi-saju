import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseUserId } from "@/lib/server/user";
import { getPrimarySajuData } from "@/lib/server/get-primary-saju";

// 대표사주(또는 최근 사주) 조회 → 오늘의 운세 입력으로 자동 채울 정보 반환.
// 응답 shape은 yearly/from-primary와 1:1 동일 — lib/server/get-primary-saju에서 공유.

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const result = await getPrimarySajuData(userId);
    return NextResponse.json({ result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "내 사주 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
