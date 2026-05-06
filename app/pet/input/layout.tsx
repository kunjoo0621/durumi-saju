import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "반려동물 궁합 | 사주보는 두루미",
  description: "우리 아이와 나의 사주 궁합을 분석해줄게. 강아지·고양이 모두 가능.",
};

export default function PetInputLayout({ children }: { children: React.ReactNode }) {
  return children;
}
