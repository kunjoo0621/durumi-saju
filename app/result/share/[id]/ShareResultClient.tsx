"use client";

import ResultView from "@/components/result/ResultView";
import ShareCTA from "@/components/result/ShareCTA";
import type { AnalysisResult } from "@/store/useInputStore";
import type { SajuData } from "@/lib/utils/saju";
import type { EnrichedSajuData } from "@/lib/utils/saju-enrichment";

type Props = {
  result: AnalysisResult;
  sajuData: SajuData | null;
  /** 서버가 계산해 내려준 enrichment. 화면에서 다시 계산하지 않는다(D-14). */
  enriched?: EnrichedSajuData | null;
  unknownBirthTime: boolean;
  resultBirthYear: number;
  userName?: string;
};

export default function ShareResultClient({
  result,
  sajuData,
  enriched = null,
  unknownBirthTime,
  resultBirthYear,
  userName,
}: Props) {
  return (
    <ResultView
      result={result}
      sajuData={sajuData}
      enriched={enriched}
      unknownBirthTime={unknownBirthTime}
      resultBirthYear={resultBirthYear}
      hidePersonalInfo
      userName={userName}
      headerBackTo="/"
      footer={<ShareCTA />}
    />
  );
}
