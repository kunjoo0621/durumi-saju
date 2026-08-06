// 🚨 DEV ONLY — 재물운/결혼운 검증 배치용 파라미터화 리포트 엔드포인트
// NODE_ENV=production이면 404
// 실제 유저/DB/코인 차감 없이 wealth/analyze, marriage/analyze와 동일한 계산 파이프라인을
// (facts → grade → prompt → Gemini → guards) 순서 그대로 태워 blocks를 뽑아낸다.
// 임시 검증 도구 — 커밋하지 않는다.

import { NextRequest, NextResponse } from "next/server";
import {
  callGemini,
  DEFAULT_MODELS,
  shouldFallback,
} from "@/lib/analysis";
import { parseJson5Loose } from "@/lib/json5Utils";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { calculateServerScoring, scoreToGrade } from "@/lib/utils/saju-scoring";
import { deriveWealthFacts, type WealthInterest } from "@/lib/wealth-facts";
import { computeWealthGrade } from "@/lib/wealth-grade";
import { buildWealthPrompt } from "@/lib/wealth-prompt";
import { applyWealthGuards, validateWealthBlocks } from "@/lib/wealth-postprocess";
import { deriveMarriageFacts, type MaritalStatus } from "@/lib/marriage-facts";
import { computeMarriageGrade } from "@/lib/marriage-grade";
import { buildMarriagePrompt } from "@/lib/marriage-prompt";
import { applyMarriageGuards } from "@/lib/marriage-postprocess";

const WEALTH_SYSTEM_PROMPT =
  "너는 지시받은 지침을 정확히 따르는 JSON 생성기다. 사용자 메시지에 포함된 규칙과 출력 스키마를 그대로 지켜라.";
const MARRIAGE_SYSTEM_PROMPT = WEALTH_SYSTEM_PROMPT;

const ALLOWED_INTEREST: WealthInterest[] = [
  "목돈·노후 준비",
  "투자로 불리기",
  "사업·수입 키우기",
  "지출·빚 관리",
];
const ALLOWED_STATUS: MaritalStatus[] = ["솔로", "연애중", "기혼", "다시 혼자"];

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const sp = request.nextUrl.searchParams;
    const y = Number(sp.get("y"));
    const m = Number(sp.get("m"));
    const d = Number(sp.get("d"));
    const hRaw = sp.get("h");
    const hour = hRaw !== null && hRaw !== "" ? Number(hRaw) : undefined;
    const sexRaw = (sp.get("sex") || "male") as "male" | "female";
    const sex: "male" | "female" = sexRaw === "female" ? "female" : "male";
    const kind = sp.get("kind");
    const interest = sp.get("interest") as WealthInterest | null;
    const maritalStatus = sp.get("maritalStatus") as MaritalStatus | null;

    if (!y || !m || !d) {
      return NextResponse.json({ error: "y, m, d는 필수입니다." }, { status: 400 });
    }
    if (kind !== "wealth" && kind !== "marriage") {
      return NextResponse.json({ error: "kind는 wealth|marriage 여야 합니다." }, { status: 400 });
    }
    if (kind === "wealth" && (!interest || !ALLOWED_INTEREST.includes(interest))) {
      return NextResponse.json({ error: "interest가 유효하지 않습니다." }, { status: 400 });
    }
    if (kind === "marriage" && (!maritalStatus || !ALLOWED_STATUS.includes(maritalStatus))) {
      return NextResponse.json({ error: "maritalStatus가 유효하지 않습니다." }, { status: 400 });
    }

    // 1) 사주 계산 — app/api/marriage/from-primary/route.ts 조립 순서 미러
    const isTimeUnknown = hour === undefined;
    const saju = await calculateSaju(y, m, d, hour, hour !== undefined ? 0 : undefined, {
      birthLocation: "서울",
    });
    if (!saju) {
      return NextResponse.json({ error: "사주 계산에 실패했어요." }, { status: 500 });
    }
    const enriched = enrichSajuData(saju, { isTimeUnknown });

    let fortune = null;
    try {
      fortune = await calculateFortune({
        birthYear: y,
        birthMonth: m,
        birthDay: d,
        birthHour: hour,
        birthMinute: hour !== undefined ? 0 : undefined,
        gender: sex,
        birthLocation: "서울",
        yearPillar: saju.year.heavenlyStem + saju.year.earthlyBranch,
        monthPillar: saju.month.heavenlyStem + saju.month.earthlyBranch,
        dayPillar: saju.day.heavenlyStem + saju.day.earthlyBranch,
        hourPillar: saju.hour.heavenlyStem + saju.hour.earthlyBranch,
        isTimeUnknown,
      });
    } catch (fortuneError) {
      console.error("[DEV_REPORT] fortune 계산 실패 (타이밍 없이 진행)", fortuneError);
    }

    const sajuText = formatSajuText(saju, { isTimeUnknown });
    const palja = `${saju.year.heavenlyStem}${saju.year.earthlyBranch} ${saju.month.heavenlyStem}${saju.month.earthlyBranch} ${saju.day.heavenlyStem}${saju.day.earthlyBranch} ${saju.hour.heavenlyStem}${saju.hour.earthlyBranch}`;

    // 2) 개인사주 카테고리 점수 — 기존 scoring 그대로 재사용(신규 유저 분석과 동일 계산)
    const serverScoring = calculateServerScoring(enriched);
    const wealthScore = serverScoring.scores.재물운;
    const loveScore = serverScoring.scores.연애운;
    const sajuScore = {
      재물운: { score: wealthScore, grade: scoreToGrade(wealthScore) },
      연애운: { score: loveScore, grade: scoreToGrade(loveScore) },
    };

    const currentYear = 2026;
    const models = DEFAULT_MODELS;

    if (kind === "wealth") {
      const facts = deriveWealthFacts(enriched, fortune, saju, interest as WealthInterest, currentYear);
      const { grade } = computeWealthGrade(wealthScore);
      const prompt = buildWealthPrompt(facts, grade, sajuText, "직장인");

      let parsed: any = null;
      let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;
      for (const model of models) {
        const res = await callGemini(model, prompt, WEALTH_SYSTEM_PROMPT, { temperature: 0.75 });
        if (res.ok) {
          try {
            const candidate = parseJson5Loose<any>(res.text);
            const blockIssues = validateWealthBlocks(candidate);
            if (blockIssues.length > 0) {
              lastError = { status: 502, apiStatus: "INVALID_BLOCKS", message: blockIssues.join("; ") };
              continue;
            }
            parsed = candidate;
            lastError = null;
            break;
          } catch (parseError: any) {
            lastError = { status: 502, apiStatus: "INVALID_JSON", message: parseError?.message };
            continue;
          }
        }
        lastError = res;
        if (!shouldFallback(res.status, res.apiStatus)) break;
      }

      if (!parsed) {
        return NextResponse.json(
          { error: "gemini 실패", detail: lastError, palja, sajuScore, grade, facts },
          { status: 502 },
        );
      }

      const { blocks, violations } = applyWealthGuards(parsed, facts, sajuText);
      return NextResponse.json({ palja, sajuScore, grade, facts, blocks, violations });
    }

    // kind === "marriage"
    const facts = deriveMarriageFacts(enriched, fortune, saju, sex, maritalStatus as MaritalStatus, currentYear);
    const { grade } = computeMarriageGrade(loveScore);
    const prompt = buildMarriagePrompt(facts, grade, sajuText);

    let parsed: any = null;
    let lastError: { status?: number; apiStatus?: string; message?: string } | null = null;
    for (const model of models) {
      const res = await callGemini(model, prompt, MARRIAGE_SYSTEM_PROMPT, { temperature: 0.75 });
      if (res.ok) {
        try {
          parsed = parseJson5Loose<any>(res.text);
          lastError = null;
          break;
        } catch (parseError: any) {
          lastError = { status: 502, apiStatus: "INVALID_JSON", message: parseError?.message };
          continue;
        }
      }
      lastError = res;
      if (!shouldFallback(res.status, res.apiStatus)) break;
    }

    if (!parsed) {
      return NextResponse.json(
        { error: "gemini 실패", detail: lastError, palja, sajuScore, grade, facts },
        { status: 502 },
      );
    }

    const { blocks, violations } = applyMarriageGuards(parsed, facts, sajuText);
    return NextResponse.json({ palja, sajuScore, grade, facts, blocks, violations });
  } catch (error: any) {
    console.error("[DEV_REPORT] error", error?.message || error);
    return NextResponse.json({ error: error?.message || "unexpected" }, { status: 500 });
  }
}
