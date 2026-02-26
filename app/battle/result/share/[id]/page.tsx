import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedBattle } from "@/lib/share-battle";
import type { BattleResult } from "@/types/battle";
import ShareBattleClient from "./ShareBattleClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getSharedBattle(id);
  if (!data) return { title: "사주보는 두루미" };

  const nameA = data.player_a_name || "";
  const nameB = data.player_b_name || "";

  const title = nameA && nameB
    ? `${nameA} vs ${nameB} 사주 대결! 승자는?`
    : "사주 대결 결과 | 사주보는 두루미";

  const description = "사주보는 두루미에서 사주 대결 결과를 확인해보세요";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://durumi-saju.vercel.app";

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: nameA && nameB ? `${nameA} vs ${nameB}` : "사주 대결",
      description,
      url: `${baseUrl}/battle/result/share/${id}`,
      images: [
        {
          url: `${baseUrl}/api/og/battle/${id}`,
          width: 1200,
          height: 630,
          alt: "사주 대결 결과",
        },
      ],
      type: "website",
      siteName: "사주보는 두루미",
    },
    twitter: {
      card: "summary_large_image",
      title: nameA && nameB ? `${nameA} vs ${nameB}` : "사주 대결",
      description,
      images: [`${baseUrl}/api/og/battle/${id}`],
    },
  };
}

export default async function ShareBattlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSharedBattle(id);
  if (!data?.full_result) notFound();

  const result = data.full_result as BattleResult;

  return <ShareBattleClient result={result} />;
}
