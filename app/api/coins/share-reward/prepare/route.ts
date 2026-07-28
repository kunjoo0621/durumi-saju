import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";
import { isShareRewardKind, type ShareRewardKind } from "@/lib/constants/share-reward";

// 공유 보상 nonce 발급.
//
// ★ 이 라우트가 보상 시스템의 보안 관문이다.
//   kind당 1회 지급이 되면서 "클라이언트가 kind를 바꿔 또 받기"가 최대 공격면이 됐다.
//   그래서 kind는 클라이언트 주장값을 그대로 쓰지 않고, kind→테이블 고정 매핑으로
//   "본인 소유의 실물 결과 row"가 있는지 서버가 확인해야만 nonce가 나간다.
//   → 다른 kind로 또 받으려면 그 상품을 실제로 구매해야 한다 = 정책이 의도한 정당한 지급.
//   웹훅 쪽은 kind를 nonce row에서만 읽으므로, 이 지점만 지키면 전 구간이 닫힌다.

type KindCheck = {
  table: string;
  /** 결제/분석 완료를 확인하는 추가 조건. 미검증 라인은 등록하지 않는다. */
  requireNonNull?: string;
};

// Phase 1~2a 대상만 등록한다.
// wealth/marriage/career는 결제 게이팅 구조를 아직 실측하지 않았다.
// 공짜 티저 row에 보상이 나가면 정책이 무너지므로, 검증 전까지는 기본 거부로 둔다.
const KIND_CHECKS: Partial<Record<ShareRewardKind, KindCheck>> = {
  result: { table: "saju_results" },
  battle: { table: "saju_battles" },
  yearly: { table: "yearly_results" },
  pet: { table: "pet_compat_results" },
};

const NONCE_TTL_MINUTES = 30;
const MAX_NONCES_PER_HOUR = 10;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const resultKind = body?.resultKind;
    const resultId = body?.resultId;

    if (!isShareRewardKind(resultKind) || typeof resultId !== "string" || !resultId) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const check = KIND_CHECKS[resultKind];
    if (!check) {
      // 아직 열지 않은 라인 — 공유는 가능하되 보상은 없다
      return NextResponse.json({ error: "지원하지 않는 결과입니다." }, { status: 400 });
    }

    // 소유 확인: 본인 것이 아니면 nonce를 주지 않는다
    let query = supabaseAdmin
      .from(check.table)
      .select("id")
      .eq("id", resultId)
      .eq("user_id", userId);
    if (check.requireNonNull) query = query.not(check.requireNonNull, "is", null);

    const { data: owned, error: ownErr } = await query.maybeSingle();
    if (ownErr) {
      console.error("[SHARE_PREPARE] ownership query error", ownErr.message);
      return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!owned) {
      return NextResponse.json({ error: "본인의 결과만 공유할 수 있습니다." }, { status: 400 });
    }

    // 남발 방지: 시간당 발급 상한
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await supabaseAdmin
      .from("share_kakao_nonces")
      .select("nonce", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if (countErr) {
      console.error("[SHARE_PREPARE] rate count error", countErr.message);
    } else if ((count ?? 0) >= MAX_NONCES_PER_HOUR) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해 주세요." },
        { status: 429 }
      );
    }

    // 이미 이 종류로 받았는지 — 공유는 계속 가능하고, 보상 문구만 감춘다
    const { data: granted } = await supabaseAdmin
      .from("share_reward_grants")
      .select("result_kind")
      .eq("user_id", userId)
      .eq("result_kind", resultKind)
      .maybeSingle();

    const nonce = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + NONCE_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: insErr } = await supabaseAdmin.from("share_kakao_nonces").insert({
      nonce,
      user_id: userId,
      result_kind: resultKind,
      result_id: resultId,
      expires_at: expiresAt,
    });
    if (insErr) {
      console.error("[SHARE_PREPARE] nonce insert error", insErr.message);
      return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      nonce,
      alreadyGranted: !!granted,
    });
  } catch (error: any) {
    console.error("[SHARE_PREPARE] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
