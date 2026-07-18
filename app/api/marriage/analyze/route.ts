// /api/marriage/analyze — 멱등 차감 + Gemini + 가드 + 저장 (+ 실패 시 환불)
// app/api/today/analyze + app/api/today/start 의 결제/환불 패턴을 그대로 재사용한다.
// (docs/superpowers/sdd/task-9-brief.md — 코인 차감/환불 로직은 today 검증 함수 재사용, 신규 작성 금지)
//
// today와의 구조적 차이: today는 start에서 차감하고 analyze는 환불만 담당하지만,
// 결혼운 검사는 teaser(=/api/marriage/start)까지 무료이고 실제 결제는 이 라우트에서 일어난다.
// 그래서 여기서 "잔액 확인 → spend_coins → unlocks insert"(today/start 미러)와
// "실패 시 refundCoins"(today/analyze 미러)를 한 라우트 안에서 순서대로 수행한다.
//
// 고정 순서 (brief Step 2):
//   1) marital_status 화이트리스트 검증
//   2) 멱등 체크 (marriage_result_unlocks 존재 && full_json 있음 → 재분석 없이 반환)
//   2-1) unlock은 있는데 full_json이 없는 orphan(이전 시도가 도중에 끊김) → 그 unlock을
//        지우고 fall-through — 재차감 없는 재사용 금지(무료 리포트/환불 파밍 방지, task-9 리뷰)
//   3) 잔액 확인 + 차감 (order_id 생성, unlocks insert; unique 위반 = 동시 요청 loser = 멱등)
//   4) facts 재조립 + grade
//   5) assertMarriageConsistency 실패 → 환불 + unlock row 삭제 + 500
//   6) Gemini 호출 → JSON 파싱
//   7) applyMarriageGuards
//   8) 저장
//   9) 실패(consistency/파싱/Gemini/저장/row소실) → 환불 + 방금 넣은 unlock row 삭제 + 한국어 메시지
//      (차감된 unlock row를 남겨두면 재시도가 "이미 결제됨"으로 오인해 무료로 통과하거나,
//       실패마다 refundCoins가 재호출돼 코인이 무한 증식한다 — refundCoins는 참조 기준
//       멱등이 아니므로 "차감당 1회 환불"을 여기서 구조적으로 보장해야 한다)

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
import { deriveMarriageFacts, type MaritalStatus } from "@/lib/marriage-facts";
import { computeMarriageGrade, extractLoveScore } from "@/lib/marriage-grade";
import { assertMarriageConsistency } from "@/lib/marriage-consistency";
import { buildMarriagePrompt } from "@/lib/marriage-prompt";
import { applyMarriageGuards, validateMarriageBlocks } from "@/lib/marriage-postprocess";
import { MARRIAGE_COST } from "@/lib/constants/coins";

// 크래시로 full_json 없이 남은 unlock을 "진행 중"으로 볼 유예 시간. 이 안이면 재차감을 막고
// 409로 잠시 후 재시도를 안내한다(동시 요청 보호). 넘으면 orphan으로 보고 멱등 환불 후 재결제.
const ORPHAN_GRACE_MS = 3 * 60 * 1000;

// 멱등 환불 헬퍼 — "차감 1회당 환불 1회, 리포트 1건" 불변식의 핵심.
// unlock row 삭제(order_id 기준)가 원자적 승자 결정: 삭제 count가 1이어야 이 호출이 환불 책임자다.
// 동시/중복 호출이 와도 삭제에 성공한 단 한 경로만 refundCoins를 부른다.
async function refundMarriageUnlock(userId: string, orderId: string): Promise<boolean> {
  // 이미 이 order_id로 환불이 기록됐는지 먼저 확인 — 조회 실패면 아무것도 건드리지 않고 false(호출부가 500).
  const { data: priorRefunds, error: refundLookupError } = await supabaseAdmin
    .from("coin_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "refund")
    .eq("reference_id", orderId)
    .limit(1);
  if (refundLookupError) {
    console.error("[MARRIAGE_ANALYZE] refund lookup 실패", orderId, refundLookupError.message);
    return false;
  }

  // unlock 삭제 = 원자적 승자 결정. 삭제된 row가 있어야 이 호출이 환불 자격을 얻는다.
  const { data: deleted, error: deleteError } = await supabaseAdmin
    .from("marriage_result_unlocks")
    .delete()
    .eq("order_id", orderId)
    .select("id");
  if (deleteError) {
    console.error("[MARRIAGE_ANALYZE] unlock 삭제 실패", orderId, deleteError.message);
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
  await refundCoins(userId, MARRIAGE_COST, orderId);
  return true;
}

const ALLOWED_STATUS: MaritalStatus[] = ["솔로", "연애중", "기혼", "다시 혼자"];

const MARRIAGE_SYSTEM_PROMPT =
  "너는 지시받은 지침을 정확히 따르는 JSON 생성기다. 사용자 메시지에 포함된 규칙과 출력 스키마를 그대로 지켜라.";

function normGender(g: string): "male" | "female" {
  return /여|female|f/i.test(g) ? "female" : "male";
}

type AnalyzeBody = { maritalStatus?: string };

export async function POST(request: NextRequest) {
  try {
    // 1) 검증
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as AnalyzeBody;
    const maritalStatus = body.maritalStatus as MaritalStatus | undefined;
    if (!maritalStatus || !ALLOWED_STATUS.includes(maritalStatus)) {
      return NextResponse.json({ error: "관계 상태를 다시 선택해 주세요." }, { status: 400 });
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

    // teaser row(=/api/marriage/start 산출물)가 있어야 한다 — 없으면 결제 대상 row가 없다.
    const { data: resultRow, error: resultRowError } = await supabaseAdmin
      .from("marriage_results")
      .select("id, full_json, marriage_grade")
      .eq("user_id", userId)
      .eq("input_hash", inputHash)
      .eq("marital_status", maritalStatus)
      .maybeSingle();

    if (resultRowError) {
      console.error("[MARRIAGE_ANALYZE] result row lookup", resultRowError.message);
      return NextResponse.json({ error: "결과 조회 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!resultRow) {
      return NextResponse.json(
        { error: "먼저 결혼운 미리보기를 생성해 주세요." },
        { status: 404 },
      );
    }
    const resultId = resultRow.id as string;

    // 2) 멱등 체크
    const { data: existingUnlock, error: unlockLookupError } = await supabaseAdmin
      .from("marriage_result_unlocks")
      .select("id, order_id, created_at")
      .eq("user_id", userId)
      .eq("input_hash", inputHash)
      .eq("marital_status", maritalStatus)
      .maybeSingle();

    if (unlockLookupError) {
      console.error("[MARRIAGE_ANALYZE] unlock lookup", unlockLookupError.message);
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
      // 결제는 됐는데 full_json이 없음 — orphan unlock. 두 경우가 섞여 있다:
      //   (a) 방금 다른 요청이 결제하고 아직 Gemini/저장 중(정상 진행) → 재차감하면 이중결제.
      //   (b) 이전 시도가 크래시로 끊겨 영영 안 채워질 stale row → 지우고 재결제해야 함.
      // 시간으로 구분한다: created_at이 3분 안이면 (a)로 보고 409로 잠시 후 재시도 안내(재차감 금지),
      // 3분을 넘겼으면 (b)로 보고 그 orphan의 차감을 멱등 환불한 뒤 이번 시도를 새로 결제시킨다.
      //
      // ★ 이전 버전은 orphan을 "환불 없이 삭제 후 재차감"해 크래시 사용자에게 이중결제를 물렸다.
      //   refundMarriageUnlock으로 orphan 차감을 먼저 되돌려 "차감 1 = 리포트 1" 불변식을 지킨다.
      const ageMs = Date.now() - new Date(existingUnlock.created_at as string).getTime();
      if (Number.isFinite(ageMs) && ageMs < ORPHAN_GRACE_MS) {
        return NextResponse.json(
          { error: "이미 분석이 진행 중이에요. 잠시 후 다시 시도해 주세요.", analyzing: true },
          { status: 409 },
        );
      }
      const cleaned = await refundMarriageUnlock(userId, existingUnlock.order_id as string);
      if (!cleaned) {
        return NextResponse.json({ error: "결제 정보 정리 중 오류가 발생했습니다." }, { status: 500 });
      }
      // fall-through → 아래에서 반드시 새로 결제(spend_coins + 새 unlock insert).
    }

    // 2-2) 결제 전 등급 게이트 (F-3/N-1) — 돈을 쓰기 전에 확정.
    //  · 연애운 결측을 0으로 뭉개 C를 만들지 않는다(extractLoveScore null → 500, 결제 없음).
    //  · 미리보기(start)가 저장한 등급과 지금 계산한 등급이 다르면(그 사이 개인사주 재분석으로
    //    사주가 바뀐 경우) 결제하지 않고 409 — 잘못된 등급으로 유료 리포트를 만들지 않는다.
    const { data: srcRow, error: srcError } = await supabaseAdmin
      .from("saju_results")
      .select("full_json")
      .eq("id", primary.sourceResultId)
      .maybeSingle();
    if (srcError) {
      console.error("[MARRIAGE_ANALYZE] full_json 조회 실패", srcError.message);
      return NextResponse.json({ error: "사주 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
    const loveScore = extractLoveScore(srcRow?.full_json);
    if (loveScore === null) {
      console.error("[MARRIAGE_ANALYZE] 연애운 점수 결측 — 결제 차단");
      return NextResponse.json({ error: "연애운 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
    const { grade } = computeMarriageGrade(loveScore);
    const storedGrade = (resultRow.marriage_grade as string | null) ?? null;
    if (storedGrade && storedGrade !== grade) {
      console.error(`[MARRIAGE_ANALYZE] 등급 불일치 — 미리보기 ${storedGrade} vs 현재 ${grade} (결제 차단)`);
      return NextResponse.json(
        { error: "미리보기 이후 사주 정보가 바뀌었어요. 미리보기를 다시 만든 뒤 시도해 주세요.", gradeMismatch: true },
        { status: 409 },
      );
    }

    // 3) 잔액 확인 + 차감 (today/start 패턴 미러) — 이 지점부터는 항상 신규 결제 경로.
    const orderId = `marriage_${inputHash.slice(0, 16)}_${maritalStatus}_${Date.now()}_${userId.slice(0, 8)}`;

    const spendRpc = await supabaseAdmin.rpc("spend_coins", {
      p_user_id: userId,
      p_amount: MARRIAGE_COST,
      p_reference_id: orderId,
    });

    if (spendRpc.error) {
      console.error("[MARRIAGE_ANALYZE] spend rpc", spendRpc.error.message);
      return NextResponse.json({ error: "알 차감 중 오류가 발생했습니다." }, { status: 500 });
    }

    const spendResult = Array.isArray(spendRpc.data) ? spendRpc.data[0] : spendRpc.data;
    if (!spendResult?.success) {
      return NextResponse.json(
        {
          insufficient: true,
          balance: spendResult?.new_balance ?? 0,
          required: MARRIAGE_COST,
          error: "알이 부족해요. 알을 충전한 뒤 다시 시도해 주세요.",
        },
        { status: 402 },
      );
    }

    // unique(user_id, input_hash, marital_status) 위반 = 동시 요청이 먼저 결제 완료 = 멱등 처리.
    const unlockInsert = await supabaseAdmin.from("marriage_result_unlocks").insert({
      user_id: userId,
      result_id: resultId,
      input_hash: inputHash,
      marital_status: maritalStatus,
      order_id: orderId,
    });

    if (unlockInsert.error) {
      if (unlockInsert.error.code === "23505") {
        // 진 쪽(loser) — 이긴 쪽이 이미 unlock row를 갖고 있으므로 내 차감만 환불하고 끝낸다.
        // 이긴 쪽 row는 절대 건드리지 않는다(아래 refundAndCleanup과 달리 삭제 없음).
        // ★여기선 refundMarriageUnlock을 쓰지 않는다: insert 실패로 내 order_id의 unlock row가
        //  없으니 삭제 게이트를 태우면 "삭제 0건 → 환불 스킵"이 돼 내 차감이 환불되지 않는다.
        //  loser는 자기 차감을 직접 환불해야 맞다(이긴 쪽 order_id와 다르므로 이중환불 아님).
        await refundCoins(userId, MARRIAGE_COST, orderId);
        const { data: freshRow } = await supabaseAdmin
          .from("marriage_results")
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
      console.error("[MARRIAGE_ANALYZE] unlock insert", unlockInsert.error.message);
      // insert 자체가 실패해 내 unlock row가 없다 — 삭제 게이트를 못 태우므로 직접 환불.
      await refundCoins(userId, MARRIAGE_COST, orderId);
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
      // 삭제(order_id) 원자성으로 "차감 1 = 환불 1"을 보장하는 멱등 헬퍼로 위임한다.
      // 실패해도 여기선 이미 500 반환 경로라 반환값은 무시(로그는 헬퍼 내부에서 남긴다).
      await refundMarriageUnlock(userId, refundRef);
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
        console.error("[MARRIAGE_ANALYZE] fortune 계산 실패 (타이밍 없이 진행)", fortuneError);
      }

      const currentYear = new Date().getFullYear();
      const facts = deriveMarriageFacts(enriched, fortune, saju, gender, maritalStatus, currentYear);
      const sajuText = formatSajuText(saju, { isTimeUnknown: primary.unknownBirthTime });

      // loveScore·grade는 결제 전 게이트(2-2)에서 이미 확정됐다(storedGrade와 동일 보장). 재조회 없이 그대로 사용.
      // 5) 일관성 검증 — 실패하면 Gemini도 호출하지 않고 즉시 환불.
      const issues = assertMarriageConsistency({
        grade,
        loveScore,
        facts: { sex: facts.sex, spouseStarType: facts.spouseStarType },
        primaryGender: primary.gender,
      });
      if (issues.length > 0) {
        console.error("[MARRIAGE_ANALYZE] consistency 실패", issues);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "결혼운 분석 결과에 문제가 있어요. 알은 환불됐어요.", refunded: true },
          { status: 500 },
        );
      }

      // 6) Gemini 호출 (analysis.ts 모델 fallback 체인 미러) → JSON5 파싱
      const prompt = buildMarriagePrompt(facts, grade, sajuText);
      const _envModels = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? [];
      const models = _envModels.length > 0 ? _envModels : DEFAULT_MODELS;

      let parsed: any = null;
      let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;

      for (const model of models) {
        const res = await callGemini(model, prompt, MARRIAGE_SYSTEM_PROMPT, { temperature: 0.75 });
        if (res.ok) {
          try {
            const candidate = parseJson5Loose<any>(res.text);
            // F-2: 필수 블록이 다 찼는지 파싱 직후 검증 — 비거나 스키마를 어긴 응답이면
            // 다음 모델로 폴백(빈 유료 리포트가 저장되는 걸 막는다).
            const blockIssues = validateMarriageBlocks(candidate);
            if (blockIssues.length > 0) {
              console.error("[MARRIAGE_ANALYZE] 블록 검증 실패 — 폴백", blockIssues);
              lastError = { status: 502, apiStatus: "INVALID_BLOCKS", message: "분석 결과 형식이 불완전합니다." };
              continue;
            }
            parsed = candidate;
            lastError = null;
            break;
          } catch (parseError: any) {
            console.error("[MARRIAGE_ANALYZE] JSON 파싱 실패", parseError?.message, res.text?.slice(0, 300));
            lastError = { status: 502, apiStatus: "INVALID_JSON", message: "분석 결과 형식이 불완전합니다." };
            continue;
          }
        }
        lastError = res;
        if (!shouldFallback(res.status, res.apiStatus)) break;
      }

      if (!parsed) {
        console.error("[MARRIAGE_ANALYZE] gemini 실패", lastError);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "분석에 실패했어. 알은 환불됐어.", refunded: true },
          { status: 500 },
        );
      }

      // 7) 가드
      const { blocks, violations } = applyMarriageGuards(parsed, facts, sajuText);
      if (violations.length > 0) {
        console.warn("[MARRIAGE_ANALYZE] guard violations", violations);
      }

      // F-2 후단: 가드가 문장을 스크럽한 뒤 필수 블록이 비었는지 재검증(무료/빈 리포트 방지).
      // 가드가 advice를 최대 통째로 지울 수 있어 여기선 minAdvice:1(최소 1개 생존) 요구.
      const postGuardIssues = validateMarriageBlocks(blocks, { minAdvice: 1 });
      if (postGuardIssues.length > 0) {
        console.error("[MARRIAGE_ANALYZE] 가드 후 블록 부족 — 환불", postGuardIssues);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "분석 결과가 불완전해요. 알은 환불됐어요.", refunded: true },
          { status: 500 },
        );
      }

      // 8) 저장
      const { data: updatedRows, error: updateError } = await supabaseAdmin
        .from("marriage_results")
        .update({
          full_json: blocks,
          saju_text: sajuText,
          marriage_grade: grade,
          spouse_star_type: facts.spouseStarType,
          gwansal_honjap: facts.gwansalHonjap,
          spouse_star_absent: facts.spouseStarAbsent,
          spouse_palace_stability: facts.spousePalaceStability,
        })
        .eq("id", resultId)
        .eq("user_id", userId)
        .select("id");

      if (updateError) {
        console.error("[MARRIAGE_ANALYZE] update", updateError.message);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "결과 저장에 실패했습니다. 알은 환불되었습니다.", refunded: true },
          { status: 500 },
        );
      }
      if (!updatedRows || updatedRows.length === 0) {
        console.error(
          `[MARRIAGE_ANALYZE] 결과 row 소실: update 0건. resultId=${resultId} userId=${userId} refundRef=${refundRef}`,
        );
        await refundAndCleanup();
        return NextResponse.json(
          { error: "분석 결과를 저장할 수 없습니다. 알은 환불되었습니다.", refunded: true },
          { status: 500 },
        );
      }

      // N-2: 가드가 무언가 걸러냈으면 사후 감사용으로 기록(별도 best-effort UPDATE, 본 저장과 분리).
      // 실패해도 리포트는 이미 저장됐으므로 비치명 — 경고만 남기고 성공 반환을 막지 않는다.
      if (violations.length > 0) {
        const { error: gvError } = await supabaseAdmin
          .from("marriage_results")
          .update({ guard_violations: violations })
          .eq("id", resultId);
        if (gvError) console.warn("[MARRIAGE_ANALYZE] guard_violations 기록 실패(비치명)", gvError.message);
      }

      // 9) 반환
      return NextResponse.json({
        ok: true,
        resultId,
        fullJson: blocks,
        marriageGrade: grade,
      });
    } catch (analysisError: any) {
      console.error("[MARRIAGE_ANALYZE] analysis failed", analysisError?.message || analysisError);
      await refundAndCleanup();
      return NextResponse.json(
        { error: "분석에 실패했습니다. 알은 환불되었습니다.", refunded: true },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("[MARRIAGE_ANALYZE] error", error?.message || error);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
