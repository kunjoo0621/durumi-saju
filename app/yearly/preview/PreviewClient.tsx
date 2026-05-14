"use client";

import { useRouter } from "next/navigation";
import { YearlyResultBody } from "../result/[id]/YearlyResultClient";
import type { YearlyResult } from "@/lib/yearly-prompt";

type Props = {
  result: YearlyResult;
};

export default function PreviewClient({ result }: Props) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background-primary">
      {/* dev 배지 */}
      <div className="bg-amber-500/10 border-b border-amber-500/30 text-center py-1.5">
        <span className="text-[11px] font-semibold text-amber-500">
          dev preview — 결제·DB 없이 정적 JSON 렌더링
        </span>
      </div>
      <YearlyResultBody result={result} onBack={() => router.push("/menu")} />
    </div>
  );
}
