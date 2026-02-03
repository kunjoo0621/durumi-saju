import { Suspense } from "react";
import ResultClient from "./ResultClient";

export const dynamic = "force-dynamic";

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background-primary px-6">
          <div className="text-text-secondary text-body-2">결과를 불러오는 중...</div>
        </div>
      }
    >
      <ResultClient />
    </Suspense>
  );
}
