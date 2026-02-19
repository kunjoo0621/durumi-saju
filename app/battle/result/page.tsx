import { Suspense } from "react";
import BattleResultClient from "./BattleResultClient";

export const dynamic = "force-dynamic";

export default function BattleResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background-primary px-6">
          <div className="text-text-secondary text-body-2">배틀 결과를 불러오는 중...</div>
        </div>
      }
    >
      <BattleResultClient />
    </Suspense>
  );
}
