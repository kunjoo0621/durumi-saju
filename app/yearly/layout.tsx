import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "올해의 운세 | 사주보는 두루미",
  description: "내 사주 위에 올해 세운이 얹혀 만들어진 한 해 한정 운세를 풀어준다.",
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
