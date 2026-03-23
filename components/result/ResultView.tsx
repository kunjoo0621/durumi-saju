"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import SajuChart, { StrengthPanel } from "@/components/saju/SajuChart";
import ResultTable from "@/components/result/ResultTable";
import ShinsalBadges from "@/components/saju/ShinsalBadges";
import FortuneTimeline from "@/components/saju/FortuneTimeline";
import { enrichSajuData, type SajuData } from "@/lib/utils/saju";
import type { AnalysisResult } from "@/store/useInputStore";
import type { CalendarType } from "@/lib/utils/lunar";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

type ResultViewProps = {
  result: AnalysisResult;
  sajuData: SajuData | null;
  displayBirthDate?: string;
  displayCalendarType?: CalendarType;
  unknownBirthTime?: boolean;
  resultBirthYear?: number;
  birthYear?: string;
  hidePersonalInfo?: boolean;
  userName?: string;
  footer?: React.ReactNode;
  headerBackTo?: string;
  onBack?: () => void;
};

export default function ResultView({
  result,
  sajuData,
  displayBirthDate = "",
  displayCalendarType = "solar",
  unknownBirthTime = false,
  resultBirthYear = 0,
  birthYear = "",
  hidePersonalInfo = false,
  userName,
  footer,
  headerBackTo,
  onBack,
}: ResultViewProps) {
  const router = useRouter();
  const [wonguExpanded, setWonguExpanded] = useState(false);
  const wonguRef = useRef<HTMLDivElement>(null);

  const enriched = useMemo(() => {
    if (!sajuData) return null;
    return enrichSajuData(sajuData, { isTimeUnknown: unknownBirthTime });
  }, [sajuData, unknownBirthTime]);

  return (
    <div className="min-h-screen bg-background-primary animate-fadeIn">
      <Header
        showBack
        showBalance
        sticky
        onBack={onBack || (headerBackTo ? () => router.push(headerBackTo) : undefined)}
      />

      <main className="px-6 py-8">
        <div className="max-w-[640px] mx-auto space-y-6">
          {/* 내 사주 원국 */}
          {sajuData && (
            <div ref={wonguRef} className="bg-background-secondary rounded-3xl p-5 md:p-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">
                  {hidePersonalInfo
                    ? userName ? `${userName}님의 사주 원국` : "사주 원국"
                    : "내 사주 원국"}
                </h3>
                {!hidePersonalInfo && displayBirthDate && (
                  <span className="text-xs text-gray-500">
                    ({displayCalendarType === "lunar" ? "음력" : "양력"} {displayBirthDate} 기준)
                  </span>
                )}
              </div>

              <SajuChart sajuData={sajuData} enriched={enriched} hideStrengthPanel />

              {!wonguExpanded && (
                <button
                  onClick={() => setWonguExpanded(true)}
                  className="w-full bg-[#252525] text-sm font-medium text-gray-200 py-3 rounded-lg mt-10 transition-colors hover:bg-[#2A2A2A] active:bg-[#2A2A2A] flex items-center justify-center gap-1.5"
                >
                  상세 분석 보기
                  <CaretDown weight="bold" size={16} />
                </button>
              )}

              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{ gridTemplateRows: wonguExpanded ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  {enriched && <StrengthPanel enriched={enriched} />}
                  {result?.fortune && (resultBirthYear || Number(birthYear)) > 0 && (
                    <>
                      <div className="h-px bg-[#222222] my-8" />
                      <FortuneTimeline
                        fortune={result.fortune}
                        birthYear={resultBirthYear || Number(birthYear)}
                      />
                    </>
                  )}
                  {enriched?.shinsal && enriched.shinsal.matches.length > 0 && (
                    <>
                      <div className="h-px bg-[#222222] my-8" />
                      <ShinsalBadges matches={enriched.shinsal.matches} note={enriched.shinsal.meta?.note} />
                    </>
                  )}

                  <button
                    onClick={() => {
                      setWonguExpanded(false);
                      wonguRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="w-full bg-[#252525] text-sm font-medium text-gray-200 py-3 rounded-lg mt-8 transition-colors hover:bg-[#2A2A2A] active:bg-[#2A2A2A] flex items-center justify-center gap-1.5"
                  >
                    상세 분석 접기
                    <CaretUp weight="bold" size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <ResultTable result={result} locked={false} initialExpandedCount={1} />
        </div>
      </main>

      {footer}
    </div>
  );
}
