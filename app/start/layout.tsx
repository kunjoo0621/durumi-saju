import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 사주 등급 확인 | 사주보는 두루미",
  description: "내 사주 등급은 S? A? 사주팔자 등급 분석, 1,000원으로 확인해봐.",
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
