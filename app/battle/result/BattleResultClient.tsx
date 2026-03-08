"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useBattleResult } from "@/store/useBattleStore";
import BattleResultView from "@/components/battle/BattleResultView";
import type { BattleResult } from "@/types/battle";
import { FullScreenLoading } from "@/components/loading";

export default function BattleResultClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const battleResult = useBattleResult();
  const [result, setResult] = useState<BattleResult | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

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
  }, [claimPending, status]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [battleResult, battleId, claimPending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loading state
  if (dbLoading) {
    return <FullScreenLoading message="불러오는 중..." />;
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

  return (
    <BattleResultView
      result={result}
      shareableId={battleId}
      showSavePrompt={isGuest}
      saveBannerReturnTo={`/battle/result${battleId ? `?id=${battleId}` : ""}`}
      dbError={dbError}
    />
  );
}
