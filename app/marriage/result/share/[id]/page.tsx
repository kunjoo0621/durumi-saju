import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedMarriageResult } from "@/lib/share-marriage";
import ShareMarriageClient from "./ShareMarriageClient";
import type { ApiResponse, MarriageBlocks } from "../../MarriageResultClient";

const SITE_URL = "https://www.durumisaju.com";
const SITE_NAME = "사주보는 두루미";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await getSharedMarriageResult(id);
  if (!row) return { title: `결혼운 | ${SITE_NAME}` };

  const title = `결혼운 ${row.marriage_grade}등급 — ${row.marital_status}`;
  const description = "두루미가 본 결혼운 심층 검사 결과.";

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/marriage/result/share/${id}`,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: title }],
      type: "website",
      siteName: SITE_NAME,
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/og-image.png`],
    },
  };
}

export default async function ShareMarriagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getSharedMarriageResult(id);
  // 결제 전 티저(full_json null)는 공유 링크로도 열리면 안 된다
  if (!row?.full_json) notFound();

  const data: ApiResponse = {
    status: "completed",
    resultId: row.id,
    maritalStatus: row.marital_status,
    marriageGrade: row.marriage_grade,
    spouseStarType: row.spouse_star_type ?? undefined,
    gwansalHonjap: row.gwansal_honjap ?? undefined,
    spouseStarAbsent: row.spouse_star_absent ?? undefined,
    spousePalaceStability: row.spouse_palace_stability ?? undefined,
    result: row.full_json as MarriageBlocks,
    teaser: row.teaser_json ?? null,
    createdAt: row.created_at,
  };

  return <ShareMarriageClient data={data} result={row.full_json as MarriageBlocks} />;
}
