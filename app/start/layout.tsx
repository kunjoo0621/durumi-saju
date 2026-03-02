import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 사주 등급 확인 | 사주보는 두루미",
  description: "AI가 분석하는 사주팔자. 내 사주 등급은 S? A? 1,000원으로 확인해봐.",
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
