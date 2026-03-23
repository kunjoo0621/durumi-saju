import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildTeaserFromFull, resolveSajuText, runFullAnalysis, type InputPayload } from "@/lib/analysis";
import { validatePersonalResult } from "@/lib/quality-gate";
import { getSupabaseUserId } from "@/lib/server/user";
import { refundCoins } from "@/lib/server/session-helpers";
import { SAJU_COST } from "@/lib/constants/coins";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { resultId } = (await request.json()) as { resultId: string };
    if (!resultId) {
      return NextResponse.json({ error: "resultId가 필요합니다." }, { status: 400 });
    }

    // 결과 row 조회 + 소유권 확인
    const { data: row, error: queryError } = await supabaseAdmin
      .from("saju_results")
      .select("id, user_id, input_hash, full_json, name, birth_date, birth_time, region, gender, relationship_status, employment_status, calendar_type, core_fear_axis")
      .eq("id", resultId)
      .eq("user_id", userId)
      .maybeSingle();

    if (queryError || !row) {
      return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
    }

    // 이미 분석 완료 (중복 호출 방지)
    if (row.full_json !== null && !(row.full_json as any)?._error) {
      return NextResponse.json({ status: "already_completed" });
    }

    // 실패 마커가 있으면 이미 환불된 상태 — 재분석 불가
    if ((row.full_json as any)?._error) {
      return NextResponse.json({ error: "이미 실패 처리된 결과입니다.", failed: true }, { status: 409 });
    }

    // InputPayload 복원
    const [bY, bM, bD] = (row.birth_date || "").split("-");
    const [bH, bMin] = (row.birth_time || "").split(":");
    const input: InputPayload = {
      name: row.name || "",
      birthYear: bY || "",
      birthMonth: bM || "",
      birthDay: bD || "",
      calendarType: (row.calendar_type as "solar" | "lunar") || "solar",
      birthHour: bH || "",
      birthMinute: bMin || "",
      birthLocation: row.region || "",
      gender: row.gender || "",
      relationshipStatus: row.relationship_status || "",
      employmentStatus: row.employment_status || "",
      coreFearAxis: (row.core_fear_axis || "") as InputPayload["coreFearAxis"],
      unknownBirthTime: !row.birth_time,
    };

    // 환불용 참조 — result_unlocks의 order_id로 정확한 트랜잭션 매칭
    const { data: unlock } = await supabaseAdmin
      .from("result_unlocks")
      .select("order_id")
      .eq("result_id", resultId)
      .eq("user_id", userId)
      .maybeSingle();
    const refundRef = unlock?.order_id || resultId;

    try {
      const sajuText = await resolveSajuText(input);
      const full = await runFullAnalysis({ ...input, saju: sajuText || input.saju });
      const teaser = buildTeaserFromFull(full);

      // Quality Gate (로깅)
      const qualityIssues = validatePersonalResult(full);
      if (qualityIssues.length > 0) {
        const errors = qualityIssues.filter((i) => i.severity === "error");
        const warns = qualityIssues.filter((i) => i.severity === "warning");
        console.warn("[ANALYZE] 품질 이슈:", {
          errors: errors.length,
          warnings: warns.length,
          issues: qualityIssues,
        });
      }

      // DB 업데이트
      const { error: updateError } = await supabaseAdmin
        .from("saju_results")
        .update({ full_json: full, teaser_json: teaser, saju_text: sajuText })
        .eq("id", resultId);

      if (updateError) {
        console.error("[ANALYZE] update failed", updateError.message);
        await supabaseAdmin
          .from("saju_results")
          .update({ full_json: { _error: true, _message: "결과 저장 실패" } })
          .eq("id", resultId);
        await refundCoins(userId, SAJU_COST, refundRef);
        return NextResponse.json({ error: "결과 저장에 실패했습니다.", refunded: true }, { status: 500 });
      }

      return NextResponse.json({ status: "completed" });
    } catch (analysisError: any) {
      console.error("[ANALYZE] analysis failed, refunding", analysisError?.message);
      await supabaseAdmin
        .from("saju_results")
        .update({ full_json: { _error: true, _message: "분석 실패" } })
        .eq("id", resultId);
      await refundCoins(userId, SAJU_COST, refundRef);
      return NextResponse.json({ error: "분석에 실패했습니다. 알은 환불되었습니다.", refunded: true }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[ANALYZE] error", error?.message);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
