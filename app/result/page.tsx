import { Suspense } from "react";
import ResultClient from "./ResultClient";
import { FullScreenLoading } from "@/components/loading";

export const dynamic = "force-dynamic";

const LOADING_STEPS = [
  { message: "결과를 불러오고 있어", delay: 0 },
];

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <FullScreenLoading
          steps={LOADING_STEPS}
          subMessage="잠깐이면 돼"
        />
      }
    >
      <ResultClient />
    </Suspense>
  );
}
