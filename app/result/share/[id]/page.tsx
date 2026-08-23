import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedResult } from "@/lib/share-result";
import { parseJson5Loose } from "@/lib/json5Utils";
import { normalizeScores } from "@/lib/resultSchema";
import { buildChartSnapshot, readStoredChart } from "@/lib/result-chart";
import type { AnalysisResult } from "@/store/useInputStore";
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

  // 원국은 결과 화면과 **같은 규칙**을 쓴다 — 저장 스냅샷 우선, 없으면 계산(D-14).
  const chart = readStoredChart(result) ?? (await buildChartSnapshot(data));

  return (
    <ShareResultClient
      result={result}
      sajuData={chart?.sajuData ?? null}
      enriched={chart?.enriched ?? null}
      unknownBirthTime={!data.birth_time}
      resultBirthYear={chart?.birthYear ?? 0}
      userName={data.name || undefined}
    />
  );
}
