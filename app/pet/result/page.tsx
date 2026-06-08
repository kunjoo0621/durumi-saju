import { Suspense } from "react";
import PetResultClient from "./PetResultClient";
import { FullScreenLoading } from "@/components/loading";

export const dynamic = "force-dynamic";

const LOADING_STEPS = [
  { message: "너와 우리 아이 사주 비교 중", delay: 0 },
  { message: "관계 신호 추출 중", delay: 1500 },
  { message: "두루미가 판정 작성 중", delay: 3000 },
];

export default function PetResultPage() {
  return (
    <Suspense
      fallback={
        <FullScreenLoading
          steps={LOADING_STEPS}
          subMessage="잠깐이면 돼"
        />
      }
    >
      <PetResultClient />
    </Suspense>
  );
}
