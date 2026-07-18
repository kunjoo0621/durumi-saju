// /api/wealth/analyze — 멱등 차감 + Gemini + 가드 + 저장 (+ 실패 시 환불)
// app/api/marriage/analyze/route.ts 를 그대로 미러한다(money-safe 검증 완료 버전).
// (docs/superpowers/sdd/task-9-brief.md — 코인 차감/환불 로직은 today 검증 함수 재사용, 신규 작성 금지)
//
// 결혼운과의 차이:
//   - gender 분기 없음(재성은 성별 중립) — assertWealthConsistency에는 sex/spouseStarType 축이
//     없다. 대신 primary.gender/employmentStatus를 읽어 buildWealthPrompt에 employmentStatus로
//     전달(프롬프트 grounding용).
//   - body 파라미터: maritalStatus → interest(관심사 4분법) 화이트리스트 검증.
//   - 점수 경로: normalizeScores(fullJson?.scores).연애운 → .재물운, computeWealthGrade.
//
// 고정 순서 (marriage/analyze와 동일 순서를 그대로 유지):
//   1) interest 화이트리스트 검증
//   2) 멱등 체크 (wealth_result_unlocks 존재 && full_json 있음 → 재분석 없이 반환)
//   2-1) unlock은 있는데 full_json이 없는 orphan(이전 시도가 도중에 끊김) → 그 unlock을
//        지우고 fall-through — 재차감 없는 재사용 금지(무료 리포트/환불 파밍 방지)
//   3) 잔액 확인 + 차감 (order_id 생성, unlocks insert; unique 위반 = 동시 요청 loser = 멱등)
//   4) facts 재조립 + grade
//   5) assertWealthConsistency 실패 → 환불 + unlock row 삭제 + 500 (Gemini 호출 이전)
//   6) Gemini 호출 → JSON5 파싱
//   7) applyWealthGuards
//   8) 저장
//   9) 실패(consistency/파싱/Gemini/저장/row소실) → 환불 + 방금 넣은 unlock row 삭제 + 한국어 메시지
//      (refundAndCleanup 구조 — marriage/analyze의 "차감당 1회 환불" 보장을 그대로 상속)

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
import { normalizeScores } from "@/lib/resultSchema";
import { getSupabaseUserId } from "@/lib/server/user";
import { refundCoins } from "@/lib/server/session-helpers";
import { getPrimarySajuData } from "@/lib/server/get-primary-saju";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import { deriveWealthFacts, type WealthInterest } from "@/lib/wealth-facts";
import { computeWealthGrade } from "@/lib/wealth-grade";
import { assertWealthConsistency } from "@/lib/wealth-consistency";
import { buildWealthPrompt } from "@/lib/wealth-prompt";
import { applyWealthGuards } from "@/lib/wealth-postprocess";
import { WEALTH_COST } from "@/lib/constants/coins";

const ALLOWED_INTEREST: WealthInterest[] = [
  "목돈·노후 준비",
  "투자로 불리기",
  "사업·수입 키우기",
  "지출·빚 관리",
];

const WEALTH_SYSTEM_PROMPT =
  "너는 지시받은 지침을 정확히 따르는 JSON 생성기다. 사용자 메시지에 포함된 규칙과 출력 스키마를 그대로 지켜라.";

function normGender(g: string): "male" | "female" {
  return /여|female|f/i.test(g) ? "female" : "male";
}

type AnalyzeBody = { interest?: string };

export async function POST(request: NextRequest) {
  try {
    // 1) 검증
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as AnalyzeBody;
    const interest = body.interest as WealthInterest | undefined;
    if (!interest || !ALLOWED_INTEREST.includes(interest)) {
      return NextResponse.json({ error: "관심사를 다시 선택해 주세요." }, { status: 400 });
    }

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

    // teaser row(=/api/wealth/start 산출물)가 있어야 한다 — 없으면 결제 대상 row가 없다.
    const { data: resultRow, error: resultRowError } = await supabaseAdmin
      .from("wealth_results")
      .select("id, full_json")
      .eq("user_id", userId)
      .eq("input_hash", inputHash)
      .eq("interest", interest)
      .maybeSingle();

    if (resultRowError) {
      console.error("[WEALTH_ANALYZE] result row lookup", resultRowError.message);
      return NextResponse.json({ error: "결과 조회 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!resultRow) {
      return NextResponse.json(
        { error: "먼저 재물운 미리보기를 생성해 주세요." },
        { status: 404 },
      );
    }
    const resultId = resultRow.id as string;

    // 2) 멱등 체크
    const { data: existingUnlock, error: unlockLookupError } = await supabaseAdmin
      .from("wealth_result_unlocks")
      .select("id, order_id")
      .eq("user_id", userId)
      .eq("input_hash", inputHash)
      .eq("interest", interest)
      .maybeSingle();

    if (unlockLookupError) {
      console.error("[WEALTH_ANALYZE] unlock lookup", unlockLookupError.message);
      return NextResponse.json({ error: "결제 정보 조회 중 오류가 발생했습니다." }, { status: 500 });
    }

    if (existingUnlock && resultRow.full_json) {
      // 이미 결제 + 생성 완료 — 재분석 없이 기존 결과 그대로 반환. (참 멱등 — 차감·Gemini 둘 다 스킵)
      return NextResponse.json({
        ok: true,
        resultId,
        fullJson: resultRow.full_json,
        reused: true,
      });
    }

    if (existingUnlock) {
      // 결제는 됐는데 full_json이 없음 — 이전 시도가 Gemini/저장 단계에서 끊긴 orphan unlock.
      // 이 row를 그대로 재사용해 재차감 없이 재시도하면:
      //   차감 → (일시적) 실패 → 환불(순환) → 재시도가 이 unlock을 "이미 결제됨"으로 오인
      //   → 재차감 없이 성공 → 순 코인 0으로 리포트 획득(무료 리포트).
      // 게다가 refundCoins는 reference_id 기준 멱등이 아니므로(주석 참조) 같은 order_id로
      // 재시도가 반복 실패하면 매번 환불만 쌓여 코인 파밍도 가능하다.
      // → stale row를 지우고 이번 시도는 반드시 새로 결제(spend_coins + 새 unlock insert)하게
      //    fall-through 시킨다. wealth_results 쪽은 8) 저장이 단일 UPDATE로 전 필드를
      //    한 번에 쓰므로 full_json이 null이면 다른 필드도 세팅된 적이 없어 별도 정리는 불필요.
      const { error: staleDeleteError } = await supabaseAdmin
        .from("wealth_result_unlocks")
        .delete()
        .eq("id", existingUnlock.id);
      if (staleDeleteError) {
        console.error("[WEALTH_ANALYZE] stale unlock delete", staleDeleteError.message);
        return NextResponse.json({ error: "결제 정보 정리 중 오류가 발생했습니다." }, { status: 500 });
      }
    }

    // 3) 잔액 확인 + 차감 (today/start 패턴 미러) — 이 지점부터는 항상 신규 결제 경로.
    const orderId = `wealth_${inputHash.slice(0, 16)}_${interest}_${Date.now()}_${userId.slice(0, 8)}`;

    const spendRpc = await supabaseAdmin.rpc("spend_coins", {
      p_user_id: userId,
      p_amount: WEALTH_COST,
      p_reference_id: orderId,
    });

    if (spendRpc.error) {
      console.error("[WEALTH_ANALYZE] spend rpc", spendRpc.error.message);
      return NextResponse.json({ error: "알 차감 중 오류가 발생했습니다." }, { status: 500 });
    }

    const spendResult = Array.isArray(spendRpc.data) ? spendRpc.data[0] : spendRpc.data;
    if (!spendResult?.success) {
      return NextResponse.json(
        {
          insufficient: true,
          balance: spendResult?.new_balance ?? 0,
          required: WEALTH_COST,
          error: "알이 부족해요. 알을 충전한 뒤 다시 시도해 주세요.",
        },
        { status: 402 },
      );
    }

    // unique(user_id, input_hash, interest) 위반 = 동시 요청이 먼저 결제 완료 = 멱등 처리.
    const unlockInsert = await supabaseAdmin.from("wealth_result_unlocks").insert({
      user_id: userId,
      result_id: resultId,
      input_hash: inputHash,
      interest,
      order_id: orderId,
    });

    if (unlockInsert.error) {
      if (unlockInsert.error.code === "23505") {
        // 진 쪽(loser) — 이긴 쪽이 이미 unlock row를 갖고 있으므로 내 차감만 환불하고 끝낸다.
        // 이긴 쪽 row는 절대 건드리지 않는다(아래 refundAndCleanup과 달리 삭제 없음).
        await refundCoins(userId, WEALTH_COST, orderId);
        const { data: freshRow } = await supabaseAdmin
          .from("wealth_results")
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
      console.error("[WEALTH_ANALYZE] unlock insert", unlockInsert.error.message);
      await refundCoins(userId, WEALTH_COST, orderId);
      return NextResponse.json(
        { error: "결제 기록 저장 중 오류가 발생했습니다.", refunded: true },
        { status: 500 },
      );
    }

    const refundRef = orderId;

    // 이 지점 이후 실패하면 반드시 "환불 + 방금 넣은 unlock row 삭제"를 함께 한다.
    // 삭제하지 않으면 다음 재시도가 이 row를 "이미 결제됨(orphan)"으로 보고 위의 existingUnlock
    // 분기를 다시 타게 되는데, 그 분기는 이제 stale row를 지우고 재차감시키므로 이중 삭제는
    // 안전하지만, 혹시라도 그 가드가 깨지면 무료 리포트 취약점이 재발한다 — 방어적으로 여기서
    // order_id 기준(unique index) 정확히 삭제해 항상 clean state로 되돌린다.
    const refundAndCleanup = async () => {
      await refundCoins(userId, WEALTH_COST, refundRef);
      const { error: cleanupError } = await supabaseAdmin
        .from("wealth_result_unlocks")
        .delete()
        .eq("order_id", refundRef);
      if (cleanupError) {
        console.error(
          "[WEALTH_ANALYZE] unlock cleanup 실패 — order_id:",
          refundRef,
          cleanupError.message,
        );
      }
    };

    // 4) facts 재조립 + grade, 5~8) 일관성 검증 → Gemini → 가드 → 저장
    try {
      let calcYear = Number(primary.birthYear);
      let calcMonth = Number(primary.birthMonth);
      let calcDay = Number(primary.birthDay);

      if (primary.calendarType === "lunar") {
        const converted = convertLunarToSolar(calcYear, calcMonth, calcDay);
        if (!converted) throw new Error("생년월일 변환 실패");
        calcYear = converted.year;
        calcMonth = converted.month;
        calcDay = converted.day;
      }

      const hour = primary.unknownBirthTime ? undefined : Number(primary.birthHour);
      const minute = primary.unknownBirthTime ? undefined : Number(primary.birthMinute);

      const saju = await calculateSaju(calcYear, calcMonth, calcDay, hour, minute, {
        birthLocation: primary.birthLocation,
      });
      if (!saju) throw new Error("사주 계산 실패");

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
        console.error("[WEALTH_ANALYZE] fortune 계산 실패 (타이밍 없이 진행)", fortuneError);
      }

      const currentYear = new Date().getFullYear();
      const facts = deriveWealthFacts(enriched, fortune, saju, interest, currentYear);
      const sajuText = formatSajuText(saju, { isTimeUnknown: primary.unknownBirthTime });

      const { data: srcRow, error: srcError } = await supabaseAdmin
        .from("saju_results")
        .select("full_json")
        .eq("id", primary.sourceResultId)
        .maybeSingle();
      if (srcError) {
        console.error("[WEALTH_ANALYZE] full_json 조회 실패", srcError.message);
      }
      const wealthScore = normalizeScores((srcRow?.full_json as any)?.scores).재물운;
      const { grade } = computeWealthGrade(wealthScore);

      // 5) 일관성 검증 — 실패하면 Gemini도 호출하지 않고 즉시 환불.
      const issues = assertWealthConsistency({
        grade,
        wealthScore,
        facts: {
          jaeseongType: facts.jaeseongType,
          jaeseong: facts.jaeseong,
          jaedaShinyak: facts.jaedaShinyak,
          jaeGrip: facts.jaeGrip,
        },
      });
      if (issues.length > 0) {
        console.error("[WEALTH_ANALYZE] consistency 실패", issues);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "재물운 분석 결과에 문제가 있어요. 알은 환불됐어요.", refunded: true },
          { status: 500 },
        );
      }

      // 6) Gemini 호출 (analysis.ts 모델 fallback 체인 미러) → JSON5 파싱
      const prompt = buildWealthPrompt(facts, grade, sajuText, primary.employmentStatus);
      const _envModels = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? [];
      const models = _envModels.length > 0 ? _envModels : DEFAULT_MODELS;

      let parsed: any = null;
      let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

      for (const model of models) {
        const res = await callGemini(model, prompt, WEALTH_SYSTEM_PROMPT, { temperature: 0.75 });
        if (res.ok) {
          try {
            parsed = parseJson5Loose<any>(res.text);
            lastError = null;
            break;
          } catch (parseError: any) {
            console.error("[WEALTH_ANALYZE] JSON 파싱 실패", parseError?.message, res.text?.slice(0, 300));
            lastError = { status: 502, apiStatus: "INVALID_JSON", message: "분석 결과 형식이 불완전합니다." };
            continue;
          }
        }
        lastError = res;
        if (!shouldFallback(res.status, res.apiStatus)) break;
      }

      if (!parsed) {
        console.error("[WEALTH_ANALYZE] gemini 실패", lastError);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "분석에 실패했어. 알은 환불됐어.", refunded: true },
          { status: 500 },
        );
      }

      // 7) 가드
      const { blocks, violations } = applyWealthGuards(parsed, facts, sajuText);
      if (violations.length > 0) {
        console.warn("[WEALTH_ANALYZE] guard violations", violations);
      }

      // 8) 저장
      const { data: updatedRows, error: updateError } = await supabaseAdmin
        .from("wealth_results")
        .update({
          full_json: blocks,
          saju_text: sajuText,
          wealth_grade: grade,
          jaeseong_type: facts.jaeseongType,
          jaeda_shinyak: facts.jaedaShinyak,
          sikssang_saengjae: facts.sikssangSaengjae,
          gunggeob_jaengjae: facts.gunggeobJaengjae,
          jae_grip: facts.jaeGrip,
        })
        .eq("id", resultId)
        .eq("user_id", userId)
        .select("id");

      if (updateError) {
        console.error("[WEALTH_ANALYZE] update", updateError.message);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "결과 저장에 실패했습니다. 알은 환불되었습니다.", refunded: true },
          { status: 500 },
        );
      }
      if (!updatedRows || updatedRows.length === 0) {
        console.error(
          `[WEALTH_ANALYZE] 결과 row 소실: update 0건. resultId=${resultId} userId=${userId} refundRef=${refundRef}`,
        );
        await refundAndCleanup();
        return NextResponse.json(
          { error: "분석 결과를 저장할 수 없습니다. 알은 환불되었습니다.", refunded: true },
          { status: 500 },
        );
      }

      // 9) 반환
      return NextResponse.json({
        ok: true,
        resultId,
        fullJson: blocks,
        wealthGrade: grade,
      });
    } catch (analysisError: any) {
      console.error("[WEALTH_ANALYZE] analysis failed", analysisError?.message || analysisError);
      await refundAndCleanup();
      return NextResponse.json(
        { error: "분석에 실패했습니다. 알은 환불되었습니다.", refunded: true },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("[WEALTH_ANALYZE] error", error?.message || error);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
