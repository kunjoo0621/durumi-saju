import { NextRequest, NextResponse } from "next/server";
import * as PortOneWebhook from "@portone/server-sdk/webhook";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// PortOne V2 webhook 수신 endpoint (3/N: 관찰 모드).
//
// 배경: 2026-05-26 우슬기 결제 누락 사고 — 카카오톡 인앱에서 결제 후 redirect 복귀 실패.
// 단방향(클라이언트 redirect) 의존이라 redirect 끊기면 우리 서버는 결제 사실을 영영 모름.
// PortOne webhook은 PortOne → 우리 서버 직통이라 redirect와 무관하게 결제 정보 도달.
//
// 이 PR (3/N) 범위 — 관찰 모드:
//   - 서명 검증 (PortOne 공식 SDK, Standard Webhooks 사양)
//   - charge_orders pending → paid 상태 기록만
//   - 코인 자동 충전 X (기존 redirect 흐름의 /api/coins/charge 가 담당)
//   - 가짜/위조 webhook은 401로 거부, 어떤 상태 변경도 없음
//
// 후속 PR (6/N) 에서 webhook이 자동 충전까지 담당하도록 확장.

export async function POST(request: NextRequest) {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[WEBHOOK] PORTONE_WEBHOOK_SECRET 미설정");
    return NextResponse.json({ error: "config missing" }, { status: 500 });
  }

  // raw body 필수 — JSON.parse 거치면 서명 매칭 실패.
  const payload = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
  };

  let verified: PortOneWebhook.Webhook;
  try {
    verified = await PortOneWebhook.verify(secret, payload, headers);
  } catch (err: any) {
    // 서명 검증 실패 = 가짜/위조 webhook. 절대 처리 안 함.
    // 관찰 모드라도 검증 실패는 명확히 거부 — 운영 원칙 "webhook 서명 실패 → 충전 금지".
    const reason = err?.reason ?? err?.message ?? "unknown";
    console.warn("[WEBHOOK] signature verification failed", reason);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 결제 승인(Transaction.Paid) 이벤트만 처리. 나머지(Ready/Failed/Cancelled 등)는 ack 후 무시.
  if (verified.type !== "Transaction.Paid") {
    return NextResponse.json({ ok: true, ignored: verified.type });
  }

  const paymentId = verified.data.paymentId;

  // PortOne API로 paymentId 재조회 → 진짜 PAID 상태인지 더블 체크.
  // webhook payload 자체는 신뢰하지만 amount/status는 PortOne API 응답이 source of truth.
  const portoneApiSecret = process.env.PORTONE_API_SECRET;
  if (!portoneApiSecret) {
    console.error("[WEBHOOK] PORTONE_API_SECRET 미설정");
    return NextResponse.json({ error: "config missing" }, { status: 500 });
  }
  const res = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `PortOne ${portoneApiSecret}` } }
  );
  if (!res.ok) {
    console.error("[WEBHOOK] PortOne API 조회 실패", res.status);
    return NextResponse.json({ error: "PortOne API error" }, { status: 502 });
  }
  const paymentData = await res.json();
  if (paymentData?.status !== "PAID") {
    // webhook은 Paid라 했는데 PortOne API는 다른 상태. 일시적 불일치 가능 (재시도로 해결됨).
    console.warn("[WEBHOOK] PortOne API status 불일치", { paymentId, status: paymentData?.status });
    return NextResponse.json({ ok: true, status: paymentData?.status });
  }

  // charge_orders 조회. 신구조 사용자(intent 거친)만 row 존재.
  // 일반 사용자(redirect 흐름) 결제는 charge_orders에 row 없음 → 관찰 모드에서 무시.
  // 후속 PR(7/N 전체 사용자 전환) 이후엔 모든 결제에 row 존재.
  const orderId = paymentId; // PortOne paymentId === 우리 발급 order_id

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("charge_orders")
    .select("status")
    .eq("order_id", orderId)
    .maybeSingle();

  if (lookupError) {
    console.error("[WEBHOOK] charge_orders lookup 실패", lookupError.message);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  if (!existing) {
    // 신구조 사용자 아님 (일반 사용자 redirect 흐름). 관찰 모드에선 기록 없이 무시.
    // reconcile (8/N) 이 PortOne PAID vs charge_orders 비교로 잡음.
    console.info("[WEBHOOK] charge_orders 없음 — 일반 사용자 redirect 흐름", { orderId });
    return NextResponse.json({ ok: true, ignored: "no charge_order" });
  }

  // 상태 머신:
  //   pending → paid     (webhook이 redirect보다 먼저 도착)
  //   paid    → paid     (멱등, 변화 없음)
  //   charged → charged  (이미 redirect 흐름이 충전 완료, webhook은 사후 도착)
  //   failed/refunded    → 변경 없음 (별개 이벤트로 처리)
  if (existing.status === "pending") {
    const { error: updateError } = await supabaseAdmin
      .from("charge_orders")
      .update({
        status: "paid",
        payment_id: paymentId,
        paid_at: paymentData.paidAt ?? new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .eq("status", "pending"); // race 가드: 그 사이 redirect 흐름이 charged 로 변경했으면 update X

    if (updateError) {
      console.error("[WEBHOOK] charge_orders update 실패", updateError.message);
      return NextResponse.json({ error: "update failed" }, { status: 500 });
    }
    console.info("[WEBHOOK] charge_orders pending → paid", { orderId });
  } else {
    console.info("[WEBHOOK] charge_orders 이미 처리됨, no-op", { orderId, status: existing.status });
  }

  // 자동 충전은 6/N PR에서. 이번 단계는 webhook 도착 + 상태 기록까지만.
  return NextResponse.json({ ok: true });
}
