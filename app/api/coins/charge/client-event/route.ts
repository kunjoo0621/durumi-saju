import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseUserId } from "@/lib/server/user";

// 결제 클라이언트 계측 — 서버가 절대 볼 수 없는 순간만 기록한다.
//
// 왜 필요했나 (2026-08-26 전수 조사):
//   charge_orders 의 pending 659건을 PortOne 원천과 대조했더니 83.6%(551건)가 READY 였다.
//   READY = PortOne 이 결제 세션은 만들었는데 사용자가 아무 시도도 안 한 상태.
//   그런데 그중에는 3분에 7번, 7분에 4번 세션만 만들고 결제 시도가 0회인 사용자가 있다.
//   망설임으로는 설명이 안 되는 패턴인데, "결제창이 화면에 실제로 떴는지"는
//   PortOne 데이터로도 우리 DB로도 알 수 없다. 클라이언트만 안다.
//
// 왜 charge_orders 를 건드리지 않나:
//   status 를 'failed' 로 마킹하고 싶은 유혹이 있지만 절대 안 된다.
//   portone/webhook 이 "이미 failed 인 주문은 자동 충전 거부"(멱등 가드)라
//   나중에 실제로 결제가 성사돼도 충전이 막힌다. 관측하려다 돈을 잃는다.
//   그래서 이 endpoint 는 **아무 상태도 바꾸지 않고** 로그만 남긴다.
//
// 조회: Vercel 런타임 로그에서 "[CHARGE_CLIENT_EVENT]" 검색.
//   빈도가 확인되면 그때 영구 저장(테이블)을 검토한다. 지금은 마이그레이션 없이 시작한다.

// 오탈자·임의 값이 섞여 로그가 오염되는 걸 막는다.
const ALLOWED_EVENTS = new Set([
  // PortOne.requestPayment 가 undefined 를 돌려줬는데 페이지가 그대로 남아 있는 경우.
  // redirect 흐름이면 페이지가 떠나므로 이 이벤트는 안 온다 → 오면 "결제창이 안 떴다"는 뜻.
  "requestPayment_no_response",
]);

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as {
      orderId?: string;
      event?: string;
      detail?: string;
    };
    if (!body.event || !ALLOWED_EVENTS.has(body.event)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    console.error("[CHARGE_CLIENT_EVENT]", JSON.stringify({
      event: body.event,
      orderId: typeof body.orderId === "string" ? body.orderId.slice(0, 64) : null,
      userId,
      // UA 는 인앱 브라우저(카톡·네이버앱) 판별에 필요하다. 채널별로 갈리는지 보려면 이게 있어야 한다.
      ua: request.headers.get("user-agent")?.slice(0, 180) ?? null,
      detail: typeof body.detail === "string" ? body.detail.slice(0, 200) : null,
      at: new Date().toISOString(),
    }));

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    // 계측이 결제 흐름에 영향을 주면 안 된다 — 실패해도 조용히 200.
    console.error("[CHARGE_CLIENT_EVENT] handler error", error?.message);
    return NextResponse.json({ ok: true });
  }
}
