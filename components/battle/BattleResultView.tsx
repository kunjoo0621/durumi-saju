"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import SavePromptBanner from "@/components/SavePromptBanner";
import BattleHero from "@/components/battle/BattleHero";
import BattleVsCard from "@/components/battle/BattleVsCard";
import BattleRadarChart from "@/components/battle/BattleRadarChart";
// TODO: enriched 데이터 추가 후 복원
// import BattleSajuCompare from "@/components/battle/BattleSajuCompare";
import BattleCompatibility from "@/components/battle/BattleCompatibility";
import BattleDangerSignals from "@/components/battle/BattleDangerSignals";
import BattleFutureOutlook from "@/components/battle/BattleFutureOutlook";
import BattleFinalVerdict from "@/components/battle/BattleFinalVerdict";
import BattleUpsellCTA from "@/components/battle/BattleUpsellCTA";
import type { BattleResult } from "@/types/battle";

type BattleResultViewProps = {
  result: BattleResult;
  footer?: React.ReactNode;
  headerBackTo?: string;
  shareableId?: string | null;
  showSavePrompt?: boolean;
  saveBannerReturnTo?: string;
  dbError?: boolean;
};

export default function BattleResultView({
  result,
  footer,
  headerBackTo = "/menu",
  shareableId,
  showSavePrompt,
  saveBannerReturnTo,
  dbError,
}: BattleResultViewProps) {
  const router = useRouter();
  const [showToast, setShowToast] = useState(false);

  const { playerA, playerB, comparison, llmAnalysis } = result;

  const highlightCategory = [...comparison.matches].sort((a, b) => b.diff - a.diff)[0]?.category;

  const handleShare = useCallback(async () => {
    if (!shareableId) return;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${baseUrl}/battle/result/share/${shareableId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      // clipboard failed silently
    }
  }, [shareableId]);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary animate-fadeIn">
      <Header showBack sticky onBack={() => router.push(headerBackTo)} />

      <main className="px-6 py-8">
        <div className="max-w-[640px] mx-auto space-y-6">

          {dbError && (
            <div className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-[13px] text-gray-400 text-center">
              저장된 결과를 못 불러와서 임시 데이터를 보여주고 있어.
            </div>
          )}

          {showSavePrompt && saveBannerReturnTo && (
            <SavePromptBanner returnTo={saveBannerReturnTo} />
          )}

          {/* Section 1: Hero */}
          <BattleHero
            nameA={playerA.name}
            nameB={playerB.name}
            gradeA={playerA.tier.grade}
            gradeB={playerB.tier.grade}
            comparison={comparison}
            heroQuip={llmAnalysis.heroQuip || (llmAnalysis as any).heroComment || ""}
          />

          {/* Section 2: Category matchups + Radar chart (grouped like personal ResultTable) */}
          <div className="space-y-6">
            <div>
              <h3 className="text-title-3 text-text-primary font-semibold mb-4">카테고리별 대결</h3>
              <BattleVsCard
                matches={comparison.matches}
                nameA={playerA.name}
                nameB={playerB.name}
                llmComments={llmAnalysis.categoryComments}
                highlightCategory={highlightCategory}
              />
            </div>

            <BattleRadarChart
              scoresA={playerA.scores}
              scoresB={playerB.scores}
              nameA={playerA.name}
              nameB={playerB.name}
            />
          </div>

          {/* TODO: enriched 데이터 추가 후 복원 */}
          {/* <BattleSajuCompare nameA={playerA.name} nameB={playerB.name} /> */}

          {/* Section 5: Compatibility scenarios */}
          <BattleCompatibility compatibility={llmAnalysis.compatibility} />

          {/* Section 6: Danger signals */}
          <BattleDangerSignals dangerSignals={llmAnalysis.dangerSignals} />

          {/* Section 7: Future outlook */}
          <BattleFutureOutlook futureOutlook={llmAnalysis.futureOutlook} />

          {/* Section 8: Final verdict */}
          <BattleFinalVerdict finalVerdict={llmAnalysis.finalVerdict} />

          {/* Section 7: Upsell */}
          <BattleUpsellCTA nameA={playerA.name} nameB={playerB.name} />

          {/* Share + rematch buttons (only on result page, not share page) */}
          {shareableId && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleShare}
                className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-all duration-200"
              >
                결과 공유로 도발하기
              </button>
              <button
                type="button"
                onClick={() => router.push("/battle/input")}
                className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
              >
                다른 상대와 재대결
              </button>
            </div>
          )}
        </div>
      </main>

      {footer}

      {/* Clipboard toast */}
      <div
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 bg-background-tertiary text-text-primary px-4 py-2 rounded-lg text-[14px] shadow-lg transition-opacity duration-300 ${showToast ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        결과 링크가 복사되었어요
      </div>
    </div>
  );
}
