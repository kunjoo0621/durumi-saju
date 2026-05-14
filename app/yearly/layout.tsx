import type { Metadata } from "next";
import { notFound } from "next/navigation";

const SITE_URL = "https://www.durumisaju.com";
const SITE_NAME = "사주보는 두루미";
const TITLE = "올해의 운세 | 사주보는 두루미";
const DESCRIPTION = "내 사주 위에 올해 세운이 얹혀 만들어진 한 해 한정 운세를 풀어준다.";

// 카카오톡·페이스북·X·Threads 등 OG 카드 미리보기에서 표시할 정적 공유 이미지.
// 메인 카드(9:16)와 OG 가로형(1.91:1)을 둘 다 등록 — 플랫폼이 가장 적합한 것 선택.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/yearly`,
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
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE_URL}/yearly-share-kakao.jpg`],
  },
};

// 환경변수 NEXT_PUBLIC_FEATURE_YEARLY=1 일 때만 라우트 노출.
// 미설정/0 이면 라우트는 빌드되지만 외부 접근 시 404.
function isYearlyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_YEARLY === "1";
}

export default function YearlyLayout({ children }: { children: React.ReactNode }) {
  if (!isYearlyEnabled()) notFound();
  return children;
}
