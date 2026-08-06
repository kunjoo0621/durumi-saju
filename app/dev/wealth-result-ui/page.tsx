// 🚨 DEV ONLY — 재물운 결과 화면 시각 검증 (prod 404). DB 마이그레이션 미적용 상태를 우회해
// 실제 파이프라인(계산 → enrichment → facts → grade → Gemini → 가드)을 서버에서 그대로 돌리고
// 그 결과를 진짜 WealthResultClient(feature 파일, 무수정)에 먹인다.
// app/dev/marriage-result-ui/page.tsx 그대로 미러(도메인만 wealth) — app/api/wealth/analyze/route.ts
// §4~8 조립 순서를 그대로 따른다. 운영자 실사주 고정 입력 + 실제 저장된 primary saju_results
// row(name="신건주", birth_date="1995-06-21")에서 재물운 점수를 읽어온다(하드코딩 아님).
// Gemini 결과는 로컬 캐시 파일에 저장해 재실행마다 재호출하지 않는다(429/비용 방지).
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { calculateSaju, enrichSajuData, formatSajuText } from "@/lib/utils/saju";
import { calculateFortune } from "@/lib/utils/saju-fortune";
import { deriveWealthFacts } from "@/lib/wealth-facts";
import { computeWealthGrade } from "@/lib/wealth-grade";
import { buildWealthPrompt } from "@/lib/wealth-prompt";
import { applyWealthGuards } from "@/lib/wealth-postprocess";
import { callGemini, DEFAULT_MODELS, shouldFallback } from "@/lib/analysis";
import { parseJson5Loose } from "@/lib/json5Utils";
import { normalizeScores } from "@/lib/resultSchema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PreviewClient from "./PreviewClient";

const CACHE_PATH =
  "/private/tmp/claude-501/-Users-kunjoo/ea195928-7467-442f-900e-09d1c49bac45/scratchpad/wealth-preview.json";

const WEALTH_SYSTEM_PROMPT =
  "너는 지시받은 지침을 정확히 따르는 JSON 생성기다. 사용자 메시지에 포함된 규칙과 출력 스키마를 그대로 지켜라.";

// 운영자 실사주 고정 입력 (marriage dev-preview와 동일 인물)
const INPUT = {
  year: 1995,
  month: 6,
  day: 21,
  hour: 16,
  minute: 30,
  birthLocation: "서울",
  interest: "투자로 불리기" as const,
  employmentStatus: "직장인",
};

function placeholderBlocks(reason: string) {
  return {
    teaserSummary: `[GEMINI 실패 — placeholder: ${reason}]`,
    gradeHeadline: "[placeholder] 등급 헤드라인 — Gemini 호출 실패로 실제 문구가 아님",
    jaeseongDiagnosis: "[placeholder] 재성 진단",
    jaeGripDiagnosis: "[placeholder] 재를 담는 그릇",
    savingStyle: "[placeholder] 투자 성향",
    riskAndPace: "[placeholder] 감당 가능한 리스크",
    timingFlow: "[placeholder] 타이밍",
    advice: [] as Array<{ text: string; tag: string }>,
    yearlyCta: "[placeholder] 올해 재물 흐름 CTA",
  };
}

// 실제 저장된 운영자 primary saju_results row에서 재물운 점수를 읽는다(하드코딩 금지 —
// coordinator 지시: "wealthScore는 normalizeScores(fullJson?.scores).재물운, 신건주 row 사용").
// 이름 표기 흔들림(테스트 데이터에 "신건주" 외 오타 변형도 섞여 있음)이 있어 정확히
// name="신건주"·birth_date="1995-06-21"·birth_time="16:30"인 행 중 최신 1건을 고른다.
async function fetchOperatorWealthScore(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("saju_results")
    .select("full_json, created_at")
    .eq("name", "신건주")
    .eq("birth_date", "1995-06-21")
    .eq("birth_time", "16:30")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[dev wealth preview] 신건주 row 조회 실패", error.message);
    return 0;
  }
  if (!data) {
    console.error("[dev wealth preview] 신건주 row 없음 — wealthScore 0 폴백");
    return 0;
  }
  return normalizeScores((data.full_json as any)?.scores).재물운;
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
  if (!saju) throw new Error("[dev wealth preview] 사주 계산 실패");

  const enriched = enrichSajuData(saju, { isTimeUnknown: false });

  let fortune = null;
  try {
    fortune = await calculateFortune({
      birthYear: INPUT.year,
      birthMonth: INPUT.month,
      birthDay: INPUT.day,
      birthHour: INPUT.hour,
      birthMinute: INPUT.minute,
      gender: "male",
      birthLocation: INPUT.birthLocation,
      yearPillar: saju.year.heavenlyStem + saju.year.earthlyBranch,
      monthPillar: saju.month.heavenlyStem + saju.month.earthlyBranch,
      dayPillar: saju.day.heavenlyStem + saju.day.earthlyBranch,
      hourPillar: saju.hour.heavenlyStem + saju.hour.earthlyBranch,
      isTimeUnknown: false,
    });
  } catch (e) {
    console.error("[dev wealth preview] fortune 계산 실패 (타이밍 없이 진행)", e);
  }

  const currentYear = new Date().getFullYear();
  const facts = deriveWealthFacts(enriched, fortune, saju, INPUT.interest, currentYear);
  const sajuText = formatSajuText(saju, { isTimeUnknown: false });

  const wealthScore = await fetchOperatorWealthScore();
  const { grade } = computeWealthGrade(wealthScore);

  const prompt = buildWealthPrompt(facts, grade, sajuText, INPUT.employmentStatus);

  let parsed: any = null;
  let geminiOk = false;
  let failReason = "";
  for (const model of DEFAULT_MODELS) {
    const res = await callGemini(model, prompt, WEALTH_SYSTEM_PROMPT, { temperature: 0.75 });
    if (res.ok) {
      try {
        parsed = parseJson5Loose<any>(res.text);
        geminiOk = true;
        break;
      } catch (parseError: any) {
        console.error("[dev wealth preview] JSON 파싱 실패", parseError?.message, res.text?.slice(0, 300));
        failReason = "JSON 파싱 실패";
        continue;
      }
    }
    failReason = (res as any).apiStatus || (res as any).message || `status ${(res as any).status}`;
    if (!shouldFallback((res as any).status, (res as any).apiStatus)) break;
  }

  const blocks = parsed ? applyWealthGuards(parsed, facts, sajuText).blocks : placeholderBlocks(failReason);

  const apiResponse = {
    status: "completed" as const,
    resultId: "dev-preview",
    interest: INPUT.interest,
    wealthGrade: grade,
    jaeseongType: facts.jaeseongType,
    jaedaShinyak: facts.jaedaShinyak,
    sikssangSaengjae: facts.sikssangSaengjae,
    gunggeobJaengjae: facts.gunggeobJaengjae,
    jaeGrip: facts.jaeGrip,
    result: blocks,
    teaser: null,
    createdAt: new Date().toISOString(),
    __devMeta: { geminiOk, wealthScore, facts, sajuText },
  };

  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(apiResponse, null, 2));
  return apiResponse;
}

export default async function DevWealthResultUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const data = await buildPreviewData();
  return <PreviewClient data={data} />;
}
