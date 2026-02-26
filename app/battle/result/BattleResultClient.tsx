"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import SavePromptBanner from "@/components/SavePromptBanner";
import { useBattleResult } from "@/store/useBattleStore";
import BattleHero from "@/components/battle/BattleHero";
import BattleVsCard from "@/components/battle/BattleVsCard";
import BattleRadarChart from "@/components/battle/BattleRadarChart";
import BattleSajuCompare from "@/components/battle/BattleSajuCompare";
import BattleCompatibility from "@/components/battle/BattleCompatibility";
import BattleFinalVerdict from "@/components/battle/BattleFinalVerdict";
import BattleUpsellCTA from "@/components/battle/BattleUpsellCTA";
import type { BattleResult } from "@/types/battle";

export default function BattleResultClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const battleResult = useBattleResult();
  const [result, setResult] = useState<BattleResult | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const battleId = searchParams.get("id");
  const claimParam = searchParams.get("claim") === "true";
  const [claimPending, setClaimPending] = useState(claimParam);

  // Guest claim after login
  const claimedRef = useRef(false);
  useEffect(() => {
    if (!claimPending || status !== "authenticated" || claimedRef.current) return;
    claimedRef.current = true;
    fetch("/api/results/claim", { method: "POST" })
      .then((res) => {
        if (res.ok) {
          setIsGuest(false);
          const url = new URL(window.location.href);
          url.searchParams.delete("claim");
          router.replace(url.pathname + url.search);
        }
      })
      .catch(() => {})
      .finally(() => setClaimPending(false));
  }, [claimPending, status, router]);

  // Load battle data
  useEffect(() => {
    if (claimPending) return;

    if (battleId) {
      setDbLoading(true);
      fetch(`/api/battles/${battleId}`)
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data) => {
          if (data.is_guest) setIsGuest(true);
          if (data.battle?.full_result) {
            setResult(data.battle.full_result as BattleResult);
          } else if (battleResult) {
            setResult(battleResult);
          }
        })
        .catch((err) => {
          console.warn("[BATTLE_RESULT] DB fetch failed, Zustand fallback:", err);
          setDbError(true);
          if (battleResult) setResult(battleResult);
        })
        .finally(() => setDbLoading(false));
      return;
    }

    if (battleResult) setResult(battleResult);
  }, [battleResult, router, battleId, claimPending]);

  // Share handler
  const handleShare = useCallback(async () => {
    if (!result) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      // clipboard failed silently
    }
  }, [result]);

  // Loading state
  if (dbLoading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center px-6">
        <div className="text-text-secondary text-[14px]">불러오는 중...</div>
      </div>
    );
  }

  // No result
  if (!result) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center px-6">
        <p className="text-body-2 text-text-secondary mb-4">배틀 결과가 없습니다.</p>
        <button
          type="button"
          onClick={() => router.push("/battle/input")}
          className="btn-primary px-6 py-3 rounded-xl text-[14px] font-semibold"
        >
          배틀 시작하기
        </button>
      </div>
    );
  }

  const { playerA, playerB, comparison, llmAnalysis, relationshipType } = result;

  // Highlight category (max score diff)
  const highlightCategory = [...comparison.matches].sort((a, b) => b.diff - a.diff)[0]?.category;

  return (
    <div className="min-h-screen bg-background-primary text-text-primary animate-fadeIn">
      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="px-6 py-8">
        <div className="max-w-[640px] mx-auto space-y-6">

          {dbError && (
            <div className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-[13px] text-gray-400 text-center">
              저장된 결과를 불러오지 못했습니다. 캐시된 데이터를 표시합니다.
            </div>
          )}

          {isGuest && <SavePromptBanner returnTo={`/battle/result${battleId ? `?id=${battleId}` : ""}`} />}

          {/* Section 1: Hero */}
          <BattleHero
            nameA={playerA.name}
            nameB={playerB.name}
            gradeA={playerA.tier.grade}
            gradeB={playerB.tier.grade}
            comparison={comparison}
            heroComment={llmAnalysis.heroComment}
          />

          {/* Section 2: Category matchups */}
          <div>
            <h3 className="text-[16px] font-semibold text-text-primary mb-4">카테고리별 대결</h3>
            <BattleVsCard
              matches={comparison.matches}
              nameA={playerA.name}
              nameB={playerB.name}
              llmComments={llmAnalysis.categoryComments}
              highlightCategory={highlightCategory}
            />
          </div>

          {/* Radar chart */}
          <BattleRadarChart
            scoresA={playerA.scores}
            scoresB={playerB.scores}
            nameA={playerA.name}
            nameB={playerB.name}
          />

          {/* Section 3: Saju compare (placeholder) */}
          <BattleSajuCompare nameA={playerA.name} nameB={playerB.name} />

          {/* Section 4: Compatibility scenarios */}
          <BattleCompatibility compatibility={llmAnalysis.compatibility} />

          {/* Section 5: Final verdict */}
          <BattleFinalVerdict finalVerdict={llmAnalysis.finalVerdict} />

          {/* CTA area */}
          <div className="space-y-3 pt-2">
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

          {/* Upsell */}
          <BattleUpsellCTA nameA={playerA.name} nameB={playerB.name} />
        </div>
      </main>

      {/* Clipboard toast */}
      <div
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 bg-background-tertiary text-text-primary px-4 py-2 rounded-lg text-[14px] shadow-lg transition-opacity duration-300 ${showToast ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        결과 링크가 복사되었어요
      </div>
    </div>
  );
}
