import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, resolveSajuEnrichedData, type InputPayload } from "@/lib/analysis";
import { calculateServerScoring, SCORING_VERSION } from "@/lib/utils/saju-scoring";
import { getSupabaseUserId } from "@/lib/server/user";
import { checkRateLimit, getClientIp } from "@/lib/server/rateLimit";
import { parseJson5Loose } from "@/lib/json5Utils";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const ip = getClientIp(request.headers);
    const minuteLimit = checkRateLimit(`result:${userId}:m`, 30, 60_000);
    const hourLimit = checkRateLimit(`result:${userId}:h`, 300, 60 * 60_000);
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
      .select(
        "full_json, unlocked_at, name, birth_date, birth_time, region, gender, relationship_status, employment_status, calendar_type, core_fear_axis, saju_text"
      )
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data?.full_json) {
      return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
    }

    let parsedResult: unknown = data.full_json;
    if (typeof parsedResult === "string") {
      try {
        parsedResult = parseJson5Loose(parsedResult);
      } catch (parseError: any) {
        console.warn("[RESULTS_FULL] Failed to parse stored full_json", {
          userId,
          resultId: resolvedResultId,
          message: parseError?.message,
        });
        return NextResponse.json(
          { error: "저장된 결과 데이터가 손상되었습니다. 고객센터에 문의해 주세요." },
          { status: 500 }
        );
      }
    }

    // 스코어링 버전이 오래되었으면 tier/scores만 실시간 재계산 (텍스트는 유지)
    const storedVersion = (parsedResult as any)?.scoringVersion ?? 0;
    if (storedVersion < SCORING_VERSION && data.birth_date) {
      try {
        const [bY, bM, bD] = data.birth_date.split("-");
        const timeParts = data.birth_time?.split(":") || [];
        const refreshInput: InputPayload = {
          name: data.name || "",
          birthYear: bY || "",
          birthMonth: bM || "",
          birthDay: bD || "",
          calendarType: (data.calendar_type as "solar" | "lunar") || "solar",
          birthHour: timeParts[0] || "",
          birthMinute: timeParts[1] || "",
          birthLocation: data.region || "",
          gender: data.gender || "",
          relationshipStatus: data.relationship_status || "",
          employmentStatus: data.employment_status || "",
          coreFearAxis: (data.core_fear_axis || "") as InputPayload["coreFearAxis"],
          unknownBirthTime: !data.birth_time,
        };
        const { enriched } = await resolveSajuEnrichedData(refreshInput);
        const freshScoring = calculateServerScoring(enriched);
        const pr = parsedResult as Record<string, any>;
        pr.tier = { ...pr.tier, ...freshScoring.tier };
        pr.scores = freshScoring.scores;
        pr.scoringVersion = SCORING_VERSION;
        console.info("[SCORING_UPGRADE] results/full re-scored", {
          storedVersion,
          currentVersion: SCORING_VERSION,
          oldGrade: (parsedResult as any)?.tier?.grade,
          newGrade: freshScoring.tier.grade,
        });
      } catch (e) {
        console.warn("[SCORING_UPGRADE] re-score failed, returning stale", e);
      }
    }

    return NextResponse.json({
      result: parsedResult,
      unlockedAt: data.unlocked_at,
      access: "user",
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
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
