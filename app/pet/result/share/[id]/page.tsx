import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedPetCompat } from "@/lib/share-pet-compat";
import type { PetCompatResult } from "@/lib/pet-compat";
import SharePetCompatClient from "./SharePetCompatClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getSharedPetCompat(id);
  if (!data) return { title: "사주보는 두루미" };

  const petInfo: any = Array.isArray(data.pet) ? data.pet[0] : data.pet;
  const petName = petInfo?.name || "우리 아이";
  const labelText = data.label_text || "두루미가 본 궁합";
  const score = data.composite_score;

  const title = `${petName}와의 궁합 ${score}점 — ${labelText}`;
  const description = `두루미가 본 너와 ${petName}의 사주 궁합 결과.`;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.durumisaju.com";

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/pet/result/share/${id}`,
      images: [
        {
          url: `${baseUrl}/og-image.png`,  // Phase 2: /api/og/pet/[id]
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: "website",
      siteName: "사주보는 두루미",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${baseUrl}/og-image.png`],
    },
  };
}

export default async function SharePetCompatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSharedPetCompat(id);
  if (!data?.full_result) notFound();

  const result = data.full_result as PetCompatResult;
  const petInfo: any = Array.isArray(data.pet) ? data.pet[0] : data.pet;

  return (
    <SharePetCompatClient
      result={result}
      petName={petInfo?.name || "우리 아이"}
      petSpecies={petInfo?.species || "dog"}
      compositeScore={data.composite_score}
      labelGrade={data.label_grade as any}
      labelText={data.label_text}
      syncScore={data.sync_score}
      rulerScore={data.ruler_score}
      loverScore={data.lover_score}
      conflictScore={data.conflict_score}
    />
  );
}
