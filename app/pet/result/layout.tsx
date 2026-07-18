import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "반려동물 궁합 결과 | 사주보는 두루미",
  description: "두루미가 본 너와 우리 아이의 사주 궁합 결과.",
  robots: { index: false, follow: false },
};

export default function PetResultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
