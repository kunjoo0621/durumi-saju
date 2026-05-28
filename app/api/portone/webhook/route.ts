import { NextRequest, NextResponse } from "next/server";
import * as PortOneWebhook from "@portone/server-sdk/webhook";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { COIN_PACKAGES } from "@/lib/constants/coins";

// PortOne V2 webhook 수신 endpoint — 자동 충전 모드.
//
// 배경: 2026-05-26 우슬기 결제 누락 사고 — 카카오톡 인앱에서 결제 후 redirect 복귀 실패.
// 단방향(클라이언트 redirect) 의존이라 redirect 끊기면 우리 서버는 결제 사실을 영영 모름.
// PortOne webhook은 PortOne → 우리 서버 직통이라 redirect와 무관하게 결제 정보 도달.
//
// 안전 조건 (8개, charge_coins RPC 멱등성으로 race-safe):
//   1) paymentId === order_id (UUID 형식 가드)
//   2) charge_orders row 없으면 충전 금지 (신구조 사용자만 대상)
//   3) PortOne API 재조회 결과 PAID 아니면 충전 금지
//   4) PortOne 결제 금액 vs charge_orders.amount 불일치면 충전 금지
//   5) COIN_PACKAGES.price 검증 (charge_orders.package_id의 expected price)
//   6) 충전은 무조건 charge_coins RPC만 (coin_transactions 직접 insert 금지)
//   7) charge_coins RPC 자체 멱등 (같은 order_id 두 번이면 charged=0)
//   8) webhook·redirect·reconcile 동시 도착해도 RPC 멱등으로 한 번만 충전
//
// 활성화 게이트: 환경변수 WEBHOOK_AUTO_CHARGE_USER_IDS (콤마구분).
//   - 비어 있음 = 자동 충전 OFF (관찰 모드, 안전판). paid 마킹까지만.
//   - "*" = 전체 사용자 자동 충전
//   - "uuid1,uuid2" = 그 user_id만 자동 충전 (운영자 테스트 단계)

function isAutoChargeEnabledFor(userId: string): boolean {
  const allow = process.env.WEBHOOK_AUTO_CHARGE_USER_IDS?.trim();
  if (!allow) return false;
  if (allow === "*") return true;
  return allow.split(",").map((s) => s.trim()).includes(userId);
}

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

  // 비-UUID paymentId 가드:
  // charge_orders.order_id 는 UUID 컬럼. useCharge.ts 의 fallback (`charge_${Date.now()}`) 또는
  // 옛 결제의 paymentId 형식이 UUID 아니면 Postgres uuid cast error → 500 응답 →
  // PortOne 재시도 폭주. 형식이 우리 발급 UUID 패턴 아니면 명시적으로 ignored 처리.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(orderId)) {
    console.info("[WEBHOOK] 비-UUID paymentId — 신구조 아님, ignored", { paymentId });
    return NextResponse.json({ ok: true, ignored: "non-uuid paymentId" });
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("charge_orders")
    .select("status, amount, user_id, package_id")
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

  // 결제 금액 검증 (★ 결제 보안):
  // PortOne API 응답의 paid amount 가 우리 charge_orders 의 expected amount 와 일치해야 함.
  // /api/coins/charge 와 동일한 검증 패턴 (route.ts:77-80). 불일치 시 paid 마킹 금지.
  // 시나리오: 클라이언트가 1,000원 주문 만들고 100원만 결제 시도 → status PAID 받지만 amount 불일치.
  const paidAmount = paymentData.amount?.total ?? paymentData.amount?.paid;
  if (paidAmount !== existing.amount) {
    console.error("[WEBHOOK] amount 불일치, paid 마킹 금지", {
      orderId,
      expected: existing.amount,
      paid: paidAmount,
    });
    return NextResponse.json({ error: "amount mismatch" }, { status: 400 });
  }

  // 상태 머신:
  //   pending → paid     (webhook이 redirect보다 먼저 도착)
  //   paid    → paid     (멱등, 변화 없음)
  //   charged → charged  (이미 redirect 흐름이 충전 완료, webhook은 사후 도착 — 자동 충전 skip)
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
  } else if (existing.status === "charged") {
    console.info("[WEBHOOK] charge_orders 이미 charged, 자동 충전 skip", { orderId });
    return NextResponse.json({ ok: true, alreadyCharged: true });
  } else {
    console.info("[WEBHOOK] charge_orders 다른 상태, no-op", { orderId, status: existing.status });
  }

  // ─── 자동 충전 (브라우저 복귀 의존 없음) ─────────────────────────────────
  // 운영자 whitelist 게이트 — env 미설정이면 관찰 모드 유지 (paid 마킹까지만).
  if (!isAutoChargeEnabledFor(existing.user_id)) {
    console.info("[WEBHOOK] 자동 충전 OFF (whitelist 미적용)", { orderId, userId: existing.user_id });
    return NextResponse.json({ ok: true, autoCharge: "disabled" });
  }

  // 패키지 검증 — charge_orders.package_id가 알려진 패키지인지 + price 일치.
  const pkg = COIN_PACKAGES.find((p) => p.id === existing.package_id);
  if (!pkg) {
    console.error("[WEBHOOK] 알 수 없는 package_id, 자동 충전 거부", {
      orderId,
      packageId: existing.package_id,
    });
    return NextResponse.json({ error: "unknown package" }, { status: 400 });
  }
  if (pkg.price !== existing.amount) {
    console.error("[WEBHOOK] package price ≠ charge_orders.amount, 자동 충전 거부", {
      orderId,
      pkgPrice: pkg.price,
      ordersAmount: existing.amount,
    });
    return NextResponse.json({ error: "package price mismatch" }, { status: 400 });
  }

  // payment_transactions 멱등 기록 (onConflict: order_id, ignoreDuplicates).
  // /api/coins/charge 와 동일 패턴 — redirect 흐름이 먼저 박았으면 silent skip.
  const paymentMethod = paymentData.method?.provider || paymentData.method?.type || "portone";
  await supabaseAdmin
    .from("payment_transactions")
    .upsert(
      {
        user_id: existing.user_id,
        order_id: orderId,
        method: paymentMethod,
        amount: existing.amount,
        status: "success",
      },
      { onConflict: "order_id", ignoreDuplicates: true }
    );

  // charge_coins RPC 호출 — 멱등 가드 내장.
  // 같은 order_id 두 번 호출이면 두 번째는 charged=0, bonus=0 반환 (no-op).
  // webhook과 redirect가 동시에 호출돼도 한 번만 실제 충전됨.
  const rpc = await supabaseAdmin.rpc("charge_coins", {
    p_user_id: existing.user_id,
    p_package_id: existing.package_id,
    p_order_id: orderId,
  });

  if (rpc.error) {
    console.error("[WEBHOOK] charge_coins RPC 실패", {
      orderId,
      message: rpc.error.message,
    });
    // 500 응답 → PortOne 자동 재시도. RPC 멱등이라 안전.
    return NextResponse.json({ error: "charge failed" }, { status: 500 });
  }

  const result = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  const alreadyCharged = result?.charged === 0 && result?.bonus === 0;

  // 첫 충전이면 charge_orders.status → charged.
  // 이미 charged 였다면 update 시점은 no-op (status가 charged면 .eq("status", "paid") 매칭 X).
  if (!alreadyCharged) {
    await supabaseAdmin
      .from("charge_orders")
      .update({
        status: "charged",
        charged_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .eq("status", "paid"); // race 가드: 동시에 redirect가 charged 박았으면 skip
    console.info("[WEBHOOK] 자동 충전 완료", {
      orderId,
      charged: result?.charged,
      bonus: result?.bonus,
    });
  } else {
    console.info("[WEBHOOK] charge_coins RPC 멱등 가드 발동, no-op", { orderId });
  }

  return NextResponse.json({
    ok: true,
    autoCharge: "executed",
    charged: result?.charged ?? 0,
    bonus: result?.bonus ?? 0,
    alreadyCharged,
  });
}
