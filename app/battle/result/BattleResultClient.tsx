"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import MenuDrawer from "../../MenuDrawer";
import { useBattleResult } from "@/store/useBattleStore";
import BattleRadarChart from "@/components/battle/BattleRadarChart";
import BattleVsCard from "@/components/battle/BattleVsCard";
import OverallGradeBadgeSlot from "@/components/result/OverallGradeBadgeSlot";
import type { BattleResult } from "@/types/battle";

const COLOR_A = "#FF6B6B";
const COLOR_B = "#A855F7";

function overallVerdictStyle(winner: "A" | "B" | "draw") {
  if (winner === "A") return { border: `2px solid ${COLOR_A}40`, bg: `${COLOR_A}10` };
  if (winner === "B") return { border: `2px solid ${COLOR_B}40`, bg: `${COLOR_B}10` };
  return { border: "2px solid rgb(161 161 170 / 0.3)", bg: "rgb(161 161 170 / 0.05)" };
}

export default function BattleResultClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const battleResult = useBattleResult();
  const [result, setResult] = useState<BattleResult | null>(null);
  const [dbLoading, setDbLoading] = useState(false);

  const battleId = searchParams.get("id");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/?returnTo=/battle");
      return;
    }

    // If ?id= param exists, load from DB
    if (battleId) {
      setDbLoading(true);
      fetch(`/api/battles/${battleId}`)
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data) => {
          if (data.battle?.full_result) {
            setResult(data.battle.full_result as BattleResult);
          }
        })
        .catch(() => {
          // DB load failed — fall through to empty state
        })
        .finally(() => setDbLoading(false));
      return;
    }

    // Otherwise use Zustand store
    if (battleResult) {
      setResult(battleResult);
    }
  }, [status, battleResult, router, battleId]);

  if (dbLoading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center px-6">
        <div className="text-text-secondary text-[14px]">불러오는 중...</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center px-6">
        <p className="text-body-2 text-text-secondary mb-4">배틀 결과가 없습니다.</p>
        <button
          type="button"
          onClick={() => router.push("/battle")}
          className="btn-primary px-6 py-3 rounded-xl text-[14px] font-semibold"
        >
          배틀 시작하기
        </button>
      </div>
    );
  }

  const { playerA, playerB, comparison, llmAnalysis, relationshipType } = result;
  const verdictStyle = overallVerdictStyle(comparison.overallWinner);

  const winnerName = comparison.overallWinner === "A" ? playerA.name
    : comparison.overallWinner === "B" ? playerB.name
    : null;

  return (
    <div className="min-h-screen bg-background-primary text-text-primary animate-fadeIn">
      <header className="sticky top-0 z-[100] bg-background-primary px-6 py-5 border-b border-white/5">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/menu")}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-primary hover:bg-background-secondary transition-colors"
            aria-label="메뉴로"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-title-3 font-aggro">배틀 결과</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="px-6 py-8">
        <div className="max-w-[640px] mx-auto space-y-6">
          {/* Head Verdict */}
          <div
            className="rounded-3xl p-6 md:p-8 text-center"
            style={{ border: verdictStyle.border, backgroundColor: verdictStyle.bg }}
          >
            <p className="text-[20px] font-aggro font-bold text-text-primary leading-tight">
              {llmAnalysis.headVerdict}
            </p>
            <div className="mt-4 flex justify-center gap-6">
              <div className="text-center flex flex-col items-center">
                <OverallGradeBadgeSlot grade={playerA.tier.grade} size={64} />
                <div className="text-[13px] text-text-secondary mt-2">{playerA.name}</div>
                <div className="text-[12px] text-text-tertiary">상위 {playerA.tier.topPercent}%</div>
              </div>
              <div className="flex items-center">
                <span className="text-[18px] font-bold text-text-tertiary">VS</span>
              </div>
              <div className="text-center flex flex-col items-center">
                <OverallGradeBadgeSlot grade={playerB.tier.grade} size={64} />
                <div className="text-[13px] text-text-secondary mt-2">{playerB.name}</div>
                <div className="text-[12px] text-text-tertiary">상위 {playerB.tier.topPercent}%</div>
              </div>
            </div>
            <div className="mt-3 flex justify-center gap-3 text-[13px] text-text-secondary">
              <span>{playerA.name} {comparison.winsA}승</span>
              <span>/</span>
              <span>{playerB.name} {comparison.winsB}승</span>
              {comparison.draws > 0 && (
                <>
                  <span>/</span>
                  <span>무승부 {comparison.draws}</span>
                </>
              )}
            </div>
          </div>

          {/* Radar Chart */}
          <BattleRadarChart
            scoresA={playerA.scores}
            scoresB={playerB.scores}
            nameA={playerA.name}
            nameB={playerB.name}
          />

          {/* Category Cards */}
          <div>
            <h3 className="text-[16px] font-semibold text-text-primary mb-4">카테고리별 대결</h3>
            <BattleVsCard
              matches={comparison.matches}
              nameA={playerA.name}
              nameB={playerB.name}
              llmComments={llmAnalysis.categoryComments}
            />
          </div>

          {/* Overall Comment */}
          <div className="rounded-3xl bg-background-secondary p-6 md:p-8">
            <h3 className="text-[16px] font-semibold text-text-primary mb-4">심판 두루미의 판정</h3>
            <p className="text-body-2 text-text-secondary">
              {llmAnalysis.overallComment}
            </p>
          </div>

          {/* Player Summaries */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-background-secondary p-5">
              <div className="text-[12px] font-semibold mb-2" style={{ color: COLOR_A }}>{playerA.name}</div>
              <p className="text-[13px] text-text-secondary leading-relaxed">{llmAnalysis.playerASummary}</p>
            </div>
            <div className="rounded-2xl bg-background-secondary p-5">
              <div className="text-[12px] font-semibold mb-2" style={{ color: COLOR_B }}>{playerB.name}</div>
              <p className="text-[13px] text-text-secondary leading-relaxed">{llmAnalysis.playerBSummary}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => router.push("/battle")}
              className="btn-primary w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none"
            >
              다시 배틀하기
            </button>
            <button
              type="button"
              onClick={() => router.push("/menu")}
              className="w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none border border-white/10 bg-background-secondary text-text-secondary hover:bg-background-secondary/80 transition-colors"
            >
              메뉴로 돌아가기
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
