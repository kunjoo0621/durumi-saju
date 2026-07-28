import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 카카오톡 공유 웹훅 수신 — "메시지가 수신자에게 성공적으로 전달된" 시점에만 호출된다.
// 이것이 웹에서 실제 전송을 확인할 수 있는 유일한 신호다(JS SDK에는 전송 성공 콜백이 없다).
//
// 설계 제약 3가지:
//   1. 3초 안에 2XX를 돌려줘야 한다 → 검증·지급·로그를 동기로 끝낸다(DB 왕복 2회 수준).
//      Vercel 서버리스는 응답 후 실행을 보장하지 않으므로 fire-and-forget 금지.
//   2. 카카오는 HMAC 서명을 주지 않는다 → 어드민 키 대조 + 1회용 nonce 2중 방어.
//   3. 재시도 정책이 문서화돼 있지 않다 → 실패도 200으로 답하고 verdict 로그로만 남긴다.
//      (5XX를 돌려줘서 얻는 이득이 불확실한 반면, 재시도 폭주 리스크는 실재한다)
//
// ★ result_kind는 이 페이로드에서 절대 읽지 않는다. nonce row에 저장된 값만 쓴다.
//   (kind당 1회 정책에서 kind 위조가 최대 공격면이기 때문)

// 미들웨어 보호 대상이 아니다(/api/coins 밖) — 비인증 공개 엔드포인트가 맞다.
export const dynamic = "force-dynamic";

type Verdict =
  | "granted"
  | "already_granted"
  | "already_consumed"
  | "invalid_nonce"
  | "expired"
  | "rejected_memo_chat"
  | "rejected_single_chatroom"
  | "rejected_open_chat"
  | "auth_fail"
  | "bad_request"
  | "error";

const OPEN_CHAT_TYPES = new Set(["OpenDirectChat", "OpenMultiChat"]);

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function parseBool(v: string | null | undefined): boolean | null {
  if (v == null) return null;
  const s = String(v).toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return null;
}

async function readParams(request: Request): Promise<Record<string, string>> {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    params[k] = v;
  });

  if (request.method === "POST") {
    // 카카오가 POST 본문을 어떤 형식으로 보내는지는 문서에 없다.
    // 콘솔에는 GET으로 등록해 뒀지만, 나중에 바꿔도 깨지지 않게 둘 다 받는다.
    const raw = await request.text().catch(() => "");
    if (raw) {
      try {
        const json = JSON.parse(raw);
        if (json && typeof json === "object") {
          for (const [k, v] of Object.entries(json)) {
            if (v != null) params[k] = String(v);
          }
        }
      } catch {
        try {
          new URLSearchParams(raw).forEach((v, k) => {
            params[k] = v;
          });
        } catch {
          // 파싱 불가 본문은 무시 — 쿼리스트링만으로 진행
        }
      }
    }
  }

  return params;
}

async function logWebhook(row: {
  nonce?: string | null;
  resourceId?: string | null;
  chatType?: string | null;
  isSingleChatroom?: boolean | null;
  memberCountRange?: string | null;
  resultKind?: string | null;
  verdict: Verdict;
  latencyMs: number;
}) {
  const { error } = await supabaseAdmin.from("share_kakao_webhook_log").insert({
    nonce: row.nonce ?? null,
    resource_id: row.resourceId ?? null,
    chat_type: row.chatType ?? null,
    is_single_chatroom: row.isSingleChatroom ?? null,
    chat_member_count_range: row.memberCountRange ?? null,
    result_kind: row.resultKind ?? null,
    verdict: row.verdict,
    latency_ms: row.latencyMs,
  });
  if (error) console.error("[KAKAO_WEBHOOK] log insert error", error.message);
}

async function handle(request: Request) {
  const startedAt = Date.now();
  const ok = () => NextResponse.json({ ok: true });

  try {
    // ① 어드민 키 대조
    const adminKey = process.env.KAKAO_ADMIN_KEY;
    const auth = request.headers.get("authorization") || "";
    if (!adminKey || !safeEqual(auth, `KakaoAK ${adminKey}`)) {
      await logWebhook({ verdict: "auth_fail", latencyMs: Date.now() - startedAt });
      return ok();
    }

    const params = await readParams(request);
    const nonce = params.n || null;
    const chatType = params.CHAT_TYPE || null;
    const isSingle = parseBool(params.IS_SINGLE_CHATROOM);
    const memberRange = params.CHAT_MEMBER_COUNT_RANGE || null;
    const resourceId = request.headers.get("x-kakao-resource-id");

    const base = {
      nonce,
      resourceId,
      chatType,
      isSingleChatroom: isSingle,
      memberCountRange: memberRange,
    };

    if (!nonce) {
      await logWebhook({ ...base, verdict: "bad_request", latencyMs: Date.now() - startedAt });
      return ok();
    }

    // ② 거부 판정 — nonce를 소모하지 않는다.
    //    사용자가 곧바로 친구에게 다시 보내면 같은 nonce로 받을 수 있어야 하기 때문.
    let rejectReason: string | null = null;
    let rejectVerdict: Verdict | null = null;

    if (chatType === "MemoChat") {
      rejectReason = "memo_chat";
      rejectVerdict = "rejected_memo_chat";
    } else if (isSingle === true) {
      rejectReason = "single_chatroom";
      rejectVerdict = "rejected_single_chatroom";
    } else if (
      process.env.SHARE_REWARD_BLOCK_OPEN_CHAT === "1" &&
      chatType &&
      OPEN_CHAT_TYPES.has(chatType)
    ) {
      // 오픈채팅은 기본 허용(운영자 결정). 살포가 관측되면 이 토글로 되돌린다.
      rejectReason = "open_chat";
      rejectVerdict = "rejected_open_chat";
    }

    if (rejectVerdict) {
      const { error } = await supabaseAdmin
        .from("share_kakao_nonces")
        .update({ last_reject_reason: rejectReason })
        .eq("nonce", nonce)
        .is("consumed_at", null);
      if (error) console.error("[KAKAO_WEBHOOK] reject mark error", error.message);

      await logWebhook({ ...base, verdict: rejectVerdict, latencyMs: Date.now() - startedAt });
      return ok();
    }

    // ③ 소모 + 지급 (kind는 nonce row에서만 읽는다)
    const { data, error } = await supabaseAdmin.rpc("consume_share_nonce_and_grant", {
      p_nonce: nonce,
    });
    if (error) {
      console.error("[KAKAO_WEBHOOK] rpc error", error.message);
      await logWebhook({ ...base, verdict: "error", latencyMs: Date.now() - startedAt });
      return ok();
    }

    const row = Array.isArray(data) ? data[0] : data;
    const verdict = (row?.verdict ?? "error") as Verdict;

    await logWebhook({
      ...base,
      resultKind: row?.result_kind ?? null,
      verdict,
      latencyMs: Date.now() - startedAt,
    });

    return ok();
  } catch (error: any) {
    console.error("[KAKAO_WEBHOOK] error", error?.message);
    await logWebhook({ verdict: "error", latencyMs: Date.now() - startedAt });
    return ok();
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
