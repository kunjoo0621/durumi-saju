"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Header from "@/components/layout/Header";
import BattleHero from "@/components/battle/BattleHero";
import BattleCategorySwiper from "@/components/battle/BattleCategorySwiper";
import BattleCompatibility from "@/components/battle/BattleCompatibility";
import BattleSimulations from "@/components/battle/BattleSimulations";
import BattleFutureOutlook from "@/components/battle/BattleFutureOutlook";
import BattleFinalVerdict from "@/components/battle/BattleFinalVerdict";
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
  const [hasPrimaryResult, setHasPrimaryResult] = useState<boolean | null>(null);

  const { playerA, playerB, comparison, llmAnalysis } = result;

  useEffect(() => {
    if (!shareableId) return;
    fetch("/api/results/primary")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setHasPrimaryResult(!!data?.primaryResultId))
      .catch(() => setHasPrimaryResult(false));
  }, [shareableId]);

  // 결정타: 전체 승자가 이긴 카테고리 중 점수차 최대
  const highlightCategory = comparison.overallWinner === "draw"
    ? undefined
    : [...comparison.matches]
        .filter((m) => m.winner === comparison.overallWinner)
        .sort((a, b) => b.diff - a.diff)[0]?.category;

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

          {/* Section 1: Hero + Radar chart */}
          <BattleHero
            nameA={playerA.name}
            nameB={playerB.name}
            gradeA={playerA.tier.grade}
            gradeB={playerB.tier.grade}
            compositeA={playerA.tier.composite}
            compositeB={playerB.tier.composite}
            comparison={comparison}
            heroQuip={llmAnalysis.heroQuip || (llmAnalysis as any).heroComment || ""}
            scoresA={playerA.scores}
            scoresB={playerB.scores}
          />

          {/* Section 3: Category matchups (swiper) */}
          <div>
            <h3 className="text-title-3 text-text-primary font-semibold mb-4">카테고리별 대결</h3>
            <BattleCategorySwiper
              matches={comparison.matches}
              nameA={playerA.name}
              nameB={playerB.name}
              llmComments={llmAnalysis.categoryResults}
              highlightCategory={highlightCategory}
            />
          </div>

          {/* Section 4: Compatibility */}
          <BattleCompatibility chemistry={llmAnalysis.chemistry} relationshipType={result.relationshipType} />

          {/* Section 5: Simulations */}
          {llmAnalysis.simulations && llmAnalysis.simulations.length > 0 && (
            <BattleSimulations
              simulations={llmAnalysis.simulations}
              icons={result.simulationQuestions?.map((sq) => sq.icon)}
            />
          )}

          {/* Section 6: Future outlook */}
          <BattleFutureOutlook
            futureOutlook={llmAnalysis.futureOutlook}
            nameA={playerA.name}
            nameB={playerB.name}
          />

          {/* Section 6: Final verdict */}
          <BattleFinalVerdict
            finalVerdict={llmAnalysis.finalVerdict}
            nameA={playerA.name}
            nameB={playerB.name}
          />

          {/* Share + CTA buttons (only on result page, not share page) */}
          {shareableId && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleShare}
                className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-all duration-200"
              >
                결과 공유로 도발하기
              </button>
              {hasPrimaryResult === true && (
                <button
                  type="button"
                  onClick={() => router.push("/menu")}
                  className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                >
                  다른 사람과 대결하기
                </button>
              )}
              {hasPrimaryResult === false && (
                <button
                  type="button"
                  onClick={() => router.push("/start")}
                  className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                >
                  내 사주 보러가기
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {footer}

      {/* 게스트용 하단 스티키 카카오 로그인 CTA */}
      {showSavePrompt && saveBannerReturnTo && (
        <div className="fixed inset-x-0 bottom-0 z-[130] border-t border-white/10 bg-black/45 px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] backdrop-blur-xl">
          <div className="max-w-[640px] mx-auto">
            <p className="text-[12px] text-white/78 text-center mb-2">
              지금 로그인하면 결과가 계속 저장돼
            </p>
            <button
              type="button"
              onClick={() =>
                signIn("kakao", { callbackUrl: `${saveBannerReturnTo}${saveBannerReturnTo.includes("?") ? "&" : "?"}claim=true` })
              }
              className="w-full h-[54px] rounded-xl bg-[#FEE500] text-black text-[15px] font-semibold flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="text-black">
                <path
                  d="M12 4c-5.06 0-9 3.15-9 7.03 0 2.47 1.54 4.63 3.9 5.87l-.7 3.06a.5.5 0 0 0 .75.54l3.56-2.26c.5.07 1.02.1 1.55.1 5.06 0 9-3.15 9-7.03S17.06 4 12 4z"
                  fill="currentColor"
                />
              </svg>
              카카오로 저장하기
            </button>
          </div>
        </div>
      )}

      {/* Clipboard toast */}
      <div
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[150] bg-background-tertiary text-text-primary px-4 py-2 rounded-lg text-[14px] shadow-lg transition-opacity duration-300 ${showToast ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        결과 링크가 복사되었어요
      </div>
    </div>
  );
}
