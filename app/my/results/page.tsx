"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import MenuDrawer from "../../MenuDrawer";
import { useStoreActions } from "@/store/useInputStore";
import OverallGradeBadgeSlot from "@/components/result/OverallGradeBadgeSlot";
import type { BattleListItem } from "@/types/battle";
import type { OverallGradeLabel } from "@/components/result/OverallGradeBadgeSlot";

type ResultItem = {
  id: string;
  name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  region: string | null;
  gender: string | null;
  calendar_type: "solar" | "lunar" | null;
  unlocked_at: string | null;
  created_at: string | null;
};

type Tab = "saju" | "battle";

const RELATIONSHIP_LABELS: Record<string, string> = {
  lover: "연인",
  friend: "친구",
  colleague: "동료",
  family: "가족",
  other: "기타",
};

export default function MyResultsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { reset } = useStoreActions();

  const [tab, setTab] = useState<Tab>("saju");

  // Saju results state
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Battle results state
  const [battles, setBattles] = useState<BattleListItem[]>([]);
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleError, setBattleError] = useState(false);
  const battleFetched = useRef(false);

  const fetchResults = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch("/api/results");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setFetchError(true);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBattles = useCallback(async () => {
    if (battleFetched.current) return;
    setBattleLoading(true);
    setBattleError(false);
    try {
      const res = await fetch("/api/battles");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBattles(Array.isArray(data.battles) ? data.battles : []);
      battleFetched.current = true;
    } catch {
      setBattleError(true);
      setBattles([]);
    } finally {
      setBattleLoading(false);
    }
  }, []);

  const retryBattles = useCallback(async () => {
    battleFetched.current = false;
    await fetchBattles();
  }, [fetchBattles]);

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    fetchResults();
  }, [session]);

  useEffect(() => {
    if (tab === "battle" && session?.user) {
      fetchBattles();
    }
  }, [tab, session, fetchBattles]);

  const formatBirthDate = (value: string | null) => {
    if (!value) return "";
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  };

  const handleAddAnother = () => {
    reset();
    router.push("/start");
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center px-5">
        <div className="text-text-secondary text-[14px]">불러오는 중...</div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col">
        <header className="px-6 py-5 sticky top-0 z-[100] bg-background-primary">
          <div className="max-w-[640px] mx-auto flex items-center justify-between">
            <div className="w-10" />
            <h1 className="text-title-3 text-text-primary font-aggro">사주보는 두루미</h1>
            <MenuDrawer />
          </div>
        </header>
        <main className="flex-1 px-5 pb-24 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-text-secondary">로그인하면 저장된 결과를 확인할 수 있어요.</p>
            <button
              onClick={() => signIn("kakao", { callbackUrl: "/menu" })}
              className="px-6 py-3 rounded-xl text-button-md bg-[#FEE500] text-black font-semibold"
            >
              카카오로 시작하기
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      <header className="px-6 py-5 sticky top-0 z-[100] bg-background-primary">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/menu")}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-primary hover:bg-background-secondary transition-colors"
            aria-label="메뉴로 돌아가기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-title-3 text-text-primary font-aggro">내 결과</h1>
          <MenuDrawer />
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-[640px] mx-auto w-full px-5">
        <div className="flex border-b border-white/10">
          <button
            type="button"
            onClick={() => setTab("saju")}
            className={`flex-1 py-3 text-center text-[14px] font-semibold transition-colors ${
              tab === "saju"
                ? "text-white border-b-2 border-[#FF6B6B]"
                : "text-gray-500"
            }`}
          >
            내 사주
          </button>
          <button
            type="button"
            onClick={() => setTab("battle")}
            className={`flex-1 py-3 text-center text-[14px] font-semibold transition-colors ${
              tab === "battle"
                ? "text-white border-b-2 border-[#FF6B6B]"
                : "text-gray-500"
            }`}
          >
            사주 배틀
          </button>
        </div>
      </div>

      <main className="flex-1 px-5 pb-24">
        <div className="max-w-[640px] mx-auto pt-6 space-y-4">
          {/* ===== 내 사주 탭 ===== */}
          {tab === "saju" && (
            <>
              {results.length > 0 && (
                <div className="space-y-3">
                  {results.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => router.push(`/result?resultId=${item.id}`)}
                      className="w-full bg-background-secondary rounded-xl p-4 text-left"
                    >
                      <div className="text-text-primary font-semibold text-[15px]">
                        {item.name || `사주 #${item.id.slice(0, 6)}`}
                      </div>
                      <div className="text-text-secondary text-[13px] mt-1">
                        {item.calendar_type === "lunar" ? "음력" : "양력"} {formatBirthDate(item.birth_date)}
                        {item.birth_time ? ` ${item.birth_time}` : ""}
                        {item.region ? ` · ${item.region}` : ""}
                        {item.gender ? ` · ${item.gender}` : ""}
                      </div>
                      <div className="text-text-tertiary text-[12px] mt-2">
                        {item.unlocked_at ? new Date(item.unlocked_at).toLocaleString() : "저장됨"}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.length > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-[12px] text-text-secondary">본인 동의가 있는 정보만 입력해 주세요</p>
                  <button
                    type="button"
                    onClick={handleAddAnother}
                    className="w-full h-[52px] rounded-xl bg-primary text-text-primary text-[15px] font-semibold"
                  >
                    다른 사람 사주 추가하기
                  </button>
                </div>
              )}

              {!fetchError && results.length === 0 && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    아직 사주를 본 적이 없어요.
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      type="button"
                      onClick={handleAddAnother}
                      className="w-full h-[52px] rounded-xl bg-primary text-text-primary text-[15px] font-semibold"
                    >
                      사주 보러가기
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/menu")}
                      className="w-full h-[52px] rounded-xl border border-white/10 bg-background-secondary text-text-secondary text-[15px] font-semibold"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}

              {fetchError && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    사주 내역을 불러오지 못했어요.
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      type="button"
                      onClick={fetchResults}
                      className="w-full h-[52px] rounded-xl bg-primary text-text-primary text-[15px] font-semibold"
                    >
                      다시 시도
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/menu")}
                      className="w-full h-[52px] rounded-xl border border-white/10 bg-background-secondary text-text-secondary text-[15px] font-semibold"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== 사주 배틀 탭 ===== */}
          {tab === "battle" && (
            <>
              {battleLoading && (
                <div className="pt-12 flex items-center justify-center">
                  <div className="text-text-secondary text-[14px]">불러오는 중...</div>
                </div>
              )}

              {!battleLoading && !battleError && battles.length > 0 && (
                <div className="space-y-3">
                  {battles.map((b) => {
                    const isWinnerA = b.overall_winner === "A";
                    const isWinnerB = b.overall_winner === "B";
                    const isDraw = b.overall_winner === "draw";

                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => router.push(`/battle/result?id=${b.id}`)}
                        className="w-full bg-background-secondary rounded-xl p-4 text-left"
                      >
                        {/* Names row */}
                        <div className="flex items-center justify-center gap-2">
                          <span
                            className={`text-[15px] font-semibold ${
                              isWinnerA ? "text-[#22C55E]" : isDraw ? "text-text-primary" : "text-gray-400"
                            }`}
                          >
                            {b.player_a_name}
                          </span>
                          <span className="text-xs text-gray-500">VS</span>
                          <span
                            className={`text-[15px] font-semibold ${
                              isWinnerB ? "text-[#22C55E]" : isDraw ? "text-text-primary" : "text-gray-400"
                            }`}
                          >
                            {b.player_b_name}
                          </span>
                        </div>

                        {/* Grade badges */}
                        <div className="flex items-center justify-center gap-6 mt-3">
                          <OverallGradeBadgeSlot
                            grade={b.player_a_grade as OverallGradeLabel}
                            size={40}
                          />
                          <OverallGradeBadgeSlot
                            grade={b.player_b_grade as OverallGradeLabel}
                            size={40}
                          />
                        </div>

                        {/* Record + intensity */}
                        <div className="text-center text-[13px] text-text-secondary mt-2">
                          {b.wins_a}승 {b.wins_b}패 {b.draws}무 · {b.overall_intensity}
                        </div>

                        {/* Relationship tag + date */}
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-[12px] text-text-tertiary px-2 py-0.5 rounded-full bg-white/5">
                            {RELATIONSHIP_LABELS[b.relationship_type] || "기타"}
                          </span>
                          <span className="text-[12px] text-text-tertiary">
                            {b.created_at ? new Date(b.created_at).toLocaleDateString() : ""}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {!battleLoading && !battleError && battles.length === 0 && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    아직 배틀 기록이 없어요.
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      type="button"
                      onClick={() => router.push("/battle")}
                      className="w-full h-[52px] rounded-xl bg-primary text-text-primary text-[15px] font-semibold"
                    >
                      배틀 시작하기
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/menu")}
                      className="w-full h-[52px] rounded-xl border border-white/10 bg-background-secondary text-text-secondary text-[15px] font-semibold"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}

              {!battleLoading && battleError && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    배틀 내역을 불러오지 못했어요.
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      type="button"
                      onClick={retryBattles}
                      className="w-full h-[52px] rounded-xl bg-primary text-text-primary text-[15px] font-semibold"
                    >
                      다시 시도
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/menu")}
                      className="w-full h-[52px] rounded-xl border border-white/10 bg-background-secondary text-text-secondary text-[15px] font-semibold"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
