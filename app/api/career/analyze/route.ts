// /api/career/analyze — 멱등 차감 + Gemini + 가드 + 저장 (+ 실패 시 환불)
// app/api/wealth/analyze/route.ts 를 그대로 미러(money-safe 검증 완료 버전).
//
// 재물운과의 차이:
//   - body 파라미터: interest → situation(상황 4분법) 화이트리스트 검증.
//   - 점수 경로: scores.재물운 → scores.직장운, computeCareerGrade.
//   - consistency: assertCareerConsistency(관성유형·관다신약·상관견관 축).
//
// 고정 순서(wealth/analyze와 동일):
//   1) situation 화이트리스트 → 2) 멱등 체크 → 2-1) orphan(3분 grace 409 / 초과 시 멱등 환불 후
//   fall-through) → 2-2) 결제 전 등급 게이트(결측 500·teaser 불일치 409) → 3) spend_coins+unlock
//   (23505 loser 직접 환불) → 4) facts 재조립 → 5) consistency 실패 시 환불 → 6)7) QA재생성+가드 →
//   가드 후 재검증(minAdvice 1) → 타임라인 병합 → 8) 저장(row 소실도 환불) → guard_violations 기록

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildInputHash,
  callGemini,
  DEFAULT_MODELS,
  shouldFallback,
  type InputPayload,
} from "@/lib/analysis";
import { parseJson5Loose } from "@/lib/json5Utils";
import { getSupabaseUserId } from "@/lib/server/user";
import { refundCoins } from "@/lib/server/session-helpers";
import { getPrimarySajuData } from "@/lib/server/get-primary-saju";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import { deriveCareerFacts, type CareerSituation } from "@/lib/career-facts";
import { computeCareerGrade, extractCareerScore } from "@/lib/career-grade";
import { assertCareerConsistency } from "@/lib/career-consistency";
import { buildCareerPrompt } from "@/lib/career-prompt";
import { applyCareerGuards, validateCareerBlocks, validateCareerRichness } from "@/lib/career-postprocess";
import { generateWithQaRegen } from "@/lib/qa-regen";
import { buildCareerTimeline } from "@/lib/fortune-timeline";
import { CAREER_COST } from "@/lib/constants/coins";
import {
  normalizeSelfInput,
  computeSelfSaju,
  deriveSelfScores,
  type SelfSajuInput,
} from "@/lib/self-input";

// 크래시로 full_json 없이 남은 unlock을 "진행 중"으로 볼 유예. 이 안이면 재차감을 막고 409로
// 잠시 후 재시도(동시 요청 보호). 넘으면 orphan으로 보고 멱등 환불 후 재결제.
const ORPHAN_GRACE_MS = 3 * 60 * 1000;

// 멱등 환불 헬퍼 — "차감 1회당 환불 1회, 리포트 1건" 불변식의 핵심.
// unlock row 삭제(order_id 기준)가 원자적 승자 결정: 삭제 count가 1이어야 이 호출이 환불 책임자.
async function refundCareerUnlock(userId: string, orderId: string): Promise<boolean> {
  const { data: priorRefunds, error: refundLookupError } = await supabaseAdmin
    .from("coin_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "refund")
    .eq("reference_id", orderId)
    .limit(1);
  if (refundLookupError) {
    console.error("[CAREER_ANALYZE] refund lookup 실패", orderId, refundLookupError.message);
    return false;
  }

  const { data: deleted, error: deleteError } = await supabaseAdmin
    .from("career_result_unlocks")
    .delete()
    .eq("order_id", orderId)
    .select("id");
  if (deleteError) {
    console.error("[CAREER_ANALYZE] unlock 삭제 실패", orderId, deleteError.message);
    return false;
  }
  if (!deleted || deleted.length === 0) {
    // 다른 경로가 이미 이 unlock을 정리·환불함 — 재환불 금지.
    return true;
  }
  if (priorRefunds && priorRefunds.length > 0) {
    // 환불은 이미 기록됐는데 unlock만 남아 있던 방어적 케이스 — 삭제만 하고 재환불 안 함.
    return true;
  }
  await refundCoins(userId, CAREER_COST, orderId);
  return true;
}

const ALLOWED_SITUATION: CareerSituation[] = [
  "진로 탐색",
  "현직 성장",
  "이직 고민",
  "독립·사업",
];

const CAREER_SYSTEM_PROMPT =
  "너는 지시받은 지침을 정확히 따르는 JSON 생성기다. 사용자 메시지에 포함된 규칙과 출력 스키마를 그대로 지켜라.";

function normGender(g: string): "male" | "female" {
  return /여|female|f/i.test(g) ? "female" : "male";
}

type AnalyzeBody = { situation?: string; source?: "primary" | "self"; selfInput?: SelfSajuInput };

export async function POST(request: NextRequest) {
  try {
    // 1) 검증
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as AnalyzeBody;
    const source = body.source === "self" ? "self" : "primary";
    const situation = body.situation as CareerSituation | undefined;
    if (!situation || !ALLOWED_SITUATION.includes(situation)) {
      return NextResponse.json({ error: "상황을 다시 선택해 주세요." }, { status: 400 });
    }

    let input: InputPayload;
    let primary: Awaited<ReturnType<typeof getPrimarySajuData>> = null;

    if (source === "self") {
      input = normalizeSelfInput(body.selfInput ?? {});
      if (!input.birthYear || !input.birthMonth || !input.birthDay || !input.gender) {
        return NextResponse.json({ error: "생년월일과 성별을 다시 확인해 주세요." }, { status: 400 });
      }
    } else {
      primary = await getPrimarySajuData(userId);
      if (!primary) {
        return NextResponse.json({ error: "먼저 사주 분석을 완료해 주세요." }, { status: 404 });
      }
      input = {
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
    }
    const inputHash = buildInputHash(input);

    // teaser row(=/api/career/start 산출물)가 있어야 한다 — 없으면 결제 대상 row가 없다.
    const { data: resultRow, error: resultRowError } = await supabaseAdmin
      .from("career_results")
      .select("id, full_json, career_grade")
      .eq("user_id", userId)
      .eq("input_hash", inputHash)
      .eq("situation", situation)
      .maybeSingle();

    if (resultRowError) {
      console.error("[CAREER_ANALYZE] result row lookup", resultRowError.message);
      return NextResponse.json({ error: "결과 조회 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!resultRow) {
      return NextResponse.json(
        { error: "먼저 커리어운 미리보기를 생성해 주세요." },
        { status: 404 },
      );
    }
    const resultId = resultRow.id as string;

    // 2) 멱등 체크
    const { data: existingUnlock, error: unlockLookupError } = await supabaseAdmin
      .from("career_result_unlocks")
      .select("id, order_id, created_at")
      .eq("user_id", userId)
      .eq("input_hash", inputHash)
      .eq("situation", situation)
      .maybeSingle();

    if (unlockLookupError) {
      console.error("[CAREER_ANALYZE] unlock lookup", unlockLookupError.message);
      return NextResponse.json({ error: "결제 정보 조회 중 오류가 발생했습니다." }, { status: 500 });
    }

    if (existingUnlock && resultRow.full_json) {
      // 이미 결제 + 생성 완료 — 재분석 없이 기존 결과 반환. (참 멱등)
      return NextResponse.json({
        ok: true,
        resultId,
        fullJson: resultRow.full_json,
        reused: true,
      });
    }

    if (existingUnlock) {
      // 결제는 됐는데 full_json 없음 — orphan unlock. (a)방금 다른 요청이 진행 중 vs (b)크래시 stale.
      // created_at 3분 안이면 (a) 409 재시도(재차감 금지), 넘으면 (b) orphan 차감 멱등 환불 후 재결제.
      const ageMs = Date.now() - new Date(existingUnlock.created_at as string).getTime();
      if (Number.isFinite(ageMs) && ageMs < ORPHAN_GRACE_MS) {
        return NextResponse.json(
          { error: "이미 분석이 진행 중이에요. 잠시 후 다시 시도해 주세요.", analyzing: true },
          { status: 409 },
        );
      }
      const cleaned = await refundCareerUnlock(userId, existingUnlock.order_id as string);
      if (!cleaned) {
        return NextResponse.json({ error: "결제 정보 정리 중 오류가 발생했습니다." }, { status: 500 });
      }
      // fall-through → 아래에서 반드시 새로 결제.
    }

    // 2-2) 결제 전 등급 게이트 (F-3/N-1) — 돈을 쓰기 전에 확정.
    //  · 직장운 결측을 0으로 뭉개 C를 만들지 않는다(extractCareerScore null → 500, 결제 없음).
    //  · 미리보기 저장 등급과 지금 계산 등급이 다르면(개인사주 재분석으로 사주가 바뀐 경우) 409.
    let careerScore: number | null;
    let selfComputed: Awaited<ReturnType<typeof computeSelfSaju>> | null = null;
    if (source === "self") {
      selfComputed = await computeSelfSaju(input);
      careerScore = extractCareerScore({ scores: deriveSelfScores(selfComputed.enriched) });
    } else {
      const { data: srcRow, error: srcError } = await supabaseAdmin
        .from("saju_results")
        .select("full_json")
        .eq("id", primary!.sourceResultId)
        .maybeSingle();
      if (srcError) {
        console.error("[CAREER_ANALYZE] full_json 조회 실패", srcError.message);
        return NextResponse.json({ error: "사주 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
      }
      careerScore = extractCareerScore(srcRow?.full_json);
    }
    if (careerScore === null) {
      console.error("[CAREER_ANALYZE] 직장운 점수 결측 — 결제 차단");
      return NextResponse.json({ error: "직장운 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
    const { grade } = computeCareerGrade(careerScore);
    const storedGrade = (resultRow.career_grade as string | null) ?? null;
    if (storedGrade && storedGrade !== grade) {
      console.error(`[CAREER_ANALYZE] 등급 불일치 — 미리보기 ${storedGrade} vs 현재 ${grade} (결제 차단)`);
      return NextResponse.json(
        { error: "미리보기 이후 사주 정보가 바뀌었어요. 미리보기를 다시 만든 뒤 시도해 주세요.", gradeMismatch: true },
        { status: 409 },
      );
    }

    // 3) 잔액 확인 + 차감 — 이 지점부터는 항상 신규 결제 경로.
    const orderId = `career_${inputHash.slice(0, 16)}_${situation}_${Date.now()}_${userId.slice(0, 8)}`;

    const spendRpc = await supabaseAdmin.rpc("spend_coins", {
      p_user_id: userId,
      p_amount: CAREER_COST,
      p_reference_id: orderId,
    });

    if (spendRpc.error) {
      console.error("[CAREER_ANALYZE] spend rpc", spendRpc.error.message);
      return NextResponse.json({ error: "알 차감 중 오류가 발생했습니다." }, { status: 500 });
    }

    const spendResult = Array.isArray(spendRpc.data) ? spendRpc.data[0] : spendRpc.data;
    if (!spendResult?.success) {
      return NextResponse.json(
        {
          insufficient: true,
          balance: spendResult?.new_balance ?? 0,
          required: CAREER_COST,
          error: "알이 부족해요. 알을 충전한 뒤 다시 시도해 주세요.",
        },
        { status: 402 },
      );
    }

    // unique(user_id, input_hash, situation) 위반 = 동시 요청이 먼저 결제 완료 = 멱등 처리.
    const unlockInsert = await supabaseAdmin.from("career_result_unlocks").insert({
      user_id: userId,
      result_id: resultId,
      input_hash: inputHash,
      situation,
      order_id: orderId,
    });

    if (unlockInsert.error) {
      if (unlockInsert.error.code === "23505") {
        // 진 쪽(loser) — 이긴 쪽 unlock row는 절대 건드리지 않고 내 차감만 직접 환불.
        // ★refundCareerUnlock을 쓰지 않는다: insert 실패로 내 order_id unlock row가 없어 삭제
        //  게이트를 태우면 "삭제 0건 → 환불 스킵"이 된다. loser는 자기 차감을 직접 환불(이중환불 아님).
        await refundCoins(userId, CAREER_COST, orderId);
        const { data: freshRow } = await supabaseAdmin
          .from("career_results")
          .select("full_json")
          .eq("id", resultId)
          .maybeSingle();
        if (freshRow?.full_json) {
          return NextResponse.json({ ok: true, resultId, fullJson: freshRow.full_json, reused: true });
        }
        return NextResponse.json(
          { error: "다른 요청이 이미 처리 중이에요. 잠시 후 다시 시도해 주세요." },
          { status: 409 },
        );
      }
      console.error("[CAREER_ANALYZE] unlock insert", unlockInsert.error.message);
      // insert 자체 실패 → 내 unlock row 없음 → 직접 환불.
      await refundCoins(userId, CAREER_COST, orderId);
      return NextResponse.json(
        { error: "결제 기록 저장 중 오류가 발생했습니다.", refunded: true },
        { status: 500 },
      );
    }

    const refundRef = orderId;

    // 이 지점 이후 실패하면 "환불 + 방금 넣은 unlock row 삭제"를 멱등 헬퍼로 함께 한다.
    const refundAndCleanup = async () => {
      await refundCareerUnlock(userId, refundRef);
    };

    // 4) facts 재조립 + grade, 5~8) 일관성 → Gemini → 가드 → 저장
    try {
      let saju: Awaited<ReturnType<typeof calculateSaju>>;
      let enriched: ReturnType<typeof enrichSajuData>;
      let fortune: Awaited<ReturnType<typeof calculateFortune>> | null;
      let sajuText: string;

      if (source === "self" && selfComputed) {
        // 등급게이트에서 계산한 원국 재사용(중복 계산 방지).
        saju = selfComputed.saju;
        enriched = selfComputed.enriched;
        fortune = selfComputed.fortune;
        sajuText = selfComputed.sajuText;
      } else {
        let calcYear = Number(primary!.birthYear);
        let calcMonth = Number(primary!.birthMonth);
        let calcDay = Number(primary!.birthDay);

        if (primary!.calendarType === "lunar") {
          const converted = convertLunarToSolar(calcYear, calcMonth, calcDay);
          if (!converted) throw new Error("생년월일 변환 실패");
          calcYear = converted.year;
          calcMonth = converted.month;
          calcDay = converted.day;
        }

        const hour = primary!.unknownBirthTime ? undefined : Number(primary!.birthHour);
        const minute = primary!.unknownBirthTime ? undefined : Number(primary!.birthMinute);

        const calcSaju = await calculateSaju(calcYear, calcMonth, calcDay, hour, minute, {
          birthLocation: primary!.birthLocation,
        });
        if (!calcSaju) throw new Error("사주 계산 실패");

        enriched = enrichSajuData(calcSaju, { isTimeUnknown: primary!.unknownBirthTime });
        const gender = normGender(primary!.gender);

        let calcFortune: Awaited<ReturnType<typeof calculateFortune>> | null = null;
        try {
          calcFortune = await calculateFortune({
            birthYear: calcYear,
            birthMonth: calcMonth,
            birthDay: calcDay,
            birthHour: hour,
            birthMinute: minute,
            gender,
            birthLocation: primary!.birthLocation,
            yearPillar: calcSaju.year.heavenlyStem + calcSaju.year.earthlyBranch,
            monthPillar: calcSaju.month.heavenlyStem + calcSaju.month.earthlyBranch,
            dayPillar: calcSaju.day.heavenlyStem + calcSaju.day.earthlyBranch,
            hourPillar: calcSaju.hour.heavenlyStem + calcSaju.hour.earthlyBranch,
            isTimeUnknown: primary!.unknownBirthTime,
          });
        } catch (fortuneError) {
          console.error("[CAREER_ANALYZE] fortune 계산 실패 (타이밍 없이 진행)", fortuneError);
        }

        saju = calcSaju;
        fortune = calcFortune;
        sajuText = formatSajuText(calcSaju, { isTimeUnknown: primary!.unknownBirthTime });
      }

      const currentYear = new Date().getFullYear();
      const facts = deriveCareerFacts(enriched, fortune, saju!, situation, currentYear);

      // careerScore·grade는 결제 전 게이트(2-2)에서 확정됨(storedGrade와 동일 보장). 재조회 없이 사용.
      // 5) 일관성 검증 — 실패하면 Gemini도 호출하지 않고 즉시 환불.
      const issues = assertCareerConsistency({
        grade,
        careerScore,
        facts: {
          gwanseongType: facts.gwanseongType,
          gwanseong: facts.gwanseong,
          gwandaSinyak: facts.gwandaSinyak,
          careerGrip: facts.careerGrip,
          sanggwanGyeongwan: facts.sanggwanGyeongwan,
          gwanseongAbsent: facts.gwanseongAbsent,
        },
      });
      if (issues.length > 0) {
        console.error("[CAREER_ANALYZE] consistency 실패", issues);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "커리어운 분석 결과에 문제가 있어요. 알은 환불됐어요.", refunded: true },
          { status: 500 },
        );
      }

      // 6) Gemini 호출 → JSON5 파싱. self면 employmentStatus 미제공(직업 안 물어 default 톤 오박음 방지).
      const prompt = buildCareerPrompt(
        facts,
        grade,
        sajuText,
        source === "self" ? undefined : input.employmentStatus,
        currentYear,
      );
      const _envModels = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? [];
      const models = _envModels.length > 0 ? _envModels : DEFAULT_MODELS;

      // 6)+7) QA 재생성 루프(가드 위반 시 위반 목록을 프롬프트에 덧붙여 1회 재생성).
      const gen = await generateWithQaRegen<any>({
        prompt,
        systemPrompt: CAREER_SYSTEM_PROMPT,
        models,
        temperature: 0.75,
        callModel: (model, p, sys, cfg) => callGemini(model, p, sys, cfg),
        shouldFallback,
        parse: (text) => parseJson5Loose<any>(text),
        validateBlocks: (candidate) => validateCareerBlocks(candidate),
        applyGuards: (candidate) => applyCareerGuards(candidate, facts, sajuText),
        softValidate: (b) => validateCareerRichness(b),
      });

      if (!gen.ok) {
        console.error("[CAREER_ANALYZE] gemini 실패", gen.error);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "분석에 실패했어. 알은 환불됐어.", refunded: true },
          { status: 500 },
        );
      }
      const blocks = gen.blocks;
      const violations = gen.violations;
      if (violations.length > 0) {
        console.warn(`[CAREER_ANALYZE] guard violations (재생성 ${gen.attempts}회 후 잔존)`, violations);
      }

      // F-2 후단: 가드 스크럽 후 필수 블록이 비었는지 재검증(빈 리포트 방지). minAdvice 1.
      const postGuardIssues = validateCareerBlocks(blocks, { minAdvice: 1 });
      if (postGuardIssues.length > 0) {
        console.error("[CAREER_ANALYZE] 가드 후 블록 부족 — 환불", postGuardIssues);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "분석 결과가 불완전해요. 알은 환불됐어요.", refunded: true },
          { status: 500 },
        );
      }

      // 서버 결정론 타임라인 — 가드/스크럽 뒤 병합(LLM 산문 아님). 실패해도 저장 막지 않음.
      const serverTimeline = buildCareerTimeline(fortune, facts, currentYear);
      if (serverTimeline) blocks.serverTimeline = serverTimeline;

      // 8) 저장
      const { data: updatedRows, error: updateError } = await supabaseAdmin
        .from("career_results")
        .update({
          full_json: blocks,
          saju_text: sajuText,
          career_grade: grade,
          gwanseong_type: facts.gwanseongType,
          gwanda_sinyak: facts.gwandaSinyak,
          gwanin_sangsaeng: facts.gwaninSangsaeng,
          sanggwan_gyeongwan: facts.sanggwanGyeongwan,
          career_grip: facts.careerGrip,
        })
        .eq("id", resultId)
        .eq("user_id", userId)
        .select("id");

      if (updateError) {
        console.error("[CAREER_ANALYZE] update", updateError.message);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "결과 저장에 실패했습니다. 알은 환불되었습니다.", refunded: true },
          { status: 500 },
        );
      }
      if (!updatedRows || updatedRows.length === 0) {
        console.error(
          `[CAREER_ANALYZE] 결과 row 소실: update 0건. resultId=${resultId} userId=${userId} refundRef=${refundRef}`,
        );
        await refundAndCleanup();
        return NextResponse.json(
          { error: "분석 결과를 저장할 수 없습니다. 알은 환불되었습니다.", refunded: true },
          { status: 500 },
        );
      }

      // N-2: 가드가 걸러낸 것 + richness 미달(soft) + 재생성 횟수를 사후 감사용 기록(별도 best-effort
      // UPDATE, 비치명). 접두어(richness:/attempts:)로 순수 위반과 구분 — 기존 집계 스크립트 호환.
      const audit = [...violations, ...gen.softIssues.map((s) => `richness:${s}`)];
      if (audit.length > 0) {
        const { error: gvError } = await supabaseAdmin
          .from("career_results")
          .update({ guard_violations: [...audit, `attempts:${gen.attempts}`] })
          .eq("id", resultId);
        if (gvError) console.warn("[CAREER_ANALYZE] guard_violations 기록 실패(비치명)", gvError.message);
      }

      // 9) 반환
      return NextResponse.json({
        ok: true,
        resultId,
        fullJson: blocks,
        careerGrade: grade,
      });
    } catch (analysisError: any) {
      console.error("[CAREER_ANALYZE] analysis failed", analysisError?.message || analysisError);
      await refundAndCleanup();
      return NextResponse.json(
        { error: "분석에 실패했습니다. 알은 환불되었습니다.", refunded: true },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("[CAREER_ANALYZE] error", error?.message || error);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
