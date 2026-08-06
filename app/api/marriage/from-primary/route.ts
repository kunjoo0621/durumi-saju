import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseUserId } from "@/lib/server/user";
import { getPrimarySajuData } from "@/lib/server/get-primary-saju";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import { deriveMarriageFacts, type MaritalStatus } from "@/lib/marriage-facts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 대표사주(primary)에서 결혼운 테스트 입력을 자동 채운다.
// 조립 로직은 lib/analysis.ts:2330-2389 (resolveSajuEnrichedData)의 미러 —
// 음력 변환 → calculateSaju → enrichSajuData → calculateFortune 순서를 그대로 따른다.

function normGender(g: string): "male" | "female" {
  return /여|female|f/i.test(g) ? "female" : "male";
}

// 실측(app/edit-profile/page.tsx, components/saju-input/SajuInputFlow.tsx):
// relationship_status 저장값은 "솔로"|"연애중"|"기혼" 3분법뿐 — "다시 혼자"는 입력 UI에 없다.
function prefill(rs: string): MaritalStatus {
  if (rs.includes("연애")) return "연애중";
  if (rs.includes("기혼")) return "기혼";
  return "솔로"; // '다시 혼자'는 저장 3분법에 없음 → 사용자가 화면에서 정정 선택
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const primary = await getPrimarySajuData(userId);
    if (!primary) {
      return NextResponse.json({ error: "먼저 사주 분석을 완료해 주세요." }, { status: 404 });
    }

    let calcYear = Number(primary.birthYear);
    let calcMonth = Number(primary.birthMonth);
    let calcDay = Number(primary.birthDay);

    // 음력 생년월일이면 계산 전 양력 변환 (lib/analysis.ts resolveSajuEnrichedData와 동일 처리)
    if (primary.calendarType === "lunar") {
      const converted = convertLunarToSolar(calcYear, calcMonth, calcDay);
      if (!converted) {
        return NextResponse.json({ error: "생년월일 변환에 실패했어요." }, { status: 500 });
      }
      calcYear = converted.year;
      calcMonth = converted.month;
      calcDay = converted.day;
    }

    const hour = primary.unknownBirthTime ? undefined : Number(primary.birthHour);
    const minute = primary.unknownBirthTime ? undefined : Number(primary.birthMinute);

    const saju = await calculateSaju(calcYear, calcMonth, calcDay, hour, minute, {
      birthLocation: primary.birthLocation,
    });
    if (!saju) {
      return NextResponse.json({ error: "사주 계산에 실패했어요." }, { status: 500 });
    }

    const enriched = enrichSajuData(saju, { isTimeUnknown: primary.unknownBirthTime });
    const gender = normGender(primary.gender);

    let fortune = null;
    try {
      fortune = await calculateFortune({
        birthYear: calcYear,
        birthMonth: calcMonth,
        birthDay: calcDay,
        birthHour: hour,
        birthMinute: minute,
        gender,
        birthLocation: primary.birthLocation,
        yearPillar: saju.year.heavenlyStem + saju.year.earthlyBranch,
        monthPillar: saju.month.heavenlyStem + saju.month.earthlyBranch,
        dayPillar: saju.day.heavenlyStem + saju.day.earthlyBranch,
        hourPillar: saju.hour.heavenlyStem + saju.hour.earthlyBranch,
        isTimeUnknown: primary.unknownBirthTime,
      });
    } catch (fortuneError) {
      console.error("[MARRIAGE from-primary] fortune 계산 실패 (타이밍 없이 진행)", fortuneError);
    }

    const currentYear = new Date().getFullYear();
    const prefillStatus = prefill(primary.relationshipStatus);
    const facts = deriveMarriageFacts(enriched, fortune, saju, gender, prefillStatus, currentYear);

    // 연애운 점수: primary full_json.scores.연애운 (없으면 0 → 등급 C 폴백)
    const { data: srcRow, error: srcError } = await supabaseAdmin
      .from("saju_results")
      .select("full_json")
      .eq("id", primary.sourceResultId)
      .maybeSingle();
    if (srcError) {
      console.error("[MARRIAGE from-primary] full_json 조회 실패", srcError.message);
    }
    const loveScore = Number((srcRow?.full_json as any)?.scores?.연애운 ?? 0);

    return NextResponse.json({
      facts,
      prefillStatus,
      // ★점수 자체는 내려보내지 않는다: 등급이 이 점수의 결정론 함수라 숫자를 주면
      // 결제 전에 등급을 역산할 수 있다(티저 등급 마스킹과 같은 이유). 진입 화면은
      // "이전 분석이 있다"는 사실만 필요하므로 boolean으로 축약한다.
      hasLoveScore: loveScore > 0,
      sajuText: formatSajuText(saju, { isTimeUnknown: primary.unknownBirthTime }),
      sourceResultId: primary.sourceResultId,
    });
  } catch (error: any) {
    // raw error.message 사용자 노출 금지 (CLAUDE.md 규약) — generic 메시지만, 상세는 서버 로그.
    console.error("[MARRIAGE from-primary]", error?.message || error);
    return NextResponse.json(
      { error: "결혼운 정보를 불러오는 중 오류가 발생했어요." },
      { status: 500 },
    );
  }
}
