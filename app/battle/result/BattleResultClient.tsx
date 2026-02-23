"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { useBattleResult } from "@/store/useBattleStore";
import BattleRadarChart from "@/components/battle/BattleRadarChart";
import BattleVsCard from "@/components/battle/BattleVsCard";
import { GRADE_GLOWS } from "@/components/result/OverallGradeBadgeSlot";
import type { OverallGradeLabel } from "@/components/result/OverallGradeBadgeSlot";
import type { BattleResult, RelationshipType } from "@/types/battle";

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  lover: "연인",
  friend: "친구",
  colleague: "직장동료",
  family: "가족",
  other: "기타",
};

function intensityLabel(winsA: number, winsB: number): string {
  const diff = Math.abs(winsA - winsB);
  if (winsA === winsB) return "대등한 대결";
  if (diff >= 5) return "완전 압살";
  if (diff >= 3) return "압승";
  return "신승";
}

export default function BattleResultClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const battleResult = useBattleResult();
  const [result, setResult] = useState<BattleResult | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [shareText, setShareText] = useState("");
  const [dbError, setDbError] = useState(false);

  const battleId = searchParams.get("id");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/?returnTo=/battle");
      return;
    }

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
          } else if (battleResult) {
            setResult(battleResult);
          }
        })
        .catch((err) => {
          console.warn("[BATTLE_RESULT] DB 조회 실패, Zustand fallback:", err);
          setDbError(true);
          if (battleResult) {
            setResult(battleResult);
          }
        })
        .finally(() => setDbLoading(false));
      return;
    }

    if (battleResult) {
      setResult(battleResult);
    }
  }, [status, battleResult, router, battleId]);

  const handleShare = useCallback(async () => {
    if (!result) return;
    const { playerA, playerB, comparison } = result;
    const winnerName = comparison.overallWinner === "A" ? playerA.name
      : comparison.overallWinner === "B" ? playerB.name
      : null;
    const text = winnerName
      ? `[사주배틀] ${playerA.name} vs ${playerB.name} - ${winnerName}의 ${intensityLabel(comparison.winsA, comparison.winsB)}! (${comparison.winsA}:${comparison.winsB})`
      : `[사주배틀] ${playerA.name} vs ${playerB.name} - 대등한 대결! (${comparison.winsA}:${comparison.winsB})`;

    const url = typeof window !== "undefined" ? window.location.href : "";

    if (navigator.share) {
      try {
        await navigator.share({ title: "사주배틀 결과", text, url });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareText("복사됨!");
      setTimeout(() => setShareText(""), 2000);
    } catch {
      // clipboard failed silently
    }
  }, [result]);

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
  const isDraw = comparison.overallWinner === "draw";
  const winnerName = comparison.overallWinner === "A" ? playerA.name
    : comparison.overallWinner === "B" ? playerB.name
    : null;
  const loserName = comparison.overallWinner === "A" ? playerB.name
    : comparison.overallWinner === "B" ? playerA.name
    : null;

  const winnerGrade = (comparison.overallWinner === "A" ? playerA.tier.grade
    : comparison.overallWinner === "B" ? playerB.tier.grade
    : playerA.tier.grade) as OverallGradeLabel;
  const loserGrade = (comparison.overallWinner === "A" ? playerB.tier.grade
    : comparison.overallWinner === "B" ? playerA.tier.grade
    : playerB.tier.grade) as OverallGradeLabel;

  const winnerGlow = GRADE_GLOWS[winnerGrade] || GRADE_GLOWS.D;
  const loserGlow = GRADE_GLOWS[loserGrade] || GRADE_GLOWS.D;

  // Highlight category: max diff
  const highlightCategory = [...comparison.matches].sort((a, b) => b.diff - a.diff)[0]?.category;

  // Winner/Loser summaries
  const winnerSummary = comparison.overallWinner === "A" ? llmAnalysis.playerASummary
    : comparison.overallWinner === "B" ? llmAnalysis.playerBSummary
    : llmAnalysis.playerASummary;
  const loserSummary = comparison.overallWinner === "A" ? llmAnalysis.playerBSummary
    : comparison.overallWinner === "B" ? llmAnalysis.playerASummary
    : llmAnalysis.playerBSummary;

  // Winner/Loser scores for strength/weakness extraction
  const winnerScores = comparison.overallWinner === "A" ? playerA.scores
    : comparison.overallWinner === "B" ? playerB.scores
    : playerA.scores;
  const loserScores = comparison.overallWinner === "A" ? playerB.scores
    : comparison.overallWinner === "B" ? playerA.scores
    : playerB.scores;

  // Extract won/lost categories per player
  const winnerWonCategories = comparison.matches
    .filter((m) => m.winner === comparison.overallWinner)
    .map((m) => m.category);
  const winnerLostCategories = comparison.matches
    .filter((m) => m.winner !== comparison.overallWinner && m.winner !== "draw")
    .map((m) => m.category);
  const loserWonCategories = comparison.matches
    .filter((m) => m.winner !== comparison.overallWinner && m.winner !== "draw")
    .map((m) => m.category);
  const loserLostCategories = comparison.matches
    .filter((m) => m.winner === comparison.overallWinner)
    .map((m) => m.category);

  // For 0-win case: find least-bad category
  function leastBadCategory(scores: Record<string, number>, lostCats: string[]): string {
    if (lostCats.length === 0) return "";
    const sorted = lostCats.sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
    return `${sorted[0]}(${scores[sorted[0]]}점)`;
  }

  return (
    <div className="min-h-screen bg-background-primary text-text-primary animate-fadeIn">
      <Header showBack onBack={() => router.push("/menu")} />

      <main className="px-6 py-8">
        <div className="max-w-[640px] mx-auto space-y-6">

          {dbError && (
            <div className="rounded-xl bg-[#1A1A1A] px-4 py-3 text-[13px] text-gray-400 text-center">
              저장된 결과를 불러오지 못했습니다. 캐시된 데이터를 표시합니다.
            </div>
          )}

          {/* === 5-1. 헤더 판정 영역 === */}
          <div className="rounded-3xl bg-background-secondary p-6 md:p-8 text-center">
            <p className="text-[18px] font-aggro font-bold text-text-primary leading-tight mb-6">
              {llmAnalysis.headVerdict}
            </p>

            {/* Grade display */}
            <div className="flex justify-center items-center gap-6">
              {/* Player A / Winner side */}
              <div className="text-center flex flex-col items-center">
                <div className="relative flex items-center justify-center">
                  {(isDraw || comparison.overallWinner === "A") && (
                    <div
                      className="absolute -inset-6 rounded-full"
                      style={{ background: GRADE_GLOWS[playerA.tier.grade as OverallGradeLabel] || GRADE_GLOWS.D }}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`relative text-5xl font-aggro font-bold ${
                      isDraw ? "text-white/90" : comparison.overallWinner === "A" ? "text-white/90" : "text-white/50"
                    }`}
                  >
                    {playerA.tier.grade}
                  </span>
                </div>
                <div className="text-[13px] text-text-secondary mt-3">{playerA.name}</div>
              </div>

              {/* VS */}
              <span className="text-sm text-gray-500 font-medium">VS</span>

              {/* Player B / Loser side */}
              <div className="text-center flex flex-col items-center">
                <div className="relative flex items-center justify-center">
                  {(isDraw || comparison.overallWinner === "B") && (
                    <div
                      className="absolute -inset-6 rounded-full"
                      style={{ background: GRADE_GLOWS[playerB.tier.grade as OverallGradeLabel] || GRADE_GLOWS.D }}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`relative text-5xl font-aggro font-bold ${
                      isDraw ? "text-white/90" : comparison.overallWinner === "B" ? "text-white/90" : "text-white/50"
                    }`}
                  >
                    {playerB.tier.grade}
                  </span>
                </div>
                <div className="text-[13px] text-text-secondary mt-3">{playerB.name}</div>
              </div>
            </div>

            {/* 전적 */}
            <div className="mt-5 flex justify-center items-center gap-2">
              <span className={`text-xl font-bold ${isDraw ? "text-white" : comparison.overallWinner === "A" ? "text-white" : "text-gray-500"}`}>
                {playerA.name} {comparison.winsA}승
              </span>
              <span className="text-text-tertiary">:</span>
              <span className={`text-xl font-bold ${isDraw ? "text-white" : comparison.overallWinner === "B" ? "text-white" : "text-gray-500"}`}>
                {playerB.name} {comparison.winsB}승
              </span>
              {comparison.draws > 0 && (
                <span className="text-text-tertiary text-sm ml-1">(무 {comparison.draws})</span>
              )}
            </div>

            {/* 승패 강도 */}
            <div className="mt-2">
              <span className="text-2xl font-bold" style={{ color: "#FF6B6B" }}>
                {intensityLabel(comparison.winsA, comparison.winsB)}
              </span>
            </div>
          </div>

          {/* === 5-2. 카테고리별 대결 === */}
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

          {/* === 5-3. 레이더 차트 === */}
          <BattleRadarChart
            scoresA={playerA.scores}
            scoresB={playerB.scores}
            nameA={playerA.name}
            nameB={playerB.name}
          />

          {/* === 5-4. 심판 판결 === */}
          <div
            className="rounded-2xl overflow-hidden flex"
            style={{ backgroundColor: "#141414" }}
          >
            <div className="w-1 shrink-0" style={{ backgroundColor: "#FF6B6B" }} />
            <div className="p-6 flex-1">
              <h3 className="text-lg font-bold text-text-primary mb-4">두루미의 냉정한 판결</h3>
              <p className="text-base text-gray-300 leading-7">
                {llmAnalysis.overallComment}
              </p>
            </div>
          </div>

          {/* === 5-5. 냉정한 상성 진단 (신규, 하위호환) === */}
          {llmAnalysis.compatibilityAnalysis && (
            <div
              className="rounded-2xl overflow-hidden flex"
              style={{ backgroundColor: "#141414" }}
            >
              <div className="w-1 shrink-0" style={{ backgroundColor: "#FF3B2F" }} />
              <div className="p-6 flex-1">
                <h3 className="text-lg font-bold text-text-primary mb-4">
                  냉정한 상성 진단: {RELATIONSHIP_LABELS[relationshipType] || "기타"}
                </h3>
                <p className="text-base text-gray-300 leading-7">
                  {llmAnalysis.compatibilityAnalysis}
                </p>
              </div>
            </div>
          )}

          {/* === 5-6. 개인 요약 카드 === */}
          <div className="space-y-3">
            {isDraw ? (
              <>
                {/* Draw: equal display, no labels */}
                <PlayerSummaryCard
                  name={playerA.name}
                  summary={llmAnalysis.playerASummary}
                  wonCategories={comparison.matches.filter((m) => m.winner === "A").map((m) => m.category)}
                  lostCategories={comparison.matches.filter((m) => m.winner === "B").map((m) => m.category)}
                  scores={playerA.scores}
                  isDraw
                />
                <PlayerSummaryCard
                  name={playerB.name}
                  summary={llmAnalysis.playerBSummary}
                  wonCategories={comparison.matches.filter((m) => m.winner === "B").map((m) => m.category)}
                  lostCategories={comparison.matches.filter((m) => m.winner === "A").map((m) => m.category)}
                  scores={playerB.scores}
                  isDraw
                />
              </>
            ) : (
              <>
                {/* Winner first */}
                <PlayerSummaryCard
                  name={winnerName!}
                  summary={winnerSummary}
                  wonCategories={winnerWonCategories}
                  lostCategories={winnerLostCategories}
                  scores={winnerScores}
                  role="winner"
                />
                {/* Loser */}
                <PlayerSummaryCard
                  name={loserName!}
                  summary={loserSummary}
                  wonCategories={loserWonCategories}
                  lostCategories={loserLostCategories}
                  scores={loserScores}
                  role="loser"
                />
              </>
            )}
          </div>

          {/* === 5-7. CTA 영역 === */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleShare}
              className="w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none text-white transition-colors"
              style={{ backgroundColor: "#FF6B6B" }}
            >
              {shareText || "결과 공유로 도발하기"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/battle")}
              className="w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none border border-white/10 bg-background-secondary text-text-secondary hover:bg-background-secondary/80 transition-colors"
            >
              다른 상대와 재대결
            </button>
            <button
              type="button"
              onClick={() => router.push("/start")}
              className="w-full py-3 text-[14px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              내 상세 사주 보기
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function PlayerSummaryCard({
  name,
  summary,
  wonCategories,
  lostCategories,
  scores,
  role,
  isDraw,
}: {
  name: string;
  summary: string;
  wonCategories: string[];
  lostCategories: string[];
  scores: Record<string, number>;
  role?: "winner" | "loser";
  isDraw?: boolean;
}) {
  const isWinner = role === "winner";
  const isLoser = role === "loser";

  // For 0-win loser: "가장 덜 처참한" category
  const leastBad = isLoser && wonCategories.length === 0
    ? findLeastBad(scores, lostCategories)
    : null;

  return (
    <div className="rounded-2xl overflow-hidden flex" style={{ backgroundColor: "#141414" }}>
      {isWinner && <div className="w-1 shrink-0" style={{ backgroundColor: "#22C55E" }} />}
      <div className="p-5 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[15px] font-bold text-text-primary">{name}</span>
          {isWinner && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#22C55E20", color: "#22C55E" }}>
              승자
            </span>
          )}
          {isLoser && (
            <span className="text-[11px] font-medium text-gray-500">패자</span>
          )}
        </div>

        <p className="text-[14px] text-text-secondary leading-relaxed mb-3">{summary}</p>

        <div className="flex flex-wrap gap-2 text-[12px]">
          {wonCategories.length > 0 && (
            <span className="text-text-tertiary">
              강점: {wonCategories.join(", ")}
            </span>
          )}
          {isLoser && wonCategories.length === 0 && leastBad && (
            <span className="text-text-tertiary">
              가장 덜 처참한: {leastBad}
            </span>
          )}
          {lostCategories.length > 0 && !isDraw && (
            <span className="text-text-tertiary">
              {wonCategories.length > 0 ? " / " : ""}약점: {lostCategories.join(", ")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function findLeastBad(scores: Record<string, number>, lostCats: string[]): string {
  if (lostCats.length === 0) return "";
  const sorted = [...lostCats].sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
  return `${sorted[0]}(${scores[sorted[0]]}점)`;
}
