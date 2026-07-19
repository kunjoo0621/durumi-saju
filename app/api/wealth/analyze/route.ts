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
import { getSupabaseUserId } from "@/lib/server/user";
import { refundCoins } from "@/lib/server/session-helpers";
import { getPrimarySajuData } from "@/lib/server/get-primary-saju";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import { deriveWealthFacts, type WealthInterest } from "@/lib/wealth-facts";
import { computeWealthGrade, extractWealthScore } from "@/lib/wealth-grade";
import { assertWealthConsistency } from "@/lib/wealth-consistency";
import { buildWealthPrompt } from "@/lib/wealth-prompt";
import { applyWealthGuards, validateWealthBlocks, validateWealthRichness } from "@/lib/wealth-postprocess";
import { generateWithQaRegen } from "@/lib/qa-regen";
import { buildWealthTimeline } from "@/lib/fortune-timeline";
import { WEALTH_COST } from "@/lib/constants/coins";
import {
  normalizeSelfInput,
  computeSelfSaju,
  deriveSelfScores,
  type SelfSajuInput,
} from "@/lib/self-input";

// 크래시로 full_json 없이 남은 unlock을 "진행 중"으로 볼 유예 시간. 이 안이면 재차감을 막고
// 409로 잠시 후 재시도를 안내한다(동시 요청 보호). 넘으면 orphan으로 보고 멱등 환불 후 재결제.
const ORPHAN_GRACE_MS = 3 * 60 * 1000;

// 멱등 환불 헬퍼 — "차감 1회당 환불 1회, 리포트 1건" 불변식의 핵심.
// unlock row 삭제(order_id 기준)가 원자적 승자 결정: 삭제 count가 1이어야 이 호출이 환불 책임자다.
// 동시/중복 호출이 와도 삭제에 성공한 단 한 경로만 refundCoins를 부른다.
async function refundWealthUnlock(userId: string, orderId: string): Promise<boolean> {
  // 이미 이 order_id로 환불이 기록됐는지 먼저 확인 — 조회 실패면 아무것도 건드리지 않고 false(호출부가 500).
  const { data: priorRefunds, error: refundLookupError } = await supabaseAdmin
    .from("coin_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "refund")
    .eq("reference_id", orderId)
    .limit(1);
  if (refundLookupError) {
    console.error("[WEALTH_ANALYZE] refund lookup 실패", orderId, refundLookupError.message);
    return false;
  }

  // unlock 삭제 = 원자적 승자 결정. 삭제된 row가 있어야 이 호출이 환불 자격을 얻는다.
  const { data: deleted, error: deleteError } = await supabaseAdmin
    .from("wealth_result_unlocks")
    .delete()
    .eq("order_id", orderId)
    .select("id");
  if (deleteError) {
    console.error("[WEALTH_ANALYZE] unlock 삭제 실패", orderId, deleteError.message);
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
  await refundCoins(userId, WEALTH_COST, orderId);
  return true;
}

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

type AnalyzeBody = { interest?: string; source?: "primary" | "self"; selfInput?: SelfSajuInput };

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
    const interest = body.interest as WealthInterest | undefined;
    if (!interest || !ALLOWED_INTEREST.includes(interest)) {
      return NextResponse.json({ error: "관심사를 다시 선택해 주세요." }, { status: 400 });
    }

    // 입력 출처 분기: self=방금 입력(대표사주 없이), primary=대표사주 재사용.
    // primary는 아래 등급게이트·원국 재조립·프롬프트에서도 참조되므로 null 가드와 함께 상위 스코프에 둔다.
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

    // teaser row(=/api/wealth/start 산출물)가 있어야 한다 — 없으면 결제 대상 row가 없다.
    const { data: resultRow, error: resultRowError } = await supabaseAdmin
      .from("wealth_results")
      .select("id, full_json, wealth_grade")
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
      .select("id, order_id, created_at")
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
      // 결제는 됐는데 full_json이 없음 — orphan unlock. 두 경우가 섞여 있다:
      //   (a) 방금 다른 요청이 결제하고 아직 Gemini/저장 중(정상 진행) → 재차감하면 이중결제.
      //   (b) 이전 시도가 크래시로 끊겨 영영 안 채워질 stale row → 지우고 재결제해야 함.
      // 시간으로 구분한다: created_at이 3분 안이면 (a)로 보고 409로 잠시 후 재시도 안내(재차감 금지),
      // 3분을 넘겼으면 (b)로 보고 그 orphan의 차감을 멱등 환불한 뒤 이번 시도를 새로 결제시킨다.
      //
      // ★ 이전 버전은 orphan을 "환불 없이 삭제 후 재차감"해 크래시 사용자에게 이중결제를 물렸다.
      //   refundWealthUnlock으로 orphan 차감을 먼저 되돌려 "차감 1 = 리포트 1" 불변식을 지킨다.
      const ageMs = Date.now() - new Date(existingUnlock.created_at as string).getTime();
      if (Number.isFinite(ageMs) && ageMs < ORPHAN_GRACE_MS) {
        return NextResponse.json(
          { error: "이미 분석이 진행 중이에요. 잠시 후 다시 시도해 주세요.", analyzing: true },
          { status: 409 },
        );
      }
      const cleaned = await refundWealthUnlock(userId, existingUnlock.order_id as string);
      if (!cleaned) {
        return NextResponse.json({ error: "결제 정보 정리 중 오류가 발생했습니다." }, { status: 500 });
      }
      // fall-through → 아래에서 반드시 새로 결제(spend_coins + 새 unlock insert).
    }

    // 2-2) 결제 전 등급 게이트 (F-3/N-1) — 돈을 쓰기 전에 확정.
    //  · 재물운 결측을 0으로 뭉개 C를 만들지 않는다(extractWealthScore null → 500, 결제 없음).
    //  · 미리보기(start)가 저장한 등급과 지금 계산한 등급이 다르면(그 사이 개인사주 재분석으로
    //    사주가 바뀐 경우) 결제하지 않고 409 — 잘못된 등급으로 유료 리포트를 만들지 않는다.
    // self는 방금 입력한 생년월일로 원국을 즉석 계산(selfComputed)해 개인사주와 동일 산식으로
    // 재물운 점수를 산출한다. 이 원국은 결제 후 4)에서 재사용해 중복 계산을 피한다.
    // (computeSelfSaju 실패 시 throw → 바깥 try/catch가 결제 전 generic 500 처리.)
    let wealthScore: number | null;
    let selfComputed: Awaited<ReturnType<typeof computeSelfSaju>> | null = null;
    if (source === "self") {
      selfComputed = await computeSelfSaju(input);
      wealthScore = extractWealthScore({ scores: deriveSelfScores(selfComputed.enriched) });
    } else {
      const { data: srcRow, error: srcError } = await supabaseAdmin
        .from("saju_results")
        .select("full_json")
        .eq("id", primary!.sourceResultId)
        .maybeSingle();
      if (srcError) {
        console.error("[WEALTH_ANALYZE] full_json 조회 실패", srcError.message);
        return NextResponse.json({ error: "사주 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
      }
      wealthScore = extractWealthScore(srcRow?.full_json);
    }
    if (wealthScore === null) {
      console.error("[WEALTH_ANALYZE] 재물운 점수 결측 — 결제 차단");
      return NextResponse.json({ error: "재물운 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
    const { grade } = computeWealthGrade(wealthScore);
    const storedGrade = (resultRow.wealth_grade as string | null) ?? null;
    if (storedGrade && storedGrade !== grade) {
      console.error(`[WEALTH_ANALYZE] 등급 불일치 — 미리보기 ${storedGrade} vs 현재 ${grade} (결제 차단)`);
      return NextResponse.json(
        { error: "미리보기 이후 사주 정보가 바뀌었어요. 미리보기를 다시 만든 뒤 시도해 주세요.", gradeMismatch: true },
        { status: 409 },
      );
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
        // ★여기선 refundWealthUnlock을 쓰지 않는다: insert 실패로 내 order_id의 unlock row가
        //  없으니 삭제 게이트를 태우면 "삭제 0건 → 환불 스킵"이 돼 내 차감이 환불되지 않는다.
        //  loser는 자기 차감을 직접 환불해야 맞다(이긴 쪽 order_id와 다르므로 이중환불 아님).
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
      // insert 자체가 실패해 내 unlock row가 없다 — 삭제 게이트를 못 태우므로 직접 환불.
      await refundCoins(userId, WEALTH_COST, orderId);
      return NextResponse.json(
        { error: "결제 기록 저장 중 오류가 발생했습니다.", refunded: true },
        { status: 500 },
      );
    }

    const refundRef = orderId;

    // 이 지점 이후 실패하면 반드시 "환불 + 방금 넣은 unlock row 삭제"를 함께 한다.
    // 삭제(order_id) 원자성으로 "차감 1 = 환불 1"을 보장하는 멱등 헬퍼로 위임한다.
    // 실패해도 여기선 이미 500 반환 경로라 반환값은 무시(로그는 헬퍼 내부에서 남긴다).
    const refundAndCleanup = async () => {
      await refundWealthUnlock(userId, refundRef);
    };

    // 4) facts 재조립 + grade, 5~8) 일관성 검증 → Gemini → 가드 → 저장
    try {
      // self는 등급게이트에서 이미 계산한 원국(selfComputed)을 그대로 재사용(중복 계산 방지).
      // primary는 저장된 대표사주로 원국을 재조립한다(기존 로직 — primary! 가드).
      let saju: Awaited<ReturnType<typeof calculateSaju>>;
      let enriched: ReturnType<typeof enrichSajuData>;
      let fortune: Awaited<ReturnType<typeof calculateFortune>> | null;
      let sajuText: string;

      if (source === "self" && selfComputed) {
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
          console.error("[WEALTH_ANALYZE] fortune 계산 실패 (타이밍 없이 진행)", fortuneError);
        }

        saju = calcSaju;
        fortune = calcFortune;
        sajuText = formatSajuText(calcSaju, { isTimeUnknown: primary!.unknownBirthTime });
      }

      const currentYear = new Date().getFullYear();
      const facts = deriveWealthFacts(enriched, fortune, saju!, interest, currentYear);

      // wealthScore·grade는 결제 전 게이트(2-2)에서 이미 확정됐다(storedGrade와 동일 보장). 재조회 없이 그대로 사용.
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
      // self는 직업을 묻지 않아 employmentStatus가 default("직장인")다. 그 톤이 은퇴자·자영업
      // 유저에게 잘못 박히지 않도록 self면 미제공(undefined)으로 넘긴다(프롬프트가 "미제공" 처리).
      const prompt = buildWealthPrompt(
        facts,
        grade,
        sajuText,
        source === "self" ? undefined : input.employmentStatus,
        currentYear,
      );
      const _envModels = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? [];
      const models = _envModels.length > 0 ? _envModels : DEFAULT_MODELS;

      // 6)+7) Gemini 호출 + 가드 — QA 재생성 루프(가드 위반 시 위반 목록을 프롬프트에 덧붙여
      // 1회 재생성, lib/qa-regen.ts). 종전에는 위반 문장을 삭제만 해 걸릴수록 리포트가 짧아졌다.
      // 모델 폴백·F-2 블록검증·파싱은 헬퍼 안에서 동일 의미로 수행된다.
      const gen = await generateWithQaRegen<any>({
        prompt,
        systemPrompt: WEALTH_SYSTEM_PROMPT,
        models,
        temperature: 0.75,
        callModel: (model, p, sys, cfg) => callGemini(model, p, sys, cfg),
        shouldFallback,
        parse: (text) => parseJson5Loose<any>(text),
        validateBlocks: (candidate) => validateWealthBlocks(candidate),
        applyGuards: (candidate) => applyWealthGuards(candidate, facts, sajuText),
        softValidate: (b) => validateWealthRichness(b),
      });

      if (!gen.ok) {
        console.error("[WEALTH_ANALYZE] gemini 실패", gen.error);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "분석에 실패했어. 알은 환불됐어.", refunded: true },
          { status: 500 },
        );
      }
      const blocks = gen.blocks;
      const violations = gen.violations;
      if (violations.length > 0) {
        console.warn(`[WEALTH_ANALYZE] guard violations (재생성 ${gen.attempts}회 후 잔존)`, violations);
      }

      // F-2 후단: 가드가 문장을 스크럽한 뒤 필수 블록이 비었는지 재검증(무료/빈 리포트 방지).
      // 가드가 advice를 최대 통째로 지울 수 있어 여기선 minAdvice:1(최소 1개 생존) 요구.
      const postGuardIssues = validateWealthBlocks(blocks, { minAdvice: 1 });
      if (postGuardIssues.length > 0) {
        console.error("[WEALTH_ANALYZE] 가드 후 블록 부족 — 환불", postGuardIssues);
        await refundAndCleanup();
        return NextResponse.json(
          { error: "분석 결과가 불완전해요. 알은 환불됐어요.", refunded: true },
          { status: 500 },
        );
      }

      // 서버 결정론 타임라인 — 가드/스크럽이 끝난 뒤에 병합한다(LLM 산문이 아니므로 스크럽
      // 대상 아님·건드리면 안 됨). 실패해도 리포트 본문과 무관하므로 저장을 막지 않는다.
      const serverTimeline = buildWealthTimeline(fortune, facts, currentYear);
      if (serverTimeline) blocks.serverTimeline = serverTimeline;

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

      // N-2: 가드가 무언가 걸러냈으면 사후 감사용으로 기록(별도 best-effort UPDATE, 본 저장과 분리).
      // 실패해도 리포트는 이미 저장됐으므로 비치명 — 경고만 남기고 성공 반환을 막지 않는다.
      if (violations.length > 0) {
        const { error: gvError } = await supabaseAdmin
          .from("wealth_results")
          .update({ guard_violations: violations })
          .eq("id", resultId);
        if (gvError) console.warn("[WEALTH_ANALYZE] guard_violations 기록 실패(비치명)", gvError.message);
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
