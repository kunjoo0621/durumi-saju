import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "사주보는 두루미",
  description: "행운 배달부 두루미의 사주풀이",
  openGraph: {
    title: "사주보는 두루미",
    description: "행운 배달부 두루미의 사주풀이",
    url: "https://durumi-saju.vercel.app",
    siteName: "사주보는 두루미",
    images: [
      {
        url: "https://durumi-saju.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "사주보는 두루미",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "사주보는 두루미",
    description: "행운 배달부 두루미의 사주풀이",
    images: ["https://durumi-saju.vercel.app/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
