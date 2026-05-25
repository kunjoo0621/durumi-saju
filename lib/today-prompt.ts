// 오늘의 운세 prompt + 분석 흐름 (lib)
// yearly-prompt.ts 패턴 미러. dev-test 로직 흡수해서 production API에서 재사용.
//
// 흐름:
//   InputPayload + targetDate
//     → 사주 계산 (마스터 calculateSaju + enrichSajuData)
//     → 일진 매칭 (마스터 getPairRelation, getTenStar)
//     → 서버 확정 mood/weather/십성
//     → Gemini LLM 호출 (system prompt v1.5)
//     → JSON 파싱 + 결과 반환

import { readFileSync } from "fs";
import { join } from "path";
import type { InputPayload } from "@/lib/analysis";
import { calculateSaju, formatEnrichedSajuText, enrichSajuData } from "@/lib/utils/saju";
import { getPairRelation, STEM_ELEMENT, getTenStar, BRANCH_INFO, type PairRelation } from "@/lib/utils/saju-enrichment";
import { calculateServerScoring } from "@/lib/utils/saju-scoring";

export const TODAY_SCORING_VERSION = 1;

// ────────────────────────────────────────────────────────
// 결과 타입
// ────────────────────────────────────────────────────────

export interface TodaySection {
  icon: string;
  title: string;
  content: string;
}

export interface TodayMeta {
  targetDate: string;       // "YYYY-MM-DD"
  dayPillar: string;        // 한자 "戊戌"
  tenStar: string;          // 본인 일간 기준 일진 천간 십성 ("정관(正官)" 등)
  twelveStage: string;      // 본인 12운성
  mood: "강세" | "보통" | "주의" | "위기";
  weatherIcon: "sun" | "cloud" | "rain" | "thunder";
  weatherLabel: string;
}

export interface TodayResult {
  tier: {
    grade: string;
    composite: number;
    percentileRank: number;
    topPercent: number;
    confidence: string;  // "low" | "medium" | "high"
    title: string;
    description: string;
  };
  scores: Record<string, number>;
  sections: TodaySection[];
  todayMeta: TodayMeta;
  todayKeywords: string[];
}

export interface TodayServerAnalysis {
  ownerDayPillar: string;
  ownerDayMaster: string;
  ownerElement: string;
  ownerStrength: string | undefined;
  todayDayPillar: string;
  todayDayMaster: string;
  todayElement: string;
  stemRelation: { label: string; impact: string };
  branchRelation: string;
  branchRelationType: PairRelation;
  tenStar: string;
  mood: "강세" | "보통" | "주의" | "위기";
  weather: { icon: string; label: string };
  twelveStage: string;
}

// ────────────────────────────────────────────────────────
// 일진 ↔ 본인 매칭 helper (마스터 단일 소스 사용)
// ────────────────────────────────────────────────────────

const SAENG: Record<string, string> = { 목:"화", 화:"토", 토:"금", 금:"수", 수:"목" };
const GEUK: Record<string, string> = { 목:"토", 토:"수", 수:"화", 화:"금", 금:"목" };

function getStemRelation(ownerEl: string, todayEl: string): { label: string; impact: string } {
  if (ownerEl === todayEl) return { label: "비화", impact: "같은 오행 — 친근·편함" };
  if (SAENG[ownerEl] === todayEl) return { label: `${ownerEl}→${todayEl} 본인이 일진을 생함`, impact: "에너지 줌 (살짝 피곤)" };
  if (SAENG[todayEl] === ownerEl) return { label: `${todayEl}→${ownerEl} 일진이 본인을 생함`, impact: "에너지 받음 (도움 옴)" };
  if (GEUK[ownerEl] === todayEl) return { label: `${ownerEl}→${todayEl} 본인이 일진을 극함`, impact: "내가 우위 (주도 가능)" };
  if (GEUK[todayEl] === ownerEl) return { label: `${todayEl}→${ownerEl} 일진이 본인을 극함`, impact: "압박 받음 (수동·기다림)" };
  return { label: "관계 없음", impact: "평이" };
}

function decideMood(stemRel: string, pairType: PairRelation): "강세" | "보통" | "주의" | "위기" {
  if (pairType === "chung" || stemRel.includes("일진이 본인을 극함")) return "위기";
  if (pairType === "hyung" || pairType === "wonjin") return "주의";
  if (pairType === "hap" || stemRel.includes("일진이 본인을 생함")) return "강세";
  return "보통";
}

const WEATHER_MAP = {
  강세: { icon: "sun" as const, label: "맑음" },
  보통: { icon: "cloud" as const, label: "흐림" },
  주의: { icon: "rain" as const, label: "비 예보" },
  위기: { icon: "thunder" as const, label: "폭풍 주의" },
};

function computeTenStar(ownerStemHanja: string, todayStemHanja: string): string {
  const ownerInfo = STEM_ELEMENT[ownerStemHanja];
  const todayInfo = STEM_ELEMENT[todayStemHanja];
  if (!ownerInfo || !todayInfo) return "";
  return getTenStar(ownerInfo.element, ownerInfo.yin_yang, todayInfo.element, todayInfo.yin_yang);
}

// ────────────────────────────────────────────────────────
// 나이대 매핑
// ────────────────────────────────────────────────────────

function getAgeBracket(age: number): string {
  if (age < 20) return "10대 후반";
  if (age < 25) return "20대 초";
  if (age < 33) return "20대 후~30대 초";
  if (age < 45) return "30대 중~40대 초";
  if (age < 55) return "40대 중~50대 초";
  return "50대 후~60대+";
}

// ────────────────────────────────────────────────────────
// LLM 호출 (analysis.ts fallback fetch 패턴)
// ────────────────────────────────────────────────────────

async function callGeminiFetch(modelName: string, systemPrompt: string, userInfo: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userInfo }] }],
      generationConfig: {
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
        temperature: 0.75,
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini fetch ${res.status}: ${errText.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  return text;
}

// ────────────────────────────────────────────────────────
// 서버 결정론 분석 (LLM 호출 전 단계)
// ────────────────────────────────────────────────────────

export async function analyzeTodayServer(input: InputPayload, targetDate: string): Promise<{
  serverAnalysis: TodayServerAnalysis;
  ownerSajuText: string;
  todayContext: string;
}> {
  // 1. 본인 사주 enriched
  const birthYear = Number(input.birthYear);
  const birthMonth = Number(input.birthMonth);
  const birthDay = Number(input.birthDay);
  const birthHour = input.unknownBirthTime ? undefined : Number(input.birthHour);
  const birthMinute = input.unknownBirthTime ? undefined : Number(input.birthMinute);

  const ownerSaju = await calculateSaju(birthYear, birthMonth, birthDay, birthHour, birthMinute, {
    birthLocation: input.birthLocation,
  });
  if (!ownerSaju) throw new Error("본인 사주 계산 실패");

  const ownerEnriched = enrichSajuData(ownerSaju, { isTimeUnknown: Boolean(input.unknownBirthTime) });
  const ownerSajuText = formatEnrichedSajuText(ownerEnriched);

  // 2. 오늘 일진 (정오 기준, 시 무관)
  const [ty, tm, td] = targetDate.split("-").map(Number);
  if (!ty || !tm || !td) throw new Error(`targetDate 형식 오류: ${targetDate}`);
  const todaySaju = await calculateSaju(ty, tm, td, 12, 0);
  if (!todaySaju) throw new Error("오늘 일진 계산 실패");
  const todayEnriched = enrichSajuData(todaySaju, { isTimeUnknown: true });

  // 3. 일진 ↔ 본인 매칭 (★ 마스터 getPairRelation 사용)
  const ownerDayStemHanja = ownerEnriched.pillars.day.slice(0, 1);
  const ownerDayBranchHanja = ownerEnriched.pillars.day.slice(1, 2);
  const ownerDayStemKor = ownerEnriched.dayMaster.korean;
  const ownerDayBranchKor = BRANCH_INFO[ownerDayBranchHanja]?.korean || ownerDayBranchHanja;
  const ownerEl = ownerEnriched.dayMaster.element;

  const todayDayStemHanja = todayEnriched.pillars.day.slice(0, 1);
  const todayDayBranchHanja = todayEnriched.pillars.day.slice(1, 2);
  const todayDayStemKor = todayEnriched.dayMaster.korean;
  const todayDayBranchKor = BRANCH_INFO[todayDayBranchHanja]?.korean || todayDayBranchHanja;
  const todayEl = todayEnriched.dayMaster.element;

  const pair = getPairRelation(ownerDayBranchHanja, todayDayBranchHanja);
  const stemRel = getStemRelation(ownerEl, todayEl);
  const mood = decideMood(stemRel.label, pair.type);
  const weather = WEATHER_MAP[mood];
  const tenStar = computeTenStar(ownerDayStemHanja, todayDayStemHanja);
  const twelveStage = ownerEnriched.twelveStages?.day?.korean || "";

  const todayContext = `
[오늘 일진 컨텍스트 — 서버 확정]
오늘 날짜: ${targetDate}
오늘 일진: ${todayEnriched.pillars.day}
오늘 연주(세운): ${todayEnriched.pillars.year}
오늘 월주(월건): ${todayEnriched.pillars.month}

일주 ↔ 일진 상호작용:
  - 일간 관계: 본인 ${ownerDayStemKor}(${ownerEl}) vs 일진 ${todayDayStemKor}(${todayEl}) → ${stemRel.label} (${stemRel.impact})
  - 일지 관계: 본인 ${ownerDayBranchKor}(${ownerDayBranchHanja}) vs 일진 ${todayDayBranchKor}(${todayDayBranchHanja}) → ${pair.label}
  - 일진 천간이 본인 일간 기준 십성: ${tenStar}

본인 용신: ${ownerEnriched.yongshin?.eokbu || "-"} / 기신: ${ownerEnriched.yongshin?.gisin || "-"}
본인 신강신약: ${ownerEnriched.strength?.result || "-"}

오늘 mood (서버 확정): **${mood}** → weather: ${weather.icon} "${weather.label}"
`.trim();

  const serverAnalysis: TodayServerAnalysis = {
    ownerDayPillar: ownerEnriched.pillars.day,
    ownerDayMaster: ownerDayStemKor,
    ownerElement: ownerEl,
    ownerStrength: ownerEnriched.strength?.result,
    todayDayPillar: todayEnriched.pillars.day,
    todayDayMaster: todayDayStemKor,
    todayElement: todayEl,
    stemRelation: stemRel,
    branchRelation: pair.label,
    branchRelationType: pair.type,
    tenStar,
    mood,
    weather: { icon: weather.icon, label: weather.label },
    twelveStage,
  };

  return { serverAnalysis, ownerSajuText, todayContext };
}

// ────────────────────────────────────────────────────────
// 메인 — LLM까지 전체 흐름 (production API에서 호출)
// ────────────────────────────────────────────────────────

export async function runTodayAnalysis(input: InputPayload, targetDate: string): Promise<{
  result: TodayResult;
  serverAnalysis: TodayServerAnalysis;
}> {
  const { serverAnalysis, ownerSajuText, todayContext } = await analyzeTodayServer(input, targetDate);

  // ★ 마스터 원칙 — 개인사주 산식으로 tier·scores 산출 (yearly와 동일)
  // 본인 enriched 재산출 (analyzeTodayServer 내부에서 했지만 export 안 함 → 다시 계산)
  const ownerSaju = await calculateSaju(
    Number(input.birthYear), Number(input.birthMonth), Number(input.birthDay),
    input.unknownBirthTime ? undefined : Number(input.birthHour),
    input.unknownBirthTime ? undefined : Number(input.birthMinute),
    { birthLocation: input.birthLocation },
  );
  if (!ownerSaju) throw new Error("본인 사주 재계산 실패");
  const ownerEnriched = enrichSajuData(ownerSaju, { isTimeUnknown: Boolean(input.unknownBirthTime) });
  const { tier: masterTier, scores: masterScores } = calculateServerScoring(ownerEnriched);

  // 나이 + 나이대 산출
  const [ty, tm, td] = targetDate.split("-").map(Number);
  const age = ty - Number(input.birthYear) - (
    tm < Number(input.birthMonth) || (tm === Number(input.birthMonth) && td < Number(input.birthDay)) ? 1 : 0
  );
  const ageBracket = getAgeBracket(age);

  // system prompt 로드
  const promptPath = join(process.cwd(), "prompts", "durumi_TODAY_SYSTEM_PROMPT_v1.7.md");
  const systemPrompt = readFileSync(promptPath, "utf-8");

  const userInfo = `
[본인 사주 원국]
${ownerSajuText}

${todayContext}

[★ 사주 마스터 값 — 서버 확정, LLM 변경 금지]
사주 단일 분석 등급(grade): ${masterTier.grade}
composite: ${masterTier.composite}
percentileRank: ${masterTier.percentileRank}
topPercent: ${masterTier.topPercent}
confidence: ${masterTier.confidence}
5분야 점수: 재물 ${masterScores.재물운} / 연애 ${masterScores.연애운} / 직장 ${masterScores.직장운} / 건강 ${masterScores.건강운} / 대인 ${masterScores.대인운}

[입력값]
이름: ${input.name || "(미입력)"}
생년월일: ${input.birthYear}-${String(input.birthMonth).padStart(2, "0")}-${String(input.birthDay).padStart(2, "0")} (${input.calendarType === "lunar" ? "음력" : "양력"})
출생시간: ${input.unknownBirthTime ? "(시 미상)" : `${input.birthHour}:${String(input.birthMinute || 0).padStart(2, "0")}`}
오늘 날짜: ${targetDate}
**현재 나이: 만 ${age}세 (${ageBracket})**  ← system prompt 8-1 나이대 매핑 참조 (경계 케이스는 8-X 교차 룰 적용)
**직업 상태: ${input.employmentStatus || "미제공"}**  ← system prompt 8-0 B 룰 적용: 직업 컨텍스트는 6 영역 중 최대 2개(돈·직장)만. 관계·연애·건강·결정 4영역은 일반 도메인(가족·친구·동네·식사·수면·취미·환경)
**연애 상태: ${input.relationshipStatus || "미제공"}**  ← 연애(💞) 영역 톤 분기에 사용 (system prompt 6섹션 정의 참조)

위 정보로 system prompt v1.7 JSON 스키마(tier + scores + sections[6] + todayMeta + todayKeywords)에 맞춰 출력:
- weather/mood/일진 → 서버 확정값 그대로 반영
- 6 sections icon 정확한 순서: 💸 / 🧩 / 💞 / 💼 / 🩺 / 🎯 (누락·중복·순서 어긋남 시 시스템이 throw)
- 6 section title 동적 생성 (8~25자, 비유·반전, 구체 명사 1개 이상)
- ★ 본문 한자 0건 — 일진 음역어("기해", "갑인", "계수") 본문 사용 금지. 친화어로 풀이
- ★ tier·scores → 위 사주 마스터 값 그대로 출력 (변경 금지). title·description은 LLM이 today 맥락 맞춰 생성하되 grade/composite 등 숫자는 마스터 그대로.
`.trim();

  const text = await callGeminiFetch("gemini-3-flash-preview", systemPrompt, userInfo);
  if (!text) throw new Error("Gemini API key 부재 또는 응답 없음");

  let parsed: TodayResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`LLM JSON 파싱 실패: ${text.slice(0, 200)}`);
  }

  // ★ v1.7 sections 검증 — icon 누락/중복/순서 어긋남 시 throw (라벨 mismatch 차단)
  // 위치 기반 fallback은 위험 (LLM이 🧩를 빼먹으면 엉뚱한 내용이 "관계"로 라벨링됨).
  // 차라리 throw로 실패 → 환불 흐름 타게 하는 게 안전.
  const EXPECTED_ICONS = ["💸", "🧩", "💞", "💼", "🩺", "🎯"] as const;
  if (!Array.isArray(parsed.sections) || parsed.sections.length !== 6) {
    throw new Error(`sections 6개 필요. 실제: ${parsed.sections?.length ?? 0}`);
  }
  const byIcon = new Map(parsed.sections.map((s) => [s.icon, s]));
  // 중복 icon 차단 (LLM이 💞를 두 번 출력 같은 케이스)
  if (byIcon.size !== 6) {
    const icons = parsed.sections.map((s) => s.icon).join(",");
    throw new Error(`sections icon 중복: [${icons}]`);
  }
  // expected icon 누락 차단 (위치 기반 fallback X — 엉뚱한 내용 라벨링 위험)
  const missing = EXPECTED_ICONS.filter((icon) => !byIcon.has(icon));
  if (missing.length > 0) {
    const actual = parsed.sections.map((s) => s.icon).join(",");
    throw new Error(`sections icon 누락: 기대 ${missing.join(",")} / 실제 [${actual}]`);
  }
  // expected 순서로 강제 정렬 (LLM이 순서만 어겨도 sequence 보장)
  parsed.sections = EXPECTED_ICONS.map((icon) => byIcon.get(icon)!);

  // ★ 서버 확정값으로 마스터 덮어쓰기 (LLM이 임시값 만들어도 마스터로 강제)
  parsed.tier = {
    grade: masterTier.grade,
    composite: masterTier.composite,
    percentileRank: masterTier.percentileRank,
    topPercent: masterTier.topPercent,
    confidence: masterTier.confidence,
    title: parsed.tier?.title || "",         // title·description은 LLM 생성 그대로
    description: parsed.tier?.description || "",
  };
  parsed.scores = masterScores as unknown as Record<string, number>;

  // 서버 확정값으로 todayMeta 덮어쓰기 (LLM이 잘못 출력해도 보호)
  parsed.todayMeta = {
    targetDate,
    dayPillar: serverAnalysis.todayDayPillar.slice(0, 2),  // 한자만
    tenStar: serverAnalysis.tenStar,
    twelveStage: serverAnalysis.twelveStage,
    mood: serverAnalysis.mood,
    weatherIcon: serverAnalysis.weather.icon as TodayMeta["weatherIcon"],
    weatherLabel: serverAnalysis.weather.label,
  };

  return { result: parsed, serverAnalysis };
}
