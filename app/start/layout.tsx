import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 사주 등급 확인 | 사주보는 두루미",
  description: "내 사주 등급은 S? A? 생년월일만 입력하면 사주팔자 등급을 알려줘.",
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
