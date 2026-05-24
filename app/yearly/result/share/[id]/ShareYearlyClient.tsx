"use client";

import { useRouter } from "next/navigation";
import { YearlyResultBody } from "../../[id]/YearlyResultClient";
import type { YearlyResult } from "@/lib/yearly-prompt";

export default function ShareYearlyClient({ result }: { result: YearlyResult }) {
  const router = useRouter();
  return (
    <YearlyResultBody
      result={result}
      onBack={() => router.push("/yearly")}
      shareMode
    />
  );
}
