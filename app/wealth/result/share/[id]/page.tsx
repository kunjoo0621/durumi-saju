import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedWealthResult } from "@/lib/share-wealth";
import ShareWealthClient from "./ShareWealthClient";
import type { ApiResponse, WealthBlocks } from "../../WealthResultClient";

const SITE_URL = "https://www.durumisaju.com";
const SITE_NAME = "사주보는 두루미";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await getSharedWealthResult(id);
  // 없는 id·미결제 티저도 절대 색인되면 안 된다 — 조기 반환에도 robots를 단다
  if (!row) return { title: `재물운 | ${SITE_NAME}`, robots: { index: false, follow: false } };

  const title = `재물운 ${row.wealth_grade}등급`;
  const description = "두루미가 본 재물운 심층 검사 결과.";

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/wealth/result/share/${id}`,
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

export default async function ShareWealthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getSharedWealthResult(id);
  // 결제 전 티저(full_json null)는 로더가 이미 null로 걸러낸다 — 여기 도달한 row는 결제 완료다
  if (!row) notFound();

  const data: ApiResponse = {
    status: "completed",
    resultId: row.id,
    interest: row.interest,
    wealthGrade: row.wealth_grade,
    jaeseongType: row.jaeseong_type ?? undefined,
    jaedaShinyak: row.jaeda_shinyak ?? undefined,
    sikssangSaengjae: row.sikssang_saengjae ?? undefined,
    gunggeobJaengjae: row.gunggeob_jaengjae ?? undefined,
    jaeGrip: row.jae_grip ?? undefined,
    result: row.full_json as WealthBlocks,
    teaser: row.teaser_json ?? null,
    createdAt: row.created_at,
  };

  return <ShareWealthClient data={data} result={row.full_json as WealthBlocks} />;
}
