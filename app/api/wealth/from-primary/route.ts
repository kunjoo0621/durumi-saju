import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseUserId } from "@/lib/server/user";
import { getPrimarySajuData } from "@/lib/server/get-primary-saju";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import { deriveWealthFacts } from "@/lib/wealth-facts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 대표사주(primary)에서 재물운 테스트 입력을 자동 채운다.
// app/api/marriage/from-primary/route.ts 미러 — 조립 로직은 lib/analysis.ts:2330-2389
// (resolveSajuEnrichedData)의 미러: 음력 변환 → calculateSaju → enrichSajuData → calculateFortune
// 순서를 그대로 따른다.
//
// 결혼운과의 차이: 재성(財星)은 성별 중립이라 facts 조립 자체에는 gender를 넘기지 않는다
// (deriveWealthFacts 시그니처에 gender 없음). 다만 primary.gender/employmentStatus는 여전히
// 읽어서 응답에 실어 보낸다 — employmentStatus는 analyze 단계에서 프롬프트 grounding에 쓰인다.

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

    let fortune = null;
    try {
      fortune = await calculateFortune({
        birthYear: calcYear,
        birthMonth: calcMonth,
        birthDay: calcDay,
        birthHour: hour,
        birthMinute: minute,
        gender: /여|female|f/i.test(primary.gender) ? "female" : "male",
        birthLocation: primary.birthLocation,
        yearPillar: saju.year.heavenlyStem + saju.year.earthlyBranch,
        monthPillar: saju.month.heavenlyStem + saju.month.earthlyBranch,
        dayPillar: saju.day.heavenlyStem + saju.day.earthlyBranch,
        hourPillar: saju.hour.heavenlyStem + saju.hour.earthlyBranch,
        isTimeUnknown: primary.unknownBirthTime,
      });
    } catch (fortuneError) {
      console.error("[WEALTH from-primary] fortune 계산 실패 (타이밍 없이 진행)", fortuneError);
    }

    const currentYear = new Date().getFullYear();
    // interest 기본값 — 프리필 단계에는 아직 사용자가 관심사를 선택하지 않았으므로
    // facts 조립을 위한 임시값만 사용한다(관심사-구조 불일치 감지 등은 실제 선택 후
    // /api/wealth/start·analyze에서 재조립된다).
    const facts = deriveWealthFacts(enriched, fortune, saju, "목돈·노후 준비", currentYear);

    // 재물운 점수: primary full_json.scores.재물운 (없으면 0 → 등급 C 폴백)
    const { data: srcRow, error: srcError } = await supabaseAdmin
      .from("saju_results")
      .select("full_json")
      .eq("id", primary.sourceResultId)
      .maybeSingle();
    if (srcError) {
      console.error("[WEALTH from-primary] full_json 조회 실패", srcError.message);
    }
    const wealthScore = Number((srcRow?.full_json as any)?.scores?.재물운 ?? 0);

    return NextResponse.json({
      facts,
      gender: primary.gender,
      employmentStatus: primary.employmentStatus,
      wealthScore,
      sajuText: formatSajuText(saju, { isTimeUnknown: primary.unknownBirthTime }),
      sourceResultId: primary.sourceResultId,
    });
  } catch (error: any) {
    // raw error.message 사용자 노출 금지 (CLAUDE.md 규약) — generic 메시지만, 상세는 서버 로그.
    console.error("[WEALTH from-primary]", error?.message || error);
    return NextResponse.json(
      { error: "재물운 정보를 불러오는 중 오류가 발생했어요." },
      { status: 500 },
    );
  }
}
