import { NextRequest, NextResponse } from "next/server";
import { assertNoContentKey, buildInputHash, runTeaserAnalysis, type InputPayload } from "@/lib/analysis";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, getClientIp } from "@/lib/server/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const minuteLimit = checkRateLimit(`analyze:${ip}:m`, 12, 60_000);
    const hourLimit = checkRateLimit(`analyze:${ip}:h`, 120, 60 * 60_000);
    if (!minuteLimit.allowed || !hourLimit.allowed) {
      console.warn("[RATE_LIMIT] /api/analyze", { ip });
      const retryAfter = Math.max(minuteLimit.retryAfter, hourLimit.retryAfter);
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = (await request.json()) as InputPayload & { mode?: "teaser" | "full" };
    const input = body as InputPayload;
    if (!input?.name || !input.birthYear || !input.birthMonth || !input.birthDay) {
      return NextResponse.json({ error: "입력값이 부족합니다." }, { status: 400 });
    }
    const inputHash = buildInputHash(input);
    const now = new Date().toISOString();

    const cached = await supabaseAdmin
      .from("teaser_cache")
      .select("result_json, expires_at, hit_count")
      .eq("input_hash", inputHash)
      .gt("expires_at", now)
      .maybeSingle();

    if (cached.data?.result_json) {
      try {
        await supabaseAdmin
          .from("teaser_cache")
          .update({ hit_count: (cached.data as any).hit_count ? (cached.data as any).hit_count + 1 : 1 })
          .eq("input_hash", inputHash)
          .throwOnError();
      } catch {
        // ignore cache hit update failures
      }
      return NextResponse.json({ result: cached.data.result_json, mode: "teaser", cached: true });
    }

    const teaser = await runTeaserAnalysis(input);

    try {
      assertNoContentKey(teaser);
    } catch (err) {
      console.error("[TEASER_GUARD]", err);
      return NextResponse.json({ error: "Teaser payload invalid" }, { status: 500 });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    try {
      await supabaseAdmin
        .from("teaser_cache")
        .upsert(
          {
            input_hash: inputHash,
            result_json: teaser,
            expires_at: expiresAt,
          },
          { onConflict: "input_hash" }
        )
        .throwOnError();
    } catch {
      // ignore cache write failures
    }

    return NextResponse.json({ result: teaser, mode: "teaser" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "사주 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
