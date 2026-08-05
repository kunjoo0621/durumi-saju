// 🚨 DEV ONLY — 결혼운 결과 화면 시각 검증 (prod 404). DB 마이그레이션 미적용 상태를 우회해
// 실제 파이프라인(계산 → enrichment → facts → grade → Gemini → 가드)을 서버에서 그대로 돌리고
// 그 결과를 진짜 MarriageResultClient(feature 파일, 무수정)에 먹인다.
// app/api/marriage/analyze/route.ts §4~8 조립 순서를 그대로 미러한다(운영자 실사주 고정 입력).
// Gemini 결과는 로컬 캐시 파일에 저장해 재실행마다 재호출하지 않는다(429/비용 방지).
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { deriveMarriageFacts } from "@/lib/marriage-facts";
import { computeMarriageGrade } from "@/lib/marriage-grade";
import { buildMarriagePrompt } from "@/lib/marriage-prompt";
import { applyMarriageGuards } from "@/lib/marriage-postprocess";
import { callGemini, DEFAULT_MODELS, shouldFallback } from "@/lib/analysis";
import { parseJson5Loose } from "@/lib/json5Utils";
import PreviewClient from "./PreviewClient";

const CACHE_PATH =
  "/private/tmp/claude-501/-Users-kunjoo/ea195928-7467-442f-900e-09d1c49bac45/scratchpad/marriage-preview.json";

const MARRIAGE_SYSTEM_PROMPT =
  "너는 지시받은 지침을 정확히 따르는 JSON 생성기다. 사용자 메시지에 포함된 규칙과 출력 스키마를 그대로 지켜라.";

// 운영자 실사주 고정 입력 (task brief 그대로)
const INPUT = {
  year: 1995,
  month: 6,
  day: 21,
  hour: 16,
  minute: 30,
  birthLocation: "서울",
  gender: "male" as const,
  maritalStatus: "연애중" as const,
  loveScore: 65,
};

function placeholderBlocks(reason: string) {
  return {
    teaserSummary: `[GEMINI 실패 — placeholder: ${reason}]`,
    gradeHeadline: "[placeholder] 등급 헤드라인 — Gemini 호출 실패로 실제 문구가 아님",
    spousePalace: "[placeholder] 배우자궁 진단",
    spouseStar: "[placeholder] 배우자성 분석",
    partnerProfile: "[placeholder] 관계 패턴",
    relationshipPattern: "[placeholder] 관계 맹점",
    timingFlow: "[placeholder] 타이밍",
    advice: [] as Array<{ text: string; tag: string }>,
    gunghapCta: "[placeholder] 궁합 CTA",
  };
}

async function buildPreviewData() {
  if (fs.existsSync(CACHE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
    } catch {
      // 캐시 파손 — 아래에서 재생성
    }
  }

  const saju = await calculateSaju(INPUT.year, INPUT.month, INPUT.day, INPUT.hour, INPUT.minute, {
    birthLocation: INPUT.birthLocation,
  });
  if (!saju) throw new Error("[dev marriage preview] 사주 계산 실패");

  const enriched = enrichSajuData(saju, { isTimeUnknown: false });

  let fortune = null;
  try {
    fortune = await calculateFortune({
      birthYear: INPUT.year,
      birthMonth: INPUT.month,
      birthDay: INPUT.day,
      birthHour: INPUT.hour,
      birthMinute: INPUT.minute,
      gender: INPUT.gender,
      birthLocation: INPUT.birthLocation,
      yearPillar: saju.year.heavenlyStem + saju.year.earthlyBranch,
      monthPillar: saju.month.heavenlyStem + saju.month.earthlyBranch,
      dayPillar: saju.day.heavenlyStem + saju.day.earthlyBranch,
      hourPillar: saju.hour.heavenlyStem + saju.hour.earthlyBranch,
      isTimeUnknown: false,
    });
  } catch (e) {
    console.error("[dev marriage preview] fortune 계산 실패 (타이밍 없이 진행)", e);
  }

  const currentYear = new Date().getFullYear();
  const facts = deriveMarriageFacts(enriched, fortune, saju, INPUT.gender, INPUT.maritalStatus, currentYear);
  const sajuText = formatSajuText(saju, { isTimeUnknown: false });
  const { grade } = computeMarriageGrade(INPUT.loveScore);

  const prompt = buildMarriagePrompt(facts, grade, sajuText);

  let parsed: any = null;
  let geminiOk = false;
  let failReason = "";
  for (const model of DEFAULT_MODELS) {
    const res = await callGemini(model, prompt, MARRIAGE_SYSTEM_PROMPT, { temperature: 0.75 });
    if (res.ok) {
      try {
        parsed = parseJson5Loose<any>(res.text);
        geminiOk = true;
        break;
      } catch (parseError: any) {
        console.error("[dev marriage preview] JSON 파싱 실패", parseError?.message, res.text?.slice(0, 300));
        failReason = "JSON 파싱 실패";
        continue;
      }
    }
    failReason = (res as any).apiStatus || (res as any).message || `status ${(res as any).status}`;
    if (!shouldFallback((res as any).status, (res as any).apiStatus)) break;
  }

  const blocks = parsed ? applyMarriageGuards(parsed, facts, sajuText).blocks : placeholderBlocks(failReason);

  const apiResponse = {
    status: "completed" as const,
    resultId: "dev-preview",
    maritalStatus: INPUT.maritalStatus,
    marriageGrade: grade,
    spouseStarType: facts.spouseStarType,
    gwansalHonjap: facts.gwansalHonjap,
    spouseStarAbsent: facts.spouseStarAbsent,
    spousePalaceStability: facts.spousePalaceStability,
    result: blocks,
    teaser: null,
    createdAt: new Date().toISOString(),
    __devMeta: { geminiOk, facts, sajuText },
  };

  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(apiResponse, null, 2));
  return apiResponse;
}

export default async function DevMarriageResultUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const data = await buildPreviewData();
  return <PreviewClient data={data} />;
}
