// /api/marriage/start — 결혼운/애정운 심층 검사 teaser row 생성 (무료, 결제 없음)
// app/api/today/start 미러이되 결제 위치가 다르다: today는 start에서 차감하지만
// 결혼운 검사는 프리뷰(teaser)까지는 무료이고 실제 과금은 /api/marriage/analyze에서 일어난다
// (docs/superpowers/sdd/task-9-brief.md Step 1/2 순서 고정 참조).
//
// 두 진입 경로:
//   · source="primary": 대표사주(from-primary) 재사용 — 기존 로직 그대로.
//   · source="self": 로그인 유저가 방금 입력한 생년월일로 원국·점수 즉석 계산(lib/self-input).
//     로그인 시점이 입력완료(SajuInputFlow 제출)라 여기 도달 시 항상 로그인 상태다.
//
// facts 조립 로직은 app/api/marriage/from-primary/route.ts와 동일 소스 미러
// (lib/analysis.ts:2330-2389 resolveSajuEnrichedData 패턴) — 광범위 리팩토링 금지 원칙상
// 공유 함수로 뽑지 않고 그대로 중복한다.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";
import { getPrimarySajuData } from "@/lib/server/get-primary-saju";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import { deriveMarriageFacts, type MaritalStatus } from "@/lib/marriage-facts";
import { computeMarriageGrade, extractLoveScore } from "@/lib/marriage-grade";
import {
  normalizeSelfInput,
  computeSelfSaju,
  deriveSelfScores,
  type SelfSajuInput,
} from "@/lib/self-input";

const ALLOWED_STATUS: MaritalStatus[] = ["솔로", "연애중", "기혼", "다시 혼자"];

function normGender(g: string): "male" | "female" {
  return /여|female|f/i.test(g) ? "female" : "male";
}

type StartBody = { maritalStatus?: string; source?: "primary" | "self"; selfInput?: SelfSajuInput };

// primary/self 공통으로 넘길 원국 번들 — 이후 tail(facts→grade→teaser→upsert)은 source 무관 동일.
type Resolved = {
  input: InputPayload;
  inputHash: string;
  saju: Awaited<ReturnType<typeof calculateSaju>>;
  enriched: ReturnType<typeof enrichSajuData>;
  fortune: Awaited<ReturnType<typeof calculateFortune>> | null;
  gender: "male" | "female";
  sajuText: string;
  loveScore: number | null;
  sourceResultId: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as StartBody;
    const source = body.source === "self" ? "self" : "primary";
    const maritalStatus = body.maritalStatus as MaritalStatus | undefined;
    if (!maritalStatus || !ALLOWED_STATUS.includes(maritalStatus)) {
      return NextResponse.json({ error: "관계 상태를 다시 선택해 주세요." }, { status: 400 });
    }

    let resolved: Resolved;

    if (source === "self") {
      // 자체입력: 방금 입력한 생년월일로 원국·연애운 점수 즉석 계산. 대표사주 조회 없음.
      const input = normalizeSelfInput(body.selfInput ?? {});
      if (!input.birthYear || !input.birthMonth || !input.birthDay || !input.gender) {
        return NextResponse.json({ error: "생년월일과 성별을 다시 확인해 주세요." }, { status: 400 });
      }
      const inputHash = buildInputHash(input);
      const { saju, enriched, fortune, gender, sajuText } = await computeSelfSaju(input);
      // 연애운 점수: 개인사주 full_json.scores와 동일 산식(deriveSelfScores)으로 생성 → 등급 일치.
      const loveScore = extractLoveScore({ scores: deriveSelfScores(enriched) });
      resolved = { input, inputHash, saju, enriched, fortune, gender, sajuText, loveScore, sourceResultId: null };
    } else {
      // 대표사주(primary) 경로 — 기존 로직 그대로.
      const primary = await getPrimarySajuData(userId);
      if (!primary) {
        return NextResponse.json({ error: "먼저 사주 분석을 완료해 주세요." }, { status: 404 });
      }

      const input: InputPayload = {
        name: primary.name || "",
        birthYear: primary.birthYear,
        birthMonth: primary.birthMonth,
        birthDay: primary.birthDay,
        calendarType: primary.calendarType,
        birthHour: primary.birthHour,
        birthMinute: primary.birthMinute,
        birthLocation: primary.birthLocation,
        gender: primary.gender,
        relationshipStatus: primary.relationshipStatus,
        employmentStatus: primary.employmentStatus,
        coreFearAxis: primary.coreFearAxis as InputPayload["coreFearAxis"],
        unknownBirthTime: primary.unknownBirthTime,
      };
      const inputHash = buildInputHash(input);

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
        console.error("[MARRIAGE_START] fortune 계산 실패 (타이밍 없이 진행)", fortuneError);
      }

      // 연애운 점수: 개인사주 full_json.scores.연애운 (경로 확정 — lib/resultSchema.ts AnalysisScores 동일 필드)
      const { data: srcRow, error: srcError } = await supabaseAdmin
        .from("saju_results")
        .select("full_json")
        .eq("id", primary.sourceResultId)
        .maybeSingle();
      if (srcError) {
        console.error("[MARRIAGE_START] full_json 조회 실패", srcError.message);
        return NextResponse.json({ error: "사주 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
      }
      const sajuText = formatSajuText(saju, { isTimeUnknown: primary.unknownBirthTime });
      resolved = {
        input,
        inputHash,
        saju,
        enriched,
        fortune,
        gender,
        sajuText,
        loveScore: extractLoveScore(srcRow?.full_json),
        sourceResultId: primary.sourceResultId,
      };
    }

    const { input, inputHash, saju, fortune, gender, sajuText, loveScore, sourceResultId } = resolved;

    // 연애운 결측을 0으로 뭉개면 결혼운이 무조건 C로 찍혀 teaser가 잘못 굳는다(F-3).
    // 결측이면 등급을 만들지 않고 500 — 미리보기 단계에서 막아 잘못된 등급이 저장되지 않게 한다.
    if (loveScore === null) {
      console.error("[MARRIAGE_START] 연애운 점수 결측 — teaser 생성 차단");
      return NextResponse.json({ error: "연애운 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }

    const currentYear = new Date().getFullYear();
    const facts = deriveMarriageFacts(resolved.enriched, fortune, saju!, gender, maritalStatus, currentYear);
    const { grade } = computeMarriageGrade(loveScore);

    // teaser_json — 결정론적 paywall 게이트. Gemini teaserSummary(문장)와는 다른 필드다:
    // 여기는 등급·배우자성 종류 같은 "구조 값"만 담아 잠금 카드 렌더링에 쓰고,
    // 실제 진단 문장은 결제 후 full_json에만 있다.
    const teaserJson = {
      grade,
      spouseStarType: facts.spouseStarType,
      spouseStarAbsent: facts.spouseStarAbsent,
      gwansalHonjap: facts.gwansalHonjap,
      maritalStatus,
    };

    const birthDate = `${input.birthYear}-${input.birthMonth.padStart(2, "0")}-${input.birthDay.padStart(2, "0")}`;
    const birthTime = input.unknownBirthTime
      ? null
      : `${input.birthHour.padStart(2, "0")}:${input.birthMinute.padStart(2, "0")}`;

    // upsert — full_json은 payload에 포함하지 않는다: 이미 결제·생성된 row를 재호출(예: 같은
    // 관계상태로 재진입)할 때 ON CONFLICT UPDATE가 full_json을 null로 되돌리는 사고 방지.
    const upserted = await supabaseAdmin
      .from("marriage_results")
      .upsert(
        {
          user_id: userId,
          source_result_id: sourceResultId,
          input_hash: inputHash,
          marital_status: maritalStatus,
          name: input.name,
          birth_date: birthDate,
          birth_time: birthTime,
          region: input.birthLocation,
          gender: input.gender,
          relationship_status: input.relationshipStatus || null,
          employment_status: input.employmentStatus || null,
          calendar_type: input.calendarType,
          core_fear_axis: input.coreFearAxis || null,
          saju_text: sajuText,
          marriage_grade: grade,
          spouse_star_type: facts.spouseStarType,
          gwansal_honjap: facts.gwansalHonjap,
          spouse_star_absent: facts.spouseStarAbsent,
          spouse_palace_stability: facts.spousePalaceStability,
          teaser_json: teaserJson,
        },
        { onConflict: "user_id,input_hash,marital_status" },
      )
      .select("id, full_json")
      .maybeSingle();

    if (upserted.error || !upserted.data?.id) {
      console.error("[MARRIAGE_START] result upsert", upserted.error?.message);
      return NextResponse.json({ error: "결혼운 정보를 저장하는 중 오류가 발생했어요." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      resultId: upserted.data.id,
      teaser: teaserJson,
      grade,
      alreadyUnlocked: Boolean(upserted.data.full_json),
    });
  } catch (error: any) {
    console.error("[MARRIAGE_START] error", error?.message || error);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
