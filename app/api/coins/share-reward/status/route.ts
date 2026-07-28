import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

// 공유 결과 폴링. 클라이언트는 공유창을 닫은 뒤 이 엔드포인트를 짧게 폴링해서
// 지급/거부를 토스트로 알린다. 웹훅이 늦거나 안 오면 아무 문구도 띄우지 않는다
// (없는 사실을 만들어내지 않는다 — 코인함 상시 안내가 그 자리를 받는다).
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const params = new URL(request.url).searchParams;

    // kind만 물어보는 경량 조회 — 버튼 라벨을 정하는 용도(보상 문구를 띄울지 말지)
    const kind = params.get("kind");
    if (kind) {
      const { data } = await supabaseAdmin
        .from("share_reward_grants")
        .select("result_kind")
        .eq("user_id", userId)
        .eq("result_kind", kind)
        .maybeSingle();
      return NextResponse.json({ alreadyGranted: !!data });
    }

    const nonce = params.get("nonce");
    if (!nonce) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("share_kakao_nonces")
      .select("result_kind, consumed_at, last_reject_reason")
      .eq("nonce", nonce)
      .eq("user_id", userId) // 남의 nonce 상태는 볼 수 없다
      .maybeSingle();

    if (error) {
      console.error("[SHARE_STATUS] query error", error.message);
      return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ state: "none" });
    }

    if (data.consumed_at) {
      // 소모됐다 = 웹훅이 도착해 지급 판정까지 끝났다.
      // 실제 지급 여부는 원장으로 확인한다(이미 받은 종류면 지급이 없다).
      const { data: grant } = await supabaseAdmin
        .from("share_reward_grants")
        .select("granted_at")
        .eq("user_id", userId)
        .eq("result_kind", data.result_kind)
        .maybeSingle();

      return NextResponse.json({
        state: "granted",
        grantedKind: data.result_kind,
        grantedAt: grant?.granted_at ?? null,
        // 이 공유로 새로 받은 게 아니라 이전에 이미 받아둔 종류인 경우
        alreadyHad: !!grant && !!data.consumed_at && grant.granted_at < data.consumed_at,
      });
    }

    if (data.last_reject_reason) {
      return NextResponse.json({ state: "rejected", rejectReason: data.last_reject_reason });
    }

    return NextResponse.json({ state: "pending" });
  } catch (error: any) {
    console.error("[SHARE_STATUS] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
