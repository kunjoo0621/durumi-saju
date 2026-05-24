// 🚨 DEV ONLY — 오늘의 운세 dev-test 엔드포인트
// NODE_ENV=production이면 404
// 운영자 사주 + 오늘 일진 → 매칭 → Gemini 호출 → JSON 반환

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { calculateSaju, formatEnrichedSajuText, enrichSajuData } from "@/lib/utils/saju";
import { getPairRelation, STEM_ELEMENT, getTenStar, BRANCH_INFO } from "@/lib/utils/saju-enrichment";

// ────────────────────────────────────────────────────────
// 일진 ↔ 본인 매칭 — 마스터 saju-enrichment의 getPairRelation 사용
// (인라인 매트릭스 금지. 단일 소스 원칙)
// ────────────────────────────────────────────────────────

const SAENG: Record<string,string> = { 목:"화", 화:"토", 토:"금", 금:"수", 수:"목" };
const GEUK: Record<string,string> = { 목:"토", 토:"수", 수:"화", 화:"금", 금:"목" };

function getStemRelation(ownerEl: string, todayEl: string): { label: string; impact: string } {
  if (ownerEl === todayEl) return { label: "비화", impact: "같은 오행 — 친근·편함" };
  if (SAENG[ownerEl] === todayEl) return { label: `${ownerEl}→${todayEl} 본인이 일진을 생함`, impact: "에너지 줌 (살짝 피곤)" };
  if (SAENG[todayEl] === ownerEl) return { label: `${todayEl}→${ownerEl} 일진이 본인을 생함`, impact: "에너지 받음 (도움 옴)" };
  if (GEUK[ownerEl] === todayEl) return { label: `${ownerEl}→${todayEl} 본인이 일진을 극함`, impact: "내가 우위 (주도 가능)" };
  if (GEUK[todayEl] === ownerEl) return { label: `${todayEl}→${ownerEl} 일진이 본인을 극함`, impact: "압박 받음 (수동·기다림)" };
  return { label: "관계 없음", impact: "평이" };
}

function decideMood(
  stemRel: string,
  pairType: "hap" | "samhap" | "banghap" | "chung" | "hyung" | "wonjin" | "same" | "none"
): "강세" | "보통" | "주의" | "위기" {
  if (pairType === "chung" || stemRel.includes("일진이 본인을 극함")) return "위기";
  if (pairType === "hyung" || pairType === "wonjin") return "주의";
  if (pairType === "hap" || stemRel.includes("일진이 본인을 생함")) return "강세";
  return "보통";
}

// 본인 일간 기준 일진 천간의 십성 (마스터 getTenStar 사용)
function computeTenStar(ownerStemHanja: string, todayStemHanja: string): string {
  const ownerInfo = STEM_ELEMENT[ownerStemHanja];
  const todayInfo = STEM_ELEMENT[todayStemHanja];
  if (!ownerInfo || !todayInfo) return "";
  return getTenStar(ownerInfo.element, ownerInfo.yin_yang, todayInfo.element, todayInfo.yin_yang);
}

const WEATHER_MAP = {
  강세: { icon: "sun", label: "맑음" },
  보통: { icon: "cloud", label: "흐림" },
  주의: { icon: "rain", label: "비 예보" },
  위기: { icon: "thunder", label: "폭풍 주의" },
};

// ────────────────────────────────────────────────────────
// LLM 호출 — fetch 직접 (lib/analysis.ts fallback 패턴 차용)
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
        maxOutputTokens: 8192,
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
// 메인 핸들러
// ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const body = await request.json() as {
      birthYear: number; birthMonth: number; birthDay: number;
      birthHour?: number; birthMinute?: number;
      birthLocation?: string;
      gender?: string;
      name?: string;
      employmentStatus?: string;  // "직장인" | "사업·프리랜서" | "학생" | "취업 준비 중"
      targetDate?: string;  // "YYYY-MM-DD" — 기본 오늘
    };

    // 1. 본인 사주 enriched
    const ownerSaju = await calculateSaju(
      Number(body.birthYear), Number(body.birthMonth), Number(body.birthDay),
      body.birthHour !== undefined ? Number(body.birthHour) : undefined,
      body.birthMinute !== undefined ? Number(body.birthMinute) : undefined,
      { birthLocation: body.birthLocation },
    );
    if (!ownerSaju) {
      return NextResponse.json({ error: "본인 사주 계산 실패" }, { status: 500 });
    }
    const isTimeUnknown = body.birthHour === undefined;
    const ownerEnriched = enrichSajuData(ownerSaju, { isTimeUnknown });
    const ownerSajuText = formatEnrichedSajuText(ownerEnriched);

    // 2. 오늘 일진 (target date 정오)
    const targetStr = body.targetDate || new Date().toISOString().slice(0, 10);
    const [ty, tm, td] = targetStr.split("-").map(Number);
    const todaySaju = await calculateSaju(ty, tm, td, 12, 0);
    if (!todaySaju) {
      return NextResponse.json({ error: "오늘 일진 계산 실패" }, { status: 500 });
    }
    const todayEnriched = enrichSajuData(todaySaju, { isTimeUnknown: true });

    // 3. 일진 ↔ 본인 매칭 (★ 마스터 saju-enrichment의 getPairRelation 사용)
    //    pillars.day 형식 = "癸未(계미)" — 한자 2글자 + 괄호한글. 한자만 추출해 마스터와 매칭.
    const ownerDayStemHanja = ownerEnriched.pillars.day.slice(0, 1);   // "癸"
    const ownerDayBranchHanja = ownerEnriched.pillars.day.slice(1, 2); // "未"
    const ownerDayStemKor = ownerEnriched.dayMaster.korean;            // "계"
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

    // 서버 결정론적 십성 (마스터 calculateTenStars 활용)
    const todayTenStar = computeTenStar(ownerDayStemHanja, todayDayStemHanja);

    // 4. 일진 컨텍스트 블록
    const todayContext = `
[오늘 일진 컨텍스트 — 서버 확정]
오늘 날짜: ${targetStr}
오늘 일진: ${todayEnriched.pillars.day}
오늘 연주(세운): ${todayEnriched.pillars.year}
오늘 월주(월건): ${todayEnriched.pillars.month}

일주 ↔ 일진 상호작용:
  - 일간 관계: 본인 ${ownerDayStemKor}(${ownerEl}) vs 일진 ${todayDayStemKor}(${todayEl}) → ${stemRel.label} (${stemRel.impact})
  - 일지 관계: 본인 ${ownerDayBranchKor}(${ownerDayBranchHanja}) vs 일진 ${todayDayBranchKor}(${todayDayBranchHanja}) → ${pair.label}
  - 일진 천간이 본인 일간 기준 십성: ${todayTenStar}

본인 용신: ${ownerEnriched.yongshin?.eokbu || "-"} / 기신: ${ownerEnriched.yongshin?.gisin || "-"}
본인 신강신약: ${ownerEnriched.strength?.result || "-"}

오늘 mood (서버 확정): **${mood}** → weather: ${weather.icon} "${weather.label}"
`.trim();

    // 5. system prompt 로드
    const promptPath = join(process.cwd(), "prompts", "durumi_TODAY_SYSTEM_PROMPT_v1.0.md");
    const systemPrompt = readFileSync(promptPath, "utf-8");

    // 6. userInfo 조합 — 나이 자동 산출
    const age = ty - body.birthYear - (
      tm < body.birthMonth || (tm === body.birthMonth && td < body.birthDay) ? 1 : 0
    );
    const ageBracket = age < 20 ? "10대 후반"
      : age < 25 ? "20대 초"
      : age < 33 ? "20대 후~30대 초"
      : age < 45 ? "30대 중~40대 초"
      : age < 55 ? "40대 중~50대 초"
      : "50대 후~60대+";

    const userInfo = `
[본인 사주 원국]
${ownerSajuText}

${todayContext}

[입력값]
이름: ${body.name || "(미입력)"}
생년월일: ${body.birthYear}-${String(body.birthMonth).padStart(2,"0")}-${String(body.birthDay).padStart(2,"0")} (양력)
출생시간: ${isTimeUnknown ? "(시 미상)" : `${body.birthHour}:${String(body.birthMinute || 0).padStart(2,"0")}`}
오늘 날짜: ${targetStr}
**현재 나이: 만 ${age}세 (${ageBracket})**  ← 본문 비유는 이 나이대 카테고리에서만 끌어올 것 (system prompt 8-1 매핑 따라)
**직업 상태: ${body.employmentStatus || "미제공"}**  ← 본문 비유는 이 직업 카테고리에서만 끌어올 것 (system prompt 8-0 매핑 따라)

위 정보로 system prompt JSON 스키마(tier + scores + sections[6] + todayMeta + todayKeywords)에 맞춰 출력:
- weather/mood/일진 → 서버 확정값 그대로 반영
- 6 section title 동적 생성 (8~25자, 비유·반전, 구체 명사 1개 이상)
- scores 임시값 (재물65/연애60/직장70/건강60/대인70)
- tier 임시값 (grade A, composite 80, percentileRank 82, topPercent 18, confidence 90)
`.trim();

    // 7. Gemini 호출 (fetch)
    const startedAt = Date.now();
    const text = await callGeminiFetch("gemini-3-flash-preview", systemPrompt, userInfo);
    const elapsedMs = Date.now() - startedAt;
    if (!text) {
      return NextResponse.json({ error: "Gemini API key 부재 또는 응답 없음" }, { status: 500 });
    }

    // 8. 결과 파싱 + title 자수 후처리 (25자 초과 reject 기록만, 자동 보정 X — 룰 위반 추적)
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({
        ok: false,
        error: "LLM JSON 파싱 실패",
        rawText: text.slice(0, 4000),
        elapsedMs,
      }, { status: 500 });
    }

    // title 자수 검증
    const violations: string[] = [];
    const checkTitle = (t: string, where: string) => {
      const len = (t || "").length;
      if (len > 25) violations.push(`${where} ${len}자 초과: "${t}"`);
      if (len < 8) violations.push(`${where} ${len}자 미만: "${t}"`);
    };
    if (parsed.tier?.title) checkTitle(parsed.tier.title, "tier.title");
    parsed.sections?.forEach((s: any, i: number) => checkTitle(s.title, `sections[${i}]`));

    return NextResponse.json({
      ok: true,
      elapsedMs,
      violations,  // title 자수 위반 기록
      serverAnalysis: {
        ownerDayPillar: ownerEnriched.pillars.day,
        ownerDayMaster: ownerEnriched.dayMaster.korean,
        ownerElement: ownerEl,
        ownerStrength: ownerEnriched.strength?.result,
        todayDayPillar: todayEnriched.pillars.day,
        todayDayMaster: todayEnriched.dayMaster.korean,
        todayElement: todayEl,
        stemRelation: stemRel,
        branchRelation: pair.label,
        branchRelationType: pair.type,
        tenStar: todayTenStar,
        mood,
        weather,
      },
      llmResult: parsed,
    });
  } catch (e: any) {
    console.error("[today/dev-test] error:", e);
    return NextResponse.json({ error: e?.message || "unexpected" }, { status: 500 });
  }
}
