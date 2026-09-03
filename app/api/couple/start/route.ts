// /api/couple/start — "우리 결혼해도 되는 사주일까" teaser row 생성 (무료, 결제 없음)
//
// app/api/marriage/start 미러. 과금은 /api/couple/analyze 에서만 일어난다.
//
// ★결혼운과 다른 점 — 여기서 판정에 쓴 연도를 DB에 저장한다.
//   marriage 는 start 와 analyze 가 각각 `new Date().getFullYear()` 를 따로 읽는다
//   (marriage/start:205, marriage/analyze:412). 배틀처럼 즉석 재계산이면 문제가 없지만,
//   teaser 를 저장했다가 나중에 결제하는 구조에서는 12/31 teaser → 1/1 analyze 에
//   대운 구간이 넘어가 판정이 밀리고, 결제 전 판정 게이트가 **정당한 결제를 409로 튕긴다.**
//   그래서 couple 은 연도를 여기서 한 번 정해 저장하고, analyze 는 저장된 값으로 재계산한다.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { buildInputHash, type InputPayload } from "@/lib/analysis";
import { authOptions } from "@/lib/auth";
import {
  buildCoupleInputHash,
  validatePartnerInput,
  type PartnerInput,
} from "@/lib/pair/couple-input-hash";
import { computePartnerChart } from "@/lib/pair/couple-charts";
import { decideCouple } from "@/lib/pair/couple-decision";
import { derivePairFacts, type Sex } from "@/lib/pair/pair-facts";
import { getPrimarySajuData } from "@/lib/server/get-primary-saju";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { getSupabaseUserId } from "@/lib/server/user";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateSaju, enrichSajuData } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import { deriveMarriageFacts } from "@/lib/marriage-facts";
import {
  normalizeSelfInput,
  computeSelfSaju,
  type SelfSajuInput,
} from "@/lib/self-input";

type StartBody = {
  source?: "primary" | "self";
  selfInput?: SelfSajuInput;
  partner?: PartnerInput;
};

function normSex(g?: string): Sex {
  return /여|female|f/i.test(g ?? "") ? "female" : "male";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // 무과금이지만 요청마다 만세력을 **두 번** 돌린다(1인 상품보다 비싸다).
    // 클라이언트 버그로 루프가 돌아도 비싼 계산에 천장을 씌운다. userId 기준인 이유는
    // 모바일 캐리어 NAT·가족 공유 IP 오탐이 유료 퍼널을 깨뜨리기 때문(marriage/start 근거 동일).
    // ★checkRateLimit 은 boolean 이 아니라 객체를 돌려준다. `!객체` 는 항상 false 라
    //   초안의 `if (!checkRateLimit(...))` 는 429 를 한 번도 못 냈다(코드리뷰에서 발견).
    //   원본과 동일하게 .allowed 를 보고, 분당·시간당 두 창을 모두 건다.
    const rlMinute = checkRateLimit(`couple_start:${userId}:m`, 20, 60_000);
    const rlHour = checkRateLimit(`couple_start:${userId}:h`, 120, 60 * 60_000);
    if (!rlMinute.allowed || !rlHour.allowed) {
      console.warn("[RATE_LIMIT] /api/couple/start", { userId });
      const retryAfter = Math.max(rlMinute.retryAfter, rlHour.retryAfter);
      return NextResponse.json(
        { error: "요청이 너무 많아. 잠시 후 다시 시도해줘." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const body = (await request.json()) as StartBody;

    /* ── 1) 상대(B) 검증 ── */
    const partnerCheck = validatePartnerInput(body.partner ?? {});
    if (!partnerCheck.ok) {
      // 어느 필드가 문제인지 클라이언트가 표시할 수 있게 필드명만 내려준다
      // (상세 메시지는 노출하지 않는다 — CLAUDE.md: error.message 노출 금지).
      return NextResponse.json(
        {
          error: "상대 정보를 다시 확인해 주세요.",
          fields: [...partnerCheck.missing, ...partnerCheck.invalid],
        },
        { status: 400 },
      );
    }
    const partner = partnerCheck.normalized;

    /* ── 2) 본인(A) 원국 ── */
    let input: InputPayload;
    let sourceResultId: string | null = null;

    if (body.source === "self") {
      input = normalizeSelfInput(body.selfInput ?? {});
      if (!input.birthYear || !input.birthMonth || !input.birthDay || !input.gender) {
        return NextResponse.json({ error: "생년월일과 성별을 다시 확인해 주세요." }, { status: 400 });
      }
    } else {
      const primary = await getPrimarySajuData(userId);
      if (!primary) {
        return NextResponse.json({ error: "먼저 사주 분석을 완료해 주세요." }, { status: 404 });
      }
      sourceResultId = primary.sourceResultId;
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

    const selfChart =
      body.source === "self"
        ? await computeSelfSaju(input)
        : await computePrimaryChart(input);
    if (!selfChart) {
      return NextResponse.json({ error: "사주 계산에 실패했어요." }, { status: 500 });
    }

    /* ── 3) 상대(B) 원국 ── */
    const partnerChart = await computePartnerChart(partner);
    if (!partnerChart.ok) {
      return NextResponse.json({ error: partnerChart.error }, { status: 400 });
    }

    /* ── 3-1) ★이미 결제된 결과는 다시 계산하지도, 덮어쓰지도 않는다 (grandfather) ──
       upsert 는 full_json 만 보호하고 verdict·축·current_year·pair_facts_json 은 덮어쓴다.
       그러면 결제자가 산 본문과 화면에 그려지는 사실이 갈라진다 — 해가 바뀌면 실제로 갈라진다
       (지나간 해는 타이밍에서 빠지므로). CLAUDE.md 의 grandfather 원칙과도 충돌한다. */
    const existingHash = buildCoupleInputHash(input, partner);
    const { data: paid } = await supabaseAdmin
      .from("couple_results")
      .select("id, full_json, teaser_json")
      .eq("user_id", userId)
      .eq("input_hash", existingHash)
      .maybeSingle();
    if (paid?.full_json) {
      return NextResponse.json({
        ok: true,
        resultId: paid.id,
        teaser: paid.teaser_json,
        alreadyUnlocked: true,
      });
    }

    /* ── 4) 관계 사실 + 판정 ── */
    // ★연도는 여기서 한 번 정하고 저장한다. analyze 는 이 값으로 재계산한다.
    const currentYear = new Date().getFullYear();
    const sexA = normSex(input.gender);

    // 타이밍 교차 — 양쪽 결혼운 타이밍의 교집합. 기존 결혼운 엔진을 그대로 호출한다
    // (같은 사실이 두 상품에서 갈라지지 않게).
    const timingA = safeTiming(() =>
      deriveMarriageFacts(selfChart.enriched, selfChart.fortune, selfChart.saju!, sexA, "솔로", currentYear).timingWindows,
    );
    const timingB = safeTiming(() =>
      deriveMarriageFacts(
        partnerChart.enriched, partnerChart.fortune, partnerChart.saju,
        partnerChart.sex, "솔로", currentYear,
      ).timingWindows,
    );

    const facts = derivePairFacts(selfChart.enriched, partnerChart.enriched, {
      currentYear,
      sexA,
      sexB: partnerChart.sex,
      timingA,
      timingB,
    });
    const decision = decideCouple(facts);

    /* ── 5) 저장 ── */
    const inputHash = existingHash;
    const birthDate = `${input.birthYear}-${String(input.birthMonth).padStart(2, "0")}-${String(input.birthDay).padStart(2, "0")}`;
    const birthTime = input.unknownBirthTime
      ? null
      : `${String(input.birthHour).padStart(2, "0")}:${String(input.birthMinute).padStart(2, "0")}`;
    const partnerBirthDate = `${partner.birthYear}-${String(partner.birthMonth).padStart(2, "0")}-${String(partner.birthDay).padStart(2, "0")}`;

    // ★teaser_json 은 "잠금 카드"용 구조 값만 담는다. 판정 문장은 결제 후 full_json 에만.
    //   ★등급은 없다(§1-0 운영자 확정) — 저장도 노출도 하지 않는다.
    const teaserJson = {
      partnerName: partner.name,
      neutralizedAxes: decision.neutralized,
      hasTimingOverlap: facts.fortuneCross.timingOverlapYears.length > 0,
    };

    // ★full_json 은 payload 에 넣지 않는다. 이미 결제된 row 를 재호출할 때
    //   ON CONFLICT UPDATE 가 full_json 을 null 로 되돌리는 사고를 막는다(marriage 교훈).
    const upserted = await supabaseAdmin
      .from("couple_results")
      .upsert(
        {
          user_id: userId,
          source_result_id: sourceResultId,
          input_hash: inputHash,
          name: input.name,
          birth_date: birthDate,
          birth_time: birthTime,
          region: input.birthLocation,
          gender: input.gender,
          calendar_type: input.calendarType,
          partner_name: partner.name,
          partner_birth_date: partnerBirthDate,
          partner_birth_time: partner.unknownBirthTime
            ? null
            : `${String(partner.birthHour).padStart(2, "0")}:${String(partner.birthMinute ?? "0").padStart(2, "0")}`,
          partner_region: partner.birthLocation ?? null,
          partner_gender: partner.gender,
          partner_calendar_type: partner.calendarType,
          partner_unknown_birth_time: Boolean(partner.unknownBirthTime),
          is_leap_month: Boolean(input.isLeapMonth),
          partner_is_leap_month: Boolean(partner.isLeapMonth),
          current_year: currentYear,
          verdict: decision.verdict,
          axis_mind: decision.axes.마음.verdict,
          axis_life: decision.axes.생활.verdict,
          axis_complement: decision.axes.보완.verdict,
          axis_timing: decision.axes.시기.verdict,
          neutralized_axes: decision.neutralized,
          pair_facts_json: facts,
          teaser_json: teaserJson,
        },
        { onConflict: "user_id,input_hash" },
      )
      .select("id, full_json")
      .maybeSingle();

    if (upserted.error || !upserted.data?.id) {
      console.error("[COUPLE_START] upsert", upserted.error?.message);
      return NextResponse.json({ error: "정보를 저장하는 중 오류가 발생했어요." }, { status: 500 });
    }

    // ★판정(verdict)은 결제 전에 내려보내지 않는다. 판정이 곧 이 상품의 결론이다.
    //   화면만 가리면 개발자도구로 보이므로 응답 경계에서 제거한다.
    return NextResponse.json({
      ok: true,
      resultId: upserted.data.id,
      teaser: teaserJson,
      alreadyUnlocked: Boolean(upserted.data.full_json),
    });
  } catch (error: unknown) {
    console.error("[COUPLE_START] error", (error as Error)?.message || error);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

/** 대표사주 경로의 원국 계산 (marriage/start 의 primary 분기와 동일 로직) */
async function computePrimaryChart(input: InputPayload) {
  let year = Number(input.birthYear);
  let month = Number(input.birthMonth);
  let day = Number(input.birthDay);

  if (input.calendarType === "lunar") {
    const converted = convertLunarToSolar(year, month, day);
    if (!converted) return null;
    year = converted.year;
    month = converted.month;
    day = converted.day;
  }

  const hour = input.unknownBirthTime ? undefined : Number(input.birthHour);
  const minute = input.unknownBirthTime ? undefined : Number(input.birthMinute);

  const saju = await calculateSaju(year, month, day, hour, minute, {
    birthLocation: input.birthLocation,
  });
  if (!saju) return null;

  const enriched = enrichSajuData(saju, { isTimeUnknown: input.unknownBirthTime });
  let fortune: Awaited<ReturnType<typeof calculateFortune>> | null = null;
  try {
    fortune = await calculateFortune({
      birthYear: year,
      birthMonth: month,
      birthDay: day,
      birthHour: hour,
      birthMinute: minute,
      gender: /여|female|f/i.test(input.gender) ? "female" : "male",
      birthLocation: input.birthLocation,
      yearPillar: saju.year.heavenlyStem + saju.year.earthlyBranch,
      monthPillar: saju.month.heavenlyStem + saju.month.earthlyBranch,
      dayPillar: saju.day.heavenlyStem + saju.day.earthlyBranch,
      hourPillar: saju.hour.heavenlyStem + saju.hour.earthlyBranch,
      isTimeUnknown: input.unknownBirthTime,
    });
  } catch (e) {
    console.error("[COUPLE_START] 대운 계산 실패", (e as Error)?.message);
  }
  return { saju, enriched, fortune };
}

/**
 * 타이밍 산출 실패를 치명적으로 다루지 않는다 — 축이 비는 것뿐이고,
 * pair-facts 는 "겹치는 해 없음"으로 처리한다. ★없다고 감점하지 않는다.
 */
function safeTiming<T>(fn: () => T[]): T[] {
  try {
    return fn() ?? [];
  } catch (e) {
    console.error("[COUPLE_START] 타이밍 산출 실패", (e as Error)?.message);
    return [];
  }
}
