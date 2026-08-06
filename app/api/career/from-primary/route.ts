import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseUserId } from "@/lib/server/user";
import { getPrimarySajuData } from "@/lib/server/get-primary-saju";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import { deriveCareerFacts } from "@/lib/career-facts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 대표사주(primary)에서 커리어운 테스트 입력을 자동 채운다. app/api/wealth/from-primary/route.ts 미러.
// 관성(官星)도 성별 중립이라 facts 조립에 gender를 넘기지 않는다(deriveCareerFacts 시그니처에 없음).
// primary.gender/employmentStatus는 응답에 실어 보낸다 — employmentStatus는 analyze 프롬프트 grounding용.

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
      console.error("[CAREER from-primary] fortune 계산 실패 (타이밍 없이 진행)", fortuneError);
    }

    const currentYear = new Date().getFullYear();
    // situation 기본값 — 프리필 단계엔 아직 사용자가 상황을 선택하지 않았으므로 facts 조립용 임시값만.
    // (상황-구조 불일치 감지 등은 실제 선택 후 /api/career/start·analyze에서 재조립된다.)
    const facts = deriveCareerFacts(enriched, fortune, saju, "진로 탐색", currentYear);

    // 직장운 점수: primary full_json.scores.직장운 (없으면 0 → 등급 C 폴백)
    const { data: srcRow, error: srcError } = await supabaseAdmin
      .from("saju_results")
      .select("full_json")
      .eq("id", primary.sourceResultId)
      .maybeSingle();
    if (srcError) {
      console.error("[CAREER from-primary] full_json 조회 실패", srcError.message);
    }
    const careerScore = Number((srcRow?.full_json as any)?.scores?.직장운 ?? 0);

    return NextResponse.json({
      facts,
      gender: primary.gender,
      employmentStatus: primary.employmentStatus,
      // ★점수 자체는 내려보내지 않는다: 등급이 이 점수의 결정론 함수라 숫자를 주면
      // 결제 전에 등급을 역산할 수 있다(티저 등급 마스킹과 같은 이유). 진입 화면은
      // "이전 분석이 있다"는 사실만 필요하므로 boolean으로 축약한다.
      hasCareerScore: careerScore > 0,
      sajuText: formatSajuText(saju, { isTimeUnknown: primary.unknownBirthTime }),
      sourceResultId: primary.sourceResultId,
    });
  } catch (error: any) {
    console.error("[CAREER from-primary]", error?.message || error);
    return NextResponse.json(
      { error: "커리어운 정보를 불러오는 중 오류가 발생했어요." },
      { status: 500 },
    );
  }
}
