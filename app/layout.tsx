import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

const SITE_URL = "https://www.durumisaju.com";
const SITE_NAME = "사주보는 두루미";
const DESCRIPTION = "내 사주 등급은 S? A? 사주 등급 분석부터 친구와 1:1 배틀까지.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  title: "사주보는 두루미 | 사주 등급 분석 · 사주 배틀",
  description: DESCRIPTION,
  keywords: ["사주", "사주 등급", "사주 분석", "사주 배틀", "사주팔자", "운세", "MZ 사주", "사주 궁합", "만세력"],
  openGraph: {
    title: "사주보는 두루미 | 사주 등급 분석 · 사주 배틀",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "사주보는 두루미 | 사주 등급 분석 · 사주 배틀",
    description: DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  themeColor: "#09090B",
  verification: {
    other: {
      "naver-site-verification": "f4bbf6412e11400b7b1f8b7073c678b19fbd53a9",
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  description: DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "EntertainmentApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "1000",
    priceCurrency: "KRW",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" style={{ colorScheme: "dark" }}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
