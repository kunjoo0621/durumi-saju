import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedPetCompat } from "@/lib/share-pet-compat";
import type { PetCompatResult } from "@/lib/pet-compat";
import type { PetResultData } from "@/lib/mockPetResult";
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

  const petInfo: any = Array.isArray(data.pet) ? data.pet[0] : data.pet;

  // getSharedPetCompat → PetResultBody 가 요구하는 shape(PetResultData)로 조립
  const resultData: PetResultData = {
    id: data.id,
    label_grade: data.label_grade as PetResultData["label_grade"],
    label_text: data.label_text,
    composite_score: data.composite_score,
    sync_score: data.sync_score,
    ruler_score: data.ruler_score,
    lover_score: data.lover_score,
    loyalty_score: (data as any).loyalty_score ?? 50,
    conflict_score: data.conflict_score,
    illustration_key: (data as any).illustration_key ?? null,
    illustration_url: data.illustration_url || null,
    full_result: data.full_result as PetCompatResult,
    scoring_version: (data as any).scoring_version ?? 0,
    created_at: data.created_at,
    pet: {
      id: petInfo?.id || "",
      name: petInfo?.name || "우리 아이",
      species: (petInfo?.species || "dog") as "dog" | "cat",
      breed: petInfo?.breed ?? null,
      gender: petInfo?.gender ?? null,
      birth_tier: petInfo?.birth_tier ?? 1,
    },
  };

  return <SharePetCompatClient data={resultData} />;
}
