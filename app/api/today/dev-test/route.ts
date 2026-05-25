// 🚨 DEV ONLY — 오늘의 운세 dev-test 엔드포인트
// NODE_ENV=production이면 404
// runTodayAnalysis (lib/today-prompt) 그대로 사용해 production API와 동일 흐름 검증

import { NextRequest, NextResponse } from "next/server";
import type { InputPayload } from "@/lib/analysis";
import { runTodayAnalysis } from "@/lib/today-prompt";
import { getKSTDateString } from "@/lib/utils/kst-date";

type DevBody = {
  birthYear: number | string;
  birthMonth: number | string;
  birthDay: number | string;
  birthHour?: number | string;
  birthMinute?: number | string;
  birthLocation?: string;
  gender?: string;
  name?: string;
  employmentStatus?: string;
  relationshipStatus?: string;
  coreFearAxis?: string;
  calendarType?: "solar" | "lunar";
  targetDate?: string;  // "YYYY-MM-DD" — 기본 오늘
};

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as DevBody;
    const targetDate = body.targetDate || getKSTDateString();

    // dev-test body → InputPayload 형식 변환 (string 필드)
    const input: InputPayload = {
      name: body.name || "",
      birthYear: String(body.birthYear || ""),
      birthMonth: String(body.birthMonth || ""),
      birthDay: String(body.birthDay || ""),
      calendarType: body.calendarType || "solar",
      birthHour: body.birthHour !== undefined ? String(body.birthHour) : "",
      birthMinute: body.birthMinute !== undefined ? String(body.birthMinute) : "",
      birthLocation: body.birthLocation || "",
      gender: body.gender || "",
      relationshipStatus: body.relationshipStatus || "",
      employmentStatus: body.employmentStatus || "",
      coreFearAxis: (body.coreFearAxis || "") as InputPayload["coreFearAxis"],
      unknownBirthTime: body.birthHour === undefined,
    };

    const startedAt = Date.now();
    const { result, serverAnalysis } = await runTodayAnalysis(input, targetDate);
    const elapsedMs = Date.now() - startedAt;

    // title 자수 검증 (룰 위반 추적용)
    const violations: string[] = [];
    const checkTitle = (t: string, where: string) => {
      const len = (t || "").length;
      if (len > 25) violations.push(`${where} ${len}자 초과: "${t}"`);
      if (len < 8) violations.push(`${where} ${len}자 미만: "${t}"`);
    };
    if (result.tier?.title) checkTitle(result.tier.title, "tier.title");
    result.sections?.forEach((s, i) => checkTitle(s.title, `sections[${i}]`));

    return NextResponse.json({
      ok: true,
      elapsedMs,
      violations,
      serverAnalysis,
      llmResult: result,
    });
  } catch (e: any) {
    console.error("[today/dev-test] error:", e);
    return NextResponse.json({ error: e?.message || "unexpected" }, { status: 500 });
  }
}
