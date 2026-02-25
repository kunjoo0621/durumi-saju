"use client";

import ResultView from "@/components/result/ResultView";
import ShareCTA from "@/components/result/ShareCTA";
import type { AnalysisResult } from "@/store/useInputStore";
import type { SajuData } from "@/lib/utils/saju";

type Props = {
  result: AnalysisResult;
  sajuData: SajuData | null;
  unknownBirthTime: boolean;
  resultBirthYear: number;
};

export default function ShareResultClient({
  result,
  sajuData,
  unknownBirthTime,
  resultBirthYear,
}: Props) {
  return (
    <ResultView
      result={result}
      sajuData={sajuData}
      unknownBirthTime={unknownBirthTime}
      resultBirthYear={resultBirthYear}
      hidePersonalInfo
      headerBackTo="/"
      footer={<ShareCTA />}
    />
  );
}
