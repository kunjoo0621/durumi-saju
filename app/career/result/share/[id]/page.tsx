import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedCareerResult } from "@/lib/share-career";
import ShareCareerClient from "./ShareCareerClient";
import type { ApiResponse, CareerBlocks } from "../../CareerResultClient";

const SITE_URL = "https://www.durumisaju.com";
const SITE_NAME = "사주보는 두루미";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await getSharedCareerResult(id);
  // 없는 id·미결제 티저도 절대 색인되면 안 된다 — 조기 반환에도 robots를 단다
  if (!row) return { title: `커리어운 | ${SITE_NAME}`, robots: { index: false, follow: false } };

  const title = `커리어운 ${row.career_grade}등급`;
  const description = "두루미가 본 커리어운 심층 검사 결과.";

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/career/result/share/${id}`,
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

export default async function ShareCareerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getSharedCareerResult(id);
  // 결제 전 티저(full_json null)는 로더가 이미 null로 걸러낸다 — 여기 도달한 row는 결제 완료다
  if (!row) notFound();

  const data: ApiResponse = {
    status: "completed",
    resultId: row.id,
    situation: row.situation,
    careerGrade: row.career_grade,
    gwanseongType: row.gwanseong_type ?? undefined,
    gwandaSinyak: row.gwanda_sinyak ?? undefined,
    gwaninSangsaeng: row.gwanin_sangsaeng ?? undefined,
    sanggwanGyeongwan: row.sanggwan_gyeongwan ?? undefined,
    careerGrip: row.career_grip ?? undefined,
    result: row.full_json as CareerBlocks,
    teaser: row.teaser_json ?? null,
    createdAt: row.created_at,
  };

  return <ShareCareerClient data={data} result={row.full_json as CareerBlocks} />;
}
