import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "사주 배틀 | 1:1 사주 대결 | 사주보는 두루미",
  description: "친구, 연인, 동료와 1:1 사주 대결. 5가지 운세 카테고리에서 누가 이길까?",
};

export default function BattleInputLayout({ children }: { children: React.ReactNode }) {
  return children;
}
