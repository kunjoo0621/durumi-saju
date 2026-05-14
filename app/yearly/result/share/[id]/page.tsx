import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedYearlyResult } from "@/lib/share-yearly";
import ShareYearlyClient from "./ShareYearlyClient";
import type { YearlyResult } from "@/lib/yearly-prompt";

const SITE_URL = "https://www.durumisaju.com";
const SITE_NAME = "사주보는 두루미";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getSharedYearlyResult(id);
  if (!data) return { title: `올해의 운세 | ${SITE_NAME}` };

  const fj = (data as any).full_json as YearlyResult;
  const targetYear = fj?.yearlyMeta?.targetYear ?? (data as any).target_year ?? new Date().getFullYear();
  const name = (data as any).name || "";
  const tierTitle = fj?.tier?.title || "";
  const keywords = (fj?.yearlyKeywords ?? []).join(" · ");

  const title = name
    ? `${name}님의 ${targetYear}년 운세 — ${SITE_NAME}`
    : `${targetYear}년 운세 — ${SITE_NAME}`;
  const description = tierTitle || keywords || `${targetYear}년 한 해 흐름 풀이`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/yearly/result/share/${id}`,
      siteName: SITE_NAME,
      images: [
        {
          url: `${SITE_URL}/yearly-share-kakao.jpg`,
          width: 1456,
          height: 788,
          alt: `${SITE_NAME} 올해의 운세`,
        },
        {
          url: `${SITE_URL}/yearly-share-card.jpg`,
          width: 768,
          height: 1376,
          alt: `${SITE_NAME} 올해의 운세 (스토리)`,
        },
      ],
      locale: "ko_KR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/yearly-share-kakao.jpg`],
    },
  };
}

export default async function YearlyShareResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSharedYearlyResult(id);
  if (!data) notFound();

  const fj = (data as any).full_json as YearlyResult;
  if (!fj) notFound();

  return <ShareYearlyClient result={fj} />;
}
