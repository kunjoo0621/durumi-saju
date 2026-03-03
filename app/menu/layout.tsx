import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "사주 분석 메뉴 | 사주보는 두루미",
  description: "사주 등급 분석, 사주 배틀. 사주보는 두루미에서 시작해봐.",
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
