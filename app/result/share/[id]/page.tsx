import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedResult } from "@/lib/share-result";
import { parseJson5Loose } from "@/lib/json5Utils";
import { normalizeScores } from "@/lib/resultSchema";
import { calculateSaju } from "@/lib/utils/saju";
import { convertLunarToSolar } from "@/lib/utils/lunar";
import type { AnalysisResult } from "@/store/useInputStore";
import type { CalendarType } from "@/lib/utils/lunar";
import { safeDisplayGrade } from "@/lib/gradeSystem";
import ShareResultClient from "./ShareResultClient";

function getTopPercent(tier: AnalysisResult["tier"]): string {
  const top = tier?.topPercent;
  if (typeof top === "number" && top > 0 && top < 100) return `상위 ${top}%`;
  return "";
}

function parseResult(data: { full_json: unknown }): AnalysisResult | null {
  try {
    const parsed =
      typeof data.full_json === "string"
        ? parseJson5Loose<AnalysisResult>(data.full_json)
        : (data.full_json as AnalysisResult);
    parsed.scores = normalizeScores(parsed.scores);
    return parsed;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getSharedResult(id);
  if (!data) return { title: "사주보는 두루미" };

  const result = parseResult(data);
  if (!result) return { title: "사주보는 두루미" };

  const grade = safeDisplayGrade(result.tier?.grade);
  const percent = getTopPercent(result.tier);
  const headline = result.tier?.title || "";
  const userName = data.name || "";

  const safeHeadline = /\d{4}년/.test(headline)
    ? `사주 ${grade}등급 분석 결과`
    : headline;

  const title = userName
    ? `두루미가 본 ${userName}님의 사주 — ${grade}등급`
    : percent
      ? `${grade}등급 · ${percent} | 사주보는 두루미`
      : `${grade}등급 | 사주보는 두루미`;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://durumi-saju.vercel.app";

  return {
    title,
    description: safeHeadline,
    robots: { index: false, follow: false },
    openGraph: {
      title: percent ? `${grade}등급 · ${percent}` : `${grade}등급`,
      description: safeHeadline,
      url: `${baseUrl}/result/share/${id}`,
      images: [
        {
          url: `${baseUrl}/api/og/result/${id}`,
          width: 1200,
          height: 630,
          alt: `사주 ${grade}등급 결과`,
        },
      ],
      type: "website",
      siteName: "사주보는 두루미",
    },
    twitter: {
      card: "summary_large_image",
      title: percent ? `${grade}등급 · ${percent}` : `${grade}등급`,
      description: safeHeadline,
      images: [`${baseUrl}/api/og/result/${id}`],
    },
  };
}

export default async function ShareResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSharedResult(id);
  if (!data) notFound();

  const result = parseResult(data);
  if (!result) notFound();

  // 사주 데이터 계산 (원국 차트용)
  let sajuData = null;
  let birthYear = 0;
  if (data.birth_date) {
    const [y, m, d] = data.birth_date.split("-").map(Number);
    birthYear = y;
    let calcY = y,
      calcM = m,
      calcD = d;
    const cal = (data.calendar_type as CalendarType) || "solar";
    if (cal === "lunar") {
      const converted = convertLunarToSolar(calcY, calcM, calcD);
      if (converted) {
        calcY = converted.year;
        calcM = converted.month;
        calcD = converted.day;
      }
    }
    const timeParts = data.birth_time?.split(":").map(Number);
    const hour = timeParts?.[0];
    const minute = timeParts?.[1];
    sajuData = await calculateSaju(calcY, calcM, calcD, hour, minute);
  }

  return (
    <ShareResultClient
      result={result}
      sajuData={sajuData}
      unknownBirthTime={!data.birth_time}
      resultBirthYear={birthYear}
      userName={data.name || undefined}
    />
  );
}
