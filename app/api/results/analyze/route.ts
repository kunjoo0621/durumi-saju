import { NextRequest, NextResponse } from "next/server";
import { buildChartForAnalysis } from "@/lib/result-chart";
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

      // ★원국 스냅샷을 분석 시점에 박아둔다 — 나중에 엔진이 바뀌어도 이 결과의 화면은
      //   본문과 같은 사주를 가리킨다(D-14 재발 방지). teaser 를 만든 뒤에 붙여 티저는 안 부풀린다.
      const chart = await buildChartForAnalysis({
        birthDate: row.birth_date,
        birthTime: row.birth_time,
        calendarType: row.calendar_type,
        birthLocation: row.region,
      });
      if (chart) (full as any).chart = chart;

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

      // DB 업데이트 — .select() 로 실제 반영된 row 수를 확인한다.
      const { data: updatedRows, error: updateError } = await supabaseAdmin
        .from("saju_results")
        .update({ full_json: full, teaser_json: teaser, saju_text: sajuText })
        .eq("id", resultId)
        .select("id");

      if (updateError) {
        console.error("[ANALYZE] update failed", updateError.message);
        await supabaseAdmin
          .from("saju_results")
          .update({ full_json: { _error: true, _message: "결과 저장 실패" } })
          .eq("id", resultId);
        await refundCoins(userId, SAJU_COST, refundRef);
        return NextResponse.json({ error: "결과 저장에 실패했습니다.", refunded: true }, { status: 500 });
      }

      // 0건 업데이트 = row 가 SELECT 이후 분석 도중 사라짐. supabase 는 이걸 에러 없이
      // 통과시켜 "돈 냄 → 결과 없음 → 환불 없음" 조용한 손실을 만든다(김효은 사건).
      // 환불 + 원인추적용 loud log 로 전환. (row 가 없으므로 _error 마커는 생략)
      if (!updatedRows || updatedRows.length === 0) {
        console.error(
          `[ANALYZE] 결과 row 소실: update 0건 — 분석 도중 삭제됨. resultId=${resultId} userId=${userId} refundRef=${refundRef}`,
        );
        await refundCoins(userId, SAJU_COST, refundRef);
        return NextResponse.json(
          { error: "분석 결과를 저장할 수 없습니다. 알은 환불되었습니다.", refunded: true },
          { status: 500 },
        );
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
