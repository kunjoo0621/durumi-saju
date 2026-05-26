import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";

// Google Ads 전환 추적용 gtag — 모든 페이지의 head 에 로드.
// 결제 완료 시점의 conversion firing 은 hooks/useCharge.ts 의 onSuccess 직전에서 처리.
const GOOGLE_ADS_ID = "AW-18186268670";

const SITE_URL = "https://www.durumisaju.com";
const SITE_NAME = "사주보는 두루미";
const DESCRIPTION = "내 사주 등급은 SS? S? 사주 등급 분석부터 친구와 1:1 배틀까지.";

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
  verification: {
    other: {
      "naver-site-verification": "f4bbf6412e11400b7b1f8b7073c678b19fbd53a9",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#09090B",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: ["두루미사주", "Durumi Saju"],
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
      },
      description: DESCRIPTION,
      sameAs: [
        "https://www.instagram.com/durumi_saju/",
        "https://blog.naver.com/durumi_log",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DESCRIPTION,
      inLanguage: "ko-KR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
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
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" style={{ colorScheme: "dark" }}>
      <head>
        <Script
          id="gtag-src"
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_ID}');
          `}
        </Script>
      </head>
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
