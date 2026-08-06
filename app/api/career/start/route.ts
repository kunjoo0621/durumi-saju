// /api/career/start — 커리어운 심층 검사 teaser row 생성 (무료, 결제 없음)
// app/api/wealth/start/route.ts 미러. 과금은 /api/career/analyze에서 일어난다(teaser까지 무료).
//
// 두 진입 경로:
//   · source="primary": 대표사주(from-primary) 재사용.
//   · source="self": 로그인 유저가 방금 입력한 생년월일로 원국·점수 즉석 계산(lib/self-input).
//
// 재물운과의 차이: interest(관심사) 대신 situation(상황 4분법) 화이트리스트. 등급 입력은 직장운.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { getSupabaseUserId } from "@/lib/server/user";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { getPrimarySajuData } from "@/lib/server/get-primary-saju";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import { deriveCareerFacts, type CareerSituation } from "@/lib/career-facts";
import { computeCareerGrade, extractCareerScore } from "@/lib/career-grade";
import {
  normalizeSelfInput,
  computeSelfSaju,
  deriveSelfScores,
  type SelfSajuInput,
} from "@/lib/self-input";

const ALLOWED_SITUATION: CareerSituation[] = [
  "진로 탐색",
  "현직 성장",
  "이직 고민",
  "독립·사업",
];

function normGender(g: string): "male" | "female" {
  return /여|female|f/i.test(g) ? "female" : "male";
}

type StartBody = { situation?: string; source?: "primary" | "self"; selfInput?: SelfSajuInput };

// primary/self 공통 원국 번들 — 이후 tail(facts→grade→teaser→upsert)은 source 무관 동일.
type Resolved = {
  input: InputPayload;
  inputHash: string;
  saju: Awaited<ReturnType<typeof calculateSaju>>;
  enriched: ReturnType<typeof enrichSajuData>;
  fortune: Awaited<ReturnType<typeof calculateFortune>> | null;
  sajuText: string;
  careerScore: number | null;
  sourceResultId: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // 유저별 rate limit — "비용 상한"(3층). 이 라우트는 무과금이지만 요청마다
    // calculateSaju+calculateFortune가 돌아 비싸다. 2026-07-29에 클라이언트 무한루프가
    // 5분간 22,674건을 쏴 평소 하루치 인보케이션(24K)을 태웠다.
    //
    // ★ 역할을 혼동하지 말 것: 루프 차단은 클라이언트(1층 useShallow·2층 키+ref 가드)가 한다.
    // 429는 루프를 멈추지 못한다 — 기존 코드에서 에러 상태도 고정점에 도달하지 않고
    // error↔loading으로 진동했고, 429는 사주 계산을 건너뛰어 응답이 빨라지므로 오히려
    // 루프가 가속된다. 이 가드의 목적은 "어떤 클라이언트 버그가 나도 비싼 계산은 돌지 않게"
    // 천장을 씌우는 것이다.
    //
    // IP가 아니라 userId로 잡는다: 모바일 캐리어 NAT·가족 공유 IP에서 오탐이 나면 유료
    // 퍼널이 깨진다. getSupabaseUserId는 정상 케이스에서 세션값을 그대로 반환하므로(DB 미조회)
    // 이 위치가 충분히 싸다. 정상 사용량은 진입 1 + 결제 1 + 충전복귀 1 수준이라 여유가 크다.
    const rlMinute = checkRateLimit(`career_start:${userId}:m`, 20, 60_000);
    const rlHour = checkRateLimit(`career_start:${userId}:h`, 120, 60 * 60_000);
    if (!rlMinute.allowed || !rlHour.allowed) {
      console.warn("[RATE_LIMIT] /api/career/start", { userId });
      const retryAfter = Math.max(rlMinute.retryAfter, rlHour.retryAfter);
      return NextResponse.json(
        { error: "요청이 너무 많아. 잠시 후 다시 시도해줘." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const body = (await request.json().catch(() => ({}))) as StartBody;
    const source = body.source === "self" ? "self" : "primary";
    const situation = body.situation as CareerSituation | undefined;
    if (!situation || !ALLOWED_SITUATION.includes(situation)) {
      return NextResponse.json({ error: "상황을 다시 선택해 주세요." }, { status: 400 });
    }

    let resolved: Resolved;

    if (source === "self") {
      // 자체입력: 방금 입력한 생년월일로 원국·직장운 점수 즉석 계산. 대표사주 조회 없음.
      const input = normalizeSelfInput(body.selfInput ?? {});
      if (!input.birthYear || !input.birthMonth || !input.birthDay || !input.gender) {
        return NextResponse.json({ error: "생년월일과 성별을 다시 확인해 주세요." }, { status: 400 });
      }
      const inputHash = buildInputHash(input);
      const { saju, enriched, fortune, sajuText } = await computeSelfSaju(input);
      // 직장운 점수: 개인사주 full_json.scores와 동일 산식(deriveSelfScores)으로 생성 → 등급 일치.
      const careerScore = extractCareerScore({ scores: deriveSelfScores(enriched) });
      resolved = { input, inputHash, saju, enriched, fortune, sajuText, careerScore, sourceResultId: null };
    } else {
      // 대표사주(primary) 경로.
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
        console.error("[CAREER_START] fortune 계산 실패 (타이밍 없이 진행)", fortuneError);
      }

      // 직장운 점수: 개인사주 full_json.scores.직장운 (경로 확정 — lib/resultSchema.ts AnalysisScores 동일 필드)
      const { data: srcRow, error: srcError } = await supabaseAdmin
        .from("saju_results")
        .select("full_json")
        .eq("id", primary.sourceResultId)
        .maybeSingle();
      if (srcError) {
        console.error("[CAREER_START] full_json 조회 실패", srcError.message);
        return NextResponse.json({ error: "사주 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
      }
      const sajuText = formatSajuText(saju, { isTimeUnknown: primary.unknownBirthTime });
      resolved = {
        input,
        inputHash,
        saju,
        enriched,
        fortune,
        sajuText,
        careerScore: extractCareerScore(srcRow?.full_json),
        sourceResultId: primary.sourceResultId,
      };
    }

    const { input, inputHash, saju, fortune, sajuText, careerScore, sourceResultId } = resolved;

    // 직장운 결측을 0으로 뭉개면 등급이 무조건 C로 찍혀 teaser가 잘못 굳는다(F-3).
    // 결측이면 등급을 만들지 않고 500 — 미리보기 단계에서 막아 잘못된 등급이 저장되지 않게 한다.
    if (careerScore === null) {
      console.error("[CAREER_START] 직장운 점수 결측 — teaser 생성 차단");
      return NextResponse.json({ error: "직장운 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }

    const currentYear = new Date().getFullYear();
    const facts = deriveCareerFacts(resolved.enriched, fortune, saju!, situation, currentYear);
    const { grade } = computeCareerGrade(careerScore);

    // teaser_json — 결정론적 paywall 게이트. Gemini teaserSummary(문장)와는 다른 필드다:
    // 등급·관성 유형 같은 "구조 값"만 담아 잠금 카드 렌더링에 쓰고, 진단 문장은 결제 후 full_json에만.
    const teaserJson = {
      grade,
      gwanseongType: facts.gwanseongType,
      situation,
    };

    const birthDate = `${input.birthYear}-${input.birthMonth.padStart(2, "0")}-${input.birthDay.padStart(2, "0")}`;
    const birthTime = input.unknownBirthTime
      ? null
      : `${input.birthHour.padStart(2, "0")}:${input.birthMinute.padStart(2, "0")}`;

    // upsert — full_json은 payload에 포함하지 않는다: 이미 결제·생성된 row 재호출(같은 상황 재진입)
    // 시 ON CONFLICT UPDATE가 full_json을 null로 되돌리는 사고 방지.
    const upserted = await supabaseAdmin
      .from("career_results")
      .upsert(
        {
          user_id: userId,
          source_result_id: sourceResultId,
          input_hash: inputHash,
          situation,
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
          career_grade: grade,
          gwanseong_type: facts.gwanseongType,
          gwanda_sinyak: facts.gwandaSinyak,
          gwanin_sangsaeng: facts.gwaninSangsaeng,
          sanggwan_gyeongwan: facts.sanggwanGyeongwan,
          career_grip: facts.careerGrip,
          teaser_json: teaserJson,
        },
        { onConflict: "user_id,input_hash,situation" },
      )
      .select("id, full_json")
      .maybeSingle();

    if (upserted.error || !upserted.data?.id) {
      console.error("[CAREER_START] result upsert", upserted.error?.message);
      return NextResponse.json({ error: "커리어운 정보를 저장하는 중 오류가 발생했어요." }, { status: 500 });
    }

    // ★등급은 결제 전에 클라이언트로 내려보내지 않는다. 등급은 유료 리포트의 결론이고,
    // 개인사주(결제 후 공개)와 기준이 어긋나면 안 된다. 화면만 가리면 개발자도구로 보이므로
    // 응답 경계에서 제거한다. DB(teaser_json.grade)에는 그대로 저장된다(서버 내부용).
    const { grade: _hiddenGrade, ...teaserPublic } = teaserJson;
    return NextResponse.json({
      ok: true,
      resultId: upserted.data.id,
      teaser: teaserPublic,
      alreadyUnlocked: Boolean(upserted.data.full_json),
    });
  } catch (error: any) {
    console.error("[CAREER_START] error", error?.message || error);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
