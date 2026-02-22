"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useKakaoLogin } from "@/hooks/useKakaoLogin";
import Image from "next/image";
import MenuDrawer from "../../MenuDrawer";
import { useStoreActions } from "@/store/useInputStore";
import { getGradeColor, getGradeBadge } from "@/lib/utils/grade-colors";
import type { BattleListItem } from "@/types/battle";

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
  grade: string | null;
  score: number | null;
};

type Tab = "saju" | "battle";

const RELATIONSHIP_LABELS: Record<string, string> = {
  lover: "연인",
  friend: "친구",
  colleague: "동료",
  family: "가족",
  other: "기타",
};

/* ── 날짜 포맷 ── */
function formatResultDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}.${date.getDate()}`;
  }
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

/* ── 스와이프 카드 ── */
function SwipeableCard({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);
  const isOpen = useRef(false);
  const [translateX, setTranslateX] = useState(0);

  const DELETE_WIDTH = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const diff = e.touches[0].clientX - startX.current;
    const base = isOpen.current ? -DELETE_WIDTH : 0;
    const next = Math.min(0, Math.max(-DELETE_WIDTH, base + diff));
    currentX.current = next;
    setTranslateX(next);
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (currentX.current < -DELETE_WIDTH / 2) {
      setTranslateX(-DELETE_WIDTH);
      isOpen.current = true;
    } else {
      setTranslateX(0);
      isOpen.current = false;
    }
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl">
      {/* 삭제 버튼 (뒤에 깔림) */}
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center text-white text-[14px] font-semibold bg-red-600"
        style={{ width: DELETE_WIDTH }}
      >
        삭제
      </button>
      {/* 카드 본체 */}
      <div
        className="relative z-10 bg-[#141414]"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging.current ? "none" : "transform 0.25s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

/* ── 삭제 확인 모달 ── */
function DeleteModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
      <div className="bg-[#1C1C1C] rounded-2xl p-6 mx-6 w-full max-w-[320px] text-center">
        <p className="text-text-primary text-[16px] font-semibold">
          결과를 삭제할까?
        </p>
        <p className="text-text-secondary text-[13px] mt-2">
          삭제하면 복구할 수 없어.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-[44px] rounded-xl bg-white/10 text-text-primary text-[14px] font-semibold"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-[44px] rounded-xl bg-red-600 text-white text-[14px] font-semibold"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 메인 페이지 ── */
export default function MyResultsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { login, signing } = useKakaoLogin();
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

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "saju" | "battle";
    id: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const endpoint =
        deleteTarget.type === "saju"
          ? `/api/results/${deleteTarget.id}`
          : `/api/battles/${deleteTarget.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error();

      if (deleteTarget.type === "saju") {
        setResults((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      } else {
        setBattles((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      }
    } catch {
      // 실패 시 무시 — 재시도 가능
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
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
        <header className="px-6 py-5 sticky top-0 z-[100] bg-[#0D0D0D]">
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
              onClick={() => login("/menu")}
              disabled={signing}
              className="px-6 py-3 rounded-xl text-button-md bg-[#FEE500] text-black font-semibold disabled:opacity-50"
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
      <header className="px-6 py-5 sticky top-0 z-[100] bg-[#0D0D0D]">
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
                  {results.map((item) => {
                    const gradeColor = item.grade ? getGradeColor(item.grade) : null;
                    const badgeSrc = item.grade ? getGradeBadge(item.grade) : null;
                    const dateStr = item.unlocked_at || item.created_at;

                    return (
                      <SwipeableCard
                        key={item.id}
                        onDelete={() => setDeleteTarget({ type: "saju", id: item.id })}
                      >
                        <button
                          type="button"
                          onClick={() => router.push(`/result?resultId=${item.id}`)}
                          className="w-full flex items-center gap-3 p-4 text-left active:bg-white/5 transition-colors"
                        >
                          {/* 배지 래퍼 */}
                          {badgeSrc && gradeColor ? (
                            <div
                              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: gradeColor.bg }}
                            >
                              <Image
                                src={badgeSrc}
                                alt={`${item.grade}등급`}
                                width={32}
                                height={32}
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white/5">
                              <span className="text-text-tertiary text-[14px]">?</span>
                            </div>
                          )}

                          {/* 텍스트 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-text-primary font-semibold text-[15px] truncate">
                                {item.name || `사주 #${item.id.slice(0, 6)}`}
                              </span>
                              <span className="text-text-tertiary text-[12px] flex-shrink-0 ml-2">
                                {dateStr ? formatResultDate(dateStr) : ""}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[13px]" style={{ color: gradeColor?.text || "#888" }}>
                                {item.grade ? `${item.grade}등급` : ""}
                                {item.grade && item.score != null ? " · " : ""}
                                {item.score != null ? `${item.score}점` : ""}
                              </span>
                              <svg className="w-4 h-4 text-text-tertiary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <div className="text-text-secondary text-[12px] mt-0.5">
                              {item.birth_date
                                ? `${item.birth_date.replace(/-/g, ".")}`
                                : ""}
                              {item.gender ? ` · ${item.gender}` : ""}
                            </div>
                          </div>
                        </button>
                      </SwipeableCard>
                    );
                  })}
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
                    아직 결과가 없어
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
                    const isDraw = b.overall_winner === "draw";
                    const winnerGrade = isDraw
                      ? b.player_a_grade
                      : isWinnerA
                        ? b.player_a_grade
                        : b.player_b_grade;
                    const winnerColor = getGradeColor(winnerGrade);
                    const winnerBadge = getGradeBadge(winnerGrade);
                    const dateStr = b.created_at;

                    return (
                      <SwipeableCard
                        key={b.id}
                        onDelete={() => setDeleteTarget({ type: "battle", id: b.id })}
                      >
                        <button
                          type="button"
                          onClick={() => router.push(`/battle/result?id=${b.id}`)}
                          className="w-full flex items-center gap-3 p-4 text-left active:bg-white/5 transition-colors"
                        >
                          {/* 승자 배지 */}
                          <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: winnerColor.bg }}
                          >
                            <Image
                              src={winnerBadge}
                              alt={`${winnerGrade}등급`}
                              width={32}
                              height={32}
                            />
                          </div>

                          {/* 텍스트 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-text-primary font-semibold text-[15px] truncate">
                                {b.player_a_name} vs {b.player_b_name}
                              </span>
                              <span className="text-text-tertiary text-[12px] flex-shrink-0 ml-2">
                                {dateStr ? formatResultDate(dateStr) : ""}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[13px] text-text-secondary">
                                {b.player_a_grade}등급 vs {b.player_b_grade}등급
                              </span>
                              <svg className="w-4 h-4 text-text-tertiary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <div className="text-text-secondary text-[12px] mt-0.5">
                              {RELATIONSHIP_LABELS[b.relationship_type] || "기타"}
                              {" · "}
                              {b.wins_a}:{b.wins_b}
                              {" "}
                              {b.overall_intensity}
                            </div>
                          </div>
                        </button>
                      </SwipeableCard>
                    );
                  })}
                </div>
              )}

              {!battleLoading && !battleError && battles.length === 0 && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    아직 배틀 기록이 없어
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      type="button"
                      onClick={() => router.push("/battle")}
                      className="w-full h-[52px] rounded-xl bg-primary text-text-primary text-[15px] font-semibold"
                    >
                      사주 배틀 하러가기
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

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
