import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";
import { checkRateLimit, getClientIp } from "@/lib/server/rateLimit";
import { parseJson5Loose } from "@/lib/json5Utils";
import { hashToken, getTokensFromCookie } from "@/lib/guest-token";

function buildResponse(data: any, access: "user" | "guest") {
  let parsedResult: unknown = data.full_json;
  if (typeof parsedResult === "string") {
    try {
      parsedResult = parseJson5Loose(parsedResult);
    } catch (parseError: any) {
      console.warn("[RESULTS_FULL] Failed to parse stored full_json", {
        message: parseError?.message,
      });
      return NextResponse.json(
        { error: "저장된 결과 데이터가 손상되었습니다. 고객센터에 문의해 주세요." },
        { status: 500 }
      );
    }
  }

  return {
    result: parsedResult,
    resultId: data.id,
    unlockedAt: data.unlocked_at,
    access,
    is_guest: access === "guest",
    input: {
      name: data.name,
      birthDate: data.birth_date,
      birthTime: data.birth_time,
      region: data.region,
      gender: data.gender,
      relationshipStatus: data.relationship_status,
      employmentStatus: data.employment_status,
      calendarType: data.calendar_type,
      coreFearAxis: data.core_fear_axis,
      sajuText: data.saju_text,
    },
  };
}

async function rescoreIfStale(_parsedResult: any, _data: any) {
  // freeze: 본문(saju_text)은 옛 LLM 출력 그대로라 점수만 v15로 덮어쓰면 본문-점수 미스매치 발생.
  // 신규 분석은 payment/complete에서 v15로 산출되므로 결과 GET 시점 재계산은 끔.
  return;
}

const RESULT_FIELDS =
  "id, full_json, unlocked_at, name, birth_date, birth_time, region, gender, relationship_status, employment_status, calendar_type, core_fear_axis, saju_text";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? await getSupabaseUserId(session) : null;

    const ip = getClientIp(request.headers);
    const rateLimitKey = userId || ip;
    const minuteLimit = checkRateLimit(`result:${rateLimitKey}:m`, 30, 60_000);
    const hourLimit = checkRateLimit(`result:${rateLimitKey}:h`, 300, 60 * 60_000);
    if (!minuteLimit.allowed || !hourLimit.allowed) {
      console.warn("[RATE_LIMIT] /api/results/full", { userId, ip });
      const retryAfter = Math.max(minuteLimit.retryAfter, hourLimit.retryAfter);
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    let input: InputPayload | null = null;
    let resultId: string | null = null;
    const bodyText = await request.text();
    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText) as InputPayload & { resultId?: string | null };
        input = parsed;
        resultId = parsed.resultId ?? null;
      } catch {
        input = null;
      }
    }

    let resolvedResultId = resultId;
    let inputHash: string | null = null;

    if (!resolvedResultId && input) {
      inputHash = buildInputHash(input);
    }

    if (!resolvedResultId && !inputHash) {
      return NextResponse.json({ error: "조회 조건이 필요합니다." }, { status: 400 });
    }

    // ============ 로그인 사용자: 기존 로직 (result_unlocks) ============
    if (userId) {
      if (resolvedResultId) {
        const { data: unlock, error: unlockError } = await supabaseAdmin
          .from("result_unlocks")
          .select("result_id")
          .eq("user_id", userId)
          .eq("result_id", resolvedResultId)
          .maybeSingle();

        if (unlockError) {
          return NextResponse.json({ error: unlockError.message }, { status: 500 });
        }
        if (!unlock?.result_id) {
          return NextResponse.json({ error: "결제가 필요합니다." }, { status: 403 });
        }
      } else if (inputHash) {
        const { data: unlock, error: unlockError } = await supabaseAdmin
          .from("result_unlocks")
          .select("result_id")
          .eq("user_id", userId)
          .eq("input_hash", inputHash)
          .maybeSingle();

        if (unlockError) {
          return NextResponse.json({ error: unlockError.message }, { status: 500 });
        }
        if (!unlock?.result_id) {
          return NextResponse.json({ error: "결제가 필요합니다." }, { status: 403 });
        }
        resolvedResultId = unlock.result_id;
      }

      let query = supabaseAdmin
        .from("saju_results")
        .select(RESULT_FIELDS)
        .eq("user_id", userId)
        .order("unlocked_at", { ascending: false, nullsFirst: false })
        .limit(1);

      if (resolvedResultId) {
        query = query.eq("id", resolvedResultId);
      } else if (inputHash) {
        query = query.eq("input_hash", inputHash);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error("[RESULTS] full query error", error.message);
        return NextResponse.json({ error: "결과 조회 중 오류가 발생했습니다." }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
      }

      // 분석 진행 중 (full_json이 아직 null)
      if (data.full_json === null) {
        return NextResponse.json({ pending: true, resultId: data.id }, { status: 202 });
      }

      // 분석 실패
      if ((data.full_json as any)?._error) {
        return NextResponse.json({
          error: "분석에 실패했습니다. 알은 환불되었습니다.",
          failed: true,
          refunded: true,
        }, { status: 500 });
      }

      const resp = buildResponse(data, "user");
      if (resp instanceof NextResponse) return resp; // parse error

      await rescoreIfStale(resp.result, data);

      return NextResponse.json(resp);
    }

    // ============ guest: guest_token_hash로 직접 조회 ============
    const tokens = await getTokensFromCookie();
    if (tokens.length > 0) {
      const hashes = tokens.map((t) => hashToken(t));

      let guestQuery = supabaseAdmin
        .from("saju_results")
        .select(RESULT_FIELDS)
        .in("guest_token_hash", hashes)
        .gt("guest_token_expires_at", new Date().toISOString())
        .order("unlocked_at", { ascending: false, nullsFirst: false })
        .limit(1);

      if (resolvedResultId) {
        guestQuery = guestQuery.eq("id", resolvedResultId);
      } else if (inputHash) {
        guestQuery = guestQuery.eq("input_hash", inputHash);
      }

      const { data, error } = await guestQuery.maybeSingle();

      if (error) {
        console.error("[RESULTS] guest query error", error.message);
        return NextResponse.json({ error: "결과 조회 중 오류가 발생했습니다." }, { status: 500 });
      }

      if (data?.full_json) {
        const resp = buildResponse(data, "guest");
        if (resp instanceof NextResponse) return resp;

        await rescoreIfStale(resp.result, data);

        return NextResponse.json(resp);
      }
    }

    return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
  } catch (error: any) {
    console.error("[RESULTS] full error", error?.message);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
